import { NextResponse } from 'next/server';
import { prisma } from '../../../../prisma/prisma';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
dayjs.extend(utc);
import bcrypt from 'bcrypt';

export async function POST(request) {
  try {
    const { token, newPassword } = await request.json();

    if (!token || !newPassword) {
      return NextResponse.json(
        { success: false, message: 'Token and new password are required' },
        { status: 400 }
      );
    }

    // if (newPassword.length < 8) {
    //   return NextResponse.json(
    //     { success: false, message: 'New password must be at least 8 characters' },
    //     { status: 400 }
    //   );
    // }

    console.log('Resetting password for token:', token);
    console.log('Current server time:', dayjs.utc().format());

    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: {
          gt: dayjs.utc().toDate(),
        },
      },
    });

    if (!user) {
      console.log('❌ Token not found or expired');
      return NextResponse.json(
        { success: false, message: 'Invalid or expired reset token. Please request a new password reset.' },
        { status: 400 }
      );
    }

    console.log('✅ Token valid for user:', user.email);

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    
    // Update user password at clear reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
        forgot_password: false,
      },
    });

    console.log('✅ Password reset successful for:', user.email);

    return NextResponse.json({
      success: true,
      message: 'Password reset successfully. You can now login with your new password.',
    });

  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { success: false, message: 'An error occurred. Please try again.' },
      { status: 500 }
    );
  }
}