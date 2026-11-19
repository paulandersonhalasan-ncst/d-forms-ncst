// lib/bot_preempt.js
// Shared helper for detecting BOT preemption conflicts.
// Used by both the POST handler and the /api/frf/bot_preempt_preview endpoint.

import { prisma } from '../../prisma/prisma';

/**
 * Given an array of BOT dates, detect which existing FRFs need to be bumped.
 * 
 * @param {Array} datesArray - [{ date, eventStart, eventEnd, placeId?, placeOther? }]
 * @param {string|null} excludeId - reservation ID to exclude (the BOT FRF itself)
 * @returns {Promise<{
 *   autoBump: Array,
 *   pickCandidates: Array,
 *   picksNeeded: number,
 * }>}
 */
export async function detectBotConflictsForDates(datesArray, excludeId = null) {
  const settings = await prisma.formSettings.findUnique({ where: { id: 'single' } });
  const maxEventsPerDay = settings?.maxEventsPerDay ?? 2;

  const autoBumpMap = new Map();
  const pickCandidatesMap = new Map();
  let totalPicksNeeded = 0;

  for (const botDate of datesArray) {
    const dayStart = new Date(botDate.date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const botStart = new Date(botDate.eventStart);
    const botEnd = new Date(botDate.eventEnd);

    // Eligible existing FRFs on that day: staffed, not yet packed up, non-BOT, non-terminal
    const existing = await prisma.facilityReservation.findMany({
      where: {
        id: excludeId ? { not: excludeId } : undefined,
        status: { in: ['PENDING_APPROVAL', 'APPROVED', 'COMPLETED'] },
        isBotEvent: false,
        isVenueOnly: false,
        packUpDoneAt: null,
        dates: { some: { date: { gte: dayStart, lt: dayEnd } } },
      },
      include: {
        dates: { where: { date: { gte: dayStart, lt: dayEnd } } },
        requestor: { select: { id: true, fname: true, lname: true, email: true } },
      },
    });

    const overlaps = [];
    const nonOverlaps = [];

    for (const ex of existing) {
      const hasOverlap = ex.dates.some(d =>
        new Date(d.eventStart) < botEnd && new Date(d.eventEnd) > botStart
      );
      if (hasOverlap) overlaps.push(ex);
      else nonOverlaps.push(ex);
    }

    // All time-overlap conflicts must be bumped (mandatory)
    for (const ov of overlaps) {
      if (!autoBumpMap.has(ov.id)) autoBumpMap.set(ov.id, ov);
    }

    // Capacity check: after bumping overlaps, BOT + remaining nonOverlaps must fit
    const remainingAfterBumps = 1 + nonOverlaps.length; // +1 for the BOT itself
    const picksNeeded = Math.max(0, remainingAfterBumps - maxEventsPerDay);

    if (picksNeeded > 0) {
      totalPicksNeeded += picksNeeded;
      for (const no of nonOverlaps) {
        if (!pickCandidatesMap.has(no.id)) pickCandidatesMap.set(no.id, no);
      }
    }
  }

  return {
    autoBump: [...autoBumpMap.values()],
    pickCandidates: [...pickCandidatesMap.values()],
    picksNeeded: totalPicksNeeded,
  };
}