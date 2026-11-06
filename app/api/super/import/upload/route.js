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
  const user = await requireSuperUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const body = await request.json();

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ['application/json'],
        maximumSizeInBytes: 500 * 1024 * 1024, // 500 MB
        addRandomSuffix: true,
      }),
      onUploadCompleted: async ({ blob }) => {
        console.log('[import-upload] blob ready:', blob.url, blob.size);
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}