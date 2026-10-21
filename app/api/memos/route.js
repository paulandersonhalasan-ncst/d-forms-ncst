import { NextResponse } from 'next/server';
import { prisma } from "../../../prisma/prisma";
import { logActivity } from "../../lib/logger";
import { jwtVerify } from "jose";
// import { writeFile, mkdir } from "fs/promises";
// import path from "path";
import {
  sendMemoSubmittedForApproval,
  sendMemoInbound,
  sendReplyNotification,
  sendMemoApproved,
  sendMemoAcknowledged,
  sendMemoProcessingStarted,
  sendMemoAssigned,
  sendMemoClosed,
  sendMemoCompleted,
  sendMemoDenied,
  getDepartmentHeads,
  getDepartmentHeadsIds
} from '../../lib/email_notification';
import { sendEmailWithRetry } from '../../lib/email_service';
import bcrypt from 'bcrypt';

import { put, del } from '@vercel/blob';

async function verifyPassword(plainPassword, storedHash, userId) {
  // If stored is already hashed (starts with $2b$), use bcrypt.compare
  if (storedHash && storedHash.startsWith('$2b$')) {
    return await bcrypt.compare(plainPassword, storedHash);
  }
  // Legacy plain‑text: direct comparison
  const matches = (plainPassword === storedHash);
  if (matches && userId) {
    // Upgrade to hash immediately
    const hashed = await bcrypt.hash(plainPassword, 12);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashed }
    });
  }
  return matches;
}

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
            actorRole: true,
            departmentName: true,
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

    // 🔐 VERIFY PASSWORD (hash‑aware)
    const passwordValid = await verifyPassword(password, authenticatedUser.password, authenticatedUser.id);
    if (!passwordValid) {
      return NextResponse.json({ success: false, message: "Security Verification Failed: Incorrect Signature Password" }, { status: 403 });
    }

    // File upload logic...
    // const files = formData.getAll("memoAttachments");
    // let savedFilePaths = [];
    // const uploadDir = path.join(process.cwd(), "public", "memos");
    // await mkdir(uploadDir, { recursive: true });
    // if (files && files.length > 0) {
    //   for (const file of files) {
    //     if (file && file.size > 0 && typeof file.arrayBuffer === 'function') {
    //       const bytes = await file.arrayBuffer();
    //       const buffer = Buffer.from(bytes);
    //       const cleanFilename = `${Date.now()}-${Math.floor(Math.random() * 1000)}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
    //       await writeFile(path.join(uploadDir, cleanFilename), buffer);
    //       savedFilePaths.push(`/memos/${cleanFilename}`);
    //     }
    //   }
    // }

    // File upload logic – Vercel Blob
    const files = formData.getAll("memoAttachments");
    let savedFilePaths = [];
    if (files && files.length > 0) {
      for (const file of files) {
        if (file && file.size > 0) {
          const cleanFilename = `memos/${Date.now()}-${Math.floor(Math.random() * 1000)}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
          const blob = await put(cleanFilename, file, {
            access: 'public',
            addRandomSuffix: true,
            token: process.env.DMSBLOB_READ_WRITE_TOKEN,
            storeId: process.env.DMSBLOB_STORE_ID
          });
          savedFilePaths.push(blob.url);
        }
      }
    }

    const userDept = authenticatedUser.departmentCode || "GEN";
    const senderFullName = `${authenticatedUser.fname} ${authenticatedUser.lname}`;
    const databaseUserRole = authenticatedUser.role ? authenticatedUser.role.toUpperCase() : "STAFF";

    const actionsRequiringFeedback = ['APPROVE', 'DENY', 'CLOSED', 'DISAPPROVE_DRAFT'];

    // ✅ Check kung OIC ang user
    const isCurrentlyOIC = (() => {
      if (!authenticatedUser.oic_start || !authenticatedUser.oic_end) return false;
      const now = new Date();
      const start = new Date(authenticatedUser.oic_start);
      const end = new Date(authenticatedUser.oic_end);
      return now >= start && now <= end;
    })();

    let initialMemoStatus = "APPROVED";
    if (!isCurrentlyOIC && 
        (databaseUserRole === "STAFF" || databaseUserRole === "USER" || databaseUserRole === "FACULTY") && 
        !parentMemoId) {
      initialMemoStatus = "FOR_APPROVAL";
    }

    const currentYear = new Date().getFullYear();
    const count = await prisma.memo.count({
      where: { senderDept: userDept, createdAt: { gte: new Date(`${currentYear}-01-01`) } }
    });
    
    const timestampSuffix = Math.floor(Math.random() * 9000) + 1000;
    // Palaging may suffix
    const refId = initialMemoStatus === "FOR_APPROVAL" 
      ? `DRAFT-${userDept}-${currentYear}-${String(count + 1).padStart(3, '0')}-${timestampSuffix}`
      : `${userDept}-${currentYear}-${String(count + 1).padStart(3, '0')}-${timestampSuffix}`;

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
        const internalHeads = await getDepartmentHeadsIds(userDept);
        if (internalHeads.length > 0) {
          await prisma.notification.createMany({
            data: internalHeads.map(head => ({
              title: "Draft Memo For Review",
              message: `${senderFullName} submitted a new draft memo requiring your signature approval. Ref: ${refId}`,
              isRead: false,
              recipientId: head.id,
              senderId: authenticatedUser.id,
              // 🆕 Routing metadata
              linkUrl: `/dashboard/forms/iom?tab=approval&focus=${newMemo.id}`,
              entityType: 'IOM',
              entityId: newMemo.id,
            }))
          });
        }
        await prisma.notification.create({
          data: {
            title: "Draft Submitted Successfully",
            message: `Your draft memo "${subject}" has been queued. It is currently pending approval/signature from your Department Head. Ref: ${refId}`,
            isRead: false,
            recipientId: authenticatedUser.id,
            senderId: authenticatedUser.id,
            // 🆕 Routing metadata
            linkUrl: `/dashboard/forms/iom?tab=authored_by_me&focus=${newMemo.id}`,
            entityType: 'IOM',
            entityId: newMemo.id,
          }
        });
      } else {
        for (const dept of targetDepts) {
          const targetHeads = await getDepartmentHeadsIds(dept);
          if (targetHeads.length > 0) {
            await prisma.notification.createMany({
              data: targetHeads.map(head => ({
                title: "Inbound Inter-Office Memo",
                message: `New official memo released from ${userDept} department. Subject: ${subject}. Ref: ${refId}`,
                isRead: false,
                recipientId: head.id,
                senderId: authenticatedUser.id,
                // 🆕 Routing metadata
                linkUrl: `/dashboard/forms/iom?tab=inbound&focus=${finalMemo.id}`,
                entityType: 'IOM',
                entityId: finalMemo.id,
              }))
            });
          }
        }
      }
    } catch (notifErr) { console.error("❌ Notification Generation Failed (POST):", notifErr); }

    // =========================================================
    // EMAIL NOTIFICATIONS (POST) – CORRECTED
    // =========================================================
    try {
      const staffUser = authenticatedUser; // sender

      if (initialMemoStatus === 'FOR_APPROVAL') {
        // Notify department heads (including active OIC) of sender's department
        await sendMemoSubmittedForApproval(staffUser, newMemo);
      } else {
        // APPROVED immediately – notify recipient department heads (including OIC)
        for (const dept of targetDepts) {
          const heads = await getDepartmentHeads(dept); // returns [{ email, fname, lname }]
          if (heads.length > 0) {
            await sendMemoInbound(heads, finalMemo);
          }
        }
      }

      // If this is a reply (parentMemoId present), notify the original sender
      if (parentMemoId && parentMemoId !== 'null') {
        try {
          const originalMemo = await prisma.memo.findUnique({
            where: { id: parentMemoId },
            select: { senderId: true },
          });
          if (originalMemo && originalMemo.senderId !== authenticatedUser.id) {
            await prisma.notification.create({
              data: {
                title: "New Reply to Your Memo",
                message: `${senderFullName} (${userDept}) replied to your memo — "${subject}". Ref: ${refId}`,
                isRead: false,
                recipientId: originalMemo.senderId,
                senderId: authenticatedUser.id,
                linkUrl: `/dashboard/forms/iom?tab=outbound&focus=${newMemo.id}`,
                entityType: 'IOM',
                entityId: newMemo.id,
              }
            });
          }
        } catch (notifErr) {
          console.error('Reply in-app notification error:', notifErr);
        }
      }
    } catch (emailErr) {
      console.error('❌ Email Notification Failed (POST):', emailErr);
      // Do not break the request; just log
    }

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
    let assignedToId = null;

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

      assignedToId = formData.get("assignedToId") || null;
      
      newSubject = formData.get("subject");
      newContent = formData.get("content");
      headNote = formData.get("headNote");
      retainedAttachments = formData.get("retainedAttachments") ? JSON.parse(formData.get("retainedAttachments")) : [];

      // Process attachments (recipient resolve)
      // const files = formData.getAll("attachments");
      // if (files && files.length > 0 && files[0] instanceof File) {
      //   const uploadDir = path.join(process.cwd(), "public", "uploads", "memos");
      //   await mkdir(uploadDir, { recursive: true });
      //   for (const file of files) {
      //     if (file.size === 0) continue;
      //     const buffer = Buffer.from(await file.arrayBuffer());
      //     const uniquePrefix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      //     const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      //     const finalFileName = `${uniquePrefix}-${cleanFileName}`;
      //     const filePath = path.join(uploadDir, finalFileName);
      //     await writeFile(filePath, buffer);
      //     attachmentPaths.push(`/uploads/memos/${finalFileName}`);
      //   }
      // }

      // Process attachments (recipient resolve) – Vercel Blob
      const files = formData.getAll("attachments");
      if (files && files.length > 0 && files[0] instanceof File) {
        for (const file of files) {
          if (file.size === 0) continue;
          const uniquePrefix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
          const blobPath = `memos/${uniquePrefix}-${cleanFileName}`;
          const blob = await put(blobPath, file, {
            access: 'public',
            addRandomSuffix: true,
          });
          attachmentPaths.push(blob.url);
        }
      }

      // Process headNewAttachments (from SuperEditModal)
      // const headNewAttachments = formData.getAll("headNewAttachments");
      // if (headNewAttachments && headNewAttachments.length > 0) {
      //   const uploadDir = path.join(process.cwd(), "public", "memos");
      //   await mkdir(uploadDir, { recursive: true });
      //   for (const file of headNewAttachments) {
      //     if (file instanceof File && file.size > 0 && typeof file.arrayBuffer === 'function') {
      //       const bytes = await file.arrayBuffer();
      //       const buffer = Buffer.from(bytes);
      //       const cleanFilename = `${Date.now()}-${Math.floor(Math.random() * 1000)}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
      //       await writeFile(path.join(uploadDir, cleanFilename), buffer);
      //       attachmentPaths.push(`/memos/${cleanFilename}`);
      //     }
      //   }
      // }
      // Process headNewAttachments (from SuperEditModal) – Vercel Blob
      const headNewAttachments = formData.getAll("headNewAttachments");
      if (headNewAttachments && headNewAttachments.length > 0) {
        for (const file of headNewAttachments) {
          if (file instanceof File && file.size > 0) {
            const cleanFilename = `memos/${Date.now()}-${Math.floor(Math.random() * 1000)}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
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
    } else {
      const body = await request.json();
      memoId = body.memoId;
      departmentName = body.departmentName;
      action = body.action;
      password = body.password;
      feedbackNote = body.feedbackNote || body.remarks || body.headNote;
      delegatedStaffId = body.delegatedStaffId;
      isSenderClosing = body.isSenderClosing || false;
      assignedToId = body.assignedToId || null;
    }

    // =================================================================================
    // 1. COMMON VALIDATIONS
    // =================================================================================
    if (!password) {
      return NextResponse.json({ success: false, message: "Password signature required" }, { status: 400 });
    }

    // ✅ Feedback validation – required for certain actions, optional for ACKNOWLEDGE, CREATE, REVISE_DRAFT
    const trimmedFeedback = feedbackNote ? feedbackNote.trim() : '';
    const actionsRequiringFeedback = ['APPROVE', 'DENY', 'CLOSED', 'DISAPPROVE_DRAFT'];
    if (actionsRequiringFeedback.includes(action) && !trimmedFeedback) {
      return NextResponse.json({ 
        success: false, 
        message: "Remarks/Feedback note is required for this action." 
      }, { status: 400 });
    }

    const passwordValid = await verifyPassword(password, authenticatedUser.password, authenticatedUser.id);
    if (!passwordValid) {
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
    // 2. PERMISSION & STATUS CHECKS PARA SA REVISE_DRAFT
    // =================================================================================
    if (action === 'REVISE_DRAFT') {
      // 1. Only Department Head or OIC can revise
      const isHead = ['DEPARTMENTHEAD', 'OIC', 'DEPARTMENT_HEAD'].includes(authenticatedUser.role?.toUpperCase());
      const isOIC = (() => {
        if (!authenticatedUser.oic_start || !authenticatedUser.oic_end) return false;
        const now = new Date();
        const start = new Date(authenticatedUser.oic_start);
        const end = new Date(authenticatedUser.oic_end);
        return now >= start && now <= end;
      })();
      if (!isHead && !isOIC) {
        return NextResponse.json({ success: false, message: "Only Department Head or OIC can revise drafts" }, { status: 403 });
      }

      // 2. Only memos in 'FOR_APPROVAL' status can be revised
      if (currentMemo.status !== 'FOR_APPROVAL') {
        return NextResponse.json({ success: false, message: "Only drafts pending approval can be revised" }, { status: 400 });
      }
    }

    // =================================================================================
    // 3. WORKFLOW LOGIC ENGINE
    // =================================================================================
    if (action === 'CREATE') {
      // handled in POST – nothing to do here
    } else if (action === 'DISAPPROVE' || action === 'DISAPPROVE_DRAFT') {
      memoUpdateData = { status: 'DRAFT' };
      historyActionType = "DISAPPROVED";
    } else if (action === 'REVISE_DRAFT') {
      const finalSubject = newSubject || currentMemo.subject;
      const finalHeadNote = headNote || '';

      const retained = retainedAttachments || [];
      const allAttachments = [...retained, ...attachmentPaths];

      const subjectChanged = finalSubject !== currentMemo.subject;
      const headNoteChanged = finalHeadNote !== (currentMemo.headNote || '');
      const attachmentsChanged = JSON.stringify(allAttachments) !== JSON.stringify(currentMemo.attachmentPaths || []);

      memoUpdateData = {
        revisedSubject: newSubject || null,        // if empty, set to null
        revisedHeadNote: headNote || null,         // if empty, set to null
        attachmentPaths: allAttachments,
      };
      historyActionType = "REVISED_BY_HEAD";
    } else if (action === 'REVERT_TO_ORIGINAL') {
        memoUpdateData = {
        revisedSubject: null,
        revisedHeadNote: null,
      };
      historyActionType = "REVERTED";
    } else if (action === 'APPROVE') {
      // Use revised values if present, otherwise original
      const finalSubject = currentMemo.revisedSubject || currentMemo.subject;
      const finalHeadNote = currentMemo.revisedHeadNote || currentMemo.headNote || '';
      let finalContent = newContent || currentMemo.content;

      if (finalHeadNote.trim()) {
        finalContent = `${finalContent}\n\n---\nDepartment Head Notes:\n${finalHeadNote}`;
      }

      // Merge attachments: retained + newly uploaded
      const retained = retainedAttachments || [];
      const allAttachments = [...retained, ...attachmentPaths];

      // Debug logs
      console.log('retainedAttachments:', retainedAttachments);
      console.log('attachmentPaths (new):', attachmentPaths);
      console.log('allAttachments:', allAttachments);

      // Remove DRAFT- prefix from reference ID if present
      let newReferenceId = currentMemo.referenceId;
      if (newReferenceId?.startsWith('DRAFT-')) {
        newReferenceId = newReferenceId.substring(6);
      }

      // Check if any changes were made (for isRevisedByHead)
      const subjectChanged = finalSubject !== currentMemo.subject;
      const headNoteExists = finalHeadNote.trim().length > 0;
      const attachmentsChanged = JSON.stringify(allAttachments) !== JSON.stringify(currentMemo.attachmentPaths || []);

      memoUpdateData = {
        status: 'APPROVED',
        subject: finalSubject,
        content: finalContent,
        attachmentPaths: allAttachments,
        referenceId: newReferenceId,
        headNote: finalHeadNote,
        revisedSubject: null,
        revisedHeadNote: null,
        isRevisedByHead: subjectChanged || headNoteExists || attachmentsChanged,
      };
      historyActionType = "APPROVED";

      // ✅ Send inbound emails to all recipient departments
      try {
        const targetDepts = currentMemo.recipients.map(r => r.departmentName);
        for (const dept of targetDepts) {
          const heads = await getDepartmentHeads(dept);
          if (heads.length > 0) {
            // Gumamit ng updated memo data (finalSubject, allAttachments, etc.)
            const approvedMemo = {
              ...currentMemo,
              subject: finalSubject,
              content: finalContent,
              attachmentPaths: allAttachments,
              referenceId: newReferenceId,
            };
            await sendMemoInbound(heads, approvedMemo);
          }
        }
      } catch (emailErr) {
        console.error('❌ Email notification to recipients failed after approval:', emailErr);
      }

      // Notifications for recipients
      try {
        const targetDepts = currentMemo.recipients.map(r => r.departmentName);
        for (const dept of targetDepts) {
          const targetHeads = await getDepartmentHeadsIds(dept);
          if (targetHeads.length > 0) {
            await prisma.notification.createMany({
              data: targetHeads.map(head => ({
                title: "Inbound Inter-Office Memo",
                message: `New official memo released from ${currentMemo.senderDept} department. Subject: ${finalSubject}. Ref: ${newReferenceId}`,
                isRead: false,
                recipientId: head.id,
                senderId: authenticatedUser.id,
                // 🆕 Routing metadata
                linkUrl: `/dashboard/forms/iom?tab=inbound`,
                entityType: 'IOM',
                entityId: currentMemo.id,
              }))
            });
          }
        }

        // Confirmation to the ORIGINAL sender (the staff whose draft was approved)
        await prisma.notification.create({
          data: {
            title: "Memo Approved & Broadcasted",
            message: `Your memo "${finalSubject}" (Ref: ${newReferenceId}) has been approved and sent to all recipients.`,
            isRead: false,
            recipientId: currentMemo.senderId,   // 🆕 was authenticatedUser.id — should be the original sender
            senderId: authenticatedUser.id,
            // 🆕 Routing metadata
            linkUrl: `/dashboard/forms/iom?tab=outbound`,
            entityType: 'IOM',
            entityId: currentMemo.id,
          }
        });
      } catch (notifErr) {
        console.error("❌ Notification Generation Failed (APPROVE):", notifErr);
      }
    } else {
      // ============================================================
      // 🟡 WORKFLOW PARA SA MGA RECIPIENT ACTIONS (ACKNOWLEDGE, START_PROCESSING, CLOSED, DENY, JOIN_PROCESSING, ASSIGN)
      // ============================================================

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

          // Send email to sender
          try {
            const sender = await prisma.user.findUnique({
              where: { id: currentMemo.senderId },
              select: { email: true, fname: true, lname: true },
            });
            if (sender) {
              await sendMemoAcknowledged(
                sender,
                currentMemo,
                departmentName,
                employeeName
              );
            }
          } catch (emailErr) {
            console.error('❌ Email Notification Failed (ACKNOWLEDGE):', emailErr);
          }

        } else if (action === 'DENY') {
          if (!targetRecipient) {
            return NextResponse.json({ success: false, message: "Department not a recipient" }, { status: 400 });
          }
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

          try {
            const sender = await prisma.user.findUnique({
              where: { id: currentMemo.senderId },
              select: { email: true, fname: true, lname: true },
            });
            if (sender) {
              await sendMemoDenied(
                sender,
                currentMemo,
                departmentName,
                employeeName,
                feedbackNote || 'No reason provided.'
              );
            }
          } catch (emailErr) {
            console.error('❌ Email Notification Failed (DENY):', emailErr);
          }
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

          // Send email to sender
          try {
            const sender = await prisma.user.findUnique({
              where: { id: currentMemo.senderId },
              select: { email: true, fname: true, lname: true },
            });
            if (sender) {
              await sendMemoAcknowledged(
                sender,
                currentMemo,
                departmentName,
                employeeName
              );
            }
          } catch (emailErr) {
            console.error('❌ Email Notification Failed (ACKNOWLEDGE):', emailErr);
          }

        } else if (action === 'START_PROCESSING') {
          if (!targetRecipient) {
            return NextResponse.json({ success: false, message: "Department not a recipient" }, { status: 400 });
          }

          const currentAssignedIds = targetRecipient.assignedToIds || [];
          const currentAssignedNames = targetRecipient.assignedToNames || [];

          if (!currentAssignedIds.includes(authenticatedUser.id)) {
            currentAssignedIds.push(authenticatedUser.id);
            currentAssignedNames.push(employeeName);
          }
          
          recipientUpdateData = {
            status: 'PROCESSING',
            processedAt: now,
            processedById: authenticatedUser.id,
            processedByName: employeeName,
            feedbackNote: feedbackNote || `Started processing by ${employeeName}`,
            assignedToIds: currentAssignedIds,
            assignedToNames: currentAssignedNames,
            assignedAt: targetRecipient.assignedAt || now,
          };
          historyActionType = "PROCESSING_STARTED";

          // Send email to sender
          try {
            const sender = await prisma.user.findUnique({
              where: { id: currentMemo.senderId },
              select: { email: true, fname: true, lname: true },
            });
            if (sender) {
              await sendMemoProcessingStarted(
                sender,
                currentMemo,
                authenticatedUser // processor
              );
            }
          } catch (emailErr) {
            console.error('❌ Email Notification Failed (START_PROCESSING):', emailErr);
          }

          // 🆕 In-app notification → memo sender (skip self)
          if (currentMemo.senderId !== authenticatedUser.id) {
            try {
              await prisma.notification.create({
                data: {
                  title: "Your Memo is Being Processed",
                  message: `${employeeName} (${departmentName}) started processing memo ${currentMemo.referenceId} — "${currentMemo.subject}".`,
                  isRead: false,
                  recipientId: currentMemo.senderId,
                  senderId: authenticatedUser.id,
                  linkUrl: `/dashboard/forms/iom?tab=outbound`,
                  entityType: 'IOM',
                  entityId: currentMemo.id,
                }
              });
            } catch (notifErr) {
              console.error('START_PROCESSING notification error:', notifErr);
            }
          }

        } else if (action === 'JOIN_PROCESSING') {
          if (!targetRecipient) {
            return NextResponse.json({ success: false, message: "Department not a recipient" }, { status: 400 });
          }
          if (!['PROCESSING', 'ACKNOWLEDGED'].includes(targetRecipient.status)) {
            return NextResponse.json({
              success: false,
              message: "Cannot join: memo must be in PROCESSING or ACKNOWLEDGED state."
            }, { status: 400 });
          }

          const currentAssignedIds = targetRecipient.assignedToIds || [];
          const currentAssignedNames = targetRecipient.assignedToNames || [];

          if (!currentAssignedIds.includes(authenticatedUser.id)) {
            currentAssignedIds.push(authenticatedUser.id);
            currentAssignedNames.push(employeeName);
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
            assignedToIds: currentAssignedIds,
            assignedToNames: currentAssignedNames,
          };
          historyActionType = "PROCESSING_JOINED";

          try {
            // 🆕 In-app notification → memo sender (skip self)
            if (currentMemo.senderId !== authenticatedUser.id) {
              try {
                await prisma.notification.create({
                  data: {
                    title: "Another Staff Joined Processing",
                    message: `${employeeName} (${departmentName}) joined processing your memo ${currentMemo.referenceId} — "${currentMemo.subject}".`,
                    isRead: false,
                    recipientId: currentMemo.senderId,
                    senderId: authenticatedUser.id,
                    linkUrl: `/dashboard/forms/iom?tab=outbound`,
                    entityType: 'IOM',
                    entityId: currentMemo.id,
                  }
                });
              } catch (notifErr) {
                console.error('JOIN_PROCESSING notification error:', notifErr);
              }
            }
          } catch (emailErr) {
            console.error('❌ Email Notification Failed (CLOSED):', emailErr);
          }

        } else if (action === 'CLOSED') {
          if (isSenderClosing) {
            // ===== SENDER CLOSING =====
            const freshRecipients = await prisma.memoRecipientStatus.findMany({
              where: { memoId: memoId }
            });

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

            try {
              const sender = await prisma.user.findUnique({
                where: { id: currentMemo.senderId },
                select: { email: true, fname: true, lname: true },
              });
              if (sender) {
                await sendMemoCompleted(
                  sender,
                  currentMemo,
                  departmentName,
                  employeeName,
                  feedbackNote
                );
              }
            } catch (emailErr) {
              console.error('❌ Email Notification Failed (COMPLETED):', emailErr);
            }
          }
        } else if (action === 'DENY') {
          if (!targetRecipient) {
            return NextResponse.json({ success: false, message: "Department not a recipient" }, { status: 400 });
          }
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

          try {
            const sender = await prisma.user.findUnique({
              where: { id: currentMemo.senderId },
              select: { email: true, fname: true, lname: true },
            });
            if (sender) {
              await sendMemoDenied(
                sender,
                currentMemo,
                departmentName,
                employeeName,
                feedbackNote || 'No reason provided.'
              );
            }
          } catch (emailErr) {
            console.error('❌ Email Notification Failed (FYI DENY):', emailErr);
          }
        } else if (action === 'ASSIGN') {
          if (!targetRecipient) {
            return NextResponse.json({ success: false, message: "Department not a recipient" }, { status: 400 });
          }

          if (!assignedToId) {
            return NextResponse.json({ success: false, message: "No staff selected for assignment" }, { status: 400 });
          }

          const assignedUserInfo = await prisma.user.findUnique({
            where: { id: assignedToId },
            select: { id: true, email: true, fname: true, lname: true }
          });
          if (!assignedUserInfo) {
            return NextResponse.json({ success: false, message: "Staff not found" }, { status: 404 });
          }

          const assignedName = `${assignedUserInfo.fname} ${assignedUserInfo.lname}`;

          const currentAssignedIds = targetRecipient.assignedToIds || [];
          const currentAssignedNames = targetRecipient.assignedToNames || [];

          const wasNewAssignment = !currentAssignedIds.includes(assignedToId);
          if (wasNewAssignment) {
            currentAssignedIds.push(assignedToId);
            currentAssignedNames.push(assignedName);
          }

          recipientUpdateData = {
            assignedToIds: currentAssignedIds,
            assignedToNames: currentAssignedNames,
            assignedAt: now,
            feedbackNote: feedbackNote || `Assigned to ${assignedName}`
          };
          historyActionType = "ASSIGNED";

          // ✅ Only notify on FIRST assignment (avoid spam on re-assign)
          if (wasNewAssignment) {
            const assignerDept = departmentName || userDept;

            // ── 1. Email to assigned staff ──────────────────────────
            try {
              await sendMemoAssigned(assignedUserInfo, currentMemo);
            } catch (emailErr) {
              console.error('❌ Email Notification Failed (ASSIGN):', emailErr);
            }

            // ── 2. In-app → ASSIGNED STAFF ──────────────────────────
            try {
              await prisma.notification.create({
                data: {
                  title: "Memo Assigned to You",
                  message: `${employeeName} (${assignerDept}) assigned you to process memo ${currentMemo.referenceId} — "${currentMemo.subject}".`,
                  isRead: false,
                  recipientId: assignedToId,
                  senderId: authenticatedUser.id,
                  linkUrl: `/dashboard/forms/iom?tab=assigned_to_me`,
                  entityType: 'IOM',
                  entityId: currentMemo.id,
                }
              });
            } catch (notifErr) {
              console.error('Assigned staff notification error:', notifErr);
            }

            // ── 3. In-app → MEMO SENDER (skip self-notify) ─────────
            if (currentMemo.senderId !== authenticatedUser.id) {
              try {
                await prisma.notification.create({
                  data: {
                    title: "Staff Assigned to Your Memo",
                    message: `${employeeName} (${assignerDept}) assigned ${assignedName} to process your memo ${currentMemo.referenceId}.`,
                    isRead: false,
                    recipientId: currentMemo.senderId,
                    senderId: authenticatedUser.id,
                    linkUrl: `/dashboard/forms/iom?tab=outbound`,
                    entityType: 'IOM',
                    entityId: currentMemo.id,
                  }
                });
              } catch (notifErr) {
                console.error('Memo sender notification error:', notifErr);
              }
            }
          }
        } else {
          return NextResponse.json({ success: false, message: `Unknown action: ${action}` }, { status: 400 });
        }
      }
    }

    // =================================================================================
    // 4. DATABASE TRANSACTIONS
    // =================================================================================
    let updatedStatus = null;

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

    if (!skipRecipientUpdate) {
      const allRecipients = await prisma.memoRecipientStatus.findMany({
        where: { memoId: memoId }
      });

      const allClosed = allRecipients.every(r => 
        r.status === 'COMPLETED' || r.status === 'CLOSED' || r.status === 'DENIED'
      );

      if (allClosed) {
        memoUpdateData = {
          ...memoUpdateData,
          status: 'CLOSED',
          lastActivityAt: now
        };
      }
    }

    if (Object.keys(memoUpdateData).length > 0) {
      await prisma.memo.update({
        where: { id: memoId },
        data: memoUpdateData
      });
    }

    // =================================================================================
    // 5. AUDIT TRAIL & NOTIFICATIONS
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

    // Notifications (skip for REVISE_DRAFT)
    if (action !== 'REVISE_DRAFT' && action !== 'REVERT_TO_ORIGINAL') {
      try {
        let notificationPayload = null;

        if (action === 'ACKNOWLEDGE') {
          notificationPayload = {
            recipientId: currentMemo.senderId,
            title: "Document Acknowledged",
            message: `Department ${departmentName} acknowledged memo ${memoRefString}. If all recipients have acknowledged, check ARCHIVED/RESOLVED Tab.`,
          };
        } else if (action === 'CLOSED') {
          if (isSenderClosing) {
            notificationPayload = {
              recipientId: currentMemo.senderId,
              title: "Memo Closed by Sender",
              message: `Memo ${memoRefString} has been closed by sender. If not available under OUTBOUND, check ARCHIVED/RESOLVED Tab.`,
            };
          } else {
            notificationPayload = {
              recipientId: currentMemo.senderId,
              title: "Action Item Completed",
              message: `Department ${departmentName} completed memo ${memoRefString}. If not available under OUTBOUND, check ARCHIVED/RESOLVED Tab.`,
            };
          }
        } else if (action === 'DENY') {
          notificationPayload = {
            recipientId: currentMemo.senderId,
            title: "Inbound Transaction Denied",
            message: `Memo ${memoRefString} denied by ${departmentName}. If not available under OUTBOUND, check ARCHIVED/RESOLVED Tab.`,
          };
        }
        // APPROVE: handled in its own block above — no duplicate here

        if (notificationPayload) {
          await prisma.notification.create({
            data: {
              ...notificationPayload,
              isRead: false,
              senderId: authenticatedUser.id,
              // 🆕 Routing metadata (was being dropped before)
              linkUrl: `/dashboard/forms/iom?tab=outbound`,
              entityType: 'IOM',
              entityId: currentMemo.id,
            }
          });
        }
      } catch (err) {
        console.error("Notification Failed:", err);
      }
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