import { NextResponse } from 'next/server';
import { prisma } from "../../../prisma/prisma";
import { logActivity } from "../../lib/logger";
import { jwtVerify } from "jose";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

async function getAuthenticatedUser(request) {
  const cookieHeader = request.headers.get("cookie") || "";
  if (!cookieHeader) return null;

  const cookieParts = cookieHeader.split(";").map((c) => c.trim());
  const sessionCookie = cookieParts.find((c) => c.startsWith("session_token="));
  if (!sessionCookie) return null;

  const token = sessionCookie.split("=")[1];
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    const userId = payload && payload.id ? String(payload.id) : null;

    if (!userId) return null;
    return await prisma.user.findUnique({ where: { id: userId } });
  } catch (err) {
    console.error("JWT Session verification broken:", err);
    return null;
  }
}

// 📄 1. FIX: GINAWANG LIGTAS AT CASE-INSENSITIVE ANG PAGHAHANAP SA MGA HEADS
async function getDepartmentUsers(deptCode, roles) {
  return await prisma.user.findMany({
    where: {
      departmentCode: deptCode,
      role: roles ? { in: roles } : undefined // Strict Enum Array Match
    },
    select: { id: true }
  });
}

// ==========================================
// 1. GET ALL MEMOS WITH TRACKER STATS
// ==========================================
export async function GET(request) {
  try {
    const memos = await prisma.memo.findMany({
      include: { recipients: true },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(memos, { status: 200 });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// ==========================================
// 2. CREATE NEW MEMO (POST METHOD)
// ==========================================
export async function POST(request) {
  try {
    const authenticatedUser = await getAuthenticatedUser(request);
    if (!authenticatedUser) {
      return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 });
    }

    const formData = await request.formData();
    
    const subject = formData.get("subject");
    const content = formData.get("content");
    const priority = formData.get("priority") || 'ROUTINE';
    const purpose = formData.get("purpose") || 'FYI';
    const parentMemoId = formData.get("parentMemoId");
    const rootMemoId = formData.get("rootMemoId");
    const password = formData.get("password");
    const targetDepts = formData.getAll("targetDepts");

    if (authenticatedUser.password !== password) {
      return NextResponse.json({ success: false, message: "Security Verification Failed: Incorrect Signature Password" }, { status: 403 });
    }

    const file = formData.get("memoAttachment");
    let savedFilePath = null;

    if (file && file.size > 0) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const cleanFilename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
      const uploadDir = path.join(process.cwd(), "public", "memos");
      await mkdir(uploadDir, { recursive: true });
      await writeFile(path.join(uploadDir, cleanFilename), buffer);
      savedFilePath = `/memos/${cleanFilename}`;
    }

    const userDept = authenticatedUser.departmentCode || "GEN";
    const senderFullName = `${authenticatedUser.fname} ${authenticatedUser.lname}`;
    const databaseUserRole = authenticatedUser.role ? authenticatedUser.role.toUpperCase() : "STAFF";

    let initialMemoStatus = "APPROVED";
    if ((databaseUserRole === "STAFF" || databaseUserRole === "USER") && !parentMemoId) {
      initialMemoStatus = "FOR_APPROVAL";
    }

    const currentYear = new Date().getFullYear();
    const count = await prisma.memo.count({
      where: { senderDept: userDept, createdAt: { gte: new Date(`${currentYear}-01-01`) } }
    });
    
    const timestampSuffix = Math.floor(Math.random() * 9000) + 1000;
    const refId = initialMemoStatus === "FOR_APPROVAL" 
      ? `DRAFT-${userDept}-${currentYear}-${String(count + 1).padStart(3, '0')}-${timestampSuffix}`
      : `${userDept}-${currentYear}-${String(count + 1).padStart(3, '0')}`;

    const deadlineAt = priority === 'RUSH' ? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) : null;

    const newMemo = await prisma.memo.create({
      data: {
        referenceId: refId,
        subject,
        content,
        attachmentPath: savedFilePath,
        priority,
        purpose,
        senderId: authenticatedUser.id,
        senderName: senderFullName,
        senderDept: userDept,
        status: initialMemoStatus, 
        deadlineAt,
        parentMemoId: parentMemoId || null,
        rootMemoId: rootMemoId || null,
        isRevisedByHead: false,
        recipients: {
          create: targetDepts.map(dept => ({
            departmentName: dept,
            status: "PENDING"
          }))
        }
      },
      include: { recipients: true }
    });

    if (!rootMemoId) {
      await prisma.memo.update({
        where: { id: newMemo.id },
        data: { rootMemoId: newMemo.id }
      });
    }

    if (parentMemoId) {
      await prisma.memoRecipientStatus.updateMany({
        where: {
          memoId: parentMemoId,
          departmentName: userDept,
          status: { in: ['PENDING', 'ACKNOWLEDGED', 'PROCESSING'] }
        },
        data: {
          status: 'RESPONDED',
          respondedAt: new Date(),
          feedbackNote: `Replied via Memo REF: ${refId}`
        }
      });
    }

    // =========================================================
    // 🎯 NOTIFICATION ENGINE INJECTION (POST)
    // =========================================================
    try {
      if (initialMemoStatus === "FOR_APPROVAL") {
       // ✨ Exact enum definition lang ang ipapasa natin para hindi mag-error si Prisma
        const internalHeads = await getDepartmentUsers(userDept, ['DepartmentHead']);
        
        if (internalHeads.length > 0) {
          await prisma.notification.createMany({
            data: internalHeads.map(head => ({
              title: "Draft Memo For Review",
              message: `${senderFullName} submitted a new draft memo requiring your signature approval. Ref: ${refId}`,
              isRead: false,
              recipientId: head.id,
              senderId: authenticatedUser.id
            }))
          });
        } else {
          console.warn(`⚠️ Warning: Walang nahanap na Head sa department: ${userDept}`);
        }

        // confirmation para sa nag-submit na staff
        await prisma.notification.create({
          data: {
            title: "Draft Submitted Successfully",
            message: `Your draft memo "${subject}" has been queued. It is currently pending approval/signature from your Department Head. Ref: ${refId}`,
            isRead: false,
            recipientId: authenticatedUser.id,
            senderId: authenticatedUser.id 
          }
        });
      } else {
        for (const dept of targetDepts) {
          const targetHeads = await getDepartmentUsers(dept, ['DepartmentHead']);
          if (targetHeads.length > 0) {
            await prisma.notification.createMany({
              data: targetHeads.map(head => ({
                title: "Inbound Inter-Office Memo",
                message: `New official memo released from ${userDept} department. Subject: ${subject}. Ref: ${refId}`,
                isRead: false,
                recipientId: head.id,
                senderId: authenticatedUser.id
              }))
            });
          }
        }
      }
    } catch (notifErr) { console.error("❌ Notification Generation Failed (POST):", notifErr); }

    try {
      await logActivity({
        req: request,
        userId: authenticatedUser.id,
        email: authenticatedUser.email,
        action: parentMemoId ? "IOM_REPLY_SUBMISSION" : (initialMemoStatus === "FOR_APPROVAL" ? "IOM_PENDING_APPROVAL" : "IOM_CREATION_SUCCESS"),
        details: JSON.stringify({ referenceId: refId, subject })
      });
    } catch (err) { console.error(err); }

    return NextResponse.json({ success: true, data: newMemo }, { status: 201 });
  } catch (error) {
    console.error("API POST Error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// ==========================================
// 3. DYNAMIC WORKFLOW ROUTE (PATCH METHOD)
// ==========================================
export async function PATCH(request) {
  try {
    const authenticatedUser = await getAuthenticatedUser(request);
    if (!authenticatedUser) {
      return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { 
      memoId, 
      departmentName, 
      password, 
      action, 
      feedbackNote, 
      isSenderClosing,
      subject, 
      content  
    } = body;

    if (authenticatedUser.password !== password) {
      return NextResponse.json({ success: false, message: "Security Verification Failed: Incorrect Signature Password" }, { status: 403 });
    }

    const employeeName = `${authenticatedUser.fname} ${authenticatedUser.lname}`;
    const userDept = authenticatedUser.departmentCode || "GEN";

    if (action === 'APPROVE') {
      const targetMemo = await prisma.memo.findUnique({ 
        where: { id: memoId },
        include: { recipients: true }
      });
      if (!targetMemo) {
        return NextResponse.json({ success: false, message: "Hindi mahanap ang orihinal na draft memo." }, { status: 404 });
      }

      const currentYear = new Date().getFullYear();
      const approvedCount = await prisma.memo.count({
        where: { senderDept: targetMemo.senderDept, status: 'APPROVED' }
      });
      
      const officialRefId = `${targetMemo.senderDept}-${currentYear}-${String(approvedCount + 1).padStart(3, '0')}`;
      const hasSubjectChanged = subject && subject !== targetMemo.subject;
      const hasContentChanged = content && content !== targetMemo.content;
      const isRevised = !!(hasSubjectChanged || hasContentChanged);

      const approvedMemo = await prisma.memo.update({
        where: { id: memoId },
        data: {
          status: 'APPROVED', 
          referenceId: officialRefId,
          subject: subject || targetMemo.subject,   
          content: content || targetMemo.content,   
          isRevisedByHead: isRevised                
        }
      });

      try {
        if (targetMemo.senderId !== authenticatedUser.id) {
          await prisma.notification.create({
            data: {
              title: "Draft Approved & Released",
              message: `Your draft memo has been signed and officially released by Head ${employeeName} as Ref: ${officialRefId}.`,
              isRead: false,
              recipientId: targetMemo.senderId,
              senderId: authenticatedUser.id
            }
          });
        }
        const destDepartments = targetMemo.recipients.map(r => r.departmentName);
        for (const dept of destDepartments) {
            const targetHeads = await getDepartmentUsers(dept, ['DepartmentHead']);          if (targetHeads.length > 0) {
            await prisma.notification.createMany({
              data: targetHeads.map(head => ({
                title: "Inbound Inter-Office Memo",
                message: `Official memo routing from ${targetMemo.senderDept} approved by Head. Ref: ${officialRefId}`,
                isRead: false,
                recipientId: head.id,
                senderId: authenticatedUser.id
              }))
            });
          }
        }
      } catch (err) { console.error(err); }

      try {
        await logActivity({
          req: request,
          userId: authenticatedUser.id,
          email: authenticatedUser.email,
          action: `IOM_DRAFT_APPROVAL_SUCCESS`,
          details: JSON.stringify({ memoId, officialRefId, revisedByHead: isRevised })
        });
      } catch (err) { console.error(err); }

      return NextResponse.json({ success: true, data: approvedMemo }, { status: 200 });
    }

    if (action === 'DISAPPROVE') {
      const targetMemo = await prisma.memo.findUnique({ 
        where: { id: memoId },
        include: { recipients: true } 
      });

      if (!targetMemo) {
        return NextResponse.json({ success: false, message: "Hindi mahanap ang orihinal na draft memo." }, { status: 404 });
      }

      await prisma.memo.update({
        where: { id: memoId },
        data: { status: 'APPROVED' }
      });

      await prisma.memoRecipientStatus.updateMany({
        where: { memoId: memoId },
        data: {
          status: 'DENIED',
          deniedBy: `System (via Head ${employeeName})`,
          deniedAt: new Date(),
          feedbackNote: "Draft disapproved by Sender's Department Head before official release."
        }
      });

      try {
        if (targetMemo.senderId !== authenticatedUser.id) {
          await prisma.notification.create({
            data: {
              title: "Draft Memo Disapproved",
              message: `Your draft memo "${targetMemo.subject}" was denied approval by Head ${employeeName} and routing has been terminated.`,
              isRead: false,
              recipientId: targetMemo.senderId,
              senderId: authenticatedUser.id
            }
          });
        }
      } catch (err) { console.error(err); }

      try {
        await logActivity({
          req: request,
          userId: authenticatedUser.id,
          email: authenticatedUser.email,
          action: `IOM_DRAFT_DISAPPROVED_AND_CANCELLED`,
          details: JSON.stringify({ memoId, originalSubject: targetMemo.subject })
        });
      } catch (err) { console.error(err); }

      return NextResponse.json({ success: true, message: "Memo draft disapproved. All potential recipient routes cancelled." }, { status: 200 });
    }

    const effectiveIsSenderClosing = isSenderClosing || (action === 'RESOLVE' && !departmentName);

    if (effectiveIsSenderClosing) {
      await prisma.memoRecipientStatus.updateMany({
        where: { 
          memoId: memoId,
          status: { in: ['PENDING', 'ACKNOWLEDGED', 'PROCESSING'] }
        },
        data: {
          status: 'RESPONDED',
          respondedAt: new Date(),
          feedbackNote: feedbackNote || `Force Closed & Resolved by Sender Head (${employeeName})`
        }
      });

      try {
        const targetMemo = await prisma.memo.findUnique({ where: { id: memoId } });
        if (targetMemo && targetMemo.senderId !== authenticatedUser.id) {
          await prisma.notification.create({
            data: {
              title: "Memo Closed by Origin Head",
              message: `The transaction workflow for Ref: ${targetMemo.referenceId} was forcefully closed and resolved by your Department Head.`,
              isRead: false,
              recipientId: targetMemo.senderId,
              senderId: authenticatedUser.id
            }
          });
        }
      } catch (err) { console.error(err); }

      try {
        await logActivity({
          req: request,
          userId: authenticatedUser.id,
          email: authenticatedUser.email,
          action: `IOM_SENDER_GLOBAL_RESOLVE_SUCCESS`,
          details: JSON.stringify({ memoId })
        });
      } catch (err) { console.error(err); }

      return NextResponse.json({ success: true, message: "Buong memo tracker logs ay matagumpay na naisara." }, { status: 200 });
    }

    if (!departmentName) {
      return NextResponse.json({ success: false, message: "System Error: Missing Department Name for this action." }, { status: 400 });
    }

    let currentSearchStatus;
    let updateData = {};
    let notificationPayload = null; 

    const parentMemoData = await prisma.memo.findUnique({ where: { id: memoId } });
    const memoRefString = parentMemoData ? parentMemoData.referenceId : "Unknown-Ref";
    const memoOwnerId = parentMemoData ? parentMemoData.senderId : null;

    switch (action) {
      case 'ACKNOWLEDGE':
        currentSearchStatus = 'PENDING';
        updateData = {
          status: 'ACKNOWLEDGED',
          acknowledgedBy: employeeName,
          acknowledgedAt: new Date()
        };
        notificationPayload = {
          recipientId: memoOwnerId,
          title: "Memo Acknowledged",
          message: `Your memo (${memoRefString}) has been opened and acknowledged by the ${departmentName} department.`
        };
        break;

      case 'START_PROCESSING':
        const currentRecord = await prisma.memoRecipientStatus.findFirst({
          where: { memoId, departmentName, status: { in: ['PENDING', 'ACKNOWLEDGED'] } }
        });
        currentSearchStatus = currentRecord ? currentRecord.status : 'ACKNOWLEDGED';
        
        updateData = {
          status: 'PROCESSING',
          processedBy: employeeName,
          processedAt: new Date()
        };
        notificationPayload = {
          recipientId: memoOwnerId,
          title: "Memo Under Processing",
          message: `The ${departmentName} department has updated your memo (${memoRefString}) status to PROCESSING.`
        };
        break;

      case 'DENY':
        const recordToDeny = await prisma.memoRecipientStatus.findFirst({
          where: { memoId, departmentName, status: { in: ['PENDING', 'ACKNOWLEDGED', 'PROCESSING'] } }
        });
        currentSearchStatus = recordToDeny ? recordToDeny.status : 'PENDING';
        
        if (!feedbackNote || feedbackNote.trim() === "") {
          return NextResponse.json({ success: false, message: "Kailangan ng Return Reason kapag magre-reject." }, { status: 400 });
        }

        updateData = {
          status: 'DENIED',
          deniedBy: employeeName,
          deniedAt: new Date(),
          feedbackNote: feedbackNote
        };
        notificationPayload = {
          recipientId: memoOwnerId,
          title: "Memo Returned / Denied",
          message: `ALERT: Your memo (${memoRefString}) was returned by ${departmentName}. Reason: "${feedbackNote}"`
        };
        break;

      case 'RESOLVE': {
        const targetRecord = await prisma.memoRecipientStatus.findFirst({
          where: { memoId, departmentName, status: { in: ['ACKNOWLEDGED', 'PROCESSING', 'PENDING'] } }
        });

        if (!targetRecord) {
          return NextResponse.json({ success: false, message: "No active inbound record found to mark as complete." }, { status: 404 });
        }

        const userBackendRole = (authenticatedUser?.role || "").toUpperCase();
        const checkIsHead = ['DEPARTMENTHEAD', 'OIC'].includes(userBackendRole);
        const resolutionNotice = checkIsHead 
          ? `Force Completed by Department Head (${employeeName}).`
          : `Marked Completed by ${employeeName}.`;

        currentSearchStatus = targetRecord.status;
        updateData = {
          status: 'RESPONDED',
          respondedAt: new Date(),
          feedbackNote: feedbackNote || targetRecord.feedbackNote || resolutionNotice
        };

        // 🎯 FIX: Inilipat ang Notification Payload bago mag-break para ma-execute sa labas ng switch
        notificationPayload = {
          recipientId: memoOwnerId,
          title: "Memo Action Completed",
          message: `The transaction for memo ${memoRefString} was marked COMPLETED by ${departmentName}.`
        };
        break;
      }

      case 'JOIN_PROCESSING': {
        const existingRecord = await prisma.memoRecipientStatus.findFirst({
          where: { memoId, departmentName }
        });

        if (!existingRecord) {
          return NextResponse.json({ success: false, message: "Record not found." }, { status: 404 });
        }

        const currentStaffs = existingRecord.processedBy ? existingRecord.processedBy : "";
        const updatedStaffs = currentStaffs ? `${currentStaffs}, ${employeeName}` : employeeName;

        currentSearchStatus = existingRecord.status;
        updateData = {
          processedBy: updatedStaffs,
          feedbackNote: existingRecord.feedbackNote || `Collaborative processing initiated.`
        };

        // 🎯 FIX: Niluto ang head payload para mag-execute sa bottom script flow
        try {
          const localHeads = await getDepartmentUsers(userDept, ['DepartmentHead', 'OIC', 'DEPARTMENTHEAD', 'DEPARTMENT HEAD']);
          if (localHeads.length > 0) {
            await prisma.notification.createMany({
              data: localHeads.map(head => ({
                title: "Staff Collaboration Update",
                message: `${employeeName} joined collaborative processing on inbound memo ${memoRefString}.`,
                isRead: false,
                recipientId: head.id,
                senderId: authenticatedUser.id
              }))
            });
          }
        } catch (err) { console.error(err); }
        break;
      }

      default:
        return NextResponse.json({ success: false, message: "Invalid action sequence requested" }, { status: 400 });
    }

    // --- EXECUTE FINAL STATE MODIFICATIONS ---
    const targetRecipientStatus = await prisma.memoRecipientStatus.findFirst({
      where: { memoId, departmentName, status: currentSearchStatus }
    });

    if (!targetRecipientStatus) {
      return NextResponse.json({ success: false, message: "Hindi mahanap ang memo ledger element para sa aksyong ito." }, { status: 404 });
    }

    const updatedStatus = await prisma.memoRecipientStatus.update({
      where: { id: targetRecipientStatus.id },
      data: updateData
    });

    // =========================================================
    // 🎯 TRIGGER FIRED FOR GENERAL SWITCH ROW NOTIFICATIONS
    // =========================================================
    try {
      if (notificationPayload && notificationPayload.recipientId) {
        await prisma.notification.create({
          data: {
            title: notificationPayload.title,
            message: notificationPayload.message,
            isRead: false,
            recipientId: notificationPayload.recipientId,
            senderId: authenticatedUser.id
          }
        });

        if (action === 'DENY') {
          const internalHeads = await getDepartmentUsers(userDept, ['DepartmentHead', 'OIC', 'DEPARTMENTHEAD', 'DEPARTMENT HEAD']);
          if (internalHeads.length > 0) {
            await prisma.notification.createMany({
              data: internalHeads.map(head => ({
                title: "Inbound Document Disapproved",
                message: `Your staff member ${employeeName} returned memo ${memoRefString} back to sender. Note: ${feedbackNote}`,
                isRead: false,
                recipientId: head.id,
                senderId: authenticatedUser.id
              }))
            });
          }
        }
      }
    } catch (err) { console.error("Switch Case Async Notification Injection Failed:", err); }

    try {
      await logActivity({
        req: request,
        userId: authenticatedUser.id,
        email: authenticatedUser.email,
        action: `IOM_${action}_SUCCESS`,
        details: JSON.stringify({ memoId, departmentName, note: feedbackNote })
      });
    } catch (err) { console.error(err); }

    return NextResponse.json({ success: true, data: updatedStatus }, { status: 200 });
  } catch (error) {
    console.error("Critical Matrix Failure:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}