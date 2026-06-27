import { NextResponse } from 'next/server';
import { prisma } from "../../../prisma/prisma";
import { jwtVerify } from "jose";

// Helper function para kilalanin kung sino ang tumatawag na user base sa session token
async function getAuthenticatedUserId(request) {
  const cookieHeader = request.headers.get("cookie") || "";
  if (!cookieHeader) return null;

  const cookieParts = cookieHeader.split(";").map((c) => c.trim());
  const sessionCookie = cookieParts.find((c) => c.startsWith("session_token="));
  if (!sessionCookie) return null;

  const token = sessionCookie.split("=")[1];
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return payload && payload.id ? String(payload.id) : null;
  } catch (err) {
    console.error("JWT Verification failed inside notifications endpoint:", err);
    return null;
  }
}

// =========================================================
// 1. GET: Kuhanin ang lahat ng notifications ng logged-in user
// =========================================================
export async function GET(request) {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 });
    }

    // Hihilahin lang natin ang notifications kung saan ang recipientId ay SIYA.
    // Naka-order din mula sa pinakabago (desc) para sa scroll feed.
    const notifications = await prisma.notification.findMany({
      where: { recipientId: userId },
      orderBy: { createdAt: 'desc' },
    });

      const unreadCount = notifications.filter((n) => !n.isRead).length;

  return NextResponse.json(
    {
      notifications,
      count: unreadCount,
    },
    { status: 200 }
  );
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// =========================================================
// 2. PATCH: I-mark as READ ang isang partikular na notification
// =========================================================
export async function PATCH(request) {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { notificationId, markAll } = body;

    // MARK ALL
    if (markAll) {
      await prisma.notification.updateMany({
        where: {
          recipientId: userId,
          isRead: false,
        },
        data: {
          isRead: true,
        },
      });

      return NextResponse.json({
        success: true,
        message: "All notifications marked as read",
      });
    }

    // SINGLE NOTIFICATION
    if (!notificationId) {
      return NextResponse.json(
        { success: false, message: "Notification ID is required" },
        { status: 400 }
      );
    }

    // 🎯 FIX: Kailangan muna nating hanapin si targetNotif sa database!
    const targetNotif = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        recipientId: userId, // Siguraduhing kanya talaga ito
      },
    });

    if (!targetNotif) {
      return NextResponse.json({ success: false, message: "Notification not found or unauthorized access" }, { status: 404 });
    }

    // Kung pag-aari nga niya, i-update na natin ang isRead flag to true
    const updatedNotification = await prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true }
    });

    return NextResponse.json({ success: true, data: updatedNotification }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  // 1. Kunin ang token mula sa cookies ng request
  const token = request.cookies.get('session_token')?.value;

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized: No token provided' }, { status: 401 });
  }

  try {
    // 2. I-verify ang JWT token gamit ang iyong secret key
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    
    // Siguraduhing tugma sa payload data niyo (e.g., payload.id o payload.userId)
    const userId = payload.id; 

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized: Invalid token payload' }, { status: 401 });
    }

    // 3. I-delete lahat ng notifications kung saan ang recipientId ay si userId
    await prisma.notification.deleteMany({
      where: {
        recipientId: userId,
      },
    });

    return NextResponse.json({ message: "Successfully deleted all notifications" });

  } catch (error) {
    console.error('❌ Token Error during deletion:', error.message);
    return NextResponse.json({ error: 'Unauthorized: Token verification failed' }, { status: 401 });
  }
}