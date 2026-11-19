// app/api/frf/bot_preempt_preview/route.js
import { NextResponse } from 'next/server';
import { prisma } from '../../../../prisma/prisma';
import { jwtVerify } from 'jose';
import { detectBotConflictsForDates } from '../../../lib/bot_preempt';

async function getAuthenticatedUser(request) {
  const cookieHeader = request.headers.get('cookie') || '';
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(';').map(c => c.trim());
  const session = parts.find(c => c.startsWith('session_token='));
  if (!session) return null;
  const token = session.split('=')[1];
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

export async function POST(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { dates } = body;

    if (!dates || !Array.isArray(dates) || dates.length === 0) {
      return NextResponse.json({ success: false, message: 'Dates are required' }, { status: 400 });
    }

    const detected = await detectBotConflictsForDates(dates);

    const serialize = (r) => ({
      reservationId: r.id,
      referenceId: r.referenceId,
      eventName: r.eventName,
      requestor: r.requestor,
      dates: r.dates.map(d => ({ eventStart: d.eventStart, eventEnd: d.eventEnd })),
    });

    return NextResponse.json({
      success: true,
      data: {
        autoBump: detected.autoBump.map(serialize),
        pickCandidates: detected.pickCandidates.map(serialize),
        picksNeeded: detected.picksNeeded,
      },
    });
  } catch (error) {
    console.error('BOT preview error:', error);
    return NextResponse.json({ success: false, message: 'Failed to preview conflicts' }, { status: 500 });
  }
}