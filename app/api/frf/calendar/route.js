import { NextResponse } from 'next/server';
import { prisma } from '../../../../prisma/prisma';
import { jwtVerify } from 'jose';

async function getAuthenticatedUser(request) {
  const cookieHeader = request.headers.get('cookie') || '';
  if (!cookieHeader) return null;

  const cookieParts = cookieHeader.split(';').map((c) => c.trim());
  const sessionCookie = cookieParts.find((c) => c.startsWith('session_token='));
  if (!sessionCookie) return null;

  const token = sessionCookie.split('=')[1];
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    const userId = payload?.id ? String(payload.id) : null;
    if (!userId) return null;
    return await prisma.user.findUnique({ where: { id: userId } });
  } catch (err) {
    console.error('JWT verification failed:', err);
    return null;
  }
}

// ==========================================
// GET /api/frf/calendar?from=&to=
// ==========================================
export async function GET(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    if (!from || !to) {
      return NextResponse.json(
        { success: false, message: 'from and to are required (YYYY-MM-DD)' },
        { status: 400 }
      );
    }

    const dateStart = new Date(`${from}T00:00:00.000Z`);
    const dateEnd = new Date(`${to}T23:59:59.999Z`);

    const reservations = await prisma.facilityReservation.findMany({
      where: {
        status: {
          in: ['PENDING_APPROVAL', 'APPROVED', 'COMPLETED', 'RESCHEDULE_PENDING'],
        },
        dates: {
          some: {
            date: { gte: dateStart, lte: dateEnd },
          },
        },
      },
      select: {
        id: true,
        referenceId: true,
        eventName: true,
        status: true,
        requestorDept: true,
        isReschedule: true,
        isVenueOnly: true,
        requestor: { select: { fname: true, lname: true } },
        dates: {
          where: { date: { gte: dateStart, lte: dateEnd } },
          orderBy: { date: 'asc' },
          select: {
            id: true,
            date: true,
            setupTime: true,
            eventStart: true,
            eventEnd: true,
            teardownTime: true,
            placeOther: true,
            place: { select: { id: true, name: true, category: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Flatten: one row = one date occurrence
    const events = [];
    for (const r of reservations) {
      for (const d of r.dates) {
        events.push({
          reservationId: r.id,
          referenceId: r.referenceId,
          eventName: r.eventName,
          status: r.status,
          requestorDept: r.requestorDept,
          requestorName: `${r.requestor.fname} ${r.requestor.lname}`,
          isReschedule: r.isReschedule,
          isVenueOnly: r.isVenueOnly,
          dateId: d.id,
          date: d.date,
          setupTime: d.setupTime,
          eventStart: d.eventStart,
          eventEnd: d.eventEnd,
          teardownTime: d.teardownTime,
          place: d.place,
          placeOther: d.placeOther,
        });
      }
    }

    return NextResponse.json({ success: true, data: events });
  } catch (error) {
    console.error('GET Calendar Error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch calendar events' },
      { status: 500 }
    );
  }
}