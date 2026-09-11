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
// VENUE CATEGORY MAPPING (fallback if category field not yet set)
// ==========================================
const VENUE_CATEGORY_MAP = {
  'HRM Bar': 'CATEGORY_1',
  'Multipurpose Room': 'CATEGORY_1',
  'NCST Gym': 'CATEGORY_2',
  'NCST Field': 'CATEGORY_2',
  // Add more as needed
};

async function getVenueCategory(placeName) {
  // First check if place has category in DB
  const place = await prisma.eventPlace.findUnique({
    where: { name: placeName },
    select: { category: true }
  });
  
  if (place?.category && place.category !== 'REGULAR') {
    return place.category;
  }
  
  // Fallback to hardcoded map
  return VENUE_CATEGORY_MAP[placeName] || 'REGULAR';
}

// ==========================================
// POST /api/frf/reservation/check-schedule
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
      return NextResponse.json({ 
        success: false, 
        message: 'At least one date is required' 
      }, { status: 400 });
    }

    const errors = [];
    const allVenues = await prisma.eventPlace.findMany({
      where: { id: { in: venueIds } },
      select: { id: true, name: true, category: true }
    });
    const venueMap = Object.fromEntries(allVenues.map(v => [v.id, v]));

    for (const dateStr of dates) {
      const eventDate = new Date(dateStr);
      const dateStart = new Date(eventDate);
      dateStart.setHours(0, 0, 0, 0);
      const dateEnd = new Date(dateStart);
      dateEnd.setDate(dateEnd.getDate() + 1);

      // Get existing reservations for this date
      const existingReservations = await prisma.facilityReservation.findMany({
        where: {
          status: { in: ['PENDING_APPROVAL', 'APPROVED', 'COMPLETED'] },
          id: excludeId ? { not: excludeId } : undefined,
          dates: {
            some: {
              date: {
                gte: dateStart,
                lt: dateEnd,
              }
            }
          }
        },
        include: {
          dates: {
            where: {
              date: {
                gte: dateStart,
                lt: dateEnd,
              }
            },
            include: { place: true }
          }
        }
      });

      // Get unique venues and their categories from existing reservations
      const existingVenueCategories = new Set();
      for (const res of existingReservations) {
        for (const d of res.dates) {
          if (d.place?.category) {
            existingVenueCategories.add(d.place.category);
          } else if (d.place?.name) {
            // Fallback: check hardcoded map
            const cat = await getVenueCategory(d.place.name);
            if (cat !== 'REGULAR') {
              existingVenueCategories.add(cat);
            }
          }
        }
      }

      // Get categories for requested venues
      const requestedCategories = new Set();
      for (const venueId of venueIds) {
        const venue = venueMap[venueId];
        if (venue?.category && venue.category !== 'REGULAR') {
          requestedCategories.add(venue.category);
        } else if (venue?.name) {
          const cat = await getVenueCategory(venue.name);
          if (cat !== 'REGULAR') {
            requestedCategories.add(cat);
          }
        }
      }

      // Check total events limit (max 2 per day)
      if (existingReservations.length >= 2) {
        errors.push(
          `Maximum of 2 events per day allowed. ${dateStart.toLocaleDateString()} already has ${existingReservations.length} events.`
        );
        continue;
      }

      // Check category-specific limits
      // Category 1: Only 1 event allowed
      if (requestedCategories.has('CATEGORY_1') && existingVenueCategories.has('CATEGORY_1')) {
        errors.push(
          `Category 1 venues (HRM Bar, Multipurpose Room) can only have 1 event per day. ${dateStart.toLocaleDateString()} already has a Category 1 event.`
        );
      }

      // Category 2: Only 1 event allowed
      if (requestedCategories.has('CATEGORY_2') && existingVenueCategories.has('CATEGORY_2')) {
        errors.push(
          `Category 2 venues (NCST Gym, NCST Field, Outside Campuses) can only have 1 event per day. ${dateStart.toLocaleDateString()} already has a Category 2 event.`
        );
      }

      // Special rule: If Category 1 and Category 2 together = 2 events (allowed)
      // But if both categories are already used, no more events
      const hasCategory1 = requestedCategories.has('CATEGORY_1') || existingVenueCategories.has('CATEGORY_1');
      const hasCategory2 = requestedCategories.has('CATEGORY_2') || existingVenueCategories.has('CATEGORY_2');
      
      if (hasCategory1 && hasCategory2) {
        // Check if adding this event would exceed limits
        const existingCategory1Count = existingReservations.filter(r => 
          r.dates.some(d => d.place?.category === 'CATEGORY_1')
        ).length;
        const existingCategory2Count = existingReservations.filter(r => 
          r.dates.some(d => d.place?.category === 'CATEGORY_2')
        ).length;
        
        // If both categories already have events, and we're adding another
        if (existingCategory1Count >= 1 && existingCategory2Count >= 1) {
          errors.push(
            `Both Category 1 and Category 2 venues are already occupied on ${dateStart.toLocaleDateString()}. No more events can be scheduled.`
          );
        }
      }
    }

    if (errors.length > 0) {
      return NextResponse.json({ 
        success: false, 
        message: errors.join(' ') 
      }, { status: 409 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Schedule available' 
    });

  } catch (error) {
    console.error('Check Schedule Error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to check schedule' },
      { status: 500 }
    );
  }
}