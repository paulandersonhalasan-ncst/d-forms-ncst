import { NextResponse } from "next/server";
import { prisma } from "../../../../../prisma/prisma";
import { jwtVerify } from "jose";
import bcrypt from "bcrypt";
import { logActivity } from "../../../../lib/logger";
import {
  sendEmailVerificationCode,
  sendEmailChangedSecurityNotice,
} from "../../../../lib/email_notification";

const ALLOWED_DOMAIN = "@ncst.edu.ph";
const OTP_EXPIRY_MS = 10 * 60 * 1000;      // 10 minutes
const RESEND_COOLDOWN_MS = 60 * 1000;      // 60 seconds
const PRIVILEGED_ROLES = ["SuperUser", "Admin"];

async function getAuthenticatedUser(request) {
  const cookieHeader = request.headers.get("cookie") || "";
  const sessionCookie = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("session_token="));
  if (!sessionCookie) return null;
  try {
    const token = sessionCookie.split("=")[1];
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    const userId = payload?.id ? String(payload.id) : null;
    if (!userId) return null;
    return await prisma.user.findUnique({ where: { id: userId } });
  } catch {
    return null;
  }
}

function normalizeEmail(raw) {
  return String(raw || "").trim().toLowerCase();
}

export async function POST(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const newEmailRaw = body.newEmail;
    const currentPassword = body.currentPassword;

    if (!newEmailRaw || !currentPassword) {
      return NextResponse.json(
        { success: false, message: "New email and current password are required" },
        { status: 400 },
      );
    }

    const newEmail = normalizeEmail(newEmailRaw);

    // 1. Domain check
    if (!newEmail.endsWith(ALLOWED_DOMAIN)) {
      return NextResponse.json(
        { success: false, message: `Email must end with ${ALLOWED_DOMAIN}` },
        { status: 400 },
      );
    }

    // Very basic format guard
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      return NextResponse.json(
        { success: false, message: "Invalid email format" },
        { status: 400 },
      );
    }

    // 2. Same-as-current check
    if (newEmail === user.email.toLowerCase()) {
      return NextResponse.json(
        { success: false, message: "New email is the same as your current email" },
        { status: 400 },
      );
    }

    // 3. Verify current password (BEFORE anything else that could leak)
    if (!user.password) {
      return NextResponse.json(
        { success: false, message: "Account has no password set. Contact admin." },
        { status: 400 },
      );
    }
    const passValid = await bcrypt.compare(currentPassword, user.password);
    if (!passValid) {
      return NextResponse.json(
        { success: false, message: "Current password is incorrect" },
        { status: 401 },
      );
    }

    // 4. Email must not already be in use
    const taken = await prisma.user.findUnique({ where: { email: newEmail } });
    if (taken) {
      return NextResponse.json(
        { success: false, message: "This email is already registered to another user" },
        { status: 409 },
      );
    }

    // 5. Rate-limit resends (if a request exists and was created < 60s ago)
    const existing = await prisma.emailChangeRequest.findFirst({
      where: { userId: user.id },
    });
    if (existing) {
      const elapsed = Date.now() - new Date(existing.createdAt).getTime();
      if (elapsed < RESEND_COOLDOWN_MS) {
        const waitSec = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
        return NextResponse.json(
          { success: false, message: `Please wait ${waitSec}s before requesting a new code` },
          { status: 429 },
        );
      }
      await prisma.emailChangeRequest.delete({ where: { id: existing.id } });
    }

    // 6. Privileged path — skip OTP, apply immediately
    if (PRIVILEGED_ROLES.includes(user.role)) {
      const oldEmail = user.email;
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { email: newEmail },
        });
      } catch (err) {
        console.error("[email-change] privileged update failed:", err);
        return NextResponse.json(
          { success: false, message: "Failed to update email" },
          { status: 500 },
        );
      }

      // Security notice to old email (fire-and-forget)
      try {
        await sendEmailChangedSecurityNotice(user, oldEmail, newEmail);
      } catch (err) {
        console.error("[email-change] security notice failed:", err);
      }

      await logActivity({
        req: request,
        userId: user.id,
        email: newEmail,
        action: "EMAIL_CHANGE_PRIVILEGED",
        details: JSON.stringify({
          from: oldEmail,
          to: newEmail,
          role: user.role,
        }),
      });

      return NextResponse.json({
        success: true,
        message: "Email updated (no verification needed for privileged roles).",
        data: { skipOtp: true, newEmail, oldEmail },
      });
    }

    // 7. Regular path — generate OTP, send to NEW email
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

    await prisma.emailChangeRequest.create({
      data: {
        userId: user.id,
        newEmail,
        codeHash,
        expiresAt,
      },
    });

    await sendEmailVerificationCode(user, newEmail, code);

    await logActivity({
      req: request,
      userId: user.id,
      email: user.email,
      action: "EMAIL_CHANGE_REQUESTED",
      details: JSON.stringify({ newEmail }),
    });

    return NextResponse.json({
      success: true,
      message: `Verification code sent to ${newEmail}`,
      data: {
        skipOtp: false,
        newEmail,
        expiresAt: expiresAt.toISOString(),
      },
    });
  } catch (err) {
    console.error("POST /api/user/email-change/request error:", err);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}