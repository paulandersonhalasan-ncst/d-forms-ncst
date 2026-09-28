// lib/timeElapsed.js

/**
 * Compact duration formatter.
 * 45s, 45m, 2h 15m, 2d 4h, 45d
 */
export function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '—';

  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);

  if (day >= 1) {
    const remHr = hr % 24;
    return remHr > 0 ? `${day}d ${remHr}h` : `${day}d`;
  }
  if (hr >= 1) {
    const remMin = min % 60;
    return remMin > 0 ? `${hr}h ${remMin}m` : `${hr}h`;
  }
  if (min >= 1) return `${min}m`;
  return `${sec}s`;
}

/**
 * Verbose formatter for tooltips.
 * "2 days, 4 hours" or "Just now"
 */
export function formatDurationVerbose(ms) {
  if (!Number.isFinite(ms) || ms < 1000) return 'Just now';

  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);

  const parts = [];
  if (day > 0) {
    parts.push(`${day} day${day !== 1 ? 's' : ''}`);
    if (hr % 24 > 0) parts.push(`${hr % 24} hour${(hr % 24) !== 1 ? 's' : ''}`);
  } else if (hr > 0) {
    parts.push(`${hr} hour${hr !== 1 ? 's' : ''}`);
    if (min % 60 > 0) parts.push(`${min % 60} min`);
  } else if (min > 0) {
    parts.push(`${min} min`);
  } else {
    parts.push(`${sec} sec`);
  }

  return parts.join(', ');
}

/**
 * Main helper. Returns null kung walang valid start.
 * Output: { ageMs, compact, verbose, sinceFormatted }
 */
export function getElapsed(start) {
  if (!start) return null;
  const startMs = new Date(start).getTime();
  if (!Number.isFinite(startMs)) return null;

  const ageMs = Math.max(0, Date.now() - startMs);

  return {
    ageMs,
    compact: formatDuration(ageMs),
    verbose: formatDurationVerbose(ageMs),
    sinceFormatted: new Date(startMs).toLocaleString('en-US', {
      timeZone: 'Asia/Manila',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }),
  };
}

/**
 * Human label for status.
 */
export function statusLabel(status) {
  switch (status) {
    case 'PENDING': return 'Pending';
    case 'ACKNOWLEDGED': return 'Awaiting processing';
    case 'PROCESSING': return 'Processing';
    default: return status || '';
  }
}

/**
 * IOM recipient anchor (per-state).
 *   PENDING       → memo.createdAt
 *   ACKNOWLEDGED  → acknowledgedAt
 *   PROCESSING    → processedAt
 *   others        → null (no timer)
 */
export function getIOMRecipientAnchor(recipientRow, memo) {
  if (!recipientRow) return null;

  switch (recipientRow.status) {
    case 'PENDING':
      return memo?.createdAt || null;
    case 'ACKNOWLEDGED':
      return recipientRow.acknowledgedAt
        || recipientRow.respondedAt
        || recipientRow.updatedAt
        || recipientRow.lastActivityAt
        || memo?.createdAt
        || null;
    case 'PROCESSING':
      return recipientRow.processedAt
        || recipientRow.acknowledgedAt
        || memo?.createdAt
        || null;
    default:
      return null;
  }
}

/**
 * FRF approval anchor (per-step).
 *   - Step 1 (requestor): createdAt (or updatedAt for reschedule)
 *   - Step N: previous step's performedAt
 *   - Returns null kung hindi pa na-reach ang step (prev is still pending)
 */
export function getFRFApprovalAnchor(approval, allApprovals, reservation) {
  if (!approval || approval.status !== 'PENDING') return null;

  const sorted = [...(allApprovals || [])].sort(
    (a, b) => a.stepOrder - b.stepOrder
  );
  const idx = sorted.findIndex((a) => a.id === approval.id);

  if (idx <= 0) {
    return reservation?.isReschedule
      ? reservation?.updatedAt || reservation?.createdAt || null
      : reservation?.createdAt || null;
  }

  const prev = sorted[idx - 1];
  if (!prev || !prev.performedAt) {
    // Previous step hasn't been completed — current step hasn't started
    return null;
  }
  return prev.performedAt;
}