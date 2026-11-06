import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { prisma } from '../../../../../prisma/prisma';

async function getAuthenticatedUser(request) {
  const cookieHeader = request.headers.get('cookie') || '';
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(';').map((c) => c.trim());
  const sessionCookie = parts.find((c) => c.startsWith('session_token='));
  if (!sessionCookie) return null;
  const sessionJwt = sessionCookie.split('=')[1];
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(sessionJwt, secret);
    const userId = payload && payload.id ? String(payload.id) : null;
    if (!userId) return null;
    return await prisma.user.findUnique({ where: { id: userId } });
  } catch (err) {
    console.error('Session token verification failed:', err);
    return null;
  }
}

export async function GET(request) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token'); // email-link flow
  const id = url.searchParams.get('id');       // dashboard flow

  let record = null;

  // ── Path A: signed token (from an email link — no login required) ──
  if (token) {
    try {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET);
      const { payload } = await jwtVerify(token, secret);
      if (payload.type !== 'backup-download') {
        return NextResponse.json({ error: 'Invalid token type' }, { status: 400 });
      }
      record = await prisma.backupExport.findUnique({
        where: { id: String(payload.backupId) },
      });
    } catch (err) {
      console.error('Download token verification failed:', err);
      return NextResponse.json(
        { error: 'Invalid or expired download token' },
        { status: 401 },
      );
    }
  }

  // ── Path B: session cookie (from the SuperUser dashboard) ──
  else if (id) {
    const user = await getAuthenticatedUser(request);
    if (!user || user.role !== 'SuperUser') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    record = await prisma.backupExport.findUnique({ where: { id } });
  }

  // ── Path C: neither credential present ──
  else {
    return NextResponse.json(
      { error: 'Provide either ?token= (email link) or ?id= (dashboard)' },
      { status: 400 },
    );
  }

  // ── Shared validation + serving (unchanged from here) ──
  if (!record || record.deletedAt) {
    return NextResponse.json(
      { error: 'Backup not found or has been deleted by an administrator' },
      { status: 404 },
    );
  }

  if (!record.blobUrl) {
    return NextResponse.json(
      { error: 'This backup was delivered as an email attachment — no server blob available' },
      { status: 400 },
    );
  }

  const blobRes = await fetch(record.blobUrl);
  if (!blobRes.ok) {
    return NextResponse.json(
      { error: 'Failed to fetch backup blob from storage' },
      { status: 502 },
    );
  }

  if (!blobRes.body) {
    return NextResponse.json({ error: 'Empty blob response' }, { status: 502 });
  }

  // Increment counter BEFORE streaming (same reasoning as before).
  await prisma.backupExport.update({
    where: { id: record.id },
    data: {
      downloadCount: { increment: 1 },
      lastDownloadedAt: new Date(),
    },
  });

  // 🆕 Stream the blob body directly. blobRes.body is a ReadableStream —
  // Vercel pipes it through without buffering, so the 4.5 MB response cap
  // does NOT apply. Content-Length comes from the DB record, not the buffer.
  return new NextResponse(blobRes.body, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${record.filename}"`,
      'Content-Length': String(record.sizeBytes),
      'Cache-Control': 'no-store',
    },
  });
}