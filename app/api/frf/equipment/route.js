import { NextResponse } from 'next/server';
import { prisma } from '../../../../prisma/prisma';
import { jwtVerify } from 'jose';
import { logActivity } from '../../../lib/logger';

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

function isDepartmentHead(user, deptCode) {
  if (!user) return false;
  const isHead = user.role === 'DepartmentHead' || user.role === 'OIC';
  return isHead && user.departmentCode === deptCode;
}

// ==========================================
// GET /api/frf/equipment
// ?department=ITO-MAIN
// ?branch=MAIN            → branch-wide + branch-specific + global
// ?placeIds=id1,id2       → venue-scoped + branch-wide + global
// ?onlyGlobal=true        → only global (branch = null)
// ==========================================
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const departmentCode = searchParams.get('department');
    const branch = searchParams.get('branch');
    const placeIdsParam = searchParams.get('placeIds');
    const onlyGlobal = searchParams.get('onlyGlobal') === 'true';

    const where = {};
    if (departmentCode) where.departmentCode = departmentCode;

    if (onlyGlobal) {
      where.branch = null;
    } else if (placeIdsParam) {
      const placeIds = placeIdsParam.split(',').filter(Boolean);
      // Get branches of those places
      const placeBranches = await prisma.eventPlace.findMany({
        where: { id: { in: placeIds } },
        select: { branch: true },
      });
      const branches = [...new Set(placeBranches.map(p => p.branch))];

      where.OR = [
        { branch: null },                          // 🌐 global
        {
          branch: { in: branches },                // 🏢 same branch
          places: {
            some: { placeId: { in: placeIds } },   // 📍 venue-specific
          },
        },
        {
          branch: { in: branches },                // 🏢 branch-wide
          places: { none: {} },                    //    (no venue restriction)
        },
      ];
    } else if (branch) {
      where.OR = [
        { branch: null },
        { branch },
      ];
    }

    const equipment = await prisma.equipment.findMany({
      where,
      orderBy: [{ branch: 'asc' }, { name: 'asc' }],
      include: {
        department: { select: { code: true } },
        places: {
          include: {
            place: { select: { id: true, name: true, branch: true } },
          },
        },
      },
    });

    // 🆕 Get usage counts (only from PACK UP DONE reservations)
    const usageData = await prisma.facilityEquipmentRequest.findMany({
      where: {
        reservation: {
          packUpDoneAt: { not: null },
        },
      },
      select: {
        equipmentId: true,
        quantityRequested: true,
      },
    });

    const usageMap = {};
    for (const u of usageData) {
      if (!usageMap[u.equipmentId]) {
        usageMap[u.equipmentId] = { count: 0, totalQty: 0 };
      }
      usageMap[u.equipmentId].count += 1;
      usageMap[u.equipmentId].totalQty += u.quantityRequested;
    }

    const equipmentWithUsage = equipment.map(e => ({
      ...e,
      useCount: usageMap[e.id]?.count || 0,
      totalDeployedQty: usageMap[e.id]?.totalQty || 0,
    }));

    return NextResponse.json({ success: true, data: equipmentWithUsage });
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
// Body: { name, departmentCode, branch?, placeIds?, isSingleItem, quantityAvailable }
// ==========================================
export async function POST(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    if (!isSuperUser(user) && !isDepartmentHead(user, user.departmentCode)) {
      return NextResponse.json(
        { success: false, message: 'Only SuperUser or Department Head can add equipment' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, departmentCode, branch, placeIds, bundledPlaceIds, isSingleItem, quantityAvailable } = body;

    if (!name || !departmentCode) {
      return NextResponse.json(
        { success: false, message: 'Name and departmentCode are required' },
        { status: 400 }
      );
    }

    const normalizedBranch = branch && branch.trim() !== '' ? branch : null;
    const normalizedPlaceIds = Array.isArray(placeIds) ? placeIds.filter(Boolean) : [];

    // 🆕 If branch is null, places must be empty
    if (!normalizedBranch && normalizedPlaceIds.length > 0) {
      return NextResponse.json(
        { success: false, message: 'Global equipment cannot be tied to specific venues' },
        { status: 400 }
      );
    }

    // 🆕 App-level uniqueness (Postgres treats NULL as distinct)
    const existing = await prisma.equipment.findFirst({
      where: {
        name: name.trim(),
        departmentCode,
        branch: normalizedBranch,
      },
    });

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          message: normalizedBranch
            ? `Equipment with this name already exists in ${normalizedBranch}`
            : 'Global equipment with this name already exists in this department',
        },
        { status: 409 }
      );
    }

    const normalizedBundledIds = Array.isArray(bundledPlaceIds)
      ? bundledPlaceIds.filter(Boolean)
      : [];

    const equipment = await prisma.equipment.create({
      data: {
        name: name.trim(),
        departmentCode,
        branch: normalizedBranch,
        isSingleItem: isSingleItem || false,
        quantityAvailable: quantityAvailable || 0,
        places: normalizedPlaceIds.length > 0
          ? {
              create: normalizedPlaceIds.map(pid => ({
                placeId: pid,
                isBundled: normalizedBundledIds.includes(pid),   // 🆕
              })),
            }
          : undefined,
      },
      include: {
        places: {
          include: { place: { select: { id: true, name: true, branch: true } } },
        },
      },
    });

    await logActivity({
      req: request,
      userId: user.id,
      email: user.email,
      action: 'EQUIPMENT_CREATE',
      details: JSON.stringify({
        equipmentId: equipment.id,
        name: equipment.name,
        department: departmentCode,
        branch: normalizedBranch,
        placeIds: normalizedPlaceIds,
      }),
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
// PUT /api/frf/equipment?id=xxx
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
    const { name, isSingleItem, quantityAvailable, branch, placeIds, bundledPlaceIds } = body;

    const existing = await prisma.equipment.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, message: 'Equipment not found' },
        { status: 404 }
      );
    }

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

    let normalizedBranch;
    if (branch !== undefined) {
      normalizedBranch = branch && branch.trim() !== '' ? branch : null;
      updateData.branch = normalizedBranch;
    }

    let normalizedPlaceIds;
    if (placeIds !== undefined) {
      normalizedPlaceIds = Array.isArray(placeIds) ? placeIds.filter(Boolean) : [];
    }

    const finalBranch = normalizedBranch !== undefined ? normalizedBranch : existing.branch;

    // If branch is null, places must be empty
    if (!finalBranch && normalizedPlaceIds && normalizedPlaceIds.length > 0) {
      return NextResponse.json(
        { success: false, message: 'Global equipment cannot be tied to specific venues' },
        { status: 400 }
      );
    }

    // Uniqueness check if name/branch changing
    const newName = updateData.name ?? existing.name;
    if (newName !== existing.name || (normalizedBranch !== undefined && normalizedBranch !== existing.branch)) {
      const duplicate = await prisma.equipment.findFirst({
        where: {
          id: { not: id },
          name: newName,
          departmentCode: existing.departmentCode,
          branch: finalBranch,
        },
      });
      if (duplicate) {
        return NextResponse.json(
          { success: false, message: 'Another equipment with this name already exists in this branch' },
          { status: 409 }
        );
      }
    }

    const normalizedBundledIds = Array.isArray(bundledPlaceIds)
      ? bundledPlaceIds.filter(Boolean)
      : [];

    const equipment = await prisma.$transaction(async (tx) => {
      // Replace venues if provided
      if (normalizedPlaceIds !== undefined) {
        await tx.equipmentPlace.deleteMany({ where: { equipmentId: id } });
        if (normalizedPlaceIds.length > 0) {
          await tx.equipmentPlace.createMany({
            data: normalizedPlaceIds.map(pid => ({
              equipmentId: id,
              placeId: pid,
              isBundled: normalizedBundledIds.includes(pid),
            })),
          });
        }
      }
      return tx.equipment.update({
        where: { id },
        data: updateData,
        include: {
          places: {
            include: { place: { select: { id: true, name: true, branch: true } } },
          },
        },
      });
    });

    await logActivity({
      req: request,
      userId: user.id,
      email: user.email,
      action: 'EQUIPMENT_UPDATE',
      details: JSON.stringify({
        equipmentId: equipment.id,
        name: equipment.name,
        branch: equipment.branch,
        placeIds: normalizedPlaceIds,
      }),
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
// DELETE /api/frf/equipment?id=xxx
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

    const existing = await prisma.equipment.findUnique({ where: { id } });
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
      where: { equipmentId: id },
    });
    if (inUse > 0) {
      return NextResponse.json(
        { success: false, message: 'Cannot delete equipment that is being used in reservations' },
        { status: 409 }
      );
    }

    await prisma.equipment.delete({ where: { id } });

    await logActivity({
      req: request,
      userId: user.id,
      email: user.email,
      action: 'EQUIPMENT_DELETE',
      details: JSON.stringify({ equipmentId: id, branch: existing.branch }),
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