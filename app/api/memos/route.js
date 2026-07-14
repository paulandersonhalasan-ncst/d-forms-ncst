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

async function getDepartmentUsers(deptCode, roles) {
  return await prisma.user.findMany({
    where: {
      departmentCode: deptCode,
      role: roles ? { in: roles } : undefined 
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
      include: { 
        recipients: true,
        sender: true,
        history: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            remarks: true,
            createdAt: true,
            performedByName: true,
            actorRole: true, // 'SENDER' or 'RECIPIENT'
          }
        }
      },
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
    const parentMemoId = formData.get("parentMemoId") || null;
    const rootMemoId = formData.get("rootMemoId") || null;
    const password = formData.get("password");
    const targetDepts = formData.getAll("targetDepts");

    // 🐛 DEBUG: Log incoming data
    console.log('📝 Creating memo with:', {
      subject,
      parentMemoId,
      rootMemoId,
      targetDepts,
      isReply: !!parentMemoId,
    });

    if (authenticatedUser.password !== password) {
      return NextResponse.json({ success: false, message: "Security Verification Failed: Incorrect Signature Password" }, { status: 403 });
    }

    // File upload logic...
    const files = formData.getAll("memoAttachments");
    let savedFilePaths = [];
    const uploadDir = path.join(process.cwd(), "public", "memos");
    await mkdir(uploadDir, { recursive: true });
    if (files && files.length > 0) {
      for (const file of files) {
        if (file && file.size > 0 && typeof file.arrayBuffer === 'function') {
          const bytes = await file.arrayBuffer();
          const buffer = Buffer.from(bytes);
          const cleanFilename = `${Date.now()}-${Math.floor(Math.random() * 1000)}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
          await writeFile(path.join(uploadDir, cleanFilename), buffer);
          savedFilePaths.push(`/memos/${cleanFilename}`);
        }
      }
    }

    const userDept = authenticatedUser.departmentCode || "GEN";
    const senderFullName = `${authenticatedUser.fname} ${authenticatedUser.lname}`;
    const databaseUserRole = authenticatedUser.role ? authenticatedUser.role.toUpperCase() : "STAFF";

    let initialMemoStatus = "APPROVED";
    if ((databaseUserRole === "STAFF" || databaseUserRole === "USER" || databaseUserRole === "FACULTY") && !parentMemoId) {
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

    // ✅ CREATE memo with relation syntax
    const newMemo = await prisma.memo.create({
      data: {
        referenceId: refId,
        subject,
        content,
        attachmentPaths: savedFilePaths,
        priority,
        purpose,
        sender: { connect: { id: authenticatedUser.id } },
        senderName: senderFullName,
        senderDept: userDept,
        status: initialMemoStatus,
        deadlineAt,
        ...(parentMemoId && parentMemoId !== 'null' ? { parentMemo: { connect: { id: parentMemoId } } } : {}),
        ...(rootMemoId && rootMemoId !== 'null' ? { rootMemo: { connect: { id: rootMemoId } } } : {}),
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

    // 🐛 DEBUG: Log after create
    console.log('✅ After create:', {
      id: newMemo.id,
      parentMemoId: newMemo.parentMemoId,
      rootMemoId: newMemo.rootMemoId,
    });

    // ✅ Para sa original memo (walang root), i-set ang rootMemoId sa sarili
    if (!rootMemoId || rootMemoId === 'null') {
      await prisma.memo.update({
        where: { id: newMemo.id },
        data: { rootMemoId: newMemo.id }
      });
      
      // 🐛 DEBUG: Log after update
      console.log('✅ After root update: rootMemoId set to self');
    }

    // ✅ I-fetch ulit para makuha ang updated data kasama ang recipients
    const finalMemo = await prisma.memo.findUnique({
      where: { id: newMemo.id },
      include: { recipients: true }
    });

    // ✅ Update parent recipient status (reply)
    if (parentMemoId && parentMemoId !== 'null') {
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
    // NOTIFICATION ENGINE INJECTION (POST)
    // =========================================================
    try {
      if (initialMemoStatus === "FOR_APPROVAL") {
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
        }
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

    return NextResponse.json({ success: true, data: finalMemo }, { status: 201 });
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
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const contentType = request.headers.get("content-type") || "";
    
    let memoId, departmentName, action, password, feedbackNote, delegatedStaffId, isSenderClosing;
    let attachmentPaths = [];
    let newSubject, newContent, retainedAttachments;
    let headNote = null;

    // =================================================================================
    // 📎 FILE UPLOAD & FORMDATA PROCESSING
    // =================================================================================
    if (contentType.includes("multipart/form-data")) {

      const formData = await request.formData();
      memoId = formData.get("memoId");
      departmentName = formData.get("departmentName");
      action = formData.get("action");
      password = formData.get("password");
      feedbackNote = formData.get("feedbackNote");
      delegatedStaffId = formData.get("delegatedStaffId");
      isSenderClosing = formData.get("isSenderClosing") === "true";
      
      newSubject = formData.get("subject");
      newContent = formData.get("content");
      headNote = formData.get("headNote");
      retainedAttachments = formData.get("retainedAttachments") ? JSON.parse(formData.get("retainedAttachments")) : [];

      // Process attachments (recipient resolve)
      const files = formData.getAll("attachments");
      if (files && files.length > 0 && files[0] instanceof File) {
        const uploadDir = path.join(process.cwd(), "public", "uploads", "memos");
        await mkdir(uploadDir, { recursive: true });
        for (const file of files) {
          if (file.size === 0) continue;
          const buffer = Buffer.from(await file.arrayBuffer());
          const uniquePrefix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
          const finalFileName = `${uniquePrefix}-${cleanFileName}`;
          const filePath = path.join(uploadDir, finalFileName);
          await writeFile(filePath, buffer);
          attachmentPaths.push(`/uploads/memos/${finalFileName}`);
        }
      }

      // Process headNewAttachments (from SuperEditModal)
      const headNewAttachments = formData.getAll("headNewAttachments");
      if (headNewAttachments && headNewAttachments.length > 0) {
        const uploadDir = path.join(process.cwd(), "public", "memos");
        await mkdir(uploadDir, { recursive: true });
        for (const file of headNewAttachments) {
          if (file instanceof File && file.size > 0 && typeof file.arrayBuffer === 'function') {
            const bytes = await file.arrayBuffer();
            const buffer = Buffer.from(bytes);
            const cleanFilename = `${Date.now()}-${Math.floor(Math.random() * 1000)}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
            await writeFile(path.join(uploadDir, cleanFilename), buffer);
            attachmentPaths.push(`/memos/${cleanFilename}`);
          }
        }
      }
    } else {
      const body = await request.json();
      memoId = body.memoId;
      departmentName = body.departmentName;
      action = body.action;
      password = body.password;
      feedbackNote = body.feedbackNote || body.remarks || body.headNote;
      delegatedStaffId = body.delegatedStaffId;
      isSenderClosing = body.isSenderClosing || false;
    }

    // Common validations
    if (!password) {
      return NextResponse.json({ success: false, message: "Password signature required" }, { status: 400 });
    }

    // ✅ Require feedback note for all actions except ACKNOWLEDGE
    const trimmedFeedback = feedbackNote ? feedbackNote.trim() : '';
    if (action !== 'ACKNOWLEDGE' && action !== 'CREATE' && !trimmedFeedback) {
      return NextResponse.json({ 
        success: false, 
        message: "Remarks/Feedback note is required for this action." 
      }, { status: 400 });
    }

    const passwordMatch = (password === authenticatedUser.password);
    if (!passwordMatch) {
      return NextResponse.json({ success: false, message: "Security signature password invalid" }, { status: 403 });
    }

    const currentMemo = await prisma.memo.findUnique({
      where: { id: memoId },
      include: { recipients: true }
    });

    if (!currentMemo) {
      return NextResponse.json({ success: false, message: "Memo not found" }, { status: 404 });
    }

    const employeeName = `${authenticatedUser.fname} ${authenticatedUser.lname}`;
    const userDept = authenticatedUser.departmentCode;
    const now = new Date();

    let recipientUpdateData = {};
    let memoUpdateData = {};
    let historyActionType = action;
    let skipRecipientUpdate = false;

    const targetRecipient = currentMemo.recipients.find(r => r.departmentName === departmentName);

    // =================================================================================
    // ⚙️ WORKFLOW LOGIC ENGINE
    // =================================================================================
    if (action === 'CREATE') {
      // Draft creation defaults
    } else if (action === 'DISAPPROVE' || action === 'DISAPPROVE_DRAFT') {
      // Disapprove draft – set memo to DRAFT
      memoUpdateData = { status: 'DRAFT' };
      historyActionType = "DISAPPROVED";
      // feedback note will be saved in memoHistory later
    } else if (action === 'APPROVE') {
      const finalSubject = newSubject || currentMemo.subject;
      const finalContent = newContent || currentMemo.content;

      let finalContentWithNote = finalContent;
      if (headNote && headNote.trim()) {
        finalContentWithNote = `${finalContent}\n\n---\n📝 Department Head Notes:\n${headNote}`;
      }

      const hasHeadNote = !!(headNote && headNote.trim().length > 0);
      const isRevised = (finalSubject !== currentMemo.subject) || hasHeadNote;
      
      const retained = retainedAttachments || [];
      const allAttachments = [...retained, ...attachmentPaths];
      
      // ✅ Simpleng fix: tanggalin lang ang "DRAFT-" prefix
      let newReferenceId = currentMemo.referenceId;
      if (currentMemo.referenceId?.startsWith('DRAFT-')) {
        newReferenceId = currentMemo.referenceId.substring(6); // "DRAFT-" = 6 chars
      }

      memoUpdateData = {
        status: 'APPROVED',
        subject: finalSubject,
        content: finalContentWithNote,
        isRevisedByHead: isRevised,
        attachmentPaths: allAttachments,
        referenceId: newReferenceId
      };
      historyActionType = "APPROVED";

      console.log('🧪 isRevised value:', isRevised, 'type:', typeof isRevised);

      // Notifications for recipients
      try {
        const targetDepts = currentMemo.recipients.map(r => r.departmentName);
        for (const dept of targetDepts) {
          const targetHeads = await getDepartmentUsers(dept, ['DepartmentHead']);
          if (targetHeads.length > 0) {
            await prisma.notification.createMany({
              data: targetHeads.map(head => ({
                title: "Inbound Inter-Office Memo",
                message: `New official memo released from ${currentMemo.senderDept} department. Subject: ${finalSubject}. Ref: ${currentMemo.referenceId}`,
                isRead: false,
                recipientId: head.id,
                senderId: authenticatedUser.id
              }))
            });
          }
        }

        await prisma.notification.create({
          data: {
            title: "Memo Approved & Broadcasted",
            message: `Your memo "${finalSubject}" (Ref: ${currentMemo.referenceId}) has been approved and sent to all recipients.`,
            isRead: false,
            recipientId: authenticatedUser.id,
            senderId: authenticatedUser.id
          }
        });
      } catch (notifErr) {
        console.error("❌ Notification Generation Failed (APPROVE):", notifErr);
      }
    } else {
      // ============================================================
      // 🟡 WORKFLOW PARA SA MGA ACTION (ACKNOWLEDGE, START_PROCESSING, CLOSED, DENY)
      // ============================================================

      // 🆕 I-check kung FYI o Non-FYI
      if (currentMemo.purpose === 'FYI') {
        // ========== FYI WORKFLOW ==========
        if (action === 'ACKNOWLEDGE') {
          if (!targetRecipient) {
            return NextResponse.json({ success: false, message: "Department not a recipient" }, { status: 400 });
          }
          recipientUpdateData = {
            status: 'CLOSED',
            feedbackNote: feedbackNote || "Acknowledged FYI Document",
            respondedAt: now,
            closedAt: now,
            closedById: authenticatedUser.id,
            closedByName: `${employeeName} (${authenticatedUser.role})`,
            attachmentPaths: attachmentPaths.length > 0 ? attachmentPaths : undefined
          };
          historyActionType = "CLOSED";
        } else if (action === 'DENY') {
          if (!targetRecipient) {
            return NextResponse.json({ success: false, message: "Department not a recipient" }, { status: 400 });
          }
          // REQUIRE feedback note for DENY
          if (!feedbackNote) {
            return NextResponse.json({ success: false, message: "Feedback note is required for denial" }, { status: 400 });
          }
          recipientUpdateData = {
            status: 'DENIED',
            deniedById: authenticatedUser.id,
            deniedByName: employeeName,
            deniedAt: now,
            feedbackNote: feedbackNote
          };
          historyActionType = "DENIED";
        } else {
          return NextResponse.json({ success: false, message: `Action "${action}" not allowed for FYI memos` }, { status: 400 });
        }
      } else {
        // ========== NON-FYI WORKFLOW ==========
        if (action === 'ACKNOWLEDGE') {
          if (!targetRecipient) {
            return NextResponse.json({ success: false, message: "Department not a recipient" }, { status: 400 });
          }
          recipientUpdateData = {
            status: 'ACKNOWLEDGED',
            respondedAt: now,
            acknowledgedById: authenticatedUser.id,
            acknowledgedByName: employeeName,
          };
          historyActionType = "ACKNOWLEDGED";
        } else if (action === 'START_PROCESSING') {
          if (!targetRecipient) {
            return NextResponse.json({ success: false, message: "Department not a recipient" }, { status: 400 });
          }
          recipientUpdateData = {
            status: 'PROCESSING',
            processedAt: now,
            processedById: delegatedStaffId || authenticatedUser.id,
            processedByName: delegatedStaffId ? "Delegated Staff" : employeeName,
            feedbackNote: feedbackNote, // ✅ IDAGDAG ITO
          };
          historyActionType = "PROCESSING_STARTED";
        } else if (action === 'JOIN_PROCESSING') {
          if (!targetRecipient) {
            return NextResponse.json({ success: false, message: "Department not a recipient" }, { status: 400 });
          }
          
          // Check kung ang status ay PROCESSING o ACKNOWLEDGED (para pwedeng sumali)
          if (!['PROCESSING', 'ACKNOWLEDGED'].includes(targetRecipient.status)) {
            return NextResponse.json({ 
              success: false, 
              message: "Cannot join: memo must be in PROCESSING or ACKNOWLEDGED state." 
            }, { status: 400 });
          }

          const currentProcessedByName = targetRecipient.processedByName || '';
          const newProcessedByName = currentProcessedByName 
            ? `${currentProcessedByName}, ${employeeName}` 
            : employeeName;

          recipientUpdateData = {
            processedByName: newProcessedByName,
            processedAt: now,
            processedById: authenticatedUser.id,
            feedbackNote: feedbackNote || `Joined processing by ${employeeName}`,
            // Huwag baguhin ang status, mananatiling PROCESSING
          };
          historyActionType = "PROCESSING_JOINED";
        } else if (action === 'CLOSED') {
          if (isSenderClosing) {
            // ===== SENDER CLOSING =====
            // Kunin ang pinakabagong recipients
            const freshRecipients = await prisma.memoRecipientStatus.findMany({
              where: { memoId: memoId }
            });

            // Suriin kung lahat ng recipients ay tapos na (completed o denied)
            const allDone = freshRecipients.every(r => {
              if (['CLOSED', 'DENIED', 'COMPLETED'].includes(r.status)) return true;
              if (r.status === 'PROCESSING' && r.recipientConfirmedAt) return true;
              return false;
            });

            if (!allDone) {
              return NextResponse.json({
                success: false,
                message: "Cannot close: some recipients have not completed or denied"
              }, { status: 400 });
            }

            // I-update ang bawat eligible recipient (PROCESSING na may confirmed)
            const eligibleRecipients = freshRecipients.filter(r =>
              r.status === 'PROCESSING' && r.recipientConfirmedAt
            );

            for (const rec of eligibleRecipients) {
              await prisma.memoRecipientStatus.update({
                where: { id: rec.id },
                data: {
                  status: 'CLOSED',
                  senderConfirmedById: authenticatedUser.id,
                  senderConfirmedByName: employeeName,
                  senderConfirmedAt: now,
                  closedAt: now,
                  closedById: authenticatedUser.id,
                  closedByName: `${employeeName} (${authenticatedUser.role})`,
                  lastActivityAt: now
                }
              });
            }

            // I-update ang memo status
            memoUpdateData = {
              status: 'CLOSED',
              lastActivityAt: now
            };
            historyActionType = "CLOSED_BY_SENDER";
            skipRecipientUpdate = true;
          } else {
            // ===== RECIPIENT CLOSING =====
            if (!targetRecipient) {
              return NextResponse.json({ success: false, message: "Department not a recipient" }, { status: 400 });
            }
            recipientUpdateData = {
              status: 'COMPLETED',
              recipientConfirmedById: authenticatedUser.id,
              recipientConfirmedByName: employeeName,
              recipientConfirmedAt: now,
              feedbackNote: feedbackNote,
              attachmentPaths: attachmentPaths.length > 0 ? attachmentPaths : undefined
            };
            historyActionType = "COMPLETED";
          }
        } else if (action === 'DENY') {
          if (!targetRecipient) {
            return NextResponse.json({ success: false, message: "Department not a recipient" }, { status: 400 });
          }
          // REQUIRE feedback note for DENY
          if (!feedbackNote) {
            return NextResponse.json({ success: false, message: "Feedback note is required for denial" }, { status: 400 });
          }
          recipientUpdateData = {
            status: 'DENIED',
            deniedById: authenticatedUser.id,
            deniedByName: employeeName,
            deniedAt: now,
            feedbackNote: feedbackNote
          };
          historyActionType = "DENIED";
        } else {
          return NextResponse.json({ success: false, message: `Unknown action: ${action}` }, { status: 400 });
        }
      }
    }

    // =================================================================================
    // 3. DATABASE TRANSACTIONS
    // =================================================================================
    let updatedStatus = null;

    // Update recipient status if needed
    if (Object.keys(recipientUpdateData).length > 0 && !skipRecipientUpdate) {
      updatedStatus = await prisma.memoRecipientStatus.update({
        where: {
          memoId_departmentName: { memoId, departmentName }
        },
        data: {
          ...recipientUpdateData,
          lastActivityAt: now
        }
      });
    }

    // 🆕 Check if all recipients are now closed (for both FYI and Non-FYI)
    // Pero kung skipRecipientUpdate (sender closing), hindi na natin kailangan i-check ulit
    if (!skipRecipientUpdate) {
      const allRecipients = await prisma.memoRecipientStatus.findMany({
        where: { memoId: memoId }
      });

      const allClosed = allRecipients.every(r => 
        r.status === 'COMPLETED' || r.status === 'CLOSED' || r.status === 'DENIED'
      );

      if (allClosed) {
        memoUpdateData = {
          status: 'CLOSED',
          lastActivityAt: now
        };
      }
    }

    // Update memo status if needed
    if (Object.keys(memoUpdateData).length > 0) {
      await prisma.memo.update({
        where: { id: memoId },
        data: memoUpdateData
      });
    }

    // =================================================================================
    // 4. AUDIT TRAIL & NOTIFICATIONS
    // =================================================================================
    const memoRefString = currentMemo.referenceId || currentMemo.id.substring(0, 8).toUpperCase();
    await prisma.memoHistory.create({
      data: {
        memoId: memoId,
        departmentName: userDept,
        performedById: authenticatedUser.id,
        performedByName: employeeName,
        actorRole: userDept === currentMemo.senderDept ? 'SENDER' : 'RECIPIENT',
        action: historyActionType,
        remarks: feedbackNote || `Action: ${action} (system default)`
      }
    });

    // Notifications
    try {
      let notificationPayload = { recipientId: currentMemo.senderId, title: "", message: "" };
      if (action === 'ACKNOWLEDGE') {
        notificationPayload.title = "Document Acknowledged";
        notificationPayload.message = `Department ${departmentName} acknowledged memo ${memoRefString}.`;
      } else if (action === 'CLOSED') {
        if (isSenderClosing) {
          notificationPayload.title = "Memo Closed by Sender";
          notificationPayload.message = `Memo ${memoRefString} has been closed by sender.`;
        } else {
          notificationPayload.title = "Action Item Completed";
          notificationPayload.message = `Department ${departmentName} completed memo ${memoRefString}.`;
        }
      } else if (action === 'DENY') {
        notificationPayload.title = "Inbound Transaction Denied";
        notificationPayload.message = `Memo ${memoRefString} denied by ${departmentName}.`;
      }

      if (notificationPayload.title) {
        await prisma.notification.create({
          data: {
            title: notificationPayload.title,
            message: notificationPayload.message,
            isRead: false,
            recipientId: notificationPayload.recipientId,
            senderId: authenticatedUser.id
          }
        });
      }
    } catch (err) {
      console.error("Notification Failed:", err);
    }

    try {
      await logActivity({
        req: request,
        userId: authenticatedUser.id,
        email: authenticatedUser.email,
        action: `IOM_${action}_SUCCESS`,
        details: JSON.stringify({ referenceId: memoRefString, departmentName, note: feedbackNote })
      });
    } catch (err) {
      console.error(err);
    }

    return NextResponse.json({ success: true, data: updatedStatus }, { status: 200 });
  } catch (error) {
    console.error("Critical Matrix Failure:", error);
    return NextResponse.json({ success: false, message: "Internal server pipeline error." }, { status: 500 });
  }
}