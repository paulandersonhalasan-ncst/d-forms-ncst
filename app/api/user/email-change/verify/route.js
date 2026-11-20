import { NextResponse } from "next/server";
import { prisma } from "../../../../../prisma/prisma";
import { jwtVerify } from "jose";
import bcrypt from "bcrypt";
import { logActivity } from "../../../../lib/logger";
import { sendEmailChangedSecurityNotice } from "../../../../lib/email_notification";

const MAX_ATTEMPTS = 5;

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
    const code = String(body.code || "").trim();

    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { success: false, message: "Enter the 6-digit code from your email" },
        { status: 400 },
      );
    }

    const pending = await prisma.emailChangeRequest.findFirst({
      where: { userId: user.id },
    });
    if (!pending) {
      return NextResponse.json(
        { success: false, message: "No pending email change. Please request again." },
        { status: 404 },
      );
    }

    // Expired?
    if (new Date(pending.expiresAt) < new Date()) {
      await prisma.emailChangeRequest.delete({ where: { id: pending.id } });
      return NextResponse.json(
        { success: false, message: "Code expired. Please request a new one." },
        { status: 410 },
      );
    }

    // Too many attempts?
    if (pending.attempts >= MAX_ATTEMPTS) {
      await prisma.emailChangeRequest.delete({ where: { id: pending.id } });
      return NextResponse.json(
        { success: false, message: "Too many failed attempts. Please request a new code." },
        { status: 429 },
      );
    }

    // Verify code
    const valid = await bcrypt.compare(code, pending.codeHash);
    if (!valid) {
      await prisma.emailChangeRequest.update({
        where: { id: pending.id },
        data: { attempts: { increment: 1 } },
      });
      const remaining = MAX_ATTEMPTS - (pending.attempts + 1);
      return NextResponse.json(
        {
          success: false,
          message: `Invalid code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`,
        },
        { status: 401 },
      );
    }

    // Re-check email not taken (race condition protection)
    const taken = await prisma.user.findUnique({ where: { email: pending.newEmail } });
    if (taken) {
      await prisma.emailChangeRequest.delete({ where: { id: pending.id } });
      return NextResponse.json(
        { success: false, message: "This email was just registered by another user. Please try a different one." },
        { status: 409 },
      );
    }

    const oldEmail = user.email;
    const newEmail = pending.newEmail;

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { email: newEmail },
      });
      await tx.emailChangeRequest.delete({ where: { id: pending.id } });
    });

    // Security notice to OLD email (fire-and-forget)
    try {
      await sendEmailChangedSecurityNotice(user, oldEmail, newEmail);
    } catch (err) {
      console.error("[email-change] security notice failed:", err);
    }

    await logActivity({
      req: request,
      userId: user.id,
      email: newEmail,
      action: "EMAIL_CHANGE_VERIFIED",
      details: JSON.stringify({ from: oldEmail, to: newEmail }),
    });

    return NextResponse.json({
      success: true,
      message: "Email changed successfully. Please log in again with your new email.",
      data: { forceLogout: true, oldEmail, newEmail },
    });
  } catch (err) {
    console.error("POST /api/user/email-change/verify error:", err);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}