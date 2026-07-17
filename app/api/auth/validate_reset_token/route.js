import { NextResponse } from 'next/server';
import { prisma } from '../../../../prisma/prisma';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ valid: false }, { status: 400 });
    }

    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: {
          gt: new Date(),
        },
      },
    });

    return NextResponse.json({ valid: !!user });
  } catch (error) {
    return NextResponse.json({ valid: false }, { status: 500 });
  }
}