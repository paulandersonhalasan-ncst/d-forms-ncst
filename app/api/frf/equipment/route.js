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

// Helper: Check if user is SuperUser
function isSuperUser(user) {
  return user?.role === 'SuperUser';
}

// Helper: Check if user is head of a department
function isDepartmentHead(user, deptCode) {
  if (!user) return false;
  const isHead = user.role === 'DepartmentHead' || user.role === 'OIC';
  return isHead && user.departmentCode === deptCode;
}

// ==========================================
// GET /api/frf/equipment
// ==========================================
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const departmentCode = searchParams.get('department');

    const where = {};
    if (departmentCode) {
      where.departmentCode = departmentCode;
    }

    const equipment = await prisma.equipment.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        department: {
          select: { code: true }
        }
      }
    });

    return NextResponse.json({ success: true, data: equipment });
  } catch (error) {
    console.error('GET Equipment Error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch equipment' },
      { status: 500 }
    );
  }
}

// ==========================================
// POST /api/frf/equipment
// ==========================================
export async function POST(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    // Only SuperUser or Dept Head can add equipment
    if (!isSuperUser(user) && !isDepartmentHead(user, user.departmentCode)) {
      return NextResponse.json(
        { success: false, message: 'Only SuperUser or Department Head can add equipment' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, departmentCode, isSingleItem, quantityAvailable } = body;

    if (!name || !departmentCode) {
      return NextResponse.json(
        { success: false, message: 'Name and departmentCode are required' },
        { status: 400 }
      );
    }

    // Check if equipment already exists
    const existing = await prisma.equipment.findUnique({
      where: {
        name_departmentCode: {
          name: name.trim(),
          departmentCode: departmentCode
        }
      }
    });

    if (existing) {
      return NextResponse.json(
        { success: false, message: 'Equipment already exists in this department' },
        { status: 409 }
      );
    }

    const equipment = await prisma.equipment.create({
      data: {
        name: name.trim(),
        departmentCode,
        isSingleItem: isSingleItem || false,
        quantityAvailable: quantityAvailable || 0
      }
    });

    await logActivity({
      req: request,
      userId: user.id,
      email: user.email,
      action: 'EQUIPMENT_CREATE',
      details: JSON.stringify({
        equipmentId: equipment.id,
        name: equipment.name,
        department: departmentCode
      })
    });

    return NextResponse.json({ success: true, data: equipment }, { status: 201 });
  } catch (error) {
    console.error('POST Equipment Error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to create equipment' },
      { status: 500 }
    );
  }
}

// ==========================================
// PUT /api/frf/equipment
// ==========================================
export async function PUT(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, message: 'Equipment ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { name, isSingleItem, quantityAvailable } = body;

    // Get existing equipment to check department
    const existing = await prisma.equipment.findUnique({
      where: { id }
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, message: 'Equipment not found' },
        { status: 404 }
      );
    }

    // Only SuperUser or head of the equipment's department can update
    if (!isSuperUser(user) && !isDepartmentHead(user, existing.departmentCode)) {
      return NextResponse.json(
        { success: false, message: 'Only SuperUser or the department head can update this equipment' },
        { status: 403 }
      );
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (isSingleItem !== undefined) updateData.isSingleItem = isSingleItem;
    if (quantityAvailable !== undefined) updateData.quantityAvailable = quantityAvailable;

    const equipment = await prisma.equipment.update({
      where: { id },
      data: updateData
    });

    await logActivity({
      req: request,
      userId: user.id,
      email: user.email,
      action: 'EQUIPMENT_UPDATE',
      details: JSON.stringify({
        equipmentId: equipment.id,
        name: equipment.name,
        quantityAvailable: equipment.quantityAvailable
      })
    });

    return NextResponse.json({ success: true, data: equipment });
  } catch (error) {
    console.error('PUT Equipment Error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to update equipment' },
      { status: 500 }
    );
  }
}

// ==========================================
// DELETE /api/frf/equipment
// ==========================================
export async function DELETE(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, message: 'Equipment ID is required' },
        { status: 400 }
      );
    }

    const existing = await prisma.equipment.findUnique({
      where: { id }
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, message: 'Equipment not found' },
        { status: 404 }
      );
    }

    if (!isSuperUser(user) && !isDepartmentHead(user, existing.departmentCode)) {
      return NextResponse.json(
        { success: false, message: 'Only SuperUser or the department head can delete this equipment' },
        { status: 403 }
      );
    }

    const inUse = await prisma.facilityEquipmentRequest.count({
      where: { equipmentId: id }
    });

    if (inUse > 0) {
      return NextResponse.json(
        { success: false, message: 'Cannot delete equipment that is being used in reservations' },
        { status: 409 }
      );
    }

    await prisma.equipment.delete({
      where: { id }
    });

    await logActivity({
      req: request,
      userId: user.id,
      email: user.email,
      action: 'EQUIPMENT_DELETE',
      details: JSON.stringify({ equipmentId: id })
    });

    return NextResponse.json({ success: true, message: 'Equipment deleted successfully' });
  } catch (error) {
    console.error('DELETE Equipment Error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to delete equipment' },
      { status: 500 }
    );
  }
}