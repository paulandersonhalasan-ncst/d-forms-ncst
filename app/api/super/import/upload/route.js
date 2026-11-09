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

  if (body.type === 'blob.generate-client-token') {
    const user = await requireSuperUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
  }

  try {
    // 🆕 Strip "store_" prefix — DMSBLOB_STORE_ID = "store_XXX" but
    // the client token payload + header must use the raw "XXX" form.
    // Vercel Blob's api v12 endpoint validates that:
    //   payload.storeId === header['x-vercel-blob-store-id']
    // The PUT client SDK derives the header from splitting the client
    // token string (parts[3] = raw storeId, no prefix), so if we pass
    // the prefixed version here the two disagree and the server rejects.
    const rawStoreId =
      process.env.DMSBLOB_STORE_ID ?? process.env.BLOB_STORE_ID ?? '';
    const cleanStoreId = rawStoreId.replace(/^store_/, '');

    const jsonResponse = await handleUpload({
      body,
      request,
      token: process.env.BLOB_READ_WRITE_TOKEN,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ['application/json'],
        maximumSizeInBytes: 500 * 1024 * 1024,
        addRandomSuffix: true,
        storeId: cleanStoreId,
      }),
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}