// app/api/super/backup/route.js
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { prisma } from '../../../../prisma/prisma';
import { logActivity } from '../../../lib/logger';
import { fetchMemosForExport, convertMemosToRows, generateCSV } from '../../../lib/export_utils';

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
  const format = url.searchParams.get('format') || 'csv';
  const preview = url.searchParams.get('preview') === 'true';

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 });
  }

  console.log('🔍 GET /api/super/backup called with:', {
    startDate,
    endDate,
    departmentCode,
    includeHistory,
    format,
    preview,
  });

  // 🔍 Preview mode – gumagamit ng parehong date range logic
  if (preview) {
    const where = {
      createdAt: {
        gte: new Date(`${startDate}T00:00:00`),
        lte: new Date(`${endDate}T23:59:59.999`),
      },
    };
    if (departmentCode) where.senderDept = departmentCode;

    console.log('📋 Preview WHERE:', where);

    const memos = await prisma.memo.findMany({
      where,
      select: {
        id: true,
        referenceId: true,
        subject: true,
        senderName: true,
        senderDept: true,
        status: true,
        priority: true,
        purpose: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    console.log(`📋 Preview found ${memos.length} memos.`);

    return NextResponse.json({ memos });
  }

  console.log('📤 Export mode: fetching memos for date range...');

  // 📤 Export mode – gumagamit ng `fetchMemosForExport` na may parehong date handling
  const memos = await fetchMemosForExport({
    startDate,
    endDate,
    departmentCode,
    includeHistory,
  });

  const { headers, rows } = convertMemosToRows(memos, includeHistory);
  const fileName = `memos_backup_${startDate}_to_${endDate}`;

  console.log(`📤 Export found ${memos.length} memos.`);

  console.log(`📤 Generated ${rows.length} rows for ${format} format.`);

  if (format === 'json') {
    // Pinalawak na JSON na may kasamang full relations
    const exportData = {
      exportedAt: new Date().toISOString(),
      version: '1.0',
      memos: memos.map((memo) => ({
        ...memo,
        // Tiyaking kasama ang full sender details
        sender: memo.sender,
        recipients: memo.recipients,
        history: memo.history,
        // I-convert ang dates sa ISO string para sa consistent format
        createdAt: memo.createdAt.toISOString(),
        updatedAt: memo.updatedAt?.toISOString(),
        deadlineAt: memo.deadlineAt?.toISOString(),
        lastActivityAt: memo.lastActivityAt?.toISOString(),
      })),
    };
    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${fileName}.json"`,
      },
    });
  }

  if (format === 'xlsx') {
    const XLSX = await import('xlsx');
    const wsData = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = headers.map(() => ({ wch: 20 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Memos');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}.xlsx"`,
      },
    });
  }

  // Default: CSV
  const csv = generateCSV(headers, rows);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${fileName}.csv"`,
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
    action: "ADMIN_BACKUP_MEMOS",
    details: JSON.stringify({
      count: deleted.count,
      startDate,
      endDate,
      department: departmentCode || 'All',
      memoIds: memoIds,
      referenceIds: refIds,
    }),
  });

  return NextResponse.json({
    success: true,
    message: `Successfully backed up ${deleted.count} memo(s).`,
    count: deleted.count,
  });
}