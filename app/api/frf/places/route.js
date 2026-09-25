import { NextResponse } from 'next/server';
import { prisma } from '../../../../prisma/prisma';
import { jwtVerify } from 'jose';
import { logActivity } from '../../../lib/logger';

// Helper: Get authenticated user
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

function isSuperUser(user) {
  return user?.role === 'SuperUser';
}

// ==========================================
// GET /api/frf/places
// ==========================================
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const where = {};
    if (!includeInactive) {
      where.isActive = true;
    }

    const places = await prisma.eventPlace.findMany({
      where,
      orderBy: { name: 'asc' }
    });

    return NextResponse.json({ success: true, data: places });
  } catch (error) {
    console.error('GET Places Error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch places' },
      { status: 500 }
    );
  }
}

// ==========================================
// POST /api/frf/places
// ==========================================
export async function POST(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    // Only SuperUser can add places
    if (!isSuperUser(user)) {
      return NextResponse.json(
        { success: false, message: 'Only SuperUser can add places' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, isActive, category } = body;

    if (!name) {
      return NextResponse.json(
        { success: false, message: 'Name is required' },
        { status: 400 }
      );
    }

    // Check if place already exists
    const existing = await prisma.eventPlace.findUnique({
      where: { name: name.trim() }
    });

    if (existing) {
      return NextResponse.json(
        { success: false, message: 'Place already exists' },
        { status: 409 }
      );
    }

    const place = await prisma.eventPlace.create({
      data: {
        name: name.trim(),
        isActive: isActive !== undefined ? isActive : true,
        category: category || 'REGULAR'
      }
    });

    await logActivity({
      req: request,
      userId: user.id,
      email: user.email,
      action: 'PLACE_CREATE',
      details: JSON.stringify({ placeId: place.id, name: place.name })
    });

    return NextResponse.json({ success: true, data: place }, { status: 201 });
  } catch (error) {
    console.error('POST Places Error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to create place' },
      { status: 500 }
    );
  }
}

// ==========================================
// PUT /api/frf/places
// ==========================================
export async function PUT(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    // Only SuperUser can update places
    if (!isSuperUser(user)) {
      return NextResponse.json(
        { success: false, message: 'Only SuperUser can update places' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, message: 'Place ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { name, isActive, category } = body;

    const existing = await prisma.eventPlace.findUnique({
      where: { id }
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, message: 'Place not found' },
        { status: 404 }
      );
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (isActive !== undefined) updateData.isActive = isActive;
    if (category !== undefined) updateData.category = category;

    const place = await prisma.eventPlace.update({
      where: { id },
      data: updateData
    });

    await logActivity({
      req: request,
      userId: user.id,
      email: user.email,
      action: 'PLACE_UPDATE',
      details: JSON.stringify({ placeId: place.id, name: place.name })
    });

    return NextResponse.json({ success: true, data: place });
  } catch (error) {
    console.error('PUT Places Error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to update place' },
      { status: 500 }
    );
  }
}

// ==========================================
// DELETE /api/frf/places
// ==========================================
export async function DELETE(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    // Only SuperUser can delete places
    if (!isSuperUser(user)) {
      return NextResponse.json(
        { success: false, message: 'Only SuperUser can delete places' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, message: 'Place ID is required' },
        { status: 400 }
      );
    }

    // 🆕 Check if place is used in any ACTIVE reservation dates
    const inUse = await prisma.facilityReservationDate.count({
      where: {
        placeId: id,
        reservation: {
          status: {
            in: ['PENDING_APPROVAL', 'APPROVED', 'RESCHEDULE_PENDING', 'COMPLETED'],
          },
        },
      },
    });

    if (inUse > 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            'Cannot delete this place. It is still used in pending, approved, or completed reservations. Deactivate it instead.',
        },
        { status: 409 }
      );
    }

    await prisma.eventPlace.delete({
      where: { id }
    });

    await logActivity({
      req: request,
      userId: user.id,
      email: user.email,
      action: 'PLACE_DELETE',
      details: JSON.stringify({ placeId: id })
    });

    return NextResponse.json({ success: true, message: 'Place deleted successfully' });
  } catch (error) {
    console.error('DELETE Places Error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to delete place' },
      { status: 500 }
    );
  }
}