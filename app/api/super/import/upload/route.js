import { NextResponse } from 'next/server';
import { issueSignedToken, presignUrl } from '@vercel/blob';
import { jwtVerify } from 'jose';
import { prisma } from '../../../../../prisma/prisma';

async function requireSuperUser(request) {
  const cookieHeader = request.headers.get('cookie') || '';
  const parts = cookieHeader.split(';').map((c) => c.trim());
  const sessionCookie = parts.find((c) => c.startsWith('session_token='));
  if (!sessionCookie) return null;
  const token = sessionCookie.split('=')[1];
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    const userId = payload?.id ? String(payload.id) : null;
    if (!userId) return null;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    return user?.role === 'SuperUser' ? user : null;
  } catch {
    return null;
  }
}

export async function POST(request) {
  const user = await requireSuperUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const body = await request.json();
  const { filename } = body;

  if (!filename) {
    return NextResponse.json({ error: 'filename required' }, { status: 400 });
  }

  try {
    const pathname = `backups/${Date.now()}-${filename}`;

    // issueSignedToken — gumagana with RW token or OIDC, no store ID headaches
    const token = await issueSignedToken({
      operations: ['put'],
      pathname,
      allowedContentTypes: ['application/json'],
      maximumSizeInBytes: 500 * 1024 * 1024,
    });

    const { presignedUrl } = await presignUrl(token, {
      pathname,
      operation: 'put',
      access: 'public',
    });

    return NextResponse.json({
      presignedUrl,
      pathname,
      blobUrl: `https://${process.env.DMSBLOB_STORE_ID?.replace(/^store_/, '')}.public.blob.vercel-storage.com/${pathname}`,
    });
  } catch (error) {
    console.error('presignUrl error:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}