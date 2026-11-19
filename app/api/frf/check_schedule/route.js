import { NextResponse } from 'next/server';
import { prisma } from '../../../../prisma/prisma';
import { jwtVerify } from 'jose';

// ==========================================
// AUTHENTICATION HELPER
// ==========================================
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
// POST /api/frf/check_schedule
// Mirrors validateEventLimit from reservation/route.js
// ==========================================
export async function POST(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { dates, venueIds, excludeId } = body;

    if (!dates || dates.length === 0) {
      return NextResponse.json(
        { success: false, message: 'At least one date is required' },
        { status: 400 }
      );
    }

    const settings = await prisma.formSettings.findUnique({ where: { id: 'single' } });
    const maxEventsPerDay = settings?.maxEventsPerDay ?? 2;

    const allVenues = await prisma.eventPlace.findMany({
      where: { id: { in: venueIds } },
      select: { id: true, name: true, category: true },
    });
    const venueMap = Object.fromEntries(allVenues.map(v => [v.id, v]));

    // VIP bypass — no limits
    const requestedHasVip = allVenues.some(v => v.category === 'VIP');
    if (requestedHasVip) {
      return NextResponse.json({
        success: true,
        message: 'VIP event — no limits applied',
      });
    }

    const errors = [];

    for (const dateStr of dates) {
      const eventDate = new Date(dateStr);
      const dateStart = new Date(eventDate);
      dateStart.setHours(0, 0, 0, 0);
      const dateEnd = new Date(dateStart);
      dateEnd.setDate(dateEnd.getDate() + 1);

      const existingReservations = await prisma.facilityReservation.findMany({
        where: {
          status: { in: ['PENDING_APPROVAL', 'APPROVED', 'COMPLETED'] },
          id: excludeId ? { not: excludeId } : undefined,
          dates: {
            some: {
              date: { gte: dateStart, lt: dateEnd },
              OR: [
                { placeId: null },
                { place: { category: { not: 'VIP' } } },
              ],
            },
          },
        },
        include: {
          dates: {
            where: {
              date: { gte: dateStart, lt: dateEnd },
              OR: [
                { placeId: null },
                { place: { category: { not: 'VIP' } } },
              ],
            },
            include: { place: true },
          },
        },
      });

      if (existingReservations.length >= maxEventsPerDay) {
        errors.push(
          `Maximum of ${maxEventsPerDay} events per day allowed on ${dateStart.toLocaleDateString()}`
        );
        continue;
      }

      const existingCategories = new Set();
      for (const res of existingReservations) {
        for (const d of res.dates) {
          const cat = d.place?.category;
          if (cat && cat !== 'VIP' && cat !== 'REGULAR') {
            existingCategories.add(cat);
          }
        }
      }

      const requestedCategories = new Set();
      for (const venueId of venueIds) {
        const cat = venueMap[venueId]?.category;
        if (cat && cat !== 'VIP' && cat !== 'REGULAR') {
          requestedCategories.add(cat);
        }
      }

      for (const cat of requestedCategories) {
        if (existingCategories.has(cat)) {
          errors.push(
            `${cat.replace('_', ' ')} venue already booked on ${dateStart.toLocaleDateString()}`
          );
        }
      }
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { success: false, message: errors.join(' ') },
        { status: 409 }
      );
    }

    return NextResponse.json({ success: true, message: 'Schedule available' });
  } catch (error) {
    console.error('Check Schedule Error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to check schedule' },
      { status: 500 }
    );
  }
}