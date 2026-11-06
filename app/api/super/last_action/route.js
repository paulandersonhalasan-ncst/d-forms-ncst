import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { prisma } from '../../../../prisma/prisma';

async function getAuthenticatedUser(request) {
  const cookieHeader = request.headers.get("cookie") || "";
  if (!cookieHeader) return null;
  const cookieParts = cookieHeader.split(";").map((c) => c.trim());
  const sessionCookie = cookieParts.find((c) => c.startsWith("session_token="));
  if (!sessionCookie) return null;
  const token = sessionCookie.split("=")[1];
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    const userId = payload && payload.id ? String(payload.id) : null;
    if (!userId) return null;
    return await prisma.user.findUnique({ where: { id: userId } });
  } catch (err) {
    console.error("JWT Session verification broken:", err);
    return null;
  }
}

export async function GET(request) {
  const user = await getAuthenticatedUser(request);
  if (!user || user.role !== 'SuperUser') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  if (!action) {
    return NextResponse.json({ error: 'action parameter is required' }, { status: 400 });
  }

  // List of allowed actions
  const allowedActions = ['ADMIN_EXPORT_MEMOS', 'ADMIN_DELETE_MEMOS', 'ADMIN_IMPORT_MEMOS'];
  if (!allowedActions.includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  try {
    const lastLog = await prisma.activityLog.findFirst({
      where: {
        action,
        // Seed-generated rows store plain text ("[SEED] …") in `details`,
        // not JSON. Skip them so the badge reflects real user actions only.
        NOT: { details: { startsWith: '[SEED]' } },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { fname: true, lname: true, email: true },
        },
      },
    });

    if (!lastLog) {
      return NextResponse.json({ success: true, data: null });
    }

    let details = {};
    if (lastLog.details) {
      try {
        details = JSON.parse(lastLog.details);
      } catch (parseErr) {
        // Any non-JSON detail string (legacy, manually-injected, or seed) falls
        // back to the raw text so the route never 500s on it.
        details = lastLog.details;
        console.warn('[last_action] details is not valid JSON:', parseErr);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        createdAt: lastLog.createdAt,
        user: lastLog.user,
        email: lastLog.email,
        details,
      },
    });
  } catch (error) {
    console.error('Error fetching last action:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}