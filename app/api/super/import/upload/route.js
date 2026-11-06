import { NextResponse } from 'next/server';
import { handleUpload } from '@vercel/blob/client';
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
  const body = await request.json();

  // 🆕 Auth ONLY on the token-generation path.
  // Webhook callbacks from Vercel Blob don't carry cookies —
  // handleUpload verifies Vercel's signature internally for those.
  if (body.type === 'blob.generate-client-token') {
    const user = await requireSuperUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      // No explicit token/storeId — let SDK read from standard env vars
      // (BLOB_READ_WRITE_TOKEN + BLOB_STORE_ID). Cleaner and works across
      // SDK versions.
      token: process.env.BLOB_READ_WRITE_TOKEN,
      storeId: process.env.DMSBLOB_STORE_ID,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ['application/json'],
        maximumSizeInBytes: 500 * 1024 * 1024,
        addRandomSuffix: true,
      }),
      // onUploadCompleted REMOVED — not needed. The client `upload()` promise
      // returns the blob URL directly, which is what /api/super/import consumes.
      // Without onUploadCompleted, there is no webhook, no auth-gate race.
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}