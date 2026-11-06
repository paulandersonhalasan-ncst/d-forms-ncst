// app/api/super/backup/route.js
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { prisma } from '../../../../prisma/prisma';
import { logActivity } from '../../../lib/logger';
import { fetchMemosForExport, convertMemosToRows, generateCSV } from '../../../lib/export_utils';
import { buildBackupFile } from '../../../lib/backup_builder';


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

export async function GET(request) {
  const user = await getAuthenticatedUser(request);
  if (!user || user.role !== 'SuperUser') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const url = new URL(request.url);
  const startDate = url.searchParams.get('startDate');
  const endDate = url.searchParams.get('endDate');
  const departmentCode = url.searchParams.get('departmentCode') || null;
  const includeHistory = url.searchParams.get('includeHistory') === 'true';
  const format = url.searchParams.get('format') || 'json';
  const preview = url.searchParams.get('preview') === 'true';
  const scopesRaw = url.searchParams.get('scopes') || 'memos';
  const scopes = scopesRaw.split(',').filter(Boolean);

  // ---- PREVIEW MODE (unchanged — Delete tab only needs memos) ----
  if (preview) {
    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 });
    }
    const where = {
      createdAt: {
        gte: new Date(`${startDate}T00:00:00`),
        lte: new Date(`${endDate}T23:59:59.999`),
      },
    };
    if (departmentCode) where.senderDept = departmentCode;

    const memos = await prisma.memo.findMany({
      where,
      select: {
        id: true, referenceId: true, subject: true, senderName: true,
        senderDept: true, status: true, priority: true, purpose: true, createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json({ memos });
  }

  // ---- EXPORT MODE ----
  const needsDates = scopes.includes('memos');
  if (needsDates && (!startDate || !endDate)) {
    return NextResponse.json({ error: 'startDate and endDate are required when exporting Memos' }, { status: 400 });
  }

  const VALID_FORMATS = ['json', 'xlsx', 'csv'];
  if (!VALID_FORMATS.includes(format)) {
    return NextResponse.json({ error: `Invalid format. Must be one of: ${VALID_FORMATS.join(', ')}` }, { status: 400 });
  }
  if (format === 'csv' && (scopes.length !== 1 || scopes[0] !== 'memos')) {
    return NextResponse.json({ error: 'CSV format only supports the Memos scope.' }, { status: 400 });
  }

  const { buffer, extension, mimeType } = await buildBackupFile(scopes, format, {
    startDate, endDate, departmentCode, includeHistory,
  });

  const scopeTag = scopes.length === 1 ? scopes[0] : 'multi';
  const fileName = `ncst-backup-${scopeTag}-${startDate || 'all'}-to-${endDate || 'all'}.${extension}`;

  await logActivity({
    req: request,
    userId: user.id,
    email: user.email,
    action: 'ADMIN_EXPORT_MEMOS',
    details: JSON.stringify({
      format, scopes, sizeBytes: buffer.length,
      startDate, endDate,
      department: departmentCode || 'All',
      includeHistory,
    }),
  });

  const responseBlob = new Blob([buffer], { type: mimeType });

  return new NextResponse(responseBlob.stream(), {
    status: 200,
    headers: {
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': String(buffer.length),
    },
  });
}

export async function POST(request) {
  const user = await getAuthenticatedUser(request);
  if (!user || user.role !== 'SuperUser') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const body = await request.json();
  const { startDate, endDate, departmentCode } = body;

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 });
  }

  const where = {
    createdAt: {
      gte: new Date(`${startDate}T00:00:00`),
      lte: new Date(`${endDate}T23:59:59.999`),
    },
  };
  if (departmentCode) where.senderDept = departmentCode;

  // 🔍 Kunin ang mga memo IDs bago mag‑delete (para sa logging)
  const memosToDelete = await prisma.memo.findMany({
    where,
    select: { id: true, referenceId: true },
  });

  const count = await prisma.memo.count({ where });
  if (count === 0) {
    return NextResponse.json({ success: true, message: 'No memos found to delete.', count: 0 });
  }

  const deleted = await prisma.memo.deleteMany({ where });

  await logActivity({
    req: request,
    userId: user.id,
    email: user.email,
    action: "ADMIN_DELETE_MEMOS",   // matches last_action allowlist
    details: JSON.stringify({
      count: deleted.count,
      startDate,
      endDate,
      department: departmentCode || 'All',
      memoIds: memosToDelete.map(m => m.id),
      referenceIds: memosToDelete.map(m => m.referenceId),
    }),
  });

  return NextResponse.json({
    success: true,
    message: `Successfully backed up ${deleted.count} memo(s).`,
    count: deleted.count,
  });
}