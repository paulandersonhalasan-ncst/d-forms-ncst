import { NextResponse } from 'next/server';
import { prisma } from '../../../../prisma/prisma';

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

    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: {
          gt: new Date(), // hindi pa expired
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Invalid or expired reset token. Please request a new password reset.' },
        { status: 400 }
      );
    }

    // Update user password at clear reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: newPassword,
        resetToken: null,
        resetTokenExpiry: null,
        forgot_password: false,
      },
    });

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