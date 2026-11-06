// app/api/super/import/upload/route.js
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
    const jsonResponse = await handleUpload({
      body,
      request,
      token: process.env.BLOB_READ_WRITE_TOKEN,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ['application/json'],
        maximumSizeInBytes: 500 * 1024 * 1024,
        addRandomSuffix: true,
        // 🆕 Pass storeId through the token options — this is the only
        // field handleUpload spreads into generateClientTokenFromReadWriteToken.
        // @ts-expect-error -- storeId is supported at runtime but missing from the type
        storeId: process.env.DMSBLOB_STORE_ID ?? process.env.BLOB_STORE_ID,
      }),
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}