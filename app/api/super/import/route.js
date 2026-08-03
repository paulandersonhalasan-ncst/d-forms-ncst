// app/api/super/backup/import/route.js
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { prisma } from '../../../../prisma/prisma';
import { logActivity } from '../../../lib/logger';

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

  const content = await file.text();
  let data;
  try {
    data = JSON.parse(content);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON format' }, { status: 400 });
  }

  // Validate structure
  if (!data.memos || !Array.isArray(data.memos)) {
    return NextResponse.json({ error: 'Invalid data: memos array expected' }, { status: 400 });
  }

  const { memos } = data;
  let importedCount = 0;
  let skippedCount = 0;
  const errors = [];
  const idMap = new Map(); // oldId -> newId para sa parent/root relationships

  // Process each memo
    for (const memoData of memos) {
    try {
        // 1. Hanapin o i-skip kung walang sender
        let senderId = null;
        if (memoData.senderId) {
        // Hanapin ang sender gamit ang ID
        const existingSender = await prisma.user.findUnique({
            where: { id: memoData.senderId },
        });
        if (existingSender) {
            senderId = existingSender.id;
        } else {
            // Subukan gamit ang email
            if (memoData.sender?.email) {
            const senderByEmail = await prisma.user.findUnique({
                where: { email: memoData.sender.email },
            });
            if (senderByEmail) {
                senderId = senderByEmail.id;
            }
            }
        }
        }

        // Kung wala pa ring sender, i-skip
        if (!senderId) {
        console.warn(`⚠️ Skipping memo ${memoData.referenceId || 'unknown'}: Sender not found`);
        skippedCount++;
        continue;
        }

        // 2. Bumuo ng base imported reference ID na may IMPORT- prefix
        let baseRefId;
        if (memoData.referenceId) {
        baseRefId = `IMPORT-${memoData.referenceId}`;
        } else {
        baseRefId = `IMPORT-RESTORE-${Date.now()}-${importedCount}`;
        }

        // 3. Siguraduhing unique ang reference ID (magdagdag ng counter kung may duplicate)
        let finalRefId = baseRefId;
        let counter = 0;
        while (true) {
        const existing = await prisma.memo.findUnique({
            where: { referenceId: finalRefId },
        });
        if (!existing) break;
        counter++;
        finalRefId = `${baseRefId}-${counter}`;
        }

        // 4. Gumawa ng bagong memo gamit ang finalRefId
        const newMemo = await prisma.memo.create({
        data: {
            referenceId: finalRefId,
            subject: memoData.subject || 'Restored Memo',
            content: memoData.content || '',
            priority: memoData.priority || 'ROUTINE',
            purpose: memoData.purpose || 'FYI',
            senderId: senderId,
            senderName: memoData.senderName || 'Unknown',
            senderDept: memoData.senderDept || 'GEN',
            status: memoData.status || 'APPROVED',
            deadlineAt: memoData.deadlineAt ? new Date(memoData.deadlineAt) : null,
            attachmentPaths: memoData.attachmentPaths || [],
            isRevisedByHead: memoData.isRevisedByHead || false,
            headNote: memoData.headNote || null,
            revisedSubject: memoData.revisedSubject || null,
            revisedHeadNote: memoData.revisedHeadNote || null,
            createdAt: memoData.createdAt ? new Date(memoData.createdAt) : undefined,
            lastActivityAt: memoData.lastActivityAt ? new Date(memoData.lastActivityAt) : undefined,
        },
        });

        // I-save ang mapping para sa parent/root relationships
        idMap.set(memoData.id, newMemo.id);

        // 5. I-restore ang recipients
        if (memoData.recipients && Array.isArray(memoData.recipients)) {
        for (const rec of memoData.recipients) {
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
            } catch (recErr) {
            console.error(`❌ Failed to restore recipient ${rec.departmentName}:`, recErr);
            errors.push(`Recipient error for ${memoData.referenceId || 'unknown'}: ${recErr.message}`);
            }
        }
        }

        // 6. I-restore ang history
        if (memoData.history && Array.isArray(memoData.history)) {
        for (const hist of memoData.history) {
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
            } catch (histErr) {
            console.error(`❌ Failed to restore history entry:`, histErr);
            }
        }
        }

        importedCount++;
    } catch (err) {
        console.error(`❌ Failed to import memo ${memoData.referenceId || 'unknown'}:`, err);
        errors.push(`Memo ${memoData.referenceId || 'unknown'}: ${err.message}`);
    }
    }

  // 6. I-update ang parent/root relationships (after all memos are created)
  for (const memoData of memos) {
    if (idMap.has(memoData.id)) {
      const newId = idMap.get(memoData.id);
      let updateData = {};

      if (memoData.parentMemoId && idMap.has(memoData.parentMemoId)) {
        updateData.parentMemoId = idMap.get(memoData.parentMemoId);
      }
      if (memoData.rootMemoId && idMap.has(memoData.rootMemoId)) {
        updateData.rootMemoId = idMap.get(memoData.rootMemoId);
      }

      if (Object.keys(updateData).length > 0) {
        await prisma.memo.update({
          where: { id: newId },
          data: updateData,
        });
      }
    }
  }

  // 7. Log activity
  await logActivity({
    req: request,
    userId: user.id,
    email: user.email,
    action: "ADMIN_IMPORT_MEMOS",
    details: JSON.stringify({
      imported: importedCount,
      skipped: skippedCount,
      errors: errors.length,
    }),
  });

  return NextResponse.json({
    success: true,
    message: `Imported ${importedCount} memos, skipped ${skippedCount}.`,
    importedCount,
    skippedCount,
    errors: errors.slice(0, 10), // Ibalik ang first 10 errors kung meron
  });
}