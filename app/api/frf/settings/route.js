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

// 🆕 Local helper — mirrors the pattern from reservation/route.js
function isHeadOrOIC(user) {
  if (!user) return false;
  const role = user.role?.toUpperCase();
  if (role === 'DEPARTMENTHEAD' || role === 'DEPARTMENT_HEAD') return true;
  if (user.oic_start && user.oic_end) {
    try {
      const now = new Date();
      const start = new Date(user.oic_start);
      const end = new Date(user.oic_end);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && now >= start && now <= end) {
        return true;
      }
    } catch {}
  }
  return false;
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
          minRescheduleDays: 3,
          enableVipMode: true,
          vipVisibleDepartments: ['PSMO', 'FMO', 'ITO-MAIN'],
          equipmentLendingDepartments: ['ITO-MAIN', 'PSMO','FMO', 'OP', 'CDO'],
          manageAccessDepartments: [],
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
        minRescheduleDays: 3,
        enableVipMode: true,
        vipVisibleDepartments: ['PSMO', 'FMO', 'ITO-MAIN'],
        equipmentLendingDepartments: ['ITO-MAIN', 'PSMO','FMO', 'OP', 'CDO'],
        manageAccessDepartments: [],
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

  // Only SuperUser and ITO-MAIN Head/OIC can edit settings.
  // Matches the UI (Settings tab is shown only for those roles).
  const isSuperUser = user.role === 'SuperUser';
  const isItoMainHeadOrOic =
    user.departmentCode === 'ITO-MAIN' && isHeadOrOIC(user);

  if (!isSuperUser && !isItoMainHeadOrOic) {
    return NextResponse.json(
      { success: false, message: 'Only SuperUser or ITO-MAIN Head/OIC can update settings' },
      { status: 403 }
    );
  }

  const body = await request.json();
  const { 
    minAdvanceDaysRegular, 
    minAdvanceDaysVIP, 
    maxEventsPerDay,
    minRescheduleDays,
    enableVipMode,
    vipVisibleDepartments,
    equipmentLendingDepartments,
    manageAccessDepartments,
  } = body;

  // 🆕 Validate array-of-string fields
  const arrayFields = {
    vipVisibleDepartments,
    equipmentLendingDepartments,
    manageAccessDepartments,
  };
  for (const [name, val] of Object.entries(arrayFields)) {
    if (val !== undefined) {
      if (!Array.isArray(val) || val.some(d => typeof d !== 'string' || !d.trim())) {
        return NextResponse.json({
          success: false,
          message: `${name} must be an array of non-empty strings`,
        }, { status: 400 });
      }
    }
  }

  // 🆕 Validate vipVisibleDepartments
  if (vipVisibleDepartments !== undefined) {
    if (
      !Array.isArray(vipVisibleDepartments) ||
      vipVisibleDepartments.some(d => typeof d !== 'string' || !d.trim())
    ) {
      return NextResponse.json({
        success: false,
        message: 'vipVisibleDepartments must be an array of non-empty strings',
      }, { status: 400 });
    }
  }

    if (
      minAdvanceDaysRegular < 0 || 
      minAdvanceDaysVIP < 0 || 
      maxEventsPerDay < 1 ||
      minRescheduleDays < 1   // 🆕 minimum 1 day
    ) {
      return NextResponse.json({
        success: false,
        message: 'Invalid values: minAdvanceDaysRegular and minAdvanceDaysVIP must be >= 0, maxEventsPerDay >= 1, minRescheduleDays >= 1',
      }, { status: 400 });
    }

  try {
    const settings = await prisma.formSettings.upsert({
      where: { id: 'single' },
      update: {
        minAdvanceDaysRegular,
        minAdvanceDaysVIP,
        maxEventsPerDay,
        minRescheduleDays,
        enableVipMode,
        ...(vipVisibleDepartments !== undefined && { vipVisibleDepartments }),
        ...(equipmentLendingDepartments !== undefined && { equipmentLendingDepartments }),
        ...(manageAccessDepartments !== undefined && { manageAccessDepartments }),
        updatedBy: user.id,
        updatedAt: new Date(),
      },
      create: {
        id: 'single',
        minAdvanceDaysRegular,
        minAdvanceDaysVIP,
        maxEventsPerDay,
        minRescheduleDays,
        enableVipMode: enableVipMode ?? true,
        vipVisibleDepartments: vipVisibleDepartments ?? ['PSMO', 'FMO', 'ITO-MAIN'],
        equipmentLendingDepartments:
          equipmentLendingDepartments ?? ['ITO-MAIN', 'PSMO', 'FMO', 'OP', 'CDO'],
        manageAccessDepartments: manageAccessDepartments ?? [],
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