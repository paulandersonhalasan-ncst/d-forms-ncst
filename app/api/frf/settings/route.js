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
// GET /api/frf/settings
// ==========================================
export async function GET(request) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const settings = await prisma.formSettings.findFirst();
    // If no settings record exists, return defaults
    if (!settings) {
      return NextResponse.json({
        success: true,
        data: {
          minAdvanceDaysRegular: 7,
          minAdvanceDaysVIP: 1,
          maxEventsPerDay: 2,
        }
      });
    }
    return NextResponse.json({ success: true, data: settings });
  } catch (error) {
    // Table might not exist yet – return defaults
    console.error('Error fetching settings:', error);
    return NextResponse.json({
      success: true,
      data: {
        minAdvanceDaysRegular: 7,
        minAdvanceDaysVIP: 1,
        maxEventsPerDay: 2,
      }
    });
  }
}

// ==========================================
// PUT /api/frf/settings
// ==========================================
export async function PUT(request) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const allowedDepartments = ['PSMO/FMO', 'ITO-MAIN'];
  const isSuperUser = user.role === 'SuperUser';
  const isAllowedDept = allowedDepartments.includes(user.departmentCode);

  if (!isSuperUser && !isAllowedDept) {
    return NextResponse.json(
      { success: false, message: 'Only SuperUser, PSMO/FMO, or ITO-MAIN can update settings' },
      { status: 403 }
    );
  }

  const body = await request.json();
  const { minAdvanceDaysRegular, minAdvanceDaysVIP, maxEventsPerDay } = body;

  if (minAdvanceDaysRegular < 0 || minAdvanceDaysVIP < 0 || maxEventsPerDay < 1) {
    return NextResponse.json({
      success: false,
      message: 'Invalid values: minAdvanceDaysRegular and minAdvanceDaysVIP must be >= 0, maxEventsPerDay >= 1',
    }, { status: 400 });
  }

  try {
    const settings = await prisma.formSettings.upsert({
      where: { id: 'single' },
      update: {
        minAdvanceDaysRegular,
        minAdvanceDaysVIP,
        maxEventsPerDay,
        updatedBy: user.id,
        updatedAt: new Date(),
      },
      create: {
        id: 'single',
        minAdvanceDaysRegular,
        minAdvanceDaysVIP,
        maxEventsPerDay,
        updatedBy: user.id,
        updatedAt: new Date(),
      },
    });
    return NextResponse.json({ success: true, data: settings });
  } catch (error) {
    console.error('PUT settings error:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to save settings: ' + error.message,
    }, { status: 500 });
  }
}