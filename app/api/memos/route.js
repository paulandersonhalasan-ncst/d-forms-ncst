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

// 1. GET ALL MEMOS WITH TRACKER STATS
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

// 2. CREATE NEW MEMO (MODIFIED FOR MULTIPART / FILE UPLOAD HANDLING)
export async function POST(request) {
  try {
    const authenticatedUser = await getAuthenticatedUser(request);
    if (!authenticatedUser) {
      return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 });
    }

    // 🚀 Gagamit tayo ng formData() para makuha pati ang file stream
    const formData = await request.formData();
    
    const subject = formData.get("subject");
    const content = formData.get("content");
    const priority = formData.get("priority") || 'ROUTINE';
    const purpose = formData.get("purpose") || 'FYI';
    const parentMemoId = formData.get("parentMemoId");
    const rootMemoId = formData.get("rootMemoId");
    const password = formData.get("password");

    // Kunin lahat ng napiling departments (Gumamit ng getAll para sa arrays)
    const targetDepts = formData.getAll("targetDepts");

    if (authenticatedUser.password !== password) {
      return NextResponse.json({ success: false, message: "Security Verification Failed: Incorrect Signature Password" }, { status: 403 });
    }

    // 📂 FILE ATTACHMENT PROCESSING LOGIC
    const file = formData.get("memoAttachment");
    let savedFilePath = null;

    if (file && file.size > 0) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // Linisin ang pangalan ng file para walang illegal space at web URL characters
      const cleanFilename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
      const uploadDir = path.join(process.cwd(), "public", "memos");

      // Siguraduhing gawa ang public/memos folder bago i-write ang file
      await mkdir(uploadDir, { recursive: true });
      await writeFile(path.join(uploadDir, cleanFilename), buffer);

      // Ang relative path link na mapupunta sa database
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
        attachmentPath: savedFilePath, // 🎯 Sinalpak ang column pointer para sa file location
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

// 3. DYNAMIC WORKFLOW ROUTE (WITH SENDER GLOBAL CLOSURE TRIGGER & HEAD SUPER-EDIT)
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

    // 🔥 OPTION B WORKFLOW: APPROVE ACTION WITH INLINE SUPER-EDIT BY DEPT HEAD
    if (action === 'APPROVE') {
      const targetMemo = await prisma.memo.findUnique({ where: { id: memoId } });
      if (!targetMemo) {
        return NextResponse.json({ success: false, message: "Hindi mahanap ang orihinal na draft memo." }, { status: 404 });
      }

      const currentYear = new Date().getFullYear();
      const approvedCount = await prisma.memo.count({
        where: { 
          senderDept: targetMemo.senderDept, 
          status: 'APPROVED'
        }
      });
      
      const officialRefId = `${targetMemo.senderDept}-${currentYear}-${String(approvedCount + 1).padStart(3, '0')}`;

      // Suriin kung binago ba ni Head ang orihinal na gawa ng staff
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

    // 🔥 BACKEND HANDLER 2: SENDER OVERRIDE CLOSURE
    if (isSenderClosing) {
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

    // --- STANDARD OPERATIONS MATRIX FOR RECIPIENTS ---
    let currentSearchStatus;
    let updateData = {};

    switch (action) {
      case 'ACKNOWLEDGE':
        currentSearchStatus = 'PENDING';
        updateData = {
          status: 'ACKNOWLEDGED',
          acknowledgedBy: employeeName,
          acknowledgedAt: new Date()
        };
        break;

      case 'START_PROCESSING':
        currentSearchStatus = 'PENDING'; 
        const currentRecord = await prisma.memoRecipientStatus.findFirst({
          where: { memoId, departmentName, status: { in: ['PENDING', 'ACKNOWLEDGED'] } }
        });
        currentSearchStatus = currentRecord ? currentRecord.status : 'ACKNOWLEDGED';
        
        updateData = {
          status: 'PROCESSING',
          processedBy: employeeName,
          processedAt: new Date()
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
        break;

      case 'RESOLVE':
        const recordToResolve = await prisma.memoRecipientStatus.findFirst({
          where: { memoId, departmentName, status: { in: ['ACKNOWLEDGED', 'PROCESSING', 'PENDING'] } }
        });
        currentSearchStatus = recordToResolve ? recordToResolve.status : 'ACKNOWLEDGED';

        updateData = {
          status: 'RESPONDED',
          respondedAt: new Date(),
          feedbackNote: feedbackNote || "Resolved standard transaction operations completed."
        };
        break;

      default:
        return NextResponse.json({ success: false, message: "Invalid action sequence requested" }, { status: 400 });
    }

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
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}