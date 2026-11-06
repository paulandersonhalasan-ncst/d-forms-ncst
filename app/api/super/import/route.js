import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import bcrypt from 'bcrypt';
import { prisma } from '../../../../prisma/prisma';
import { logActivity } from '../../../lib/logger';

async function getAuthenticatedUser(request) {
  const cookieHeader = request.headers.get('cookie') || '';
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(';').map((c) => c.trim());
  const sessionCookie = parts.find((c) => c.startsWith('session_token='));
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

export async function POST(request) {
  const user = await getAuthenticatedUser(request);
  if (!user || user.role !== 'SuperUser') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get('file');
  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  let scopes = [];
  try {
    scopes = JSON.parse(formData.get('scopes') || '[]');
  } catch {
    return NextResponse.json({ error: 'Invalid scopes payload' }, { status: 400 });
  }
  const settingsMode = formData.get('settingsMode') === 'overwrite' ? 'overwrite' : 'skip';

  const content = await file.text();
  let data;
  try {
    data = JSON.parse(content);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON format' }, { status: 400 });
  }

  const results = {
    memos: { imported: 0, skipped: 0 },
    users: { imported: 0, skipped: 0 },
    departments: { imported: 0, skipped: 0 },
    eventPlaces: { imported: 0, skipped: 0 },
    equipment: { imported: 0, skipped: 0 },
    equipmentPlaces: { imported: 0, skipped: 0 },
    frf: { imported: 0, skipped: 0 },
    system: { action: 'skipped' },
  };
  const errors = [];
  const oldIdMap = new Map(); // legacy old->new memo id map, used below for parent/root

  // ==========================================
  // 1. DEPARTMENTS (prerequisite for users & equipment)
  // ==========================================
  if (scopes.includes('users') && Array.isArray(data.departments)) {
    for (const d of data.departments) {
      try {
        const existing = await prisma.department.findUnique({ where: { code: d.code } });
        if (existing) { results.departments.skipped++; continue; }
        await prisma.department.create({ data: { code: d.code } });
        results.departments.imported++;
      } catch (e) { errors.push(`Dept ${d.code}: ${e.message}`); results.departments.skipped++; }
    }
  }

  // ==========================================
  // 2. USERS (needs departments)
  // ==========================================
  if (scopes.includes('users') && Array.isArray(data.users)) {
    for (const u of data.users) {
      try {
        const existing = await prisma.user.findUnique({ where: { email: u.email } });
        if (existing) { results.users.skipped++; continue; }
        const dept = await prisma.department.findUnique({ where: { code: u.departmentCode } });
        if (!dept) { results.users.skipped++; errors.push(`User ${u.email}: dept ${u.departmentCode} missing`); continue; }

        // Random password + force reset — the backup never contains passwords
        const randomPassword = await bcrypt.hash(crypto.randomUUID(), 10);
        await prisma.user.create({
          data: {
            employee_id: u.employee_id || '',
            email: u.email,
            password: randomPassword,
            fname: u.fname,
            lname: u.lname,
            role: u.role || 'Staff',
            branch: u.branch || 'MAIN',
            departmentCode: u.departmentCode,
            oic_start: u.oic_start || null,
            oic_end: u.oic_end || null,
            disabled: !!u.disabled,
            forgot_password: true,   // force password reset on next login
          },
        });
        results.users.imported++;
      } catch (e) { errors.push(`User ${u.email}: ${e.message}`); results.users.skipped++; }
    }
  }

  // ==========================================
  // 3. EVENT PLACES (needed for FRF dates)
  // ==========================================
  const placeMap = new Map(); // oldId -> newId
  if (scopes.includes('frf') && Array.isArray(data.eventPlaces)) {
    for (const p of data.eventPlaces) {
      try {
        let target = await prisma.eventPlace.findUnique({ where: { name: p.name } });
        if (!target) {
          target = await prisma.eventPlace.create({
            data: {
              name: p.name,
              isActive: p.isActive !== false,
              branch: p.branch || 'MAIN',
              hasSetItems: !!p.hasSetItems,
              notes: p.notes || null,
              category: p.category || 'REGULAR',
            },
          });
          results.eventPlaces.imported++;
        } else {
          results.eventPlaces.skipped++;
        }
        placeMap.set(p.id, target.id);
      } catch (e) { errors.push(`Place ${p.name}: ${e.message}`); }
    }
  }

  // ==========================================
  // 4. EQUIPMENT (needed for FRF equipment requests)
  // ==========================================
  const equipMap = new Map(); // oldId -> newId
  if (scopes.includes('frf') && Array.isArray(data.equipment)) {
    for (const e of data.equipment) {
      try {
        let target = await prisma.equipment.findFirst({
          where: { name: e.name, departmentCode: e.departmentCode, branch: e.branch || null },
        });
        if (!target) {
          const dept = await prisma.department.findUnique({ where: { code: e.departmentCode } });
          if (!dept) { errors.push(`Equipment ${e.name}: dept ${e.departmentCode} missing`); continue; }
          target = await prisma.equipment.create({
            data: {
              name: e.name,
              departmentCode: e.departmentCode,
              isSingleItem: !!e.isSingleItem,
              quantityAvailable: e.quantityAvailable ?? 0,
              quantityReserved: e.quantityReserved ?? 0,
              branch: e.branch || 'MAIN',
            },
          });
          results.equipment.imported++;
        } else {
          results.equipment.skipped++;
        }
        equipMap.set(e.id, target.id);
      } catch (e2) { errors.push(`Equipment ${e.name}: ${e2.message}`); }
    }
  }

  // ==========================================
  // 5. EQUIPMENT ↔ PLACE links
  // ==========================================
  if (scopes.includes('frf') && Array.isArray(data.equipmentPlaces)) {
    for (const ep of data.equipmentPlaces) {
      try {
        const eqId = equipMap.get(ep.equipmentId);
        const placeId = placeMap.get(ep.placeId);
        if (!eqId || !placeId) { results.equipmentPlaces.skipped++; continue; }
        await prisma.equipmentPlace.upsert({
          where: { equipmentId_placeId: { equipmentId: eqId, placeId } },
          create: { equipmentId: eqId, placeId, isBundled: !!ep.isBundled },
          update: {},
        });
        results.equipmentPlaces.imported++;
      } catch { results.equipmentPlaces.skipped++; }
    }
  }

  // ==========================================
  // 6. MEMOS (existing logic, preserved)
  // ==========================================
  if (scopes.includes('memos') && Array.isArray(data.memos)) {
    const importedMemoIds = [];
    const importedRefIds = [];

    for (const memoData of data.memos) {
      try {
        let senderId = null;
        if (memoData.senderId) {
          const byId = await prisma.user.findUnique({ where: { id: memoData.senderId } });
          if (byId) senderId = byId.id;
        }
        if (!senderId && memoData.sender?.email) {
          const byEmail = await prisma.user.findUnique({ where: { email: memoData.sender.email } });
          if (byEmail) senderId = byEmail.id;
        }
        if (!senderId) { results.memos.skipped++; continue; }

        const baseRefId = memoData.referenceId
          ? `IMPORT-${memoData.referenceId}`
          : `IMPORT-RESTORE-${Date.now()}-${results.memos.imported}`;
        let finalRefId = baseRefId, counter = 0;
        while (await prisma.memo.findUnique({ where: { referenceId: finalRefId } })) {
          counter++;
          finalRefId = `${baseRefId}-${counter}`;
        }

        const newMemo = await prisma.memo.create({
          data: {
            referenceId: finalRefId,
            subject: memoData.subject || 'Restored Memo',
            content: memoData.content || '',
            priority: memoData.priority || 'ROUTINE',
            purpose: memoData.purpose || 'FYI',
            senderId,
            senderName: memoData.senderName || 'Unknown',
            senderDept: memoData.senderDept || 'GEN',
            status: memoData.status || 'APPROVED',
            deadlineAt: memoData.deadlineAt ? new Date(memoData.deadlineAt) : null,
            attachmentPaths: memoData.attachmentPaths || [],
            isRevisedByHead: !!memoData.isRevisedByHead,
            headNote: memoData.headNote || null,
            revisedSubject: memoData.revisedSubject || null,
            revisedHeadNote: memoData.revisedHeadNote || null,
            createdAt: memoData.createdAt ? new Date(memoData.createdAt) : undefined,
            lastActivityAt: memoData.lastActivityAt ? new Date(memoData.lastActivityAt) : undefined,
          },
        });

        importedMemoIds.push(newMemo.id);
        importedRefIds.push(newMemo.referenceId);
        oldIdMap.set(memoData.id, newMemo.id);

        for (const rec of memoData.recipients || []) {
          try {
            await prisma.memoRecipientStatus.create({
              data: {
                memoId: newMemo.id,
                departmentName: rec.departmentName,
                status: rec.status || 'PENDING',
                acknowledgedById: rec.acknowledgedById || null,
                acknowledgedByName: rec.acknowledgedByName || null,
                acknowledgedAt: rec.acknowledgedAt ? new Date(rec.acknowledgedAt) : null,
                processedAt: rec.processedAt ? new Date(rec.processedAt) : null,
                completedById: rec.completedById || null,
                completedByName: rec.completedByName || null,
                completedAt: rec.completedAt ? new Date(rec.completedAt) : null,
                feedbackNote: rec.feedbackNote || null,
                processedById: rec.processedById || null,
                processedByName: rec.processedByName || null,
                deniedById: rec.deniedById || null,
                deniedByName: rec.deniedByName || null,
                deniedAt: rec.deniedAt ? new Date(rec.deniedAt) : null,
                senderConfirmedById: rec.senderConfirmedById || null,
                senderConfirmedByName: rec.senderConfirmedByName || null,
                senderConfirmedAt: rec.senderConfirmedAt ? new Date(rec.senderConfirmedAt) : null,
                recipientConfirmedById: rec.recipientConfirmedById || null,
                recipientConfirmedByName: rec.recipientConfirmedByName || null,
                recipientConfirmedAt: rec.recipientConfirmedAt ? new Date(rec.recipientConfirmedAt) : null,
                closedById: rec.closedById || null,
                closedByName: rec.closedByName || null,
                closedAt: rec.closedAt ? new Date(rec.closedAt) : null,
                respondedAt: rec.respondedAt ? new Date(rec.respondedAt) : null,
                assignedToIds: rec.assignedToIds || [],
                assignedToNames: rec.assignedToNames || [],
                assignedAt: rec.assignedAt ? new Date(rec.assignedAt) : null,
              },
            });
          } catch (recErr) { errors.push(`Recipient error on ${memoData.referenceId}: ${recErr.message}`); }
        }

        for (const hist of memoData.history || []) {
          try {
            await prisma.memoHistory.create({
              data: {
                memoId: newMemo.id,
                departmentName: hist.departmentName || null,
                performedById: hist.performedById || senderId,
                performedByName: hist.performedByName || 'System',
                actorRole: hist.actorRole || 'SYSTEM',
                action: hist.action || 'CREATED',
                remarks: hist.remarks || null,
                createdAt: hist.createdAt ? new Date(hist.createdAt) : undefined,
              },
            });
          } catch {}
        }

        results.memos.imported++;
      } catch (e) {
        errors.push(`Memo ${memoData.referenceId || '?'}: ${e.message}`);
        results.memos.skipped++;
      }
    }

    // Fix parent/root pointers after all memos exist
    for (const memoData of data.memos) {
      if (!oldIdMap.has(memoData.id)) continue;
      const newId = oldIdMap.get(memoData.id);
      const patch = {};
      if (memoData.parentMemoId && oldIdMap.has(memoData.parentMemoId)) patch.parentMemoId = oldIdMap.get(memoData.parentMemoId);
      if (memoData.rootMemoId && oldIdMap.has(memoData.rootMemoId)) patch.rootMemoId = oldIdMap.get(memoData.rootMemoId);
      if (Object.keys(patch).length > 0) {
        await prisma.memo.update({ where: { id: newId }, data: patch }).catch(() => {});
      }
    }
  }

  // ==========================================
  // 7. FACILITY RESERVATIONS
  // ==========================================
      if (scopes.includes('frf') && Array.isArray(data.facilityReservations)) {
          for (const r of data.facilityReservations) {
            try {
              // 🆕 Prefix with IMPORT- so restored FRFs are read-only markers
              const baseRefId = r.referenceId
                ? `IMPORT-${r.referenceId}`
                : `IMPORT-RESTORE-${Date.now()}-${results.frf.imported}`;
              const importedRefId = baseRefId;

              // Idempotency: if already imported once, skip (no -1, -2 clones)
              const exists = await prisma.facilityReservation.findUnique({ where: { referenceId: importedRefId } });
              if (exists) { results.frf.skipped++; continue; }

        // Resolve requestor (by id, then email)
        let requestor = null;
        if (r.requestor?.id) requestor = await prisma.user.findUnique({ where: { id: r.requestor.id } });
        if (!requestor && r.requestor?.email) requestor = await prisma.user.findUnique({ where: { email: r.requestor.email } });
        if (!requestor) { results.frf.skipped++; errors.push(`FRF ${r.referenceId}: requestor missing`); continue; }

        const newRes = await prisma.facilityReservation.create({
          data: {
            referenceId: importedRefId,
            requestorId: requestor.id,
            requestorDept: r.requestorDept,
            type: r.type || 'EMPLOYEE_ONLY',
            eventName: r.eventName || null,
            attendeesCount: r.attendeesCount || 0,
            usageHours: r.usageHours ?? null,
            withCharge: !!r.withCharge,
            requestorNotes: r.requestorNotes || null,
            attachments: r.attachments || [],
            status: r.status || 'PENDING_APPROVAL',
            isVenueOnly: !!r.isVenueOnly,
            isReschedule: !!r.isReschedule,
            originalDates: r.originalDates || undefined,
            originalApprovals: r.originalApprovals || undefined,
            createdAt: r.createdAt ? new Date(r.createdAt) : undefined,
            updatedAt: r.updatedAt ? new Date(r.updatedAt) : undefined,
          },
        });

        // Dates
        for (const d of r.dates || []) {
          try {
            const place = d.place?.name
              ? await prisma.eventPlace.findUnique({ where: { name: d.place.name } })
              : null;
            await prisma.facilityReservationDate.create({
              data: {
                reservationId: newRes.id,
                date: new Date(d.date),
                setupTime: new Date(d.setupTime),
                eventStart: new Date(d.eventStart),
                eventEnd: new Date(d.eventEnd),
                teardownTime: new Date(d.teardownTime),
                placeId: place?.id || null,
                placeOther: d.placeOther || null,
              },
            });
          } catch (e) { errors.push(`FRF ${r.referenceId} date: ${e.message}`); }
        }

        // Approvals
        for (const a of r.approvals || []) {
          try {
            let performedById = a.performedById || null;
            if (performedById) {
              const perf = await prisma.user.findUnique({ where: { id: performedById } });
              if (!perf) performedById = null;
            }
            await prisma.facilityApproval.create({
              data: {
                reservationId: newRes.id,
                departmentCode: a.departmentCode,
                stepOrder: a.stepOrder,
                status: a.status || 'PENDING',
                performedById,
                performedAt: a.performedAt ? new Date(a.performedAt) : null,
                remarks: a.remarks || null,
                revisionRequestedAt: a.revisionRequestedAt ? new Date(a.revisionRequestedAt) : null,
                revisionReason: a.revisionReason || null,
                acknowledgedAt: a.acknowledgedAt ? new Date(a.acknowledgedAt) : null,
              },
            });
          } catch (e) { errors.push(`FRF ${r.referenceId} approval: ${e.message}`); }
        }

        // Equipment requests
        for (const er of r.equipmentRequests || []) {
          try {
            const eq = er.equipment?.name
              ? await prisma.equipment.findFirst({
                  where: { name: er.equipment.name, departmentCode: er.equipment.departmentCode },
                })
              : null;
            if (!eq) continue;
            await prisma.facilityEquipmentRequest.create({
              data: {
                reservationId: newRes.id,
                equipmentId: eq.id,
                quantityRequested: er.quantityRequested || 1,
              },
            });
          } catch {}
        }

        // Assignments (userId is required — skip if user not found)
        for (const ass of r.assignments || []) {
          try {
            let staff = null;
            if (ass.userId) staff = await prisma.user.findUnique({ where: { id: ass.userId } });
            if (!staff && ass.user?.email) staff = await prisma.user.findUnique({ where: { email: ass.user.email } });
            if (!staff) continue;
            await prisma.facilityAssignment.create({
              data: {
                reservationId: newRes.id,
                userId: staff.id,
                dutyStart: new Date(ass.dutyStart),
                dutyEnd: new Date(ass.dutyEnd),
                dutyType: ass.dutyType || 'SETUP',
                notes: ass.notes || null,
                isOvertime: !!ass.isOvertime,
              },
            });
          } catch {}
        }

        // Pack up done by
        if (r.packUpDoneBy?.email && r.packUpDoneAt) {
          const p = await prisma.user.findUnique({ where: { email: r.packUpDoneBy.email } });
          if (p) {
            await prisma.facilityReservation.update({
              where: { id: newRes.id },
              data: {
                packUpDoneAt: new Date(r.packUpDoneAt),
                packUpDoneById: p.id,
                packUpDoneNotes: r.packUpDoneNotes || null,
                packUpDonePhotos: r.packUpDonePhotos || [],
              },
            });
          }
        }

        results.frf.imported++;
      } catch (e) {
        errors.push(`FRF ${r.referenceId}: ${e.message}`);
        results.frf.skipped++;
      }
    }
  }

  // ==========================================
  // 8. SYSTEM SETTINGS (opt-in overwrite)
  // ==========================================
  if (scopes.includes('system') && settingsMode === 'overwrite') {
    try {
      if (Array.isArray(data.formSettings) && data.formSettings.length > 0) {
        const s = data.formSettings[0];
        await prisma.formSettings.upsert({
          where: { id: 'single' },
          create: {
            id: 'single',
            minAdvanceDaysRegular: s.minAdvanceDaysRegular ?? 7,
            minAdvanceDaysVIP: s.minAdvanceDaysVIP ?? 1,
            maxEventsPerDay: s.maxEventsPerDay ?? 2,
            minRescheduleDays: s.minRescheduleDays ?? 3,
            enableVipMode: s.enableVipMode !== false,
            updatedBy: user.id,
          },
          update: {
            minAdvanceDaysRegular: s.minAdvanceDaysRegular ?? 7,
            minAdvanceDaysVIP: s.minAdvanceDaysVIP ?? 1,
            maxEventsPerDay: s.maxEventsPerDay ?? 2,
            minRescheduleDays: s.minRescheduleDays ?? 3,
            enableVipMode: s.enableVipMode !== false,
            updatedBy: user.id,
          },
        });
      }

      if (Array.isArray(data.privacySettings) && data.privacySettings.length > 0) {
        const p = data.privacySettings[0];
        await prisma.privacySettings.upsert({
          where: { id: 'singleton' },
          create: {
            id: 'singleton',
            dpoBadgeUrl: p.dpoBadgeUrl || null,
            dpoRegistrationNo: p.dpoRegistrationNo || null,
            dpoRegisteredDate: p.dpoRegisteredDate ? new Date(p.dpoRegisteredDate) : null,
            dpoOfficerName: p.dpoOfficerName || null,
            dpoContactEmail: p.dpoContactEmail || null,
            dpoContactPhone: p.dpoContactPhone || null,
            dpoOfficeAddress: p.dpoOfficeAddress || null,
            noticeText: p.noticeText || null,
            lastUpdated: p.lastUpdated ? new Date(p.lastUpdated) : null,
            updatedById: user.id,
            updatedByName: `${user.fname} ${user.lname}`,
          },
          update: {
            dpoBadgeUrl: p.dpoBadgeUrl || null,
            dpoRegistrationNo: p.dpoRegistrationNo || null,
            dpoRegisteredDate: p.dpoRegisteredDate ? new Date(p.dpoRegisteredDate) : null,
            dpoOfficerName: p.dpoOfficerName || null,
            dpoContactEmail: p.dpoContactEmail || null,
            dpoContactPhone: p.dpoContactPhone || null,
            dpoOfficeAddress: p.dpoOfficeAddress || null,
            noticeText: p.noticeText || null,
            lastUpdated: p.lastUpdated ? new Date(p.lastUpdated) : null,
            updatedById: user.id,
            updatedByName: `${user.fname} ${user.lname}`,
          },
        });
      }

      results.system.action = 'overwritten';
    } catch (e) {
      errors.push(`System settings: ${e.message}`);
      results.system.action = 'failed';
    }
  }

  // ==========================================
  // 9. LOG
  // ==========================================
  const totalImported =
    results.memos.imported + results.users.imported + results.departments.imported +
    results.frf.imported + results.eventPlaces.imported + results.equipment.imported;

  await logActivity({
    req: request,
    userId: user.id,
    email: user.email,
    action: 'ADMIN_IMPORT_MEMOS',   // matches last_action allowlist & UI badge
    details: JSON.stringify({
      scopes,
      settingsMode,
      totalImported,
      results,
      errorCount: errors.length,
    }),
  });

  return NextResponse.json({
    success: true,
    message: `Restored ${totalImported} record(s). Check the results below for details.`,
    results,
    errors: errors.slice(0, 20),
  });
}