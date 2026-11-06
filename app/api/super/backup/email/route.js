import { NextResponse } from 'next/server';
import { jwtVerify, SignJWT } from 'jose';
import { put } from '@vercel/blob';
import { prisma } from '../../../../../prisma/prisma';
import { logActivity } from '../../../../lib/logger';
import { buildBackupPayload } from '../../../../lib/backup_builder';
import { sendBackupReadyEmail } from '../../../../lib/email_notification';
import { buildBackupFile } from '../../../../lib/backup_builder';


const FIVE_MB = 5 * 1024 * 1024;
const TOKEN_TTL = '7d';

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

  const body = await request.json();
    const {
    scopes: scopesRaw,
    scope: scopeLegacy,
    startDate = null,
    endDate = null,
    departmentCode = null,
    includeHistory = false,
    recipientEmail = null,
    format = 'json',
    } = body;

    // Normalize: prefer scopes array, fall back to legacy scope string
    const scopes = Array.isArray(scopesRaw) && scopesRaw.length > 0
    ? scopesRaw
    : (scopeLegacy ? [scopeLegacy] : []);

    if (scopes.length === 0) {
    return NextResponse.json(
        { error: 'At least one scope is required' },
        { status: 400 },
    );
    }

    const VALID = ['memos', 'frf', 'users', 'system', 'full'];
    const invalid = scopes.filter(s => !VALID.includes(s));
    if (invalid.length > 0) {
    return NextResponse.json(
        { error: `Invalid scope(s): ${invalid.join(', ')}` },
        { status: 400 },
    );
    }

    const VALID_FORMATS = ['json', 'xlsx', 'csv'];
    if (!VALID_FORMATS.includes(format)) {
    return NextResponse.json(
        { error: `Invalid format. Must be one of: ${VALID_FORMATS.join(', ')}` },
        { status: 400 },
    );
    }

    // CSV guard (defence-in-depth — UI already restricts)
    if (format === 'csv' && (scopes.length !== 1 || scopes[0] !== 'memos')) {
    return NextResponse.json(
        { error: 'CSV format only supports the Memos scope.' },
        { status: 400 },
    );
    }

  // Build recipient list — always self, optionally one more
  const recipients = new Set([user.email]);
  if (recipientEmail && recipientEmail.trim() && recipientEmail.trim() !== user.email) {
    recipients.add(recipientEmail.trim());
  }
  const recipientList = Array.from(recipients);

  try {
    // 1. Build payload
    // AFTER
    const { buffer, extension } = await buildBackupFile(scopes, format, {
    startDate, endDate, departmentCode, includeHistory,
    });
    const sizeBytes = buffer.length;

    const scopeTag = scopes.length === 1 ? scopes[0] : 'multi';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `ncst-backup-${scopeTag}-${timestamp}.${extension}`;

    const deliveryMode = sizeBytes > FIVE_MB ? 'link' : 'attached';
    let blobUrl = null;
    let downloadUrl = null;

    // 2. Create audit record (need id for token + history)
    const record = await prisma.backupExport.create({
    data: {
        filename,
        sizeBytes,
        deliveryMode,
        recipientEmails: recipientList,
        scope: Array.from(new Set(
        scopes.map(s => s === 'full' ? 'memos,frf,users,system' : s),
        )).join(','),   // 'full' expands so history stays consistent
        createdById: user.id,
    },
    });

    // 3. Upload + sign token if over the limit
    if (deliveryMode === 'link') {
      const blobPath = `backups/${user.id}/${timestamp}-${filename}`;
      const blob = await put(blobPath, buffer, {
        access: 'public',
        addRandomSuffix: true,
        contentType: 'application/json',
        token: process.env.DMSBLOB_READ_WRITE_TOKEN,
        storeId: process.env.DMSBLOB_STORE_ID,
      });
      blobUrl = blob.url;
      await prisma.backupExport.update({
        where: { id: record.id },
        data: { blobUrl },
      });

      const secret = new TextEncoder().encode(process.env.JWT_SECRET);
      const token = await new SignJWT({ backupId: record.id, type: 'backup-download' })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(TOKEN_TTL)
        .sign(secret);

      const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      downloadUrl = `${base}/api/super/backup/download?token=${token}`;
    }

    // 4. Send email(s)
    let emailsSent = 0;
    for (const recipient of recipientList) {
      try {
        await sendBackupReadyEmail({
          recipient,
          filename,
          sizeBytes,
          scopes,
          format,
          deliveryMode,
          downloadUrl,
          attachedBuffer: deliveryMode === 'attached' ? buffer : null,
        });
        emailsSent += 1;
      } catch (emailErr) {
        console.error(`Backup email failed for ${recipient}:`, emailErr);
      }
    }

    if (emailsSent === 0) {
      // All emails failed — clean up the blob if we created one
      if (blobUrl) {
        try {
          const { del } = await import('@vercel/blob');
          await del(blobUrl);
        } catch { /* swallow */ }
      }
      return NextResponse.json(
        { error: 'All email deliveries failed. Check SMTP configuration.' },
        { status: 500 },
      );
    }

    // 5. Log
    await logActivity({
      req: request,
      userId: user.id,
      email: user.email,
      action: 'ADMIN_EXPORT_MEMOS',
        details: JSON.stringify({
        via: 'email',
        backupExportId: record.id,
        scopes,
        format, 
        sizeBytes,
        deliveryMode,
        recipientEmails: recipientList,
        startDate,
        endDate,
        department: departmentCode || 'All',
        includeHistory,
        }),
    });

    return NextResponse.json({
      success: true,
      backupId: record.id,
      filename,
      sizeBytes,
      deliveryMode,
      downloadUrl,
      recipientEmails: recipientList,
      emailsSent,
    });
  } catch (err) {
    console.error('Backup email error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to send backup' },
      { status: 500 },
    );
  }
}