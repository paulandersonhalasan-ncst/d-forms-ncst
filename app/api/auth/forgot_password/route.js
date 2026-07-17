import { NextResponse } from 'next/server';
import { prisma } from '../../../../prisma/prisma';
import { sendPasswordResetEmail } from '../../../lib/email_service';
import crypto from 'crypto';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
dayjs.extend(utc);

export async function POST(request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { success: false, message: 'Email is required' },
        { status: 400 }
      );
    }

    // Hanapin ang user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    // 🔐 SECURITY: Always return success kahit wala ang email
    // (para hindi malaman ng attacker kung sino ang may account)
    if (!user) {
      console.log(`⚠️ Password reset attempt for non-existent email: ${email}`);
      return NextResponse.json({
        success: true,
        message: 'If your email is registered, you will receive a password reset link.',
      });
    }

    // Generate reset token (random string)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = dayjs.utc().add(1, 'hour').toDate();

    console.log('Token generated:', resetToken);
    console.log('Expiry set to:', resetTokenExpiry);
    console.log('Current UTC time:', dayjs.utc().format());
    console.log('Current UTC time (milliseconds):', dayjs.utc().valueOf());

    // Save token sa database
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken: resetToken,
        resetTokenExpiry: resetTokenExpiry,
        forgot_password: true,
      },
    });

    // Build reset link
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const resetLink = `${baseUrl}/auth/reset_password?token=${resetToken}`;

    // Send email
    const emailSent = await sendPasswordResetEmail(email, resetLink);

    if (!emailSent) {
      console.error(`❌ Failed to send reset email to ${email}`);
      // Huwag i-reveal na nag-fail ang email sa user
      return NextResponse.json({
        success: true,
        message: 'If your email is registered, you will receive a password reset link.',
      });
    }

    console.log(`✅ Password reset email sent to ${email}`);
    return NextResponse.json({
      success: true,
      message: 'If your email is registered, you will receive a password reset link.',
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { success: false, message: 'An error occurred. Please try again.' },
      { status: 500 }
    );
  }
}