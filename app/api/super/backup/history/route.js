import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { del } from '@vercel/blob';
import { prisma } from '../../../../../prisma/prisma';
import { logActivity } from '../../../../lib/logger';

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

export async function GET(request) {
  const user = await getAuthenticatedUser(request);
  if (!user || user.role !== 'SuperUser') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const url = new URL(request.url);
  const includeDeleted = url.searchParams.get('includeDeleted') === 'true';

  const backups = await prisma.backupExport.findMany({
    where: includeDeleted ? {} : { deletedAt: null },
    include: {
      createdBy: { select: { fname: true, lname: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return NextResponse.json({ success: true, data: backups });
}

export async function DELETE(request) {
  const user = await getAuthenticatedUser(request);
  if (!user || user.role !== 'SuperUser') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 });
  }

  const record = await prisma.backupExport.findUnique({ where: { id } });
  if (!record) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (record.deletedAt) {
    return NextResponse.json({ error: 'Already deleted' }, { status: 400 });
  }

  // Delete blob first (only exists in link mode)
  if (record.blobUrl) {
    try {
      await del(record.blobUrl);
    } catch (err) {
      // Non-fatal — DB is source of truth. Orphaned blob just leaks a few MB.
      console.error('Blob delete error (non-fatal):', err);
    }
  }

  await prisma.backupExport.update({
    where: { id },
    data: { deletedAt: new Date(), deletedById: user.id },
  });

  await logActivity({
    req: request,
    userId: user.id,
    email: user.email,
    action: 'ADMIN_BACKUP_DELETE',
    details: JSON.stringify({
      backupExportId: id,
      filename: record.filename,
      hadBlob: !!record.blobUrl,
    }),
  });

  return NextResponse.json({ success: true });
}