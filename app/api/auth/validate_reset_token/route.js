import { NextResponse } from 'next/server';
import { prisma } from '../../../../prisma/prisma';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ valid: false }, { status: 400 });
    }

    console.log('Validating token:', token);
    console.log('Current server time:', new Date());
    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: {
          gt: new Date(),
        },
      },
    });

    console.log('Found user with token:', user);
    console.log('Expiry in DB:', user?.resetTokenExpiry);
    console.log('Is valid?', user?.resetTokenExpiry > new Date());

    return NextResponse.json({ valid: !!user });
  } catch (error) {
    return NextResponse.json({ valid: false }, { status: 500 });
  }
}