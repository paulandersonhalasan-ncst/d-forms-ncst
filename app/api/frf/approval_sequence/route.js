// app/api/frf/approval_sequence/route.js
import { NextResponse } from 'next/server';
import { prisma } from '../../../../prisma/prisma';
import { jwtVerify } from 'jose';
import { logActivity } from '../../../lib/logger';
import { TRIGGER_KEYS, STEP_TYPES } from '../../../lib/approval_sequence_defaults';

async function getAuthenticatedUser(request) {
  const cookieHeader = request.headers.get('cookie') || '';
  if (!cookieHeader) return null;
  const sessionCookie = cookieHeader.split(';').map(c => c.trim()).find(c => c.startsWith('session_token='));
  if (!sessionCookie) return null;
  const token = sessionCookie.split('=')[1];
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    const userId = payload?.id ? String(payload.id) : null;
    if (!userId) return null;
    return await prisma.user.findUnique({ where: { id: userId } });
  } catch {
    return null;
  }
}

// ==========================================
// GET /api/frf/approval_sequence?formType=FRF
// ==========================================
export async function GET(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const formType = searchParams.get('formType') || 'FRF';

    const sequence = await prisma.approvalSequence.findUnique({
      where: { formType },
      include: { steps: { orderBy: { sequenceIndex: 'asc' } } },
    });

    const departments = await prisma.department.findMany({
      select: { code: true },
      orderBy: { code: 'asc' },
    });

    const inFlightCount = await prisma.facilityReservation.count({
      where: {
        status: { in: ['PENDING_APPROVAL', 'REVISION_REQUESTED', 'RESCHEDULE_PENDING'] },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        sequence: sequence
          ? {
              id: sequence.id,
              formType: sequence.formType,
              label: sequence.label,
              isActive: sequence.isActive,
              createdAt: sequence.createdAt,
              updatedAt: sequence.updatedAt,
            }
          : null,
        steps: sequence?.steps ?? [],
        departments: departments.map(d => ({ value: d.code, label: d.code })),
        inFlightCount,
      },
    });
  } catch (error) {
    console.error('GET Approval Sequence Error:', error);
    return NextResponse.json({ success: false, message: 'Failed to fetch approval sequences' }, { status: 500 });
  }
}

// ==========================================
// PUT /api/frf/approval_sequence
// Body: { formType, label, isActive, steps: [{ departmentCode, stepType, triggerKey }] }
// ==========================================
export async function PUT(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

    if (user.role !== 'SuperUser') {
      return NextResponse.json({ success: false, message: 'Only SuperUser can edit approval sequences' }, { status: 403 });
    }

    const body = await request.json();
    const { formType = 'FRF', label, isActive = true, steps } = body;

    if (!Array.isArray(steps) || steps.length === 0) {
      return NextResponse.json({ success: false, message: 'At least one step is required' }, { status: 400 });
    }

    // ---- Validate each step ----
    const seenDepts = new Set();
    for (const [i, step] of steps.entries()) {
      if (!step.departmentCode) {
        return NextResponse.json({ success: false, message: `Step ${i + 1}: departmentCode is required` }, { status: 400 });
      }
      if (!STEP_TYPES.includes(step.stepType)) {
        return NextResponse.json({ success: false, message: `Step ${i + 1}: invalid stepType "${step.stepType}"` }, { status: 400 });
      }
      if (!TRIGGER_KEYS.includes(step.triggerKey)) {
        return NextResponse.json({ success: false, message: `Step ${i + 1}: invalid triggerKey "${step.triggerKey}"` }, { status: 400 });
      }
      if (seenDepts.has(step.departmentCode)) {
        return NextResponse.json({ success: false, message: `Duplicate department: ${step.departmentCode}` }, { status: 400 });
      }
      seenDepts.add(step.departmentCode);
    }

    // ---- Validate departments exist ----
    const deptCodes = [...seenDepts];
    const existing = await prisma.department.findMany({
      where: { code: { in: deptCodes } },
      select: { code: true },
    });
    const existingSet = new Set(existing.map(d => d.code));
    const missing = deptCodes.filter(c => !existingSet.has(c));
    if (missing.length > 0) {
      return NextResponse.json({
        success: false,
        message: `Department(s) not found: ${missing.join(', ')}. Add them first.`,
      }, { status: 400 });
    }

    // ---- Must have at least one APPROVAL step ----
    if (!steps.some(s => s.stepType === 'APPROVAL')) {
      return NextResponse.json({ success: false, message: 'At least one APPROVAL step is required' }, { status: 400 });
    }

    // ---- Atomic upsert: create/update sequence + replace all steps ----
    const result = await prisma.$transaction(async (tx) => {
      const seq = await tx.approvalSequence.upsert({
        where: { formType },
        update: {
          label: label || `FRF Default`,
          isActive,
          updatedAt: new Date(),
        },
        create: {
          formType,
          label: label || `FRF Default`,
          isActive,
        },
      });

      await tx.approvalSequenceStep.deleteMany({ where: { sequenceId: seq.id } });

      await tx.approvalSequenceStep.createMany({
        data: steps.map((s, i) => ({
          sequenceId: seq.id,
          sequenceIndex: i + 1,
          departmentCode: s.departmentCode,
          stepType: s.stepType,
          triggerKey: s.triggerKey,
        })),
      });

      return tx.approvalSequence.findUnique({
        where: { id: seq.id },
        include: { steps: { orderBy: { sequenceIndex: 'asc' } } },
      });
    });

    await logActivity({
      req: request,
      userId: user.id,
      email: user.email,
      action: 'FRF_SEQUENCE_UPDATED',
      details: JSON.stringify({ formType, stepCount: steps.length }),
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('PUT Sequences Error:', error);
    return NextResponse.json({ success: false, message: error.message || 'Failed to save sequence' }, { status: 500 });
  }
}