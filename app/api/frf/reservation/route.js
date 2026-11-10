import { NextResponse } from 'next/server';
import { prisma } from '../../../../prisma/prisma';
import { jwtVerify } from 'jose';
import { logActivity } from '../../../lib/logger';
// import { writeFile, mkdir } from 'fs/promises';
// import path from 'path';

import {
  sendFRFApprovalToRequestor,
  sendFRFApprovalToNextDepartments,
  getDepartmentHeads,
  sendFRFRescheduleNotification,
  sendFRFAssignmentToStaff,
  sendFRFCompletionNotification
} from '../../../lib/email_notification';
import bcrypt from 'bcrypt';

import { put, del } from '@vercel/blob';


// ==========================================
// PASSWORD VERIFICATION HELPER
// ==========================================
async function verifyPassword(plainPassword, storedHash, userId) {
  if (storedHash && storedHash.startsWith('$2b$')) {
    return await bcrypt.compare(plainPassword, storedHash);
  }
  const matches = (plainPassword === storedHash);
  if (matches && userId) {
    const hashed = await bcrypt.hash(plainPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashed }
    });
  }
  return matches;
}

// ==========================================
// HELPERS
// ==========================================
async function getAuthenticatedUser(request) {
  const cookieHeader = request.headers.get('cookie') || '';
  if (!cookieHeader) return null;

  const cookieParts = cookieHeader.split(';').map((c) => c.trim());
  const sessionCookie = cookieParts.find((c) => c.startsWith('session_token='));
  if (!sessionCookie) return null;

  const token = sessionCookie.split('=')[1];
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    const userId = payload?.id ? String(payload.id) : null;
    if (!userId) return null;
    return await prisma.user.findUnique({ where: { id: userId } });
  } catch (err) {
    console.error('JWT verification failed:', err);
    return null;
  }
}

// At the top of route.js, after imports
async function validateMultiPurposeHallLimit(datesArray, attendeesCount) {
  if (attendeesCount <= 200) return null; // no issue

  // Find the Multi-Purpose Hall 2/F ID once
  const hall = await prisma.eventPlace.findFirst({
    where: { name: 'Multi-Purpose Hall 2/F' },
    select: { id: true },
  });
  const hallId = hall?.id;

  for (const entry of datesArray) {
    const isMpHall =
      (entry.placeId && entry.placeId === hallId) ||
      (entry.placeOther && entry.placeOther.trim() === 'Multi-Purpose Hall 2/F');
    if (isMpHall && attendeesCount > 200) {
      return 'Multi-Purpose Hall 2/F has a maximum capacity of 200 attendees.';
    }
  }
  return null;
}

function isHeadOrOIC(user) {
  if (!user) return false;
  
  // 1. Check by role
  const role = user.role?.toUpperCase();
  if (role === 'DEPARTMENTHEAD' || role === 'DEPARTMENT_HEAD') {
    return true;
  }
  
  // 2. Check OIC dates (if provided)
  if (user.oic_start && user.oic_end) {
    try {
      const now = new Date();
      const start = new Date(user.oic_start);
      const end = new Date(user.oic_end);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && now >= start && now <= end) {
        return true;
      }
    } catch (e) {
      // ignore invalid date strings
    }
  }
  
  return false;
}

function isSuperUser(user) {
  return user?.role === 'SuperUser';
}

function isStaff(user) {
  if (!user) return false;
  const role = user.role?.toUpperCase();
  return role === 'STAFF' || role === 'FACULTY';
}

function validateItoHeadAssignments(user, isVenueOnly, isDraft, assignments) {
  const isItoHeadRequestor =
    user.departmentCode === 'ITO-MAIN' && isHeadOrOIC(user);
  if (!isItoHeadRequestor) return null;
  if (isVenueOnly) return null;
  if (isDraft) return null; // drafts can be empty
  if (Array.isArray(assignments) && assignments.length > 0) return null;
  return 'ITO-MAIN head/OIC must assign at least one ITO staff member before submitting';
}

async function persistAssignments(tx, reservationId, assignments) {
  if (!assignments || assignments.length === 0) return;
  for (const a of assignments) {
    if (!a.userId || !a.dutyStart || !a.dutyEnd || !a.dutyType) {
      throw new Error('Invalid assignment payload — userId, dutyStart, dutyEnd, dutyType required');
    }
    const staff = await tx.user.findUnique({ where: { id: a.userId } });
    if (!staff || (staff.departmentCode !== 'ITO-MAIN' && staff.departmentCode !== 'ITO')) {
      throw new Error(`Staff ${a.userId} not found or not in ITO department`);
    }
    await tx.facilityAssignment.create({
      data: {
        reservationId,
        userId: a.userId,
        dutyStart: new Date(a.dutyStart),
        dutyEnd: new Date(a.dutyEnd),
        dutyType: a.dutyType,
        notes: a.notes || null,
        isOvertime: !!a.isOvertime,
      },
    });
  }
}

function getApprovalSequence(type, hasLedWall, hasCDOEquipment = false, hasITOEquipment = true) {

  const sequence = ['PSMO/FMO'];

  if (hasLedWall) {
    sequence.push('OP');
  }

  if (type === 'WITH_STUDENTS') {
    sequence.push('OSA');
  }

  if (hasCDOEquipment) {
    sequence.push('CDO');
  }

  sequence.push('OCM', 'SAFETY-SECURITY');

  if (hasITOEquipment || hasLedWall) {
    sequence.push('ITO-MAIN');
  }

  return [...new Set(sequence)];
}

// ==========================================
// GET /api/frf/reservation
// ==========================================
export async function GET(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const department = searchParams.get('department');
    const status = searchParams.get('status');
    const mine = searchParams.get('mine') === 'true';
    const search = searchParams.get('search');

    const where = {};

    if (department) {
      where.approvals = {
        some: {
          departmentCode: department,
          status: 'PENDING'
        }
      };
    }

    if (status) {
      where.status = status;
    }

    if (mine) {
      where.requestorId = user.id;
    }

    if (search) {
      where.OR = [
        { referenceId: { contains: search, mode: 'insensitive' } },
      ];
    }

    const reservations = await prisma.facilityReservation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        requestor: {
          select: {
            id: true,
            fname: true,
            lname: true,
            email: true,
            departmentCode: true
          }
        },
        dates: {
          orderBy: { date: 'asc' },
          include: {
            place: true,
          }
        },
        approvals: {
          orderBy: { stepOrder: 'asc' },
          include: {
            performedBy: {
              select: {
                fname: true,
                lname: true,
              },
            },
          },
        },
        equipmentRequests: {
          include: { equipment: true }
        },
        assignments: {
          include: {
            user: {
              select: {
                id: true,
                fname: true,
                lname: true,
                email: true
              }
            }
          }
        },
        packUpDoneBy: {
          select: { id: true, fname: true, lname: true, email: true, departmentCode: true }
        },
      }
    });

    return NextResponse.json({ success: true, data: reservations });
  } catch (error) {
    console.error('GET Reservation Error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch reservations' },
      { status: 500 }
    );
  }
}

// ==========================================
// POST /api/frf/reservation
// ==========================================
export async function POST(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();

    const eventName = formData.get('eventName') || null;
    const type = formData.get('type');
    const attendeesCount = parseInt(formData.get('attendeesCount')) || 0;
    const usageHours = parseFloat(formData.get('usageHours')) || null;
    const withCharge = formData.get('withCharge') === 'true';
    const isDraft = formData.get('isDraft') === 'true'; 
    const requestorNotes = formData.get('requestorNotes') || null;
    const equipmentItems = JSON.parse(formData.get('equipmentItems') || '[]');
    const datesArray = JSON.parse(formData.get('dates') || '[]');

    const assignmentsRaw = formData.get('assignments');
    let submittedAssignments = [];
    try {
      submittedAssignments = assignmentsRaw ? JSON.parse(assignmentsRaw) : [];
    } catch {
      return NextResponse.json({ success: false, message: 'Invalid assignments payload' }, { status: 400 });
    }

    const capacityError = await validateMultiPurposeHallLimit(datesArray, attendeesCount);
    if (capacityError) {
      return NextResponse.json({ success: false, message: capacityError }, { status: 400 });
    }

    if (!datesArray || datesArray.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'At least one date is required'
      }, { status: 400 });
    }

    for (const entry of datesArray) {
      const setup = new Date(entry.setupTime);
      const start = new Date(entry.eventStart);
      const end = new Date(entry.eventEnd);
      const teardown = new Date(entry.teardownTime);

      if (setup.getTime() + 3600000 > start.getTime()) {
        return NextResponse.json({
          success: false,
          message: 'Starting time must be at least 1 hour before Actual Time Start'
        }, { status: 400 });
      }
      if (end.getTime() > teardown.getTime()) {
        return NextResponse.json({
          success: false,
          message: 'Time End must be before or equal to Actual Time End'
        }, { status: 400 });
      }
    }

    // ==========================================
    // EVENT LIMIT VALIDATION
    // ==========================================
    const venueIds = datesArray.map(entry => entry.placeId).filter(Boolean);
    const limitErrors = await validateEventLimit(datesArray, venueIds);
    if (limitErrors.length > 0) {
      return NextResponse.json({
        success: false,
        message: limitErrors.join(' ')
      }, { status: 409 });
    }

    // ==========================================
    // ✅ DETECT LED WALL AND CDO EQUIPMENT
    // ==========================================
    const equipmentIds = equipmentItems.map(item => item.equipmentId || item.id);
    let hasLedWall = false;
    let hasCDOEquipment = false;
    let hasITOEquipment = false;

    if (equipmentIds.length > 0) {
      const equipmentList = await prisma.equipment.findMany({
        where: { id: { in: equipmentIds } },
        select: { id: true, name: true, departmentCode: true }
      });
      hasLedWall = equipmentList.some(eq =>
        eq.name === 'LED Wall' || eq.name === 'LED_WALL' || eq.name === 'LED_Wall'
      );
      hasCDOEquipment = equipmentList.some(eq => eq.departmentCode === 'CDO');
      hasITOEquipment = equipmentList.some(eq => eq.departmentCode === 'ITO-MAIN');

      console.log('Equipment list:', equipmentList);
      console.log('hasCDOEquipment:', hasCDOEquipment);
    }


    // Generate reference ID
    const currentYear = new Date().getFullYear();
    const count = await prisma.facilityReservation.count({
      where: {
        createdAt: { gte: new Date(`${currentYear}-01-01`) }
      }
    });
    const referenceId = `FRF-${user.departmentCode}-${currentYear}-${String(count + 1).padStart(4, '0')}`;

    // Process attachments
    // const files = formData.getAll('attachments');
    // const attachmentPaths = [];
    // if (files && files.length > 0) {
    //   const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'frf');
    //   await mkdir(uploadDir, { recursive: true });
    //   for (const file of files) {
    //     if (file && file.size > 0 && typeof file.arrayBuffer === 'function') {
    //       const bytes = await file.arrayBuffer();
    //       const buffer = Buffer.from(bytes);
    //       const cleanFilename = `${Date.now()}-${Math.floor(Math.random() * 1000)}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
    //       await writeFile(path.join(uploadDir, cleanFilename), buffer);
    //       attachmentPaths.push(`/uploads/frf/${cleanFilename}`);
    //     }
    //   }
    // }

    // Process attachments – Vercel Blob
    const files = formData.getAll('attachments');
    const attachmentPaths = [];
    if (files && files.length > 0) {
      for (const file of files) {
        if (file && file.size > 0) {
          const cleanFilename = `frf/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
          const blob = await put(cleanFilename, file, {
            access: 'public',
            addRandomSuffix: true,
            token: process.env.DMSBLOB_READ_WRITE_TOKEN,
            storeId: process.env.DMSBLOB_STORE_ID
          });
          attachmentPaths.push(blob.url);
        }
      }
    }

    // ==========================================
    // ✅ BUILD APPROVAL SEQUENCE WITH CDO CONDITION
    // ==========================================
    const isVenueOnly = formData.get('isVenueOnly') === 'true';
    const isRequestorHead = isHeadOrOIC(user);

    const assignmentError = validateItoHeadAssignments(user, isVenueOnly, isDraft, submittedAssignments);
    if (assignmentError) {
      return NextResponse.json({ success: false, message: assignmentError }, { status: 400 });
    }

    // 🆕 Drafts skip approval creation entirely — approvals added on submit-draft
    const approvals = [];
    if (!isDraft) {
      const approvalSequence = getApprovalSequence(type, hasLedWall, hasCDOEquipment, hasITOEquipment)
        .filter(dept => dept !== user.departmentCode);

      const finalApprovalSequence = isVenueOnly
        ? approvalSequence.filter(dept => dept !== 'ITO-MAIN')
        : approvalSequence;

      approvals.push({
        departmentCode: user.departmentCode,
        stepOrder: 1,
        status: isRequestorHead ? 'APPROVED' : 'PENDING',
        ...(isRequestorHead && {
          performedById: user.id,
          performedAt: new Date(),
        }),
      });

      finalApprovalSequence.forEach((dept, index) => {
        approvals.push({
          departmentCode: dept,
          stepOrder: 2 + index,
          status: 'PENDING'
        });
      });
    }

    // finalApprovalSequence.forEach((dept, index) => {
    //   approvals.push({
    //     departmentCode: dept,
    //     stepOrder: 2 + index,
    //     status: 'PENDING'
    //   });
    // });

    // Create reservation with multiple dates
    const reservation = await prisma.facilityReservation.create({
      data: {
        referenceId,
        eventName,
        requestorId: user.id,
        requestorDept: user.departmentCode,
        type,
        attendeesCount,
        usageHours,
        withCharge,
        requestorNotes: requestorNotes || undefined,
        attachments: attachmentPaths,
        status: isDraft ? 'DRAFT' : 'PENDING_APPROVAL',
        ...(approvals.length > 0 ? { approvals: { create: approvals } } : {}),
        equipmentRequests: {
          create: equipmentItems.map(item => ({
            equipmentId: item.equipmentId || item.id,
            quantityRequested: item.quantity || 1
          }))
        },
        dates: {
          create: datesArray.map(entry => ({
            date: new Date(entry.date),
            setupTime: new Date(entry.setupTime),
            eventStart: new Date(entry.eventStart),
            eventEnd: new Date(entry.eventEnd),
            teardownTime: new Date(entry.teardownTime),
            placeId: entry.placeId || undefined,
            placeOther: entry.placeOther || undefined,
          }))
        },
        isVenueOnly: isVenueOnly
      },
      include: {
        approvals: true,
        requestor: true,
        equipmentRequests: {
          include: { equipment: true },
        },
        dates: {
          include: { place: true },
        },
      },
    });

    const needsEquipmentReservation = !isDraft && equipmentItems.length > 0;
    const needsAssignmentCreation = submittedAssignments.length > 0;

    if (needsEquipmentReservation || needsAssignmentCreation) {
      try {
        await prisma.$transaction(async (tx) => {
          if (needsEquipmentReservation) {
            for (const item of equipmentItems) {
              const equipmentId = item.equipmentId || item.id;
              const eq = await tx.equipment.findUnique({
                where: { id: equipmentId },
                select: { isSingleItem: true, quantityAvailable: true, quantityReserved: true, name: true }
              });
              if (!eq) continue;
              const qty = eq.isSingleItem ? 1 : (item.quantity || 1);
              const trulyAvailable = eq.quantityAvailable - eq.quantityReserved;
              if (trulyAvailable < qty) {
                throw new Error(`Not enough stock for ${eq.name}. Available: ${trulyAvailable}, requested: ${qty}.`);
              }
              await tx.equipment.update({
                where: { id: equipmentId },
                data: { quantityReserved: { increment: qty } }
              });
            }
          }
          if (needsAssignmentCreation) {
            await persistAssignments(tx, reservation.id, submittedAssignments);
          }
        });
      } catch (reserveErr) {
        await prisma.facilityReservation.delete({ where: { id: reservation.id } });
        console.error('Reservation side-effects failed:', reserveErr);
        return NextResponse.json(
          { success: false, message: reserveErr.message || 'Failed to create reservation' },
          { status: 409 }
        );
      }
    }

    // After creating the reservation (inside POST)
    if (!isDraft) {  // 🆕 no notifications for draft saves
        try {
          const firstApproval = reservation.approvals
            .filter(a => a.status === 'PENDING')
            .sort((a, b) => a.stepOrder - b.stepOrder)[0];
          if (firstApproval) {
            const nextDeptHeads = await getDepartmentHeads(firstApproval.departmentCode);
            if (nextDeptHeads.length > 0) {
            await sendFRFApprovalToNextDepartments(nextDeptHeads, reservation, user.departmentCode);
            const nextUsers = await prisma.user.findMany({
              where: {
                departmentCode: firstApproval.departmentCode,
                OR: [
                  { role: 'DepartmentHead' },
                  {
                    oic_start: { lte: new Date().toISOString() },
                    oic_end: { gte: new Date().toISOString() }
                  }
                ]
              },
              select: { id: true }
            });
            for (const u of nextUsers) {
              await prisma.notification.create({
                data: {
                  title: 'FRF Pending Approval',
                  message: `New FRF ${reservation.referenceId} needs your approval.`,
                  isRead: false,
                  recipientId: u.id,
                  senderId: user.id,
                  // 🆕 Routing metadata
                  linkUrl: `/dashboard/forms/frf?tab=pending_approval&focus=${reservation.id}`,
                  entityType: 'FRF',
                  entityId: reservation.id,
                }
              });
            }
          }
        }
      } catch (notifErr) {
        console.error('POST notification error:', notifErr);
      }
    }

    await logActivity({
      req: request,
      userId: user.id,
      email: user.email,
      action: isDraft ? 'FRF_CREATE_DRAFT' : 'FRF_CREATE',
      details: JSON.stringify({
        referenceId,
        type,
        datesCount: datesArray.length,
        approvals: approvals.map(a => a.departmentCode)
      })
    });

    return NextResponse.json({ success: true, data: reservation }, { status: 201 });

  } catch (error) {
    console.error('POST Reservation Error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to create reservation' },
      { status: 500 }
    );
  }
}

// ==========================================
// PATCH /api/frf/reservation
// ==========================================
export async function PATCH(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const action = formData.get('action');
      const id = formData.get('id');
      const password = formData.get('password');

      if (!id) {
        return NextResponse.json(
          { success: false, message: 'Reservation ID is required' },
          { status: 400 }
        );
      }

      // 🆕 save-draft is a low-friction autosave-like action — no password needed.
      // The requestor is already verified via JWT + requestorId check inside the save-draft block.
      const requiresPassword = action !== 'save-draft';

      if (requiresPassword) {
        if (!password) {
          return NextResponse.json(
            { success: false, message: 'Password is required for this action' },
            { status: 400 }
          );
        }
        const passwordValid = await verifyPassword(password, user.password, user.id);
        if (!passwordValid) {
          return NextResponse.json(
            { success: false, message: 'Invalid password' },
            { status: 403 }
          );
        }
      }

      // ==========================================
      // 🆕 PACK UP DONE (with optional photos)
      // ==========================================
      if (action === 'packup-done') {
        const remarks = formData.get('remarks') || '';
        const files = formData.getAll('packUpPhotos');

      const reservation = await prisma.facilityReservation.findUnique({
        where: { id },
        include: {
          approvals: {
            orderBy: { stepOrder: 'asc' },
            include: {
              performedBy: { select: { fname: true, lname: true } }
            }
          },
          requestor: true,
          dates: {
            include: {
              place: true,
            },
          },
          equipmentRequests: {
            include: {
              equipment: true,
            },
          },
          assignments: {
            include: {
              user: {
                select: { id: true, fname: true, lname: true, email: true },
              },
            },
          },
        }
      });

        if (!reservation) {
          return NextResponse.json({ success: false, message: 'Reservation not found' }, { status: 404 });
        }

        // 1. Reservation must be COMPLETED
        if (reservation.status !== 'COMPLETED') {
          return NextResponse.json(
            { success: false, message: 'Pack Up Done is only available for completed reservations' },
            { status: 400 }
          );
        }

        // 2. Not yet marked
        if (reservation.packUpDoneAt) {
          return NextResponse.json(
            { success: false, message: 'Pack Up Done has already been recorded for this reservation' },
            { status: 400 }
          );
        }

        // 3. Permission
        const isAssigned = reservation.assignments.some(a => a.userId === user.id);
        const isITOHeadOrOIC = user.departmentCode === 'ITO-MAIN' && isHeadOrOIC(user);
        const isSuper = isSuperUser(user);

        if (!isAssigned && !isITOHeadOrOIC && !isSuper) {
          return NextResponse.json(
            {
              success: false,
              message: 'Only assigned staff, ITO-MAIN Head/OIC, or SuperUser can mark Pack Up Done'
            },
            { status: 403 }
          );
        }

        // 4. Event must have ended
        if (!reservation.dates || reservation.dates.length === 0) {
          return NextResponse.json(
            { success: false, message: 'No event dates found' },
            { status: 400 }
          );
        }

        const latestEventEnd = reservation.dates.reduce((latest, d) => {
          const end = new Date(d.eventEnd);
          return end > latest ? end : latest;
        }, new Date(0));

        if (new Date() < latestEventEnd) {
          return NextResponse.json(
            {
              success: false,
              message: `Pack Up Done can only be marked after the event ends (${latestEventEnd.toLocaleString()})`
            },
            { status: 400 }
          );
        }

        // 5. Remarks required
        if (!remarks || remarks.trim() === '') {
          return NextResponse.json(
            { success: false, message: 'Notes are required for Pack Up Done' },
            { status: 400 }
          );
        }

        // 6. Upload photos to Vercel Blob
        const photoUrls = [];
        for (const file of files) {
          if (file && file.size > 0) {
            const cleanFilename = `frf/packup/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
            const blob = await put(cleanFilename, file, {
              access: 'public',
              addRandomSuffix: true,
              token: process.env.DMSBLOB_READ_WRITE_TOKEN,
              storeId: process.env.DMSBLOB_STORE_ID,
            });
            photoUrls.push(blob.url);
          }
        }

        // 7. Save + restore equipment (transactional)
        await prisma.$transaction(async (tx) => {
          await tx.facilityReservation.update({
            where: { id },
            data: {
              packUpDoneAt: new Date(),
              packUpDoneById: user.id,
              packUpDoneNotes: remarks.trim(),
              packUpDonePhotos: photoUrls,
            },
          });

          for (const req of reservation.equipmentRequests) {
            const eq = await tx.equipment.findUnique({
              where: { id: req.equipmentId },
              select: { isSingleItem: true, quantityReserved: true }
            });
            if (!eq) continue;

            if (eq.isSingleItem) {
              const releaseQty = Math.min(req.quantityRequested, eq.quantityReserved);
              if (releaseQty > 0) {
                await tx.equipment.update({
                  where: { id: req.equipmentId },
                  data: { quantityReserved: { decrement: releaseQty } }
                });
              }
            } else {
              await tx.equipment.update({
                where: { id: req.equipmentId },
                data: { quantityAvailable: { increment: req.quantityRequested } },
              });
            }
          }
        });

        // 8. Notify requestor
        try {
          await prisma.notification.create({
            data: {
              title: 'Event Pack Up Done',
              message: `The event for ${reservation.referenceId} has been marked as packed up by ${user.fname} ${user.lname}. Equipment has been released back to inventory.`,
              isRead: false,
              recipientId: reservation.requestorId,
              senderId: user.id,
              // 🆕 Routing metadata
              linkUrl: `/dashboard/forms/frf?tab=completed&focus=${reservation.id}`,
              entityType: 'FRF',
              entityId: reservation.id,
            },
          });
        } catch (notifErr) {
          console.error('Pack Up notification error:', notifErr);
        }

        // 9. Log
        await logActivity({
          req: request,
          userId: user.id,
          email: user.email,
          action: 'FRF_PACKUP_DONE',
          details: JSON.stringify({
            reservationId: id,
            markedBy: `${user.fname} ${user.lname}`,
            markedByRole: user.role,
            markedByDept: user.departmentCode,
            photoCount: photoUrls.length,
            restoredEquipment: reservation.equipmentRequests.map((eq) => ({
              equipmentId: eq.equipmentId,
              quantity: eq.quantityRequested,
            })),
          }),
        });

        return NextResponse.json({
          success: true,
          message: 'Pack Up Done recorded. Equipment quantities have been restored.',
          data: {
            packUpDoneAt: new Date().toISOString(),
            packUpDoneById: user.id,
            packUpDonePhotos: photoUrls,
          },
        });
      }

      // ==========================================
      // 🆕 SAVE-DRAFT / SUBMIT-DRAFT
      // ==========================================
      if (action === 'save-draft' || action === 'submit-draft') {
        const reservation = await prisma.facilityReservation.findUnique({
          where: { id },
          include: {
            approvals: { orderBy: { stepOrder: 'asc' } },
            requestor: true,
            dates: { include: { place: true } },
            equipmentRequests: { include: { equipment: true } },
          }
        });

        if (!reservation) {
          return NextResponse.json({ success: false, message: 'Reservation not found' }, { status: 404 });
        }

        if (reservation.requestorId !== user.id) {
          return NextResponse.json({ success: false, message: 'Only the requestor can modify drafts' }, { status: 403 });
        }

        if (reservation.status !== 'DRAFT') {
          return NextResponse.json({ success: false, message: 'Only drafts can be edited or submitted this way' }, { status: 400 });
        }

        // Extract fields
        const type = formData.get('type');
        const eventName = formData.get('eventName') || null;
        const attendeesCount = parseInt(formData.get('attendeesCount')) || 0;
        const usageHours = parseFloat(formData.get('usageHours')) || null;
        const withCharge = formData.get('withCharge') === 'true';
        const requestorNotes = formData.get('requestorNotes') || null;
        const datesArray = JSON.parse(formData.get('dates') || '[]');
        const equipmentRequests = JSON.parse(formData.get('equipmentItems') || formData.get('equipmentRequests') || '[]');
        const attachmentsToKeep = JSON.parse(formData.get('attachmentsToKeep') || '[]');
        const newFiles = formData.getAll('newAttachments');
        const isVenueOnly = formData.get('isVenueOnly') === 'true';

        const assignmentsRaw = formData.get('assignments');
        let submittedAssignments = [];
        try {
          submittedAssignments = assignmentsRaw ? JSON.parse(assignmentsRaw) : [];
        } catch {
          return NextResponse.json({ success: false, message: 'Invalid assignments payload' }, { status: 400 });
        }

        // Basic validation (both actions)
        if (!datesArray || datesArray.length === 0) {
          return NextResponse.json({ success: false, message: 'At least one date is required' }, { status: 400 });
        }

        const capacityError = await validateMultiPurposeHallLimit(datesArray, attendeesCount);
        if (capacityError) {
          return NextResponse.json({ success: false, message: capacityError }, { status: 400 });
        }

        for (const entry of datesArray) {
          const setup = new Date(entry.setupTime);
          const start = new Date(entry.eventStart);
          const end = new Date(entry.eventEnd);
          const teardown = new Date(entry.teardownTime);

          if (setup.getTime() + 3600000 > start.getTime()) {
            return NextResponse.json({ success: false, message: 'Starting time must be at least 1 hour before Actual Time Start' }, { status: 400 });
          }
          if (end.getTime() > teardown.getTime()) {
            return NextResponse.json({ success: false, message: 'Time End must be before or equal to Actual Time End' }, { status: 400 });
          }
        }

        // Upload new attachments
        const newAttachmentPaths = [];
        for (const file of newFiles) {
          if (file && file.size > 0) {
            const cleanFilename = `frf/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
            const blob = await put(cleanFilename, file, {
              access: 'public',
              addRandomSuffix: true,
              token: process.env.DMSBLOB_READ_WRITE_TOKEN,
              storeId: process.env.DMSBLOB_STORE_ID
            });
            newAttachmentPaths.push(blob.url);
          }
        }

        const finalAttachments = [...attachmentsToKeep, ...newAttachmentPaths];

        // ──────────────── SAVE-DRAFT (light validation) ────────────────
        if (action === 'save-draft') {
          await prisma.$transaction(async (tx) => {
            await tx.facilityReservationDate.deleteMany({ where: { reservationId: id } });
            await tx.facilityEquipmentRequest.deleteMany({ where: { reservationId: id } });

            await tx.facilityReservation.update({
              where: { id },
              data: {
                type,
                eventName: eventName || undefined,
                attendeesCount,
                usageHours: usageHours || null,
                withCharge,
                requestorNotes: requestorNotes || undefined,
                attachments: finalAttachments,
                isVenueOnly,
                dates: {
                  create: datesArray.map(entry => ({
                    date: new Date(entry.date),
                    setupTime: new Date(entry.setupTime),
                    eventStart: new Date(entry.eventStart),
                    eventEnd: new Date(entry.eventEnd),
                    teardownTime: new Date(entry.teardownTime),
                    placeId: entry.placeId || undefined,
                    placeOther: entry.placeOther || undefined,
                  }))
                },
                equipmentRequests: {
                  create: equipmentRequests.map(item => ({
                    equipmentId: item.equipmentId,
                    quantityRequested: item.quantity || 1
                  }))
                }
              }
            });
          });

          const removedAttachments = (reservation.attachments || []).filter(
            (url) => !finalAttachments.includes(url)
          );
          if (removedAttachments.length > 0) {
            try {
              await del(removedAttachments);
              console.log(`🗑️ [save-draft] Deleted ${removedAttachments.length} removed attachment blob(s)`);
            } catch (delErr) {
              // Non-fatal — DB is source of truth. Orphaned blobs just leak a few KB.
              console.error('save-draft blob cleanup error:', delErr);
            }
          }

          await logActivity({
            req: request,
            userId: user.id,
            email: user.email,
            action: 'FRF_DRAFT_SAVED',
            details: JSON.stringify({ reservationId: id })
          });

          return NextResponse.json({ success: true, message: 'Draft saved', data: { status: 'DRAFT' } });
        }

        // ──────────────── SUBMIT-DRAFT (full validation + workflow) ────────────────
        if (!requestorNotes || requestorNotes.trim() === '') {
          return NextResponse.json({ success: false, message: 'Requestor notes are required before submitting' }, { status: 400 });
        }
        if (finalAttachments.length === 0) {
          return NextResponse.json({ success: false, message: 'At least one attachment is required before submitting' }, { status: 400 });
        }

        // Detect equipment for approval sequence
        const equipmentIds = equipmentRequests.map(item => item.equipmentId);
        let hasLedWall = false, hasCDOEquipment = false, hasITOEquipment = false;
        if (equipmentIds.length > 0) {
          const equipmentList = await prisma.equipment.findMany({
            where: { id: { in: equipmentIds } },
            select: { id: true, name: true, departmentCode: true }
          });
          hasLedWall = equipmentList.some(eq => eq.name === 'LED Wall' || eq.name === 'LED_WALL' || eq.name === 'LED_Wall');
          hasCDOEquipment = equipmentList.some(eq => eq.departmentCode === 'CDO');
          hasITOEquipment = equipmentList.some(eq => eq.departmentCode === 'ITO-MAIN');
        }

        const isRequestorHead = isHeadOrOIC(user);
        const approvalSequence = getApprovalSequence(type, hasLedWall, hasCDOEquipment, hasITOEquipment)
          .filter(dept => dept !== user.departmentCode);
        const finalApprovalSequence = isVenueOnly
          ? approvalSequence.filter(dept => dept !== 'ITO-MAIN')
          : approvalSequence;

        const approvals = [{
          departmentCode: user.departmentCode,
          stepOrder: 1,
          status: isRequestorHead ? 'APPROVED' : 'PENDING',
          ...(isRequestorHead && { performedById: user.id, performedAt: new Date() }),
        }];
        finalApprovalSequence.forEach((dept, index) => {
          approvals.push({ departmentCode: dept, stepOrder: 2 + index, status: 'PENDING' });
        });

        // 🆕 Server-side guard — ITO-head/OIC submitting a draft must have assignments
        const draftAssignmentError = validateItoHeadAssignments(
          user,
          isVenueOnly,
          false,
          submittedAssignments,
        );
        if (draftAssignmentError) {
          return NextResponse.json({ success: false, message: draftAssignmentError }, { status: 400 });
        }

        // Transact: update fields + recreate dates/equipment + create approvals + reserve stock
        try {
          await prisma.$transaction(async (tx) => {
            await tx.facilityReservationDate.deleteMany({ where: { reservationId: id } });
            await tx.facilityEquipmentRequest.deleteMany({ where: { reservationId: id } });

            await tx.facilityReservation.update({
              where: { id },
              data: {
                type,
                eventName: eventName || undefined,
                attendeesCount,
                usageHours: usageHours || null,
                withCharge,
                requestorNotes: requestorNotes || undefined,
                attachments: finalAttachments,
                isVenueOnly,
                status: 'PENDING_APPROVAL',
                dates: {
                  create: datesArray.map(entry => ({
                    date: new Date(entry.date),
                    setupTime: new Date(entry.setupTime),
                    eventStart: new Date(entry.eventStart),
                    eventEnd: new Date(entry.eventEnd),
                    teardownTime: new Date(entry.teardownTime),
                    placeId: entry.placeId || undefined,
                    placeOther: entry.placeOther || undefined,
                  }))
                },
                equipmentRequests: {
                  create: equipmentRequests.map(item => ({
                    equipmentId: item.equipmentId,
                    quantityRequested: item.quantity || 1
                  }))
                },
                approvals: { create: approvals }
              }
            });

            // Reserve equipment (skip for venue-only or empty lists)
            for (const item of equipmentRequests) {
              const eq = await tx.equipment.findUnique({
                where: { id: item.equipmentId },
                select: { isSingleItem: true, quantityAvailable: true, quantityReserved: true, name: true }
              });
              if (!eq) continue;
              const qty = eq.isSingleItem ? 1 : (item.quantity || 1);
              const trulyAvailable = eq.quantityAvailable - eq.quantityReserved;
              if (trulyAvailable < qty) {
                throw new Error(`Not enough stock for ${eq.name}. Available: ${trulyAvailable}, requested: ${qty}.`);
              }
              await tx.equipment.update({
                where: { id: item.equipmentId },
                data: { quantityReserved: { increment: qty } }
              });
            }

            // 🆕 Persist assignments (optional for drafts)
            if (submittedAssignments.length > 0) {
              await tx.facilityAssignment.deleteMany({ where: { reservationId: id } });
              await persistAssignments(tx, id, submittedAssignments);
            }
          });
        } catch (submitErr) {
          console.error('Submit-draft transaction failed:', submitErr);
          return NextResponse.json({ success: false, message: submitErr.message || 'Failed to submit draft' }, { status: 409 });
        }

        // 🆕 Cleanup: delete blobs for attachments removed between draft and submit
        // (e.g., user deleted an existing file while editing before submitting)
        const removedAttachments = (reservation.attachments || []).filter(
          (url) => !finalAttachments.includes(url)
        );
        if (removedAttachments.length > 0) {
          try {
            await del(removedAttachments);
            console.log(`🗑️ [submit-draft] Deleted ${removedAttachments.length} removed attachment blob(s)`);
          } catch (delErr) {
            // Non-fatal — submit already succeeded at DB level
            console.error('submit-draft blob cleanup error:', delErr);
          }
        }

        // Notify first approver
        try {
          const freshReservation = await prisma.facilityReservation.findUnique({
            where: { id },
            include: {
              approvals: { orderBy: { stepOrder: 'asc' } },
              requestor: true,
              dates: { include: { place: true } },
              equipmentRequests: { include: { equipment: true } },
            }
          });

          const firstApproval = freshReservation.approvals
            .filter(a => a.status === 'PENDING')
            .sort((a, b) => a.stepOrder - b.stepOrder)[0];
          if (firstApproval) {
            const nextDeptHeads = await getDepartmentHeads(firstApproval.departmentCode);
            if (nextDeptHeads.length > 0) {
              await sendFRFApprovalToNextDepartments(nextDeptHeads, freshReservation, user.departmentCode);
              const nextUsers = await prisma.user.findMany({
                where: {
                  departmentCode: firstApproval.departmentCode,
                  OR: [
                    { role: 'DepartmentHead' },
                    { oic_start: { lte: new Date().toISOString() }, oic_end: { gte: new Date().toISOString() } }
                  ]
                },
                select: { id: true }
              });
              for (const u of nextUsers) {
                await prisma.notification.create({
                  data: {
                    title: 'FRF Pending Approval',
                    message: `New FRF ${freshReservation.referenceId} needs your approval.`,
                    isRead: false,
                    recipientId: u.id,
                    senderId: user.id,
                    linkUrl: `/dashboard/forms/frf?tab=pending_approval&focus=${freshReservation.id}`,
                    entityType: 'FRF',
                    entityId: freshReservation.id,
                  }
                });
              }
            }
          }
        } catch (notifErr) {
          console.error('Submit-draft notification error:', notifErr);
        }

        await logActivity({
          req: request,
          userId: user.id,
          email: user.email,
          action: 'FRF_DRAFT_SUBMITTED',
          details: JSON.stringify({
            reservationId: id,
            type,
            datesCount: datesArray.length,
            removedAttachments: removedAttachments.length,
            finalAttachmentCount: finalAttachments.length
          })
        });

        return NextResponse.json({ success: true, message: 'Draft submitted for approval', data: { status: 'PENDING_APPROVAL' } });
      }

      // Only resubmit is supported via multipart (other than packup-done + draft actions)
      if (action !== 'resubmit') {
        return NextResponse.json(
          { success: false, message: 'Invalid action for multipart request' },
          { status: 400 }
        );
      }

      // 🆕 Parse the frontend's explicit delete list but DEFER the actual del() call
      // until AFTER the transaction succeeds. Deleting early risks losing blobs
      // if the resubmit fails (leaving the DB with broken attachment URLs).
      const attachmentsToDelete = JSON.parse(formData.get('attachmentsToDelete') || '[]');
      if (attachmentsToDelete.length > 0) {
        try {
          await del(attachmentsToDelete);
        } catch (delErr) {
          console.error('Blob deletion error:', delErr);
        }
      }
      

      const reservation = await prisma.facilityReservation.findUnique({
        where: { id },
        include: {
          approvals: {
            orderBy: { stepOrder: 'asc' },
            include: {
              performedBy: { select: { fname: true, lname: true } }
            }
          },
          requestor: true,
          dates: {
            include: {
              place: true,
            },
          },
          equipmentRequests: {
            include: {
              equipment: true,
            },
          },
          assignments: {
            include: {
              user: {
                select: { id: true, fname: true, lname: true, email: true },
              },
            },
          },
        }
      });

      if (!reservation) {
        return NextResponse.json({ success: false, message: 'Reservation not found' }, { status: 404 });
      }

      if (reservation.requestorId !== user.id) {
        return NextResponse.json(
          { success: false, message: 'Only the requestor can resubmit' },
          { status: 403 }
        );
      }

      if (reservation.status !== 'REVISION_REQUESTED') {
        return NextResponse.json(
          { success: false, message: 'Only reservations marked for revision can be resubmitted' },
          { status: 400 }
        );
      }

      const revisionApproval = await prisma.facilityApproval.findFirst({
        where: {
          reservationId: id,
          status: 'REVISION_REQUESTED'
        }
      });

      if (!revisionApproval) {
        return NextResponse.json(
          { success: false, message: 'No revision request found' },
          { status: 400 }
        );
      }

      // --- Extract fields ---
      const type = formData.get('type');
      const eventName = formData.get('eventName') || null;
      const attendeesCount = parseInt(formData.get('attendeesCount')) || 0;
      const usageHours = parseFloat(formData.get('usageHours')) || null;
      const withCharge = formData.get('withCharge') === 'true';
      const requestorNotes = formData.get('requestorNotes') || null;
      const datesArray = JSON.parse(formData.get('dates') || '[]');
      const equipmentRequests = JSON.parse(formData.get('equipmentRequests') || '[]');
      const attachmentsToKeep = JSON.parse(formData.get('attachmentsToKeep') || '[]');
      const newFiles = formData.getAll('newAttachments');
      const assignmentsRaw = formData.get('assignments');

      let submittedAssignments = [];
      try {
        submittedAssignments = assignmentsRaw ? JSON.parse(assignmentsRaw) : [];
      } catch {
        return NextResponse.json({ success: false, message: 'Invalid assignments payload' }, { status: 400 });
      }

      // --- Validate dates ---
      if (!datesArray || datesArray.length === 0) {
        return NextResponse.json({
          success: false,
          message: 'At least one date is required'
        }, { status: 400 });
      }

      const capacityError = await validateMultiPurposeHallLimit(datesArray, attendeesCount);
      if (capacityError) {
        return NextResponse.json({ success: false, message: capacityError }, { status: 400 });
      }

      for (const entry of datesArray) {
        const setup = new Date(entry.setupTime);
        const start = new Date(entry.eventStart);
        const end = new Date(entry.eventEnd);
        const teardown = new Date(entry.teardownTime);

        if (setup.getTime() + 3600000 > start.getTime()) {
          return NextResponse.json({
            success: false,
            message: 'Starting time must be at least 1 hour before Actual Time Start'
          }, { status: 400 });
        }
        if (end.getTime() > teardown.getTime()) {
          return NextResponse.json({
            success: false,
            message: 'Time End must be before or equal to Actual Time End'
          }, { status: 400 });
        }
      }

      // --- Save new attachments ---
      // const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'frf');
      // await mkdir(uploadDir, { recursive: true });
      // const newAttachmentPaths = [];
      // for (const file of newFiles) {
      //   if (file && file.size > 0 && typeof file.arrayBuffer === 'function') {
      //     const bytes = await file.arrayBuffer();
      //     const buffer = Buffer.from(bytes);
      //     const cleanFilename = `${Date.now()}-${Math.floor(Math.random() * 1000)}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
      //     await writeFile(path.join(uploadDir, cleanFilename), buffer);
      //     newAttachmentPaths.push(`/uploads/frf/${cleanFilename}`);
      //   }
      // }

      // --- Save new attachments – Vercel Blob ---
      const newAttachmentPaths = [];
      for (const file of newFiles) {
        if (file && file.size > 0) {
          const cleanFilename = `frf/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
          const blob = await put(cleanFilename, file, {
            access: 'public',
            addRandomSuffix: true,
            token: process.env.DMSBLOB_READ_WRITE_TOKEN,
            storeId: process.env.DMSBLOB_STORE_ID
          });
          newAttachmentPaths.push(blob.url);
        }
      }

      const finalAttachments = [...attachmentsToKeep, ...newAttachmentPaths];

      // 🆕 ITO-head resubmit guard — BEFORE the transaction
      const existingAssignmentCount = await prisma.facilityAssignment.count({
        where: { reservationId: id },
      });
      const hasAssignmentsAfterResubmit =
        submittedAssignments.length > 0 || existingAssignmentCount > 0;
      const isItoHeadResubmitting =
        user.departmentCode === 'ITO-MAIN' && isHeadOrOIC(user) && !reservation.isVenueOnly;

      if (isItoHeadResubmitting && !hasAssignmentsAfterResubmit) {
        return NextResponse.json({
          success: false,
          message:
            'ITO-MAIN head/OIC must have at least one ITO staff assignment for this reservation. Please assign staff before resubmitting.',
        }, { status: 400 });
      }

      // --- Update reservation ---
      await prisma.$transaction(async (tx) => {
        await tx.facilityReservationDate.deleteMany({
          where: { reservationId: id }
        });
        await tx.facilityEquipmentRequest.deleteMany({
          where: { reservationId: id }
        });

        if (submittedAssignments.length > 0) {
          await tx.facilityAssignment.deleteMany({ where: { reservationId: id } });
          await persistAssignments(tx, id, submittedAssignments);
        }

        await tx.facilityReservation.update({
          where: { id },
          data: {
            type,
            eventName: eventName || undefined,
            attendeesCount,
            usageHours: usageHours || null,
            withCharge,
            requestorNotes: requestorNotes || undefined,
            attachments: finalAttachments,
            status: 'PENDING_APPROVAL',
            dates: {
              create: datesArray.map(entry => ({
                date: new Date(entry.date),
                setupTime: new Date(entry.setupTime),
                eventStart: new Date(entry.eventStart),
                eventEnd: new Date(entry.eventEnd),
                teardownTime: new Date(entry.teardownTime),
                placeId: entry.placeId || undefined,
                placeOther: entry.placeOther || undefined,
              }))
            },
            equipmentRequests: {
              create: equipmentRequests.map(item => ({
                equipmentId: item.equipmentId,
                quantityRequested: item.quantity || 1
              }))
            }
          }
        });

        await tx.facilityApproval.update({
          where: { id: revisionApproval.id },
          data: {
            status: 'PENDING',
            revisionRequestedAt: null,
            performedById: null,
            performedAt: null,
            remarks: `Resubmitted by requestor on ${new Date().toLocaleString()}`
          }
        });

        for (const item of equipmentRequests) {
          const eq = await tx.equipment.findUnique({
            where: { id: item.equipmentId },
            select: { isSingleItem: true, quantityAvailable: true, quantityReserved: true, name: true }
          });
          if (!eq) continue;

          const qty = eq.isSingleItem ? 1 : (item.quantity || 1);
          const trulyAvailable = eq.quantityAvailable - eq.quantityReserved;
          if (trulyAvailable < qty) {
            throw new Error(`Not enough stock for ${eq.name}. Available: ${trulyAvailable}, requested: ${qty}.`);
          }

          await tx.equipment.update({
            where: { id: item.equipmentId },
            data: { quantityReserved: { increment: qty } }
          });
        }
      });

      // 🆕 Cleanup: delete blobs that are no longer referenced by this reservation.
      // Combines two sources:
      //   1. Frontend's explicit attachmentsToDelete (legacy — future compat)
      //   2. Server-side diff: any URL in the previous attachments[] that is
      //      missing from the new finalAttachments[]
      // Deduped so the same blob is never del()'d twice.
      const removedAttachments = (reservation.attachments || []).filter(
        (url) => !finalAttachments.includes(url)
      );
      const allToDelete = [...new Set([...attachmentsToDelete, ...removedAttachments])];

      if (allToDelete.length > 0) {
        try {
          await del(allToDelete);
          console.log(`🗑️ [resubmit] Deleted ${allToDelete.length} removed attachment blob(s)`);
        } catch (delErr) {
          // Non-fatal — DB is source of truth. Orphaned blobs just leak a few KB.
          console.error('resubmit blob cleanup error:', delErr);
        }
      }

      await logActivity({
        req: request,
        userId: user.id,
        email: user.email,
        action: 'FRF_RESUBMIT',
        details: JSON.stringify({
          reservationId: id,
          datesCount: datesArray.length,
          attachmentsKept: attachmentsToKeep.length,
          newAttachments: newAttachmentPaths.length,
          removedAttachments: allToDelete.length,   // 🆕
        })
      });

      return NextResponse.json({
        success: true,
        message: 'Reservation resubmitted successfully',
        data: { status: 'PENDING_APPROVAL' }
      });
    }

    // ------------------------------
    // JSON (for all other actions)
    // ------------------------------
    const body = await request.json();
    const { id, action, remarks, assignments, finalEditData, password } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, message: 'Reservation ID is required' },
        { status: 400 }
      );
    }

        // All actions require password
    if (!password) {
      return NextResponse.json(
        { success: false, message: 'Password is required to perform this action' },
        { status: 400 }
      );
    }

    const passwordValid = await verifyPassword(password, user.password, user.id);
    if (!passwordValid) {
      return NextResponse.json(
        { success: false, message: 'Invalid password' },
        { status: 403 }
      );
    }

      const reservation = await prisma.facilityReservation.findUnique({
        where: { id },
        include: {
          approvals: {
            orderBy: { stepOrder: 'asc' },
            include: {
              performedBy: { select: { fname: true, lname: true } }
            }
          },
          requestor: true,
          dates: {
            include: {
              place: true,
            },
          },
          equipmentRequests: {
            include: {
              equipment: true,
            },
          },
          assignments: {
            include: {
              user: {
                select: { id: true, fname: true, lname: true, email: true },
              },
            },
          },
        }
      });

    if (!reservation) {
      return NextResponse.json({ success: false, message: 'Reservation not found' }, { status: 404 });
    }

    // ==========================================
    // APPROVE ACTION
    // ==========================================
    if (action === 'approve') {

      const pendingApproval = reservation.approvals.find(
        a => a.status === 'PENDING' && a.departmentCode === user.departmentCode
      );

      const isVenueOnly = reservation.isVenueOnly;
      const isITO = user.departmentCode === 'ITO-MAIN' || user.departmentCode === 'ITO';

      // ---- Validations (unchanged) ----
      if (isVenueOnly && isITO) {
        return NextResponse.json(
          { success: false, message: 'ITO approval is not required for venue-only reservations.' },
          { status: 403 }
        );
      }

      if (!pendingApproval) {
        return NextResponse.json(
          { success: false, message: 'No pending approval for your department' },
          { status: 403 }
        );
      }

      if (!isHeadOrOIC(user) && !isSuperUser(user)) {
        return NextResponse.json(
          { success: false, message: 'Only Department Head or OIC can approve' },
          { status: 403 }
        );
      }

      if (!remarks || remarks.trim() === '') {
        return NextResponse.json(
          { success: false, message: 'Remarks are required for approval' },
          { status: 400 }
        );
      }

      // ---------- ITO Assignment Handling ----------
      // Only ITO users need to assign staff. Non-ITO users (PSMO/FMO, OCM, etc.)
      // skip this entire block and proceed directly to approval update.
      if (isITO && !isVenueOnly) {
        console.log('✅ Entering ITO assignment block');

        if (reservation.isReschedule) {
          // ---------- RESCHEDULE PATH: recreate assignments with new dates ----------
          console.log('✅ Reschedule detected – recreating assignments');

          // 1. Delete all existing assignments
          await prisma.facilityAssignment.deleteMany({
            where: { reservationId: id }
          });

          // 2. Get the new dates
          const newDates = await prisma.facilityReservationDate.findMany({
            where: { reservationId: id },
            orderBy: { date: 'asc' }
          });

          if (newDates.length === 0) {
            return NextResponse.json(
              { success: false, message: 'No new dates found for reschedule.' },
              { status: 400 }
            );
          }

          // 3. Determine which assignments to use
          let assignmentData = assignments;
          if (!assignmentData || !Array.isArray(assignmentData) || assignmentData.length === 0) {
            // Fallback: use existing assignments (with old dates)
            assignmentData = reservation.assignments.map(a => ({
              userId: a.userId,
              dutyType: a.dutyType,
              isOvertime: a.isOvertime ?? false,
              oldStart: new Date(a.dutyStart),
              oldEnd: new Date(a.dutyEnd),
            }));
          } else {
            assignmentData = assignments.map(a => ({
              userId: a.userId,
              dutyType: a.dutyType,
              isOvertime: a.isOvertime ?? false,
              oldStart: new Date(a.dutyStart),
              oldEnd: new Date(a.dutyEnd),
            }));
          }

          // after the existing if/else that sets assignmentData
          if (assignmentData.length === 0) {
            return NextResponse.json({
              success: false,
              message: 'At least one ITO staff assignment is required for reschedule approval. Please provide new assignments or ensure the original reservation has existing assignments.'
            }, { status: 400 });
          }

          // 4. Re-create assignments with new dates
          for (let i = 0; i < assignmentData.length; i++) {
            const ass = assignmentData[i];
            const dateIndex = i % newDates.length;
            const dateObj = new Date(newDates[dateIndex].date);

            let hoursStart = 0, minutesStart = 0, hoursEnd = 0, minutesEnd = 0;
            if (ass.oldStart) {
              hoursStart = ass.oldStart.getHours();
              minutesStart = ass.oldStart.getMinutes();
            }
            if (ass.oldEnd) {
              hoursEnd = ass.oldEnd.getHours();
              minutesEnd = ass.oldEnd.getMinutes();
            }

            const newStart = new Date(dateObj);
            newStart.setHours(hoursStart, minutesStart, 0, 0);
            const newEnd = new Date(dateObj);
            newEnd.setHours(hoursEnd, minutesEnd, 0, 0);

            await prisma.facilityAssignment.create({
              data: {
                reservationId: id,
                userId: ass.userId,
                dutyStart: newStart,
                dutyEnd: newEnd,
                dutyType: ass.dutyType,
                isOvertime: !!ass.isOvertime,
              }
            });
          }

          // Notify assigned staff of their NEW duty dates
          try {
            const staffIds = assignmentData.map(a => a.userId);
            const staffUsers = await prisma.user.findMany({
              where: { id: { in: staffIds } },
              select: { id: true, email: true, fname: true, lname: true },
            });

            const freshAssignments = await prisma.facilityAssignment.findMany({
              where: { reservationId: id },
              include: {
                user: { select: { id: true, fname: true, lname: true, email: true } },
              },
            });

            const staffMap = Object.fromEntries(staffUsers.map(u => [u.id, u]));
            const assignmentDetails = freshAssignments.map(a => ({
              userId: a.userId,
              staffName: `${staffMap[a.userId]?.fname || ''} ${staffMap[a.userId]?.lname || ''}`.trim(),
              dutyStart: a.dutyStart,
              dutyEnd: a.dutyEnd,
              dutyType: a.dutyType,
              isOvertime: a.isOvertime,
              notes: a.notes,
            }));

            if (staffUsers.length > 0) {
              const freshReservation = await prisma.facilityReservation.findUnique({
                where: { id },
                include: {
                  requestor: true,
                  dates: { include: { place: true } },
                  equipmentRequests: { include: { equipment: true } },
                },
              });
              await sendFRFAssignmentToStaff(staffUsers, freshReservation, assignmentDetails);

              // 🆕 In-app notifications per assigned staff (with updated dates)
              for (const staff of staffUsers) {
                const myDuties = assignmentDetails.filter(a => a.userId === staff.id);
                if (myDuties.length === 0) continue;
                await prisma.notification.create({
                  data: {
                    title: "Your Event Assignment Was Updated",
                    message: `Your duty assignment(s) for ${freshReservation.referenceId} were updated due to a reschedule. ${myDuties.length} duty assignment(s).`,
                    isRead: false,
                    recipientId: staff.id,
                    senderId: user.id,
                    linkUrl: `/dashboard/forms/frf?tab=assigned_to_me&focus=${reservation.id}`,
                    entityType: 'FRF',
                    entityId: reservation.id,
                  }
                });
              }
            }
          } catch (staffNotifErr) {
            console.error('❌ [RESCHEDULE NOTIFY] Error:', staffNotifErr);
          }

        } else {
          // ---------- NORMAL ITO APPROVAL (new event) ----------
          if (!assignments || !Array.isArray(assignments) || assignments.length === 0) {
            return NextResponse.json(
              { success: false, message: 'At least one staff assignment is required for ITO approval' },
              { status: 400 }
            );
          }

          // Validate each assignment
          for (const assignment of assignments) {
            if (!assignment.userId || !assignment.dutyStart || !assignment.dutyEnd || !assignment.dutyType) {
              return NextResponse.json(
                { success: false, message: 'Each assignment must have userId, dutyStart, dutyEnd, and dutyType' },
                { status: 400 }
              );
            }
            const staff = await prisma.user.findUnique({
              where: { id: assignment.userId }
            });
            if (!staff || (staff.departmentCode !== 'ITO-MAIN' && staff.departmentCode !== 'ITO')) {
              return NextResponse.json(
                { success: false, message: `Staff ${assignment.userId} not found or not in ITO department` },
                { status: 400 }
              );
            }
          }

          // Create assignment records
          for (const assignment of assignments) {
            await prisma.facilityAssignment.create({
              data: {
                reservationId: id,
                userId: assignment.userId,
                dutyStart: new Date(assignment.dutyStart),
                dutyEnd: new Date(assignment.dutyEnd),
                dutyType: assignment.dutyType,
                notes: assignment.notes || null,
                isOvertime: !!assignment.isOvertime,
              }
            });
          }

          // Notify assigned ITO staff
          try {
            const staffIds = assignments.map(a => a.userId);
            const staffUsers = await prisma.user.findMany({
              where: { id: { in: staffIds } },
              select: { id: true, email: true, fname: true, lname: true },
            });

            const staffMap = Object.fromEntries(staffUsers.map(u => [u.id, u]));

            const assignmentDetails = assignments.map(a => ({
              userId: a.userId,
              staffName: `${staffMap[a.userId]?.fname || ''} ${staffMap[a.userId]?.lname || ''}`.trim(),
              dutyStart: a.dutyStart,
              dutyEnd: a.dutyEnd,
              dutyType: a.dutyType,
              isOvertime: a.isOvertime,
              notes: a.notes,
            }));

            if (staffUsers.length > 0) {
              await sendFRFAssignmentToStaff(staffUsers, reservation, assignmentDetails);

              // 🆕 In-app notifications per assigned staff
              for (const staff of staffUsers) {
                const myDuties = assignmentDetails.filter(a => a.userId === staff.id);
                if (myDuties.length === 0) continue;
                await prisma.notification.create({
                  data: {
                    title: "You've Been Assigned to an Event",
                    message: `You have ${myDuties.length} duty assignment(s) for ${reservation.referenceId} — "${reservation.eventName || 'Facility Event'}".`,
                    isRead: false,
                    recipientId: staff.id,
                    senderId: user.id,
                    linkUrl: `/dashboard/forms/frf?tab=assigned_to_me&focus=${reservation.id}`,
                    entityType: 'FRF',
                    entityId: reservation.id,
                  }
                });
              }
            }
          } catch (staffNotifErr) {
            console.error('❌ [NOTIFY] Staff assignment notification error:', staffNotifErr);
          }
        }
      }
      // ⬆️ END: if (isITO && !isVenueOnly)
      // Non-ITO users skip the entire block above and continue below.

      // ---------- Update the pending approval to APPROVED ----------
      await prisma.facilityApproval.update({
        where: { id: pendingApproval.id },
        data: {
          status: 'APPROVED',
          performedById: user.id,
          performedAt: new Date(),
          remarks: remarks || null
        }
      });

      // ---------- Check if all approvals are done ----------
      const allApprovals = await prisma.facilityApproval.findMany({
        where: { reservationId: id }
      });

      let nextPending = allApprovals
        .filter(a => a.status === 'PENDING')
        .sort((a, b) => a.stepOrder - b.stepOrder)[0];

      if (nextPending) {
        try {
          const nextDeptHeads = await getDepartmentHeads(nextPending.departmentCode);
          if (nextDeptHeads.length > 0) {
            await sendFRFApprovalToNextDepartments(nextDeptHeads, reservation, user.departmentCode);
            const nextUsers = await prisma.user.findMany({
              where: {
                departmentCode: nextPending.departmentCode,
                OR: [
                  { role: 'DepartmentHead' },
                  { oic_start: { lte: new Date().toISOString() }, oic_end: { gte: new Date().toISOString() } }
                ]
              },
              select: { id: true }
            });
            for (const u of nextUsers) {
              await prisma.notification.create({
                data: {
                  title: 'FRF Pending Approval',
                  message: `FRF ${reservation.referenceId} needs your approval.`,
                  isRead: false,
                  recipientId: u.id,
                  senderId: user.id,
                  // 🆕 Routing metadata
                  linkUrl: `/dashboard/forms/frf?tab=pending_approval&focus=${reservation.id}`,
                  entityType: 'FRF',
                  entityId: reservation.id,
                }
              });
            }
          }
        } catch (notifErr) {
          console.error('Next department notification error:', notifErr);
        }
      }

      const allNonHrdDone = allApprovals.every(a =>
        a.status === 'APPROVED' || a.status === 'ACKNOWLEDGED'
      );

      const requestor = await prisma.user.findUnique({
        where: { id: reservation.requestorId }
      });

      if (allNonHrdDone) {
        await prisma.facilityReservation.update({
          where: { id },
          data: { status: 'COMPLETED' }
        });

        const equipmentRequests = await prisma.facilityEquipmentRequest.findMany({
          where: { reservationId: id }
        });
        for (const req of equipmentRequests) {
          const eq = await prisma.equipment.findUnique({
            where: { id: req.equipmentId },
            select: { isSingleItem: true, quantityReserved: true }
          });
          if (!eq) continue;

          // ✅ Single items: reusable — don't decrement availability.
          // Keep quantityReserved until Pack Up Done releases it.
          if (eq.isSingleItem) {
            continue;
          }

          const reserveDec = Math.min(req.quantityRequested, eq.quantityReserved);
          await prisma.equipment.update({
            where: { id: req.equipmentId },
            data: {
              quantityAvailable: { decrement: req.quantityRequested },
              quantityReserved: { decrement: reserveDec }
            }
          });
        }

        // 🆕 Send the completion email BEFORE the notification
        // (idempotent — safe to call even if OCM later finalizes)
        try {
          const completionRes = await prisma.facilityReservation.findUnique({
            where: { id },
            include: {
              requestor: true,
              dates: { include: { place: true } },
              approvals: {
                orderBy: { stepOrder: 'asc' },
                include: { performedBy: { select: { fname: true, lname: true } } },
              },
              equipmentRequests: { include: { equipment: true } },
              assignments: {
                include: { user: { select: { id: true, fname: true, lname: true, email: true } } },
              },
              packUpDoneBy: {
                select: { fname: true, lname: true, email: true, departmentCode: true },
              },
            },
          });
          if (completionRes) {
            await sendFRFCompletionNotification(completionRes);
          }
        } catch (emailErr) {
          console.error('[FRF_COMPLETION] email send error (non-fatal):', emailErr);
        }

        try {
          if (requestor) {
            await sendFRFApprovalToRequestor(requestor, reservation);
            await prisma.notification.create({
              data: {
                title: 'FRF Completed',
                message: `Your FRF ${reservation.referenceId} has been completed.`,
                isRead: false,
                recipientId: requestor.id,
                senderId: user.id,
                // 🆕 Routing metadata
                linkUrl: `/dashboard/forms/frf?tab=completed&focus=${reservation.id}`,
                entityType: 'FRF',
                entityId: reservation.id,
              }
            });
          }
        } catch (notifErr) {
          console.error('Requestor notification error:', notifErr);
        }
      }

      await logActivity({
        req: request,
        userId: user.id,
        email: user.email,
        action: 'FRF_APPROVE',
        details: JSON.stringify({
          reservationId: id,
          department: user.departmentCode,
          remarks,
          assignments: isITO ? assignments?.map(a => ({ userId: a.userId, dutyStart: a.dutyStart, dutyEnd: a.dutyEnd })) : undefined
        })
      });

      return NextResponse.json({
        success: true,
        message: `Approved by ${user.departmentCode}`,
        data: { status: allNonHrdDone ? 'APPROVED' : 'PENDING_APPROVAL' }
      });
    }

    // ==========================================
    // REJECT ACTION
    // ==========================================
    if (action === 'reject') {
      const pendingApproval = reservation.approvals.find(
        a => a.status === 'PENDING' && a.departmentCode === user.departmentCode
      );

      if (user.departmentCode === 'HRD') {
        return NextResponse.json(
          { success: false, message: 'HRD does not have approval authority to reject.' },
          { status: 403 }
        );
      }

      if (!pendingApproval) {
        return NextResponse.json(
          { success: false, message: 'No pending approval for your department' },
          { status: 403 }
        );
      }

      if (!isHeadOrOIC(user) && !isSuperUser(user)) {
        return NextResponse.json(
          { success: false, message: 'Only Department Head or OIC can reject' },
          { status: 403 }
        );
      }

      if (!remarks) {
        return NextResponse.json(
          { success: false, message: 'Remarks are required for rejection' },
          { status: 400 }
        );
      }

      await prisma.facilityApproval.update({
        where: { id: pendingApproval.id },
        data: {
          status: 'REJECTED',
          performedById: user.id,
          performedAt: new Date(),
          remarks
        }
      });

      await prisma.facilityApproval.updateMany({
        where: {
          reservationId: id,
          stepOrder: { gt: pendingApproval.stepOrder },
          status: 'PENDING'
        },
        data: {
          status: 'REJECTED',
          remarks: `Rejected due to rejection by ${user.departmentCode}`
        }
      });

      await prisma.facilityReservation.update({
        where: { id },
        data: { status: 'REJECTED' }
      });

      for (const req of reservation.equipmentRequests) {
        const eq = await prisma.equipment.findUnique({
          where: { id: req.equipmentId },
          select: { quantityReserved: true }
        });
        const decrementBy = Math.min(req.quantityRequested, eq?.quantityReserved ?? 0);
        if (decrementBy > 0) {
          await prisma.equipment.update({
            where: { id: req.equipmentId },
            data: { quantityReserved: { decrement: decrementBy } }
          });
        }
      }

      try {
        await prisma.notification.create({
          data: {
            title: 'FRF Rejected',
            message: `Your FRF ${reservation.referenceId} was rejected by ${user.departmentCode}. Remarks: ${remarks || 'No remarks provided.'}`,
            isRead: false,
            recipientId: reservation.requestorId,
            senderId: user.id,
            // 🆕 Routing metadata
            linkUrl: `/dashboard/forms/frf?tab=my_requests&focus=${reservation.id}`,
            entityType: 'FRF',
            entityId: reservation.id,
          }
        });
      } catch (notifErr) {
        console.error('Rejection notification error:', notifErr);
      }

      await logActivity({
        req: request,
        userId: user.id,
        email: user.email,
        action: 'FRF_REJECT',
        details: JSON.stringify({
          reservationId: id,
          department: user.departmentCode,
          remarks
        })
      });

      return NextResponse.json({
        success: true,
        message: `Rejected by ${user.departmentCode}`,
        data: { status: 'REJECTED' }
      });
    }

    // ==========================================
    // RETURN FOR REVISION ACTION
    // ==========================================
    if (action === 'return') {
      const pendingApproval = reservation.approvals.find(
        a => a.status === 'PENDING' && a.departmentCode === user.departmentCode
      );

      if (user.departmentCode === 'HRD') {
        return NextResponse.json(
          { success: false, message: 'HRD does not have approval authority to return for revision.' },
          { status: 403 }
        );
      }

      if (!pendingApproval) {
        return NextResponse.json(
          { success: false, message: 'No pending approval for your department' },
          { status: 403 }
        );
      }

      if (!isHeadOrOIC(user) && !isSuperUser(user)) {
        return NextResponse.json(
          { success: false, message: 'Only Department Head or OIC can return for revision' },
          { status: 403 }
        );
      }

      if (!remarks) {
        return NextResponse.json(
          { success: false, message: 'Remarks are required for revision request' },
          { status: 400 }
        );
      }

      await prisma.facilityApproval.update({
        where: { id: pendingApproval.id },
        data: {
          status: 'REVISION_REQUESTED',
          performedById: user.id,
          performedAt: new Date(),
          revisionRequestedAt: new Date(),
          revisionReason: remarks
        }
      });

      await prisma.facilityReservation.update({
        where: { id },
        data: { status: 'REVISION_REQUESTED' }
      });

      for (const req of reservation.equipmentRequests) {
        const eq = await prisma.equipment.findUnique({
          where: { id: req.equipmentId },
          select: { quantityReserved: true }
        });
        const decrementBy = Math.min(req.quantityRequested, eq?.quantityReserved ?? 0);
        if (decrementBy > 0) {
          await prisma.equipment.update({
            where: { id: req.equipmentId },
            data: { quantityReserved: { decrement: decrementBy } }
          });
        }
      }

      try {
        await prisma.notification.create({
          data: {
            title: 'FRF Returned for Revision',
            message: `Your FRF ${reservation.referenceId} was returned for revision by ${user.departmentCode}. Reason: ${remarks || 'No reason provided.'}`,
            isRead: false,
            recipientId: reservation.requestorId,
            senderId: user.id,
            // 🆕 Routing metadata
            linkUrl: `/dashboard/forms/frf?tab=my_requests&focus=${reservation.id}`,
            entityType: 'FRF',
            entityId: reservation.id
          }
        });
      } catch (notifErr) {
        console.error('Return notification error:', notifErr);
      }

      await logActivity({
        req: request,
        userId: user.id,
        email: user.email,
        action: 'FRF_RETURN',
        details: JSON.stringify({
          reservationId: id,
          department: user.departmentCode,
          remarks
        })
      });

      return NextResponse.json({
        success: true,
        message: `Returned for revision by ${user.departmentCode}`,
        data: { status: 'REVISION_REQUESTED' }
      });
    }

    // ==========================================
    // ASSIGN ACTION (standalone)
    // ==========================================
    if (action === 'assign') {
      if (user.departmentCode !== 'ITO-MAIN' && user.departmentCode !== 'ITO') {
        return NextResponse.json(
          { success: false, message: 'Only ITO department can assign staff' },
          { status: 403 }
        );
      }

      if (!isHeadOrOIC(user) && !isSuperUser(user)) {
        return NextResponse.json(
          { success: false, message: 'Only Department Head or OIC can assign staff' },
          { status: 403 }
        );
      }

      if (!assignments || !Array.isArray(assignments) || assignments.length === 0) {
        return NextResponse.json(
          { success: false, message: 'At least one staff assignment is required' },
          { status: 400 }
        );
      }

      for (const assignment of assignments) {
        if (!assignment.userId || !assignment.dutyStart || !assignment.dutyEnd || !assignment.dutyType) {
          return NextResponse.json(
            { success: false, message: 'Each assignment must have userId, dutyStart, dutyEnd and dutyType' },
            { status: 400 }
          );
        }
        const staff = await prisma.user.findUnique({
          where: { id: assignment.userId }
        });
        if (!staff || (staff.departmentCode !== 'ITO-MAIN' && staff.departmentCode !== 'ITO')) {
          return NextResponse.json(
            { success: false, message: `Staff ${assignment.userId} not found or not in ITO department` },
            { status: 400 }
          );
        }
      }

      // ITO-MAIN can always (re)assign staff for this reservation

      // If already has assignments, replace them
      await prisma.facilityAssignment.deleteMany({ where: { reservationId: id } });

      const createdAssignments = [];
      for (const assignment of assignments) {
        const created = await prisma.facilityAssignment.create({
          data: {
            reservationId: id,
            userId: assignment.userId,
            dutyStart: new Date(assignment.dutyStart),
            dutyEnd: new Date(assignment.dutyEnd),
            dutyType: assignment.dutyType,
            notes: assignment.notes || null,
            isOvertime: !!assignment.isOvertime,
          },
          include: {
            user: {
              select: { id: true, fname: true, lname: true, email: true }
            }
          }
        });
        createdAssignments.push(created);
      }

      // 🆕 Notify newly assigned staff
      try {
        const uniqueStaffIds = [...new Set(assignments.map(a => a.userId))];
        const staffUsers = await prisma.user.findMany({
          where: { id: { in: uniqueStaffIds } },
          select: { id: true, email: true, fname: true, lname: true },
        });
        const assignmentDetails = assignments.map(a => ({
          userId: a.userId,
          staffName: `${staffUsers.find(s => s.id === a.userId)?.fname || ''} ${staffUsers.find(s => s.id === a.userId)?.lname || ''}`.trim(),
          dutyStart: a.dutyStart,
          dutyEnd: a.dutyEnd,
          dutyType: a.dutyType,
          isOvertime: a.isOvertime,
          notes: a.notes,
        }));
        if (staffUsers.length > 0) {
          await sendFRFAssignmentToStaff(staffUsers, reservation, assignmentDetails);
        }

        // 🆕 In-app notifications for each assigned staff
        for (const staff of staffUsers) {
          const myDuties = assignmentDetails.filter(a => a.userId === staff.id);
          if (myDuties.length === 0) continue;
          await prisma.notification.create({
            data: {
              title: "You've Been Assigned to an Event",
              message: `You have ${myDuties.length} duty assignment(s) for ${reservation.referenceId} — "${reservation.eventName || 'Facility Event'}".`,
              isRead: false,
              recipientId: staff.id,
              senderId: user.id,
              linkUrl: `/dashboard/forms/frf?tab=assigned_to_me&focus=${reservation.id}`,
              entityType: 'FRF',
              entityId: reservation.id,
            }
          });
        }
      } catch (staffNotifErr) {
        console.error('Staff assignment notification error (assign action):', staffNotifErr);
      }

      await logActivity({
        req: request,
        userId: user.id,
        email: user.email,
        action: 'FRF_ASSIGN',
        details: JSON.stringify({
          reservationId: id,
          assignments: assignments.map(a => ({
            staffId: a.userId,
            dutyStart: a.dutyStart,
            dutyEnd: a.dutyEnd
          }))
        })
      });

      return NextResponse.json({
        success: true,
        message: `${assignments.length} staff assigned successfully`,
        data: { assignments: createdAssignments }
      });
    }

    // ==========================================
    // OCM FINAL EDIT ACTION
    // ==========================================
    if (action === 'ocm-finalize') {
      if (user.departmentCode !== 'OCM' && user.departmentCode !== 'OCM') {
        return NextResponse.json(
          { success: false, message: 'Only OCM department can finalize' },
          { status: 403 }
        );
      }

      if (!finalEditData) {
        return NextResponse.json(
          { success: false, message: 'Final edit data is required' },
          { status: 400 }
        );
      }

      const { eventName, attendeesCount, usageHours, withCharge, requestorNotes, dates } = finalEditData;

      await prisma.$transaction(async (tx) => {
        await tx.facilityReservation.update({
          where: { id },
          data: {
            eventName: eventName || undefined,
            attendeesCount: attendeesCount || 0,
            usageHours: usageHours || null,
            withCharge: withCharge !== undefined ? withCharge : undefined,
            requestorNotes: requestorNotes || undefined,
            ocmEditedById: user.id,
            ocmEditedAt: new Date(),
            status: 'COMPLETED',
          },
        });

        await tx.facilityReservationDate.deleteMany({
          where: { reservationId: id },
        });

        if (dates && dates.length > 0) {
          await tx.facilityReservationDate.createMany({
            data: dates.map(entry => ({
              reservationId: id,
              date: new Date(entry.date),
              setupTime: new Date(entry.setupTime),
              eventStart: new Date(entry.eventStart),
              eventEnd: new Date(entry.eventEnd),
              teardownTime: new Date(entry.teardownTime),
              placeId: entry.placeId || undefined,
              placeOther: entry.placeOther || undefined,
            })),
          });
        }
      });

      try {
        const completionRes = await prisma.facilityReservation.findUnique({
          where: { id },
          include: {
            requestor: true,
            dates: { include: { place: true } },
            approvals: {
              orderBy: { stepOrder: 'asc' },
              include: { performedBy: { select: { fname: true, lname: true } } },
            },
            equipmentRequests: { include: { equipment: true } },
            assignments: {
              include: { user: { select: { id: true, fname: true, lname: true, email: true } } },
            },
            packUpDoneBy: {
              select: { fname: true, lname: true, email: true, departmentCode: true },
            },
          },
        });
        if (completionRes) {
          await sendFRFCompletionNotification(completionRes);
        }
      } catch (emailErr) {
        console.error('[FRF_COMPLETION] email send error on OCM finalize (non-fatal):', emailErr);
      }

      await logActivity({
        req: request,
        userId: user.id,
        email: user.email,
        action: 'FRF_OCM_FINALIZE',
        details: JSON.stringify({
          reservationId: id,
          edits: finalEditData
        })
      });

      try {
        await prisma.notification.create({
          data: {
            title: 'FRF Completed',
            message: `Your FRF ${reservation.referenceId} has been finalized and completed by OCM.`,
            isRead: false,
            recipientId: reservation.requestorId,
            senderId: user.id,
            // 🆕 Routing metadata
            linkUrl: `/dashboard/forms/frf?tab=completed&focus=${reservation.id}`,
            entityType: 'FRF',
            entityId: reservation.id
          }
        });
      } catch (notifErr) {
        console.error('OCM finalize notification error:', notifErr);
      }

      return NextResponse.json({
        success: true,
        message: 'Reservation finalized by OCM',
        data: { status: 'COMPLETED' }
      });
    }

    if (action === 'reschedule') {
      const isVenueOnly = reservation.isVenueOnly;

      // 1. Only requestor can reschedule
      if (reservation.requestorId !== user.id) {
        return NextResponse.json(
          { success: false, message: 'Only the requestor can reschedule' },
          { status: 403 }
        );
      }

      // 2. Only APPROVED or COMPLETED reservations can be rescheduled
      if (reservation.status !== 'APPROVED' && reservation.status !== 'COMPLETED') {
        return NextResponse.json(
          { success: false, message: 'Only approved or completed reservations can be rescheduled' },
          { status: 400 }
        );
      }

      // 3. Extract fields from body (BEFORE validation)
      const {
        dates: newDatesArray,
        reason,
        type: newType,
        attendeesCount: newAttendeesCount,
        equipmentRequests: newEquipmentRequests,
        withCharge: newWithCharge,
        requestorNotes: newRequestorNotes,
        eventName: newEventName
      } = body;

      if (!newDatesArray || newDatesArray.length === 0) {
        return NextResponse.json(
          { success: false, message: 'At least one new date is required' },
          { status: 400 }
        );
      }

      // 4. Validate min reschedule days
      const settings = await prisma.formSettings.findUnique({
        where: { id: 'single' },
      });
      const minRescheduleDays = settings?.minRescheduleDays ?? 3;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const minAllowedDate = new Date(today);
      minAllowedDate.setDate(today.getDate() + minRescheduleDays);

      const earliestNewDate = newDatesArray.reduce((earliest, entry) => {
        const d = new Date(entry.date);
        d.setHours(0, 0, 0, 0);
        return d < earliest ? d : earliest;
      }, new Date(8640000000000000));

      if (earliestNewDate < minAllowedDate) {
        return NextResponse.json(
          {
            success: false,
            message: `Reschedule date must be at least ${minRescheduleDays} day(s) from today (earliest allowed: ${minAllowedDate.toLocaleDateString()}).`,
          },
          { status: 400 }
        );
      }

      if (earliestNewDate < minAllowedDate) {
        return NextResponse.json(
          {
            success: false,
            message: `Reschedule date must be at least ${minRescheduleDays} day(s) from today (earliest allowed: ${minAllowedDate.toLocaleDateString()}).`,
          },
          { status: 400 }
        );
      }
      if (!newDatesArray || newDatesArray.length === 0) {
        return NextResponse.json(
          { success: false, message: 'At least one new date is required' },
          { status: 400 }
        );
      }

      const capacityError = await validateMultiPurposeHallLimit(newDatesArray, newAttendeesCount || reservation.attendeesCount);
      if (capacityError) {
        return NextResponse.json({ success: false, message: capacityError }, { status: 400 });
      }

      // 4. Validate new dates
      for (const entry of newDatesArray) {
        const setup = new Date(entry.setupTime);
        const start = new Date(entry.eventStart);
        const end = new Date(entry.eventEnd);
        const teardown = new Date(entry.teardownTime);

        if (setup.getTime() + 3600000 > start.getTime()) {
          return NextResponse.json({
            success: false,
            message: 'Starting time must be at least 1 hour before Actual Time Start'
          }, { status: 400 });
        }
        if (end.getTime() > teardown.getTime()) {
          return NextResponse.json({
            success: false,
            message: 'Time End must be before or equal to Actual Time End'
          }, { status: 400 });
        }
      }

      // 5. Determine equipment to use (new if provided, otherwise existing)
      const equipmentToUse = newEquipmentRequests || reservation.equipmentRequests.map(eq => ({
        equipmentId: eq.equipmentId,
        quantity: eq.quantityRequested
      }));

      // 6. Detect LED Wall and CDO Equipment from the NEW equipment
      let hasLedWall = false;
      let hasCDOEquipment = false;
      let hasITOEquipment = false;

      if (equipmentToUse.length > 0) {
        const equipmentIds = equipmentToUse.map(item => item.equipmentId);
        const equipmentList = await prisma.equipment.findMany({
          where: { id: { in: equipmentIds } },
          select: { id: true, name: true, departmentCode: true }
        });
        hasLedWall = equipmentList.some(eq =>
          eq.name === 'LED Wall' || eq.name === 'LED_WALL' || eq.name === 'LED_Wall'
        );
        hasCDOEquipment = equipmentList.some(eq => eq.departmentCode === 'CDO');
        hasITOEquipment = equipmentList.some(eq => eq.departmentCode === 'ITO-MAIN');
      }

      // 7. Determine type (new if provided, otherwise existing)
      const finalType = newType || reservation.type;

      // ---------- DYNAMIC APPROVAL LOGIC ----------
      // 8. Detect original equipment status (from the existing reservation)
      const originalEquipmentIds = reservation.equipmentRequests.map(eq => eq.equipmentId);
      let originalHasLedWall = false;
      let originalHasCDOEquipment = false;
      let originalHasITOEquipment = false;
      if (originalEquipmentIds.length > 0) {
        const originalEquipmentList = await prisma.equipment.findMany({
          where: { id: { in: originalEquipmentIds } },
          select: { id: true, name: true, departmentCode: true }
        });
        originalHasLedWall = originalEquipmentList.some(eq =>
          eq.name === 'LED Wall' || eq.name === 'LED_WALL' || eq.name === 'LED_Wall'
        );
        originalHasCDOEquipment = originalEquipmentList.some(eq => eq.departmentCode === 'CDO');
        originalHasITOEquipment = originalEquipmentList.some(eq => eq.departmentCode === 'ITO-MAIN');
      }

      // 9. Get already approved (non‑HRD) departments from the original approval flow
      const originalApprovedDepts = new Set(
        reservation.approvals
          .filter(a => a.status === 'APPROVED' || a.status === 'ACKNOWLEDGED')
          .map(a => a.departmentCode)
      );

      // 10. Compute full new sequence based on new type and equipment
      const fullNewSequence = getApprovalSequence(finalType, hasLedWall, hasCDOEquipment, hasITOEquipment)
        .filter(dept => dept !== user.departmentCode);

      // 11. Core departments that always need re‑approval on reschedule
      const coreDepartments = new Set(['PSMO/FMO', 'SAFETY-SECURITY', 'ITO-MAIN', 'HRD']);

      // 12. Determine which departments to include
      const rescheduleDepartments = fullNewSequence.filter(dept => {
        // Always keep core
        if (coreDepartments.has(dept)) return true;

        // OP only if LED Wall is newly added
        if (dept === 'OP') {
          return hasLedWall && !originalHasLedWall;
        }

        // CDO only if CDO equipment is newly added
        if (dept === 'CDO') {
          return hasCDOEquipment && !originalHasCDOEquipment;
        }

        // OSA only if type changed to WITH_STUDENTS
        // and either the type changed or OSA wasn't already approved
        if (dept === 'OSA') {
          if (finalType !== 'WITH_STUDENTS') return false;
          // If it was already approved and type didn't change, skip
          if (reservation.type === 'WITH_STUDENTS' && originalApprovedDepts.has('OSA')) return false;
          // Otherwise include (type changed or not yet approved)
          return true;
        }

        // For any other department not in core, keep only if it wasn't already approved
        return !originalApprovedDepts.has(dept);
      });

      // Remove duplicates and preserve order
      const finalApprovalSequence = [...new Set(rescheduleDepartments)];

      // 13. Apply venue‑only filter (remove ITO-MAIN if venue-only)
      const finalSequence = isVenueOnly
        ? finalApprovalSequence.filter(dept => dept !== 'ITO-MAIN')
        : finalApprovalSequence;
      
      const isRequestorHead = isHeadOrOIC(user);

      const rescheduleApprovals = [];
      rescheduleApprovals.push({
        departmentCode: user.departmentCode,
        stepOrder: 1,
        status: isRequestorHead ? 'APPROVED' : 'PENDING',
        ...(isRequestorHead && {
          performedById: user.id,
          performedAt: new Date(),
        }),
      });

      finalSequence.forEach((dept, index) => {
        rescheduleApprovals.push({
          departmentCode: dept,
          stepOrder: 2 + index,
          status: 'PENDING'
        });
      });

      // 15. Store original dates for reference
      const originalDates = reservation.dates.map(d => ({
        date: d.date,
        setupTime: d.setupTime,
        eventStart: d.eventStart,
        eventEnd: d.eventEnd,
        teardownTime: d.teardownTime,
        placeId: d.placeId,
        placeOther: d.placeOther,
      }));

      // 🆕 15.5. Store original equipment for history
      const originalEquipment = reservation.equipmentRequests.map(eq => ({
        equipmentId: eq.equipmentId,
        quantityRequested: eq.quantityRequested,
        equipmentName: eq.equipment?.name,
        departmentCode: eq.equipment?.departmentCode,
      }));

      // 16. Store original approvals as JSON for history
      const originalApprovals = reservation.approvals.map(a => ({
        id: a.id,
        departmentCode: a.departmentCode,
        stepOrder: a.stepOrder,
        status: a.status,
        performedById: a.performedById,
        performedAt: a.performedAt,
        remarks: a.remarks,
        revisionReason: a.revisionReason,
        acknowledgedAt: a.acknowledgedAt,
        performedByName: a.performedBy ? `${a.performedBy.fname} ${a.performedBy.lname}` : null,
        performedBy: a.performedBy ? { fname: a.performedBy.fname, lname: a.performedBy.lname } : undefined,
      }));

        await prisma.$transaction(async (tx) => {

          for (const req of reservation.equipmentRequests) {
            const eq = await tx.equipment.findUnique({
              where: { id: req.equipmentId },
              select: { isSingleItem: true, quantityReserved: true }
            });
            if (!eq) continue;

            const reserveDec = Math.min(req.quantityRequested, eq.quantityReserved);

            if (eq.isSingleItem) {
              // ✅ Single items: release reservation only, don't touch availability
              if (reserveDec > 0) {
                await tx.equipment.update({
                  where: { id: req.equipmentId },
                  data: { quantityReserved: { decrement: reserveDec } }
                });
              }
            } else {
              await tx.equipment.update({
                where: { id: req.equipmentId },
                data: {
                  quantityAvailable: { increment: req.quantityRequested },
                  quantityReserved: { decrement: reserveDec }
                }
              });
            }
          }

        // Delete old dates and equipment
        await tx.facilityReservationDate.deleteMany({
          where: { reservationId: id }
        });
        await tx.facilityEquipmentRequest.deleteMany({
          where: { reservationId: id }
        });

        // Update main record with new data
        await tx.facilityReservation.update({
          where: { id },
          data: {
            status: 'RESCHEDULE_PENDING',
            isReschedule: true,
            originalDates: originalDates,
            originalEquipment: originalEquipment,
            originalApprovals: originalApprovals,
            requestorNotes: newRequestorNotes || reason || `Reschedule requested: ${new Date().toLocaleString()}`,
            type: finalType,
            eventName: newEventName || reservation.eventName,
            attendeesCount: newAttendeesCount || reservation.attendeesCount,
            withCharge: newWithCharge !== undefined ? newWithCharge : reservation.withCharge,
            dates: {
              create: newDatesArray.map(entry => ({
                date: new Date(entry.date),
                setupTime: new Date(entry.setupTime),
                eventStart: new Date(entry.eventStart),
                eventEnd: new Date(entry.eventEnd),
                teardownTime: new Date(entry.teardownTime),
                placeId: entry.placeId || undefined,
                placeOther: entry.placeOther || undefined,
              }))
            },
            equipmentRequests: {
              create: equipmentToUse.map(item => ({
                equipmentId: item.equipmentId,
                quantityRequested: item.quantity || 1
              }))
            },
            approvals: {
              deleteMany: {},
              create: rescheduleApprovals
            }
          }
        });
      });

      for (const item of equipmentToUse) {
        const eq = await prisma.equipment.findUnique({
          where: { id: item.equipmentId },
          select: { isSingleItem: true, quantityAvailable: true, quantityReserved: true, name: true }
        });
        if (!eq) continue;

        const qty = eq.isSingleItem ? 1 : (item.quantity || 1);
        const trulyAvailable = eq.quantityAvailable - eq.quantityReserved;
        if (trulyAvailable < qty) {
          throw new Error(`Not enough stock for ${eq.name}. Available: ${trulyAvailable}, requested: ${qty}.`);
        }

        await prisma.equipment.update({
          where: { id: item.equipmentId },
          data: { quantityReserved: { increment: qty } }
        });
      }

      // 17. Notify the first department
      try {
            const firstApproval = rescheduleApprovals
              .filter(a => a.status === 'PENDING')
              .sort((a, b) => a.stepOrder - b.stepOrder)[0];
            if (firstApproval) {
              const deptHeads = await getDepartmentHeads(firstApproval.departmentCode);
              if (deptHeads.length > 0) {
                await sendFRFRescheduleNotification(deptHeads, reservation, firstApproval.departmentCode);

            const users = await prisma.user.findMany({
              where: {
                departmentCode: firstApproval.departmentCode,
                OR: [
                  { role: 'DepartmentHead' },
                  { oic_start: { lte: new Date().toISOString() }, oic_end: { gte: new Date().toISOString() } }
                ]
              },
              select: { id: true }
            });
            for (const u of users) {
              await prisma.notification.create({
                data: {
                  title: 'FRF Reschedule Pending',
                  message: `Reschedule request for ${reservation.referenceId} needs your approval.`,
                  isRead: false,
                  recipientId: u.id,
                  senderId: user.id,
                  // 🆕 Routing metadata
                  linkUrl: `/dashboard/forms/frf?tab=pending_approval&focus=${reservation.id}`,
                  entityType: 'FRF',
                  entityId: reservation.id,
                }
              });
            }
          }
        }
      } catch (notifErr) {
        console.error('Reschedule notification error:', notifErr);
      }

      await logActivity({
        req: request,
        userId: user.id,
        email: user.email,
        action: 'FRF_RESCHEDULE_REQUEST',
        details: JSON.stringify({
          reservationId: id,
          newDatesCount: newDatesArray.length,
          hasLedWall,
          hasCDOEquipment,
          reason
        })
      });

      return NextResponse.json({
        success: true,
        message: 'Reschedule request submitted for approval',
        data: { status: 'RESCHEDULE_PENDING' }
      });
    }


    // ==========================================
    // INVALID ACTION
    // ==========================================
    return NextResponse.json(
      { success: false, message: `Unknown action: ${action}` },
      { status: 400 }
    );

  } catch (error) {
    console.error('PATCH Reservation Error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to process request' },
      { status: 500 }
    );
  }
}

// ==========================================
// EVENT LIMIT VALIDATION HELPER
// ==========================================
const VENUE_CATEGORY_MAP = {
  'HRM Bar': 'CATEGORY_1',
  'Multipurpose Room': 'CATEGORY_1',
  'NCST Gym': 'CATEGORY_2',
  'NCST Field': 'CATEGORY_2',
};

async function getVenueCategory(placeName) {
  const place = await prisma.eventPlace.findUnique({
    where: { name: placeName },
    select: { category: true }
  });
  if (place?.category && place.category !== 'REGULAR') {
    return place.category;
  }
  return VENUE_CATEGORY_MAP[placeName] || 'REGULAR';
}

async function validateEventLimit(datesArray, venueIds, excludeId = null) {
  const errors = [];
  const allVenues = await prisma.eventPlace.findMany({
    where: { id: { in: venueIds } },
    select: { id: true, name: true, category: true }
  });
  const venueMap = Object.fromEntries(allVenues.map(v => [v.id, v]));

  // 🆕 VIP bypass — kapag may VIP place sa request, wag na i-apply ang daily limit
  const requestedHasVip = allVenues.some(v => v.category === 'VIP');
  if (requestedHasVip) {
    return []; // no limits for VIP events
  }

  for (const dateEntry of datesArray) {
    const eventDate = new Date(dateEntry.date);
    const dateStart = new Date(eventDate);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(dateStart);
    dateEnd.setDate(dateEnd.getDate() + 1);

    // 🆕 Exclude VIP reservations sa daily count (they don't occupy regular slots)
    const existingReservations = await prisma.facilityReservation.findMany({
      where: {
        status: { in: ['PENDING_APPROVAL', 'APPROVED', 'COMPLETED'] },
        id: excludeId ? { not: excludeId } : undefined,
        dates: {
          some: {
            date: { gte: dateStart, lt: dateEnd },
            OR: [
              { placeId: null },
              { place: { category: { not: 'VIP' } } }
            ]
          }
        }
      },
      include: {
        dates: {
          where: {
            date: { gte: dateStart, lt: dateEnd },
            OR: [
              { placeId: null },
              { place: { category: { not: 'VIP' } } }
            ]
          },
          include: { place: true }
        }
      }
    });

    const existingCategories = new Set();
    for (const res of existingReservations) {
      for (const d of res.dates) {
        if (d.place?.category && d.place.category !== 'VIP') {
          existingCategories.add(d.place.category);
        } else if (d.place?.name) {
          const cat = await getVenueCategory(d.place.name);
          if (cat !== 'REGULAR' && cat !== 'VIP') existingCategories.add(cat);
        }
      }
    }

    const requestedCategories = new Set();
    for (const venueId of venueIds) {
      const venue = venueMap[venueId];
      if (venue?.category && venue.category !== 'REGULAR' && venue.category !== 'VIP') {
        requestedCategories.add(venue.category);
      } else if (venue?.name) {
        const cat = await getVenueCategory(venue.name);
        if (cat !== 'REGULAR' && cat !== 'VIP') requestedCategories.add(cat);
      }
    }

    if (existingReservations.length >= 2) {
      errors.push(
        `Maximum of 2 events per day allowed on ${dateStart.toLocaleDateString()}`
      );
      continue;
    }

    if (requestedCategories.has('CATEGORY_1') && existingCategories.has('CATEGORY_1')) {
      errors.push(
        `Category 1 venue already booked on ${dateStart.toLocaleDateString()}`
      );
    }

    if (requestedCategories.has('CATEGORY_2') && existingCategories.has('CATEGORY_2')) {
      errors.push(
        `Category 2 venue already booked on ${dateStart.toLocaleDateString()}`
      );
    }

    if (existingCategories.has('CATEGORY_1') && existingCategories.has('CATEGORY_2') &&
        (requestedCategories.has('CATEGORY_1') || requestedCategories.has('CATEGORY_2'))) {
      errors.push(
        `Both Category 1 and Category 2 are occupied on ${dateStart.toLocaleDateString()}`
      );
    }
  }
  

  return errors;
}

// ==========================================
// DELETE /api/frf/reservation?id=xxx
// Deletes a DRAFT reservation (requestor or SuperUser only)
// ==========================================
export async function DELETE(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, message: 'Reservation ID is required' }, { status: 400 });
    }

    const reservation = await prisma.facilityReservation.findUnique({
      where: { id },
      select: { id: true, requestorId: true, status: true, attachments: true, referenceId: true }
    });

    if (!reservation) {
      return NextResponse.json({ success: false, message: 'Reservation not found' }, { status: 404 });
    }

    if (reservation.requestorId !== user.id && !isSuperUser(user)) {
      return NextResponse.json({ success: false, message: 'Only the requestor or SuperUser can delete this reservation' }, { status: 403 });
    }

    if (reservation.status !== 'DRAFT') {
      return NextResponse.json({ success: false, message: 'Only draft reservations can be deleted' }, { status: 400 });
    }

    // Best-effort blob cleanup
    if (reservation.attachments && reservation.attachments.length > 0) {
      try {
        await del(reservation.attachments);
      } catch (delErr) {
        console.error('Draft attachment blob deletion error:', delErr);
      }
    }

    await prisma.facilityReservation.delete({ where: { id } });

    await logActivity({
      req: request,
      userId: user.id,
      email: user.email,
      action: 'FRF_DRAFT_DELETED',
      details: JSON.stringify({ reservationId: id, referenceId: reservation.referenceId })
    });

    return NextResponse.json({ success: true, message: 'Draft deleted' });
  } catch (error) {
    console.error('DELETE Reservation Error:', error);
    return NextResponse.json({ success: false, message: error.message || 'Failed to delete reservation' }, { status: 500 });
  }
}