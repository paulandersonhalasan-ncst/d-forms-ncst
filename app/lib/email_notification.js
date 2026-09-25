import { sendEmailWithRetry } from './email_service';
import { prisma } from '../../prisma/prisma';

/**
 * Get active Department Heads (including OIC) for a given department code
 * OIC = user with oic_start and oic_end covering current date/time
 */

function renderFRFDetailsHTML(reservation, options = {}) {
  const {
    showApprovals = false,
    showAssignments = false,
    showPackUp = false,
    accentColor = '#1a3a5c',
  } = options;

  const fmtDate = (v) =>
    v ? new Date(v).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';
  const fmtDateTime = (v) =>
    v ? new Date(v).toLocaleString('en-US', { timeZone: 'Asia/Manila' }) : '—';
  const fmtTime = (v) =>
    v
      ? new Date(v).toLocaleTimeString('en-US', {
          timeZone: 'Asia/Manila',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        })
      : '—';
  const esc = (s) =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  // ----- Unique venues -----
  const venueMap = new Map();
  (reservation.dates || []).forEach((d) => {
    const name = d.place?.name || d.placeOther || 'TBA';
    const key = name.trim().toLowerCase();
    if (!venueMap.has(key)) venueMap.set(key, name.trim());
  });
  const venuesStr = Array.from(venueMap.values()).join(', ') || '—';

  // ----- Meta grid -----
  const metaGrid = `
    <table cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-collapse: collapse; background: #f8f9fa; border-radius: 6px; margin: 16px 0;">
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e9ecef;">
          <div style="color: #666; font-size: 11px; font-weight: 600; letter-spacing: 0.4px; text-transform: uppercase;">Status</div>
          <div style="font-size: 13px; font-weight: 600; color: ${accentColor}; margin-top: 2px;">
            ${esc(reservation.status)}
            ${reservation.isReschedule ? `<span style="display: inline-block; margin-left: 6px; padding: 1px 8px; border-radius: 10px; background: #fef3c7; color: #92400e; font-size: 10px; font-weight: 700;">RESCHEDULE</span>` : ''}
            ${reservation.isVenueOnly ? `<span style="display: inline-block; margin-left: 6px; padding: 1px 8px; border-radius: 10px; background: #e5e7eb; color: #4b5563; font-size: 10px; font-weight: 700;">VENUE ONLY</span>` : ''}
          </div>
        </td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e9ecef;">
          <div style="color: #666; font-size: 11px; font-weight: 600; letter-spacing: 0.4px; text-transform: uppercase;">Type</div>
          <div style="font-size: 13px; color: #1a3a5c; margin-top: 2px;">${esc((reservation.type || '').replace('_', ' '))}</div>
        </td>
      </tr>
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e9ecef;">
          <div style="color: #666; font-size: 11px; font-weight: 600; letter-spacing: 0.4px; text-transform: uppercase;">Event Title</div>
          <div style="font-size: 13px; color: #1a3a5c; margin-top: 2px;">${esc(reservation.eventName || '—')}</div>
        </td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e9ecef;">
          <div style="color: #666; font-size: 11px; font-weight: 600; letter-spacing: 0.4px; text-transform: uppercase;">Requestor</div>
          <div style="font-size: 13px; color: #1a3a5c; margin-top: 2px;">${esc(reservation.requestor?.fname || '')} ${esc(reservation.requestor?.lname || '')}</div>
        </td>
      </tr>
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e9ecef;">
          <div style="color: #666; font-size: 11px; font-weight: 600; letter-spacing: 0.4px; text-transform: uppercase;">Department</div>
          <div style="font-size: 13px; color: #1a3a5c; margin-top: 2px;">${esc(reservation.requestorDept || '—')}</div>
        </td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e9ecef;">
          <div style="color: #666; font-size: 11px; font-weight: 600; letter-spacing: 0.4px; text-transform: uppercase;">Attendees</div>
          <div style="font-size: 13px; color: #1a3a5c; margin-top: 2px;">${esc(reservation.attendeesCount)}</div>
        </td>
      </tr>
      <tr>
        <td style="padding: 10px 12px;">
          <div style="color: #666; font-size: 11px; font-weight: 600; letter-spacing: 0.4px; text-transform: uppercase;">Venue/s</div>
          <div style="font-size: 13px; color: #1a3a5c; margin-top: 2px;">${esc(venuesStr)}</div>
        </td>
        <td style="padding: 10px 12px;">
          <div style="color: #666; font-size: 11px; font-weight: 600; letter-spacing: 0.4px; text-transform: uppercase;">Usage Hours / With Charge</div>
          <div style="font-size: 13px; color: #1a3a5c; margin-top: 2px;">${esc(reservation.usageHours ?? '—')} hrs · ${reservation.withCharge ? 'Yes' : 'No'}</div>
        </td>
      </tr>
    </table>
  `;

  // ----- Requestor notes -----
  const notesBlock = reservation.requestorNotes
    ? `
    <div style="margin: 16px 0; padding: 12px 16px; border-left: 3px solid #888; background: #f8f9fa;">
      <div style="font-weight: 600; font-size: 12px; color: #666; margin-bottom: 4px;">REQUESTOR NOTES</div>
      <div style="font-size: 13px; color: #333; white-space: pre-wrap; line-height: 1.5;">${esc(reservation.requestorNotes)}</div>
    </div>`
    : '';

  // ----- Event dates -----
  const datesHtml = (reservation.dates || [])
    .map((d, i) => {
      const placeName = d.place?.name || d.placeOther || 'TBA';
      return `
      <div style="margin: 8px 0; padding: 10px 12px; border-left: 3px solid ${accentColor}; background: #f8f9fa; border-radius: 4px;">
        <div style="font-weight: 700; font-size: 13px; color: ${accentColor}; margin-bottom: 4px;">Date ${i + 1}: ${esc(fmtDate(d.eventStart))}</div>
        <div style="font-size: 12px; color: #333; line-height: 1.6;">
          <span style="color: #666;">Setup:</span> <b>${esc(fmtTime(d.setupTime))}</b> &nbsp;·&nbsp;
          <span style="color: #666;">Event:</span> <b>${esc(fmtTime(d.eventStart))} – ${esc(fmtTime(d.eventEnd))}</b> &nbsp;·&nbsp;
          <span style="color: #666;">Pack-up:</span> <b>${esc(fmtTime(d.teardownTime))}</b>
          <br/>
          <span style="color: #666;">Place:</span> <b>${esc(placeName)}</b>
        </div>
      </div>`;
    })
    .join('');

  // ----- Equipment table -----
  const equipmentRows = (reservation.equipmentRequests || []).length > 0
    ? reservation.equipmentRequests
        .map(
          (eq, i) => `
      <tr style="border-bottom: 1px dashed #dee2e6;">
        <td style="padding: 6px 8px; text-align: center; font-size: 12px; color: #666;">${i + 1}</td>
        <td style="padding: 6px 8px; font-size: 13px; color: #1a3a5c; font-weight: 500;">${esc(eq.equipment?.name || 'Unknown')}</td>
        <td style="padding: 6px 8px; font-size: 12px; color: #666;">${esc(eq.equipment?.departmentCode || '—')}</td>
        <td style="padding: 6px 8px; text-align: center; font-size: 13px; color: #1a3a5c; font-weight: 600;">${esc(eq.quantityRequested)}</td>
      </tr>`
        )
        .join('')
    : `<tr><td colspan="4" style="padding: 12px; text-align: center; font-size: 12px; font-style: italic; color: #999;">No equipment requested</td></tr>`;

  const equipmentTable = `
    <table cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-collapse: collapse; margin-top: 8px;">
      <thead>
        <tr style="border-bottom: 2px solid #1a3a5c;">
          <th style="padding: 6px 8px; text-align: center; font-size: 11px; color: #1a3a5c; letter-spacing: 0.4px; text-transform: uppercase; width: 8%;">#</th>
          <th style="padding: 6px 8px; text-align: left; font-size: 11px; color: #1a3a5c; letter-spacing: 0.4px; text-transform: uppercase;">Equipment</th>
          <th style="padding: 6px 8px; text-align: left; font-size: 11px; color: #1a3a5c; letter-spacing: 0.4px; text-transform: uppercase; width: 20%;">Dept</th>
          <th style="padding: 6px 8px; text-align: center; font-size: 11px; color: #1a3a5c; letter-spacing: 0.4px; text-transform: uppercase; width: 12%;">Qty</th>
        </tr>
      </thead>
      <tbody>${equipmentRows}</tbody>
    </table>
  `;

  // ----- Assignments (optional) -----
  let assignmentsBlock = '';
  if (showAssignments && (reservation.assignments || []).length > 0) {
    const rows = reservation.assignments
      .map((a) => {
        const duty =
          a.dutyType === 'TEARDOWN' ? 'PACK-UP' : a.dutyType;
        const otBadge = a.isOvertime
          ? `<span style="display: inline-block; padding: 1px 6px; background: #d4edda; color: #155724; border-radius: 3px; font-size: 10px; font-weight: 700;">OT</span>`
          : '—';
        return `
        <tr style="border-bottom: 1px dashed #dee2e6;">
          <td style="padding: 6px 8px; font-size: 12px; color: #333;">${esc(fmtDate(a.dutyStart))}</td>
          <td style="padding: 6px 8px; font-size: 13px; color: #1a3a5c; font-weight: 600;">${esc(a.user?.fname || '')} ${esc(a.user?.lname || '')}</td>
          <td style="padding: 6px 8px; font-size: 12px; color: #333;">${esc(duty)}</td>
          <td style="padding: 6px 8px; text-align: center; font-size: 12px;">${otBadge}</td>
          <td style="padding: 6px 8px; font-size: 12px; color: #333;">${esc(fmtTime(a.dutyStart))}</td>
          <td style="padding: 6px 8px; font-size: 12px; color: #333;">${esc(fmtTime(a.dutyEnd))}</td>
          <td style="padding: 6px 8px; font-size: 12px; color: #666;">${esc(a.notes || '—')}</td>
        </tr>`;
      })
      .join('');

    assignmentsBlock = `
      <div style="margin-top: 20px;">
        <div style="font-weight: 700; font-size: 14px; color: ${accentColor}; border-bottom: 1px solid #e9ecef; padding-bottom: 6px; margin-bottom: 10px;">ITO Staff Duty Line-up</div>
        <table cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="border-bottom: 2px solid #1a3a5c;">
              <th style="padding: 6px 8px; text-align: left; font-size: 11px; color: #1a3a5c; text-transform: uppercase;">Date</th>
              <th style="padding: 6px 8px; text-align: left; font-size: 11px; color: #1a3a5c; text-transform: uppercase;">Staff</th>
              <th style="padding: 6px 8px; text-align: left; font-size: 11px; color: #1a3a5c; text-transform: uppercase;">Duty</th>
              <th style="padding: 6px 8px; text-align: center; font-size: 11px; color: #1a3a5c; text-transform: uppercase;">OT</th>
              <th style="padding: 6px 8px; text-align: left; font-size: 11px; color: #1a3a5c; text-transform: uppercase;">Start</th>
              <th style="padding: 6px 8px; text-align: left; font-size: 11px; color: #1a3a5c; text-transform: uppercase;">End</th>
              <th style="padding: 6px 8px; text-align: left; font-size: 11px; color: #1a3a5c; text-transform: uppercase;">Notes</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  // ----- Approvals (optional) -----
  let approvalsBlock = '';
  if (showApprovals && (reservation.approvals || []).length > 0) {
    const sorted = [...reservation.approvals].sort((a, b) => a.stepOrder - b.stepOrder);
    const rows = sorted
      .map((a) => {
        const statusLabel =
          a.status === 'ACKNOWLEDGED' && a.remarks?.includes('Noted by')
            ? 'Noted'
            : a.status;
        const statusColor =
          a.status === 'APPROVED'
            ? { bg: '#d4edda', fg: '#155724' }
            : a.status === 'REJECTED'
            ? { bg: '#f8d7da', fg: '#721c24' }
            : a.status === 'REVISION_REQUESTED'
            ? { bg: '#fff3cd', fg: '#856404' }
            : a.status === 'ACKNOWLEDGED'
            ? { bg: '#cce5ff', fg: '#004085' }
            : { bg: '#e9ecef', fg: '#495057' };

        const performer = a.performedBy
          ? `${a.performedBy.fname} ${a.performedBy.lname}`
          : a.performedById
          ? `User ${a.performedById}`
          : '—';

        return `
        <tr style="border-bottom: 1px dashed #dee2e6;">
          <td style="padding: 6px 8px; font-size: 13px; font-weight: 600; color: #1a3a5c;">${esc(a.departmentCode)}</td>
          <td style="padding: 6px 8px;">
            <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; background: ${statusColor.bg}; color: ${statusColor.fg};">${esc(statusLabel)}</span>
          </td>
          <td style="padding: 6px 8px; font-size: 12px; color: #333;">${esc(performer)}</td>
          <td style="padding: 6px 8px; font-size: 11px; color: #666;">${a.performedAt ? esc(fmtDateTime(a.performedAt)) : '—'}</td>
          <td style="padding: 6px 8px; font-size: 12px; color: #333; max-width: 220px;">${esc(a.remarks || a.revisionReason || '—')}</td>
        </tr>`;
      })
      .join('');

    approvalsBlock = `
      <div style="margin-top: 20px;">
        <div style="font-weight: 700; font-size: 14px; color: ${accentColor}; border-bottom: 1px solid #e9ecef; padding-bottom: 6px; margin-bottom: 10px;">Approval Flow</div>
        <table cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="border-bottom: 2px solid #1a3a5c;">
              <th style="padding: 6px 8px; text-align: left; font-size: 11px; color: #1a3a5c; text-transform: uppercase; width: 15%;">Dept</th>
              <th style="padding: 6px 8px; text-align: left; font-size: 11px; color: #1a3a5c; text-transform: uppercase; width: 12%;">Status</th>
              <th style="padding: 6px 8px; text-align: left; font-size: 11px; color: #1a3a5c; text-transform: uppercase; width: 22%;">By</th>
              <th style="padding: 6px 8px; text-align: left; font-size: 11px; color: #1a3a5c; text-transform: uppercase; width: 18%;">Timestamp</th>
              <th style="padding: 6px 8px; text-align: left; font-size: 11px; color: #1a3a5c; text-transform: uppercase;">Remarks</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  // ----- Pack up (optional) -----
  let packUpBlock = '';
  if (showPackUp && reservation.packUpDoneAt) {
    packUpBlock = `
      <div style="margin-top: 20px; padding: 12px 16px; border: 1px solid #c0c0c0; background: #f3f5f3; border-radius: 6px;">
        <div style="font-weight: 700; font-size: 14px; color: #4b5563; margin-bottom: 6px;">✓ PACK UP DONE</div>
        <div style="font-size: 12px; color: #333; line-height: 1.6;">
          <div><b>Marked by:</b> ${esc(reservation.packUpDoneBy?.fname || '')} ${esc(reservation.packUpDoneBy?.lname || '')} (${esc(reservation.packUpDoneBy?.departmentCode || '—')})</div>
          <div><b>Date & Time:</b> ${esc(fmtDateTime(reservation.packUpDoneAt))}</div>
          ${reservation.packUpDoneNotes ? `<div style="margin-top: 6px;"><b>Notes:</b> ${esc(reservation.packUpDoneNotes)}</div>` : ''}
        </div>
      </div>
    `;
  }

    return `
    ${metaGrid}
    ${notesBlock}
    <div style="margin-top: 20px;">
      <div style="font-weight: 700; font-size: 14px; color: ${accentColor}; border-bottom: 1px solid #e9ecef; padding-bottom: 6px; margin-bottom: 10px;">Event Dates</div>
      ${datesHtml || '<div style="color: #999; font-size: 12px; font-style: italic;">No dates specified</div>'}
    </div>
    <div style="margin-top: 20px;">
      <div style="font-weight: 700; font-size: 14px; color: ${accentColor}; border-bottom: 1px solid #e9ecef; padding-bottom: 6px; margin-bottom: 10px;">Equipment Requested</div>
      ${equipmentTable}
    </div>
    ${assignmentsBlock}
    ${approvalsBlock}
    ${packUpBlock}
  `;
}

// ============================================
// 🆕 FRF — Notify Assigned Staff (personal duty email)
// ============================================

/**
 * Send a personal email to each staff member who was assigned to an event.
 *
 * @param {Array<{id:string, email:string, fname:string, lname:string}>} assignedStaffUsers
 * @param {object} reservation
 * @param {Array<{userId:string, staffName:string, dutyStart:any, dutyEnd:any, dutyType:string, isOvertime:boolean, notes?:string}>} assignments
 */
export async function sendFRFAssignmentToStaff(assignedStaffUsers, reservation, assignments) {
  const actionUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/forms/frf`;
  const accentColor = '#0d9488'; // teal

  const esc = (s) =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  const fmtDate = (v) =>
    v ? new Date(v).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '—';
  const fmtTime = (v) =>
    v ? new Date(v).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit', hour12: true }) : '—';

  const dutyLabel = (t) =>
    t === 'TEARDOWN' ? 'Pack-up' : (t.charAt(0) + t.slice(1).toLowerCase());

  const dutyBadgeColors = (t) => {
    if (t === 'SETUP')     return { bg: '#dbeafe', fg: '#1e40af' };
    if (t === 'TEARDOWN')  return { bg: '#fff3e0', fg: '#9a3412' };
    if (t === 'OPERATOR')  return { bg: '#f3e8ff', fg: '#6b21a8' };
    return { bg: '#e5e7eb', fg: '#374151' }; // ASSISTANT
  };

  // ----- Group assignments by user -----
  const byUser = {};
  for (const a of assignments) {
    if (!byUser[a.userId]) byUser[a.userId] = [];
    byUser[a.userId].push(a);
  }

  // ----- Unique venues -----
  const venueMap = new Map();
  (reservation.dates || []).forEach((d) => {
    const name = d.place?.name || d.placeOther || 'TBA';
    const key = name.trim().toLowerCase();
    if (!venueMap.has(key)) venueMap.set(key, name.trim());
  });
  const venuesStr = Array.from(venueMap.values()).join(', ') || '—';

  // ----- Event dates summary block -----
  const datesBlock = (reservation.dates || [])
    .map((d) => {
      const placeName = d.place?.name || d.placeOther || 'TBA';
      return `
        <div style="margin: 6px 0; padding: 10px 12px; border-left: 3px solid ${accentColor}; background: #f8f9fa; border-radius: 4px;">
          <div style="font-weight: 700; font-size: 13px; color: ${accentColor}; margin-bottom: 3px;">${esc(fmtDate(d.eventStart))}</div>
          <div style="font-size: 12px; color: #333; line-height: 1.6;">
            <b>Event:</b> ${esc(fmtTime(d.eventStart))} – ${esc(fmtTime(d.eventEnd))} &nbsp;·&nbsp;
            <b>Place:</b> ${esc(placeName)}
          </div>
        </div>`;
    })
    .join('');

  for (const staff of assignedStaffUsers) {
    const myDuties = byUser[staff.id] || [];
    if (myDuties.length === 0) continue;

    const hasOT = myDuties.some((d) => d.isOvertime);

    // ----- Personal duty table -----
    const dutyRows = myDuties
      .map((d) => {
        const colors = dutyBadgeColors(d.dutyType);
        const otBadge = d.isOvertime
          ? `<span style="display: inline-block; padding: 1px 6px; background: #d4edda; color: #155724; border-radius: 3px; font-size: 10px; font-weight: 700;">OT</span>`
          : '—';
        return `
          <tr style="border-bottom: 1px dashed #dee2e6;">
            <td style="padding: 8px 10px; font-size: 12px; color: #333;">${esc(fmtDate(d.dutyStart))}</td>
            <td style="padding: 8px 10px;">
              <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; background: ${colors.bg}; color: ${colors.fg};">
                ${esc(dutyLabel(d.dutyType))}
              </span>
            </td>
            <td style="padding: 8px 10px; font-size: 12px; color: #333;">${esc(fmtTime(d.dutyStart))} – ${esc(fmtTime(d.dutyEnd))}</td>
            <td style="padding: 8px 10px; text-align: center; font-size: 12px;">${otBadge}</td>
            <td style="padding: 8px 10px; font-size: 12px; color: #666;">${esc(d.notes || '—')}</td>
          </tr>`;
      })
      .join('');

    const subject = `📌 You've Been Assigned – ${reservation.referenceId}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>You've Been Assigned</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f5f7fa; font-family: 'Inter', Arial, Helvetica, sans-serif;">
        <div style="max-width: 760px; margin: 24px auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); overflow: hidden;">

          <!-- Header -->
          <div style="padding: 28px 40px 20px 40px; border-bottom: 3px solid ${accentColor};">
            <div style="font-size: 20px; font-weight: 700; color: ${accentColor}; letter-spacing: 0.3px;">📌 You've Been Assigned</div>
            <div style="color: #666; font-size: 13px; margin-top: 4px;">
              ${esc(reservation.referenceId)} &nbsp;·&nbsp; ${esc(
  new Date().toLocaleString('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
)}
            </div>
          </div>

          <!-- Body -->
          <div style="padding: 24px 40px 32px 40px;">
            <p style="font-size: 15px; color: #333; line-height: 1.6; margin: 0 0 14px 0;">
              Dear <b>${esc(staff.fname)} ${esc(staff.lname)}</b>,
            </p>
            <p style="font-size: 14px; color: #333; line-height: 1.7; margin: 0 0 16px 0;">
              You have been assigned as <b>technical staff</b> for the following facility event.
              Kindly review your duty details below and make necessary preparations.
              ${hasOT ? `<br/><br/><span style="display: inline-block; padding: 4px 10px; background: #d4edda; color: #155724; border-radius: 4px; font-size: 12px; font-weight: 700;">⏰ Your duty includes Overtime (OT)</span>` : ''}
            </p>

            <!-- Event summary -->
            <table cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-collapse: collapse; background: #f8f9fa; border-radius: 6px; margin: 16px 0;">
              <tr>
                <td style="padding: 10px 12px; border-bottom: 1px solid #e9ecef;">
                  <div style="color: #666; font-size: 11px; font-weight: 600; letter-spacing: 0.4px; text-transform: uppercase;">Event Title</div>
                  <div style="font-size: 13px; color: #1a3a5c; margin-top: 2px;">${esc(reservation.eventName || '—')}</div>
                </td>
                <td style="padding: 10px 12px; border-bottom: 1px solid #e9ecef;">
                  <div style="color: #666; font-size: 11px; font-weight: 600; letter-spacing: 0.4px; text-transform: uppercase;">Requested by</div>
                  <div style="font-size: 13px; color: #1a3a5c; margin-top: 2px;">${esc(reservation.requestorDept || '—')}</div>
                </td>
              </tr>
              <tr>
                <td style="padding: 10px 12px;" colspan="2">
                  <div style="color: #666; font-size: 11px; font-weight: 600; letter-spacing: 0.4px; text-transform: uppercase;">Venue/s</div>
                  <div style="font-size: 13px; color: #1a3a5c; margin-top: 2px;">${esc(venuesStr)}</div>
                </td>
              </tr>
            </table>

            <!-- Event Dates -->
            <div style="margin-top: 20px;">
              <div style="font-weight: 700; font-size: 14px; color: ${accentColor}; border-bottom: 1px solid #e9ecef; padding-bottom: 6px; margin-bottom: 10px;">Event Dates</div>
              ${datesBlock || '<div style="color: #999; font-size: 12px; font-style: italic;">No dates specified</div>'}
            </div>

            <!-- Your Duty Line-up -->
            <div style="margin-top: 24px;">
              <div style="font-weight: 700; font-size: 14px; color: ${accentColor}; border-bottom: 1px solid #e9ecef; padding-bottom: 6px; margin-bottom: 10px;">🎯 Your Duty Line-up</div>
              <table cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="border-bottom: 2px solid ${accentColor};">
                    <th style="padding: 6px 10px; text-align: left; font-size: 11px; color: ${accentColor}; text-transform: uppercase; letter-spacing: 0.4px;">Date</th>
                    <th style="padding: 6px 10px; text-align: left; font-size: 11px; color: ${accentColor}; text-transform: uppercase; letter-spacing: 0.4px;">Duty</th>
                    <th style="padding: 6px 10px; text-align: left; font-size: 11px; color: ${accentColor}; text-transform: uppercase; letter-spacing: 0.4px;">Time</th>
                    <th style="padding: 6px 10px; text-align: center; font-size: 11px; color: ${accentColor}; text-transform: uppercase; letter-spacing: 0.4px;">OT</th>
                    <th style="padding: 6px 10px; text-align: left; font-size: 11px; color: ${accentColor}; text-transform: uppercase; letter-spacing: 0.4px;">Notes</th>
                  </tr>
                </thead>
                <tbody>${dutyRows}</tbody>
              </table>
            </div>

            <!-- CTA -->
            <div style="text-align: center; margin-top: 28px;">
              <a href="${actionUrl}" style="display: inline-block; padding: 12px 28px; background-color: #1a3a5c; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
                View Full Details on NCST D-Forms
              </a>
            </div>
            <p style="text-align: center; font-size: 11px; color: #999; margin: 14px 0 0 0;">
              Or print this email to keep a physical copy of your duty slip.
            </p>
          </div>

          <!-- Footer -->
          <div style="padding: 20px 40px; border-top: 1px solid #e9ecef; background: #fafafa; text-align: center; font-size: 12px; color: #999;">
            <p style="margin: 0;">
              This is a system-generated notification from
              <a href="${process.env.NEXT_PUBLIC_APP_URL}" style="color: #1a3a5c; text-decoration: none; font-weight: 600;">NCST D-Forms</a>.
            </p>
            <p style="margin: 6px 0 0 0; font-size: 11px; color: #bbb;">
              Printed on ${esc(
  new Date().toLocaleString('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
)}
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await sendEmailWithRetry({ to: staff.email, subject, html });
    } catch (err) {
      console.error(`Failed to send assignment email to ${staff.email}:`, err);
    }
  }
}

export async function getDepartmentHeads(deptCode) {
  const now = new Date();
  const heads = await prisma.user.findMany({
    where: {
      departmentCode: deptCode,
      OR: [
        { role: 'DepartmentHead' },
        {
          oic_start: { lte: now.toISOString() },
          oic_end: { gte: now.toISOString() },
        },
      ],
    },
    select: { email: true, fname: true, lname: true },
  });
  return heads;
}

/**
 * Get active Department Heads and OIC (return only IDs) for notifications
 */
export async function getDepartmentHeadsIds(deptCode) {
  const now = new Date();
  const users = await prisma.user.findMany({
    where: {
      departmentCode: deptCode,
      OR: [
        { role: 'DepartmentHead' },
        {
          oic_start: { lte: now.toISOString() },
          oic_end: { gte: now.toISOString() },
        },
      ],
    },
    select: { id: true },
  });
  return users;
}

/**
 * Get all Admin and SuperUser users (for security alerts)
 */
async function getAdminAndSuperUsers() {
  const users = await prisma.user.findMany({
    where: {
      role: { in: ['Admin', 'SuperUser'] },
    },
    select: { email: true, fname: true, lname: true },
  });
  return users;
}

// ============================================
// Memo Notification Helpers
// ============================================

export async function sendMemoSubmittedForApproval(staff, memo) {
  const deptHeads = await getDepartmentHeads(memo.senderDept);
  if (deptHeads.length === 0) return;

  const subject = `📝 New Draft Memo for Approval – ${memo.referenceId}`;
  const html = `
    <h2>Draft Memo Pending Your Approval</h2>
    <p><strong>From:</strong> ${staff.fname} ${staff.lname} (${memo.senderDept})</p>
    <p><strong>Subject:</strong> ${memo.subject}</p>
    <p><strong>Reference:</strong> ${memo.referenceId}</p>
    <p>Please review and approve this memo via the D-Forms dashboard.</p>
    <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/forms/iom?tab=approval">Click here to review</a></p>
  `;

  for (const head of deptHeads) {
    await sendEmailWithRetry({ to: head.email, subject, html });
  }
}

export async function sendMemoApproved(sender, memo) {
  const subject = `✅ Memo Approved – ${memo.referenceId}`;
  const html = `
    <h2>Your Memo Has Been Approved</h2>
    <p><strong>Subject:</strong> ${memo.subject}</p>
    <p><strong>Reference:</strong> ${memo.referenceId}</p>
    <p>Your memo has been approved and sent to all recipients.</p>
    <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/forms/iom?tab=outbound">View Memo</a></p>
  `;
  await sendEmailWithRetry({ to: sender.email, subject, html });
}

export async function sendMemoInbound(recipientHeads, memo) {
  const subject = `📨 Inbound Memo – ${memo.referenceId}`;
  const html = `
    <h2>New Inbound Memo</h2>
    <p><strong>From:</strong> ${memo.senderName} (${memo.senderDept})</p>
    <p><strong>Subject:</strong> ${memo.subject}</p>
    <p><strong>Reference:</strong> ${memo.referenceId}</p>
    <p>Please acknowledge this memo.</p>
    <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/forms/iom?tab=inbound">View Inbound</a></p>
  `;
  for (const head of recipientHeads) {
    await sendEmailWithRetry({ to: head.email, subject, html });
  }
}

export async function sendMemoAcknowledged(sender, memo, departmentName, acknowledgedBy) {
  const subject = `✅ Memo Acknowledged – ${memo.referenceId}`;
  const html = `
    <h2>Memo Acknowledged</h2>
    <p><strong>Department:</strong> ${departmentName}</p>
    <p><strong>Acknowledged by:</strong> ${acknowledgedBy}</p>
    <p><strong>Subject:</strong> ${memo.subject}</p>
    <p><strong>Reference:</strong> ${memo.referenceId}</p>
  `;
  await sendEmailWithRetry({ to: sender.email, subject, html });
}

export async function sendMemoProcessingStarted(sender, memo, processor) {
  const subject = `⚙️ Memo Processing Started – ${memo.referenceId}`;
  const html = `
    <h2>Memo Processing Started</h2>
    <p><strong>Processor:</strong> ${processor.fname} ${processor.lname} (${processor.departmentCode})</p>
    <p><strong>Subject:</strong> ${memo.subject}</p>
    <p><strong>Reference:</strong> ${memo.referenceId}</p>
  `;
  await sendEmailWithRetry({ to: sender.email, subject, html });
}

export async function sendMemoAssigned(assignedStaff, memo) {
  const subject = `📌 Memo Assigned to You – ${memo.referenceId}`;
  const html = `
    <h2>Memo Assigned to You</h2>
    <p><strong>Subject:</strong> ${memo.subject}</p>
    <p><strong>Reference:</strong> ${memo.referenceId}</p>
    <p>You have been assigned to process this memo.</p>
    <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/forms/iom?tab=assigned_to_me">View Assigned Memos</a></p>
  `;
  await sendEmailWithRetry({ to: assignedStaff.email, subject, html });
}

export async function sendMemoClosed(sender, memo, closerName, departmentName) {
  const subject = `🔒 Memo Closed – ${memo.referenceId}`;
  const html = `
    <h2>Memo Closed</h2>
    <p><strong>Closed by:</strong> ${closerName} (${departmentName})</p>
    <p><strong>Subject:</strong> ${memo.subject}</p>
    <p><strong>Reference:</strong> ${memo.referenceId}</p>
  `;
  await sendEmailWithRetry({ to: sender.email, subject, html });
}

export async function sendReplyNotification(originalSender, replyMemo) {
  const subject = `💬 Reply to Your Memo – ${replyMemo.referenceId}`;
  const html = `
    <h2>Reply Received</h2>
    <p><strong>From:</strong> ${replyMemo.senderName} (${replyMemo.senderDept})</p>
    <p><strong>Subject:</strong> ${replyMemo.subject}</p>
    <p><strong>Reference:</strong> ${replyMemo.referenceId}</p>
    <p>You have received a reply to your memo.</p>
    <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/forms/iom?tab=outbound">View Reply</a></p>
  `;
  await sendEmailWithRetry({ to: originalSender.email, subject, html });
}

// ============================================
// Memo Denied / Completed Notifications
// ============================================

export async function sendMemoDenied(sender, memo, departmentName, deniedBy, reason) {
  const subject = `🚫 Memo Denied – ${memo.referenceId}`;
  const html = `
    <h2>Memo Denied</h2>
    <p><strong>Denied by:</strong> ${deniedBy} (${departmentName})</p>
    <p><strong>Reason:</strong> ${reason || 'No reason provided.'}</p>
    <p><strong>Subject:</strong> ${memo.subject}</p>
    <p><strong>Reference:</strong> ${memo.referenceId}</p>
    <p>Please review the denial and take necessary action.</p>
    <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/forms/iom?tab=outbound">View Memo</a></p>
  `;
  await sendEmailWithRetry({ to: sender.email, subject, html });
}

export async function sendMemoCompleted(sender, memo, departmentName, completedBy, feedbackNote) {
  const subject = `✅ Memo Completed – ${memo.referenceId}`;
  const html = `
    <h2>Memo Completed</h2>
    <p><strong>Completed by:</strong> ${completedBy} (${departmentName})</p>
    <p><strong>Subject:</strong> ${memo.subject}</p>
    <p><strong>Reference:</strong> ${memo.referenceId}</p>
    <p><strong>Remarks:</strong> ${feedbackNote}</p>
    <p>The memo has been marked as completed by the recipient department.</p>
    <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/forms/iom?tab=outbound">View Memo</a></p>
  `;
  await sendEmailWithRetry({ to: sender.email, subject, html });
}

// ============================================
// Security Alert: Failed Login Attempts
// ============================================

export async function sendFailedLoginAlert(user, attempts, ip) {
  const admins = await getAdminAndSuperUsers();
  if (admins.length === 0) return;

  const deptHeads = await getDepartmentHeads(user.departmentCode);
  const recipients = [...admins, ...deptHeads];

  const subject = `🚨 Security Alert: Multiple Failed Login Attempts – ${user.email}`;
  const html = `
    <h2>Multiple Failed Login Attempts Detected</h2>
    <p><strong>User:</strong> ${user.fname} ${user.lname} (${user.email})</p>
    <p><strong>Department:</strong> ${user.departmentCode}</p>
    <p><strong>Failed Attempts (last 10 min):</strong> ${attempts}</p>
    <p><strong>IP Address:</strong> ${ip}</p>
    <p>Please investigate if this is a legitimate user or a brute-force attack.</p>
  `;

  for (const admin of recipients) {
    await sendEmailWithRetry({ to: admin.email, subject, html });
  }
}

// ============================================
// FRF Notification Helpers
// ============================================

export async function sendFRFApprovalNotification(requestor, reservation, approvedBy) {
  const subject = `FRF Approved – ${reservation.referenceId}`;
  const html = `
    <h2>Facility Reservation Approved</h2>
    <p><strong>Reference:</strong> ${reservation.referenceId}</p>
    <p><strong>Type:</strong> ${reservation.type}</p>
    <p><strong>Date(s):</strong> ${reservation.dates.map(d => new Date(d.date).toLocaleDateString()).join(', ')}</p>
    <p><strong>Approved by:</strong> ${approvedBy}</p>
    <p>Your facility reservation has been fully approved. The facility is now reserved for your event.</p>
    <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/forms/frf">View Reservation</a></p>
  `;
  await sendEmailWithRetry({ to: requestor.email, subject, html });
}

export async function sendFRFApprovalToRequestor(requestor, reservation) {
  const esc = (s) =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  const subject = `✅ FRF Fully Approved – ${reservation.referenceId}`;

  const actionUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/forms/frf`;
  const detailsHtml = renderFRFDetailsHTML(reservation, {
    showApprovals: true,       // complete na lahat
    showAssignments: true,     // ITO staff lineup na
    showPackUp: !!reservation.packUpDoneAt,
    accentColor: '#16a34a',    // green for approved
  });

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>FRF Approved</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f5f7fa; font-family: 'Inter', Arial, Helvetica, sans-serif;">
      <div style="max-width: 760px; margin: 24px auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); overflow: hidden;">

        <!-- Header -->
        <div style="padding: 28px 40px 20px 40px; border-bottom: 3px solid #22c55e;">
          <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
            <tr>
              <td style="vertical-align: top;">
                <div style="font-size: 20px; font-weight: 700; color: #16a34a; letter-spacing: 0.3px;">✅ Facility Reservation Approved</div>
                <div style="color: #666; font-size: 13px; margin-top: 4px;">
                  ${esc(reservation.referenceId)} &nbsp;·&nbsp; ${esc(
                    new Date().toLocaleString('en-US', {
                      timeZone: 'Asia/Manila',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true,
                    })
                  )}
                </div>
              </td>
            </tr>
          </table>
        </div>

        <!-- Body -->
        <div style="padding: 24px 40px 32px 40px;">
          <p style="font-size: 14px; color: #333; line-height: 1.6; margin: 0 0 12px 0;">
            Dear ${esc(requestor.fname)} ${esc(requestor.lname)},
          </p>
          <p style="font-size: 14px; color: #333; line-height: 1.6; margin: 0 0 16px 0;">
            Your facility reservation request has been <b style="color: #16a34a;">fully approved</b>.
            The facility is now reserved for your event.
          </p>

          ${detailsHtml}

          <!-- CTA -->
          <div style="text-align: center; margin-top: 28px;">
            <a href="${actionUrl}" style="display: inline-block; padding: 12px 28px; background-color: #1a3a5c; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
              View Reservation on NCST D-Forms
            </a>
          </div>
          <p style="text-align: center; font-size: 11px; color: #999; margin: 14px 0 0 0;">
            Or print this email to keep a physical copy of the FRF.
          </p>
        </div>

        <!-- Footer -->
        <div style="padding: 20px 40px; border-top: 1px solid #e9ecef; background: #fafafa; text-align: center; font-size: 12px; color: #999;">
          <p style="margin: 0;">
            This is a system-generated notification from
            <a href="${process.env.NEXT_PUBLIC_APP_URL}" style="color: #1a3a5c; text-decoration: none; font-weight: 600;">NCST D-Forms</a>.
          </p>
          <p style="margin: 6px 0 0 0; font-size: 11px; color: #bbb;">
            Printed on ${esc(
  new Date().toLocaleString('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
)}
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmailWithRetry({ to: requestor.email, subject, html });
}

export async function sendFRFApprovalToNextDepartments(nextDeptHeads, reservation, previousDept) {
  const subject = `📨 FRF Pending Approval – ${reservation.referenceId}`;

  const actionUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/forms/frf`;
  const detailsHtml = renderFRFDetailsHTML(reservation, {
    showApprovals: false,      // hindi pa kumpleto — nasa process pa
    showAssignments: false,    // ITO pa lang ang nag-aassign
    showPackUp: false,
    accentColor: '#d97706',    // amber for "pending" state
  });

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>FRF Pending Approval</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f5f7fa; font-family: 'Inter', Arial, Helvetica, sans-serif;">
      <div style="max-width: 760px; margin: 24px auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); overflow: hidden;">

        <!-- Header -->
        <div style="padding: 28px 40px 20px 40px; border-bottom: 3px solid #f59e0b;">
          <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
            <tr>
              <td style="vertical-align: top;">
                <div style="font-size: 20px; font-weight: 700; color: #d97706; letter-spacing: 0.3px;">📨 FRF Pending Approval</div>
                <div style="color: #666; font-size: 13px; margin-top: 4px;">
                  ${esc(reservation.referenceId)} &nbsp;·&nbsp; ${esc(
  new Date().toLocaleString('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
)}
                </div>
              </td>
            </tr>
          </table>
        </div>

        <!-- Body -->
        <div style="padding: 24px 40px 32px 40px;">
          <p style="font-size: 14px; color: #333; line-height: 1.6; margin: 0 0 12px 0;">
            Dear Department Head,
          </p>
          <p style="font-size: 14px; color: #333; line-height: 1.6; margin: 0 0 16px 0;">
            A facility reservation request is pending your <b>signature / approval</b>.
            Previous approver: <b>${esc(previousDept)}</b>.
          </p>

          ${detailsHtml}

          <!-- CTA -->
          <div style="text-align: center; margin-top: 28px;">
            <a href="${actionUrl}" style="display: inline-block; padding: 12px 28px; background-color: #1a3a5c; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
              Review &amp; Approve on NCST D-Forms
            </a>
          </div>
          <p style="text-align: center; font-size: 11px; color: #999; margin: 14px 0 0 0;">
            Or print this email to keep a physical copy of the FRF.
          </p>
        </div>

        <!-- Footer -->
        <div style="padding: 20px 40px; border-top: 1px solid #e9ecef; background: #fafafa; text-align: center; font-size: 12px; color: #999;">
          <p style="margin: 0;">
            This is a system-generated notification from
            <a href="${process.env.NEXT_PUBLIC_APP_URL}" style="color: #1a3a5c; text-decoration: none; font-weight: 600;">NCST D-Forms</a>.
          </p>
          <p style="margin: 6px 0 0 0; font-size: 11px; color: #bbb;">
            Printed on ${esc(
  new Date().toLocaleString('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
)}
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  for (const head of nextDeptHeads) {
    await sendEmailWithRetry({ to: head.email, subject, html });
  }
}

export async function sendFRFAssignmentNotification(itoHead, reservation, assignments) {
  const subject = `📌 ITO Staff Assigned – ${reservation.referenceId}`;
  const html = `
    <h2>ITO Staff Assigned</h2>
    <p><strong>Reference:</strong> ${reservation.referenceId}</p>
    <p><strong>Assigned Staff:</strong></p>
    <ul>
      ${assignments.map(a => `<li>${a.staffName} – ${new Date(a.dutyStart).toLocaleString()} to ${new Date(a.dutyEnd).toLocaleString()}</li>`).join('')}
    </ul>
    <p>These staff are assigned for the event.</p>
  `;
  await sendEmailWithRetry({ to: itoHead.email, subject, html });
}

// lib/email_notification.js

export async function sendFRFHRDNotification(hrdHeads, reservation, assignments) {
  // Group assignments by date for better organization
  const groupedByDate = assignments.reduce((acc, a) => {
    if (!hrdHeads || hrdHeads.length === 0) {
      console.warn('No HRD heads found, skipping email notification.');
      return;
    }
    const dateKey = new Date(a.dutyStart).toDateString();
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(a);
    return acc;
  }, {});

  // Get all unique event dates
  const eventDates = reservation.dates.map(d => new Date(d.eventStart));

  // Build the staff list HTML
  let staffListHtml = '';
  for (const [dateKey, dateAssignments] of Object.entries(groupedByDate)) {
    const displayDate = new Date(dateKey).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Get the event for this date
    const eventDate = reservation.dates.find(d => 
      new Date(d.eventStart).toDateString() === dateKey
    );
    const eventLocation = reservation.place?.name || reservation.placeOther || 'TBA';
    const eventTime = eventDate ? 
      `${new Date(eventDate.eventStart).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} – ${new Date(eventDate.eventEnd).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}` :
      'TBA';

    // Separate setup and teardown assignments
    const setupStaff = dateAssignments.filter(a => a.dutyType === 'SETUP');
    const teardownStaff = dateAssignments.filter(a => a.dutyType === 'TEARDOWN');

    // Build duty description
    let dutyDesc = '';
    if (setupStaff.length > 0) {
      const setupNames = setupStaff.map(s => s.staffName).join(', ');
      const setupTime = new Date(setupStaff[0].dutyStart).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      dutyDesc += `
        <div style="margin: 8px 0;">
          <strong>Setup:</strong> ${setupNames}<br/>
          <span style="color: #666; font-size: 13px;">Duty: ${setupTime} – ${new Date(setupStaff[0].dutyEnd).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</span>
        </div>
      `;
    }

    if (teardownStaff.length > 0) {
      const teardownNames = teardownStaff.map(s => s.staffName).join(', ');
      const teardownTime = new Date(teardownStaff[0].dutyStart).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      dutyDesc += `
        <div style="margin: 8px 0;">
          <strong>Pack-up / Teardown:</strong> ${teardownNames}<br/>
          <span style="color: #666; font-size: 13px;">Duty: ${teardownTime} – ${new Date(teardownStaff[0].dutyEnd).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</span>
        </div>
      `;
    }

    staffListHtml += `
      <div style="margin: 16px 0; padding: 12px; background-color: #f8f9fa; border-left: 4px solid #1a3a5c; border-radius: 4px;">
        <div style="font-weight: 600; color: #1a3a5c; font-size: 14px;">
          ${displayDate} – ${eventLocation}
          <span style="font-weight: 400; color: #666; font-size: 13px; display: block;">
            Event: ${eventTime}
          </span>
        </div>
        ${dutyDesc}
      </div>
    `;
  }

  const subject = `📋 FRF – Overtime Staff for Noting – ${reservation.referenceId}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
        body {
          font-family: 'Inter', Arial, sans-serif;
          margin: 0;
          padding: 0;
          background-color: #f5f7fa;
        }
        .container {
          max-width: 800px;
          margin: 20px auto;
          background-color: #ffffff;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
          padding: 40px;
        }
        .header {
          border-bottom: 3px solid #1a3a5c;
          padding-bottom: 20px;
          margin-bottom: 24px;
        }
        .header h1 {
          font-size: 22px;
          font-weight: 700;
          color: #1a3a5c;
          margin: 0;
        }
        .header .subtitle {
          color: #666;
          font-size: 14px;
          margin-top: 4px;
        }
        .greeting {
          font-size: 16px;
          margin-bottom: 16px;
          padding: 16px;
          background-color: #f8f9fa;
          border-radius: 6px;
        }
        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px 16px;
          margin: 16px 0 20px 0;
          padding: 16px;
          background-color: #f8f9fa;
          border-radius: 6px;
        }
        .info-grid .label {
          color: #666;
          font-size: 13px;
          font-weight: 600;
        }
        .info-grid .value {
          font-size: 14px;
          font-weight: 500;
          color: #1a3a5c;
        }
        .staff-section {
          margin-top: 20px;
        }
        .staff-section h2 {
          font-size: 16px;
          font-weight: 600;
          color: #1a3a5c;
          margin-bottom: 12px;
        }
        .footer {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #e0e0e0;
          font-size: 13px;
          color: #999;
          text-align: center;
        }
        .footer a {
          color: #1a3a5c;
          text-decoration: none;
        }
        .badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
          background-color: #e9ecef;
          color: #495057;
        }
        .badge-blue {
          background-color: #dbeafe;
          color: #1a3a5c;
        }
        .badge-orange {
          background-color: #fff3e0;
          color: #e65100;
        }
        @media print {
          .container {
            box-shadow: none;
            padding: 20px;
          }
          body {
            background-color: white;
          }
        }
        @media (max-width: 600px) {
          .container { padding: 20px; }
          .info-grid { grid-template-columns: 1fr; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <!-- HEADER -->
        <div class="header">
          <h1>Facility Reservation Form (FRF)</h1>
          <div class="subtitle">
            Overtime Staff for Noting &bull; ${reservation.referenceId}
          </div>
        </div>

        <!-- GREETING -->
        <div class="greeting">
          <strong>Dear HRD,</strong><br/><br/>
          This is to inform your good office that the following personnel will render overtime for the events listed below.
        </div>

        <!-- RESERVATION INFO -->
        <div class="info-grid">
          <div>
            <div class="label">Reference</div>
            <div class="value">${reservation.referenceId}</div>
          </div>
          <div>
            <div class="label">Type</div>
            <div class="value">${reservation.type.replace('_', ' ')}</div>
          </div>
          <div>
            <div class="label">Requestor</div>
            <div class="value">${reservation.requestor?.fname || ''} ${reservation.requestor?.lname || ''}</div>
          </div>
          <div>
            <div class="label">Department</div>
            <div class="value">${reservation.requestorDept || 'N/A'}</div>
          </div>
        </div>

        <!-- STAFF ASSIGNMENTS -->
        <div class="staff-section">
          <h2>🎯 Personnel with Overtime</h2>
          ${staffListHtml}
        </div>

        <!-- FOOTER -->
        <div class="footer">
          <p>
            This is a system-generated notification from <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/forms/frf">NCST D-Forms</a>.<br/>
            For details, please view the FRF on the dashboard.
          </p>
          <p style="font-size: 11px; color: #bbb;">
            Printed on ${new Date().toLocaleString()}
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  for (const head of hrdHeads) {
    await sendEmailWithRetry({ to: head.email, subject, html });
  }
}

// ============================================
// FRF HRD Noted Notification
// ============================================

export async function sendFRFHRDNotedNotification(itoHeads, staffUsers, reservation) {
  // Build list of assigned staff with their duty details
  const staffList = staffUsers.map(u => 
    `${u.fname} ${u.lname}`
  ).join(', ');

  const subject = `📋 FRF Noted by HRD – ${reservation.referenceId}`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; background: #f5f7fa; margin: 0; padding: 20px; }
        .container { max-width: 700px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
        .header { border-bottom: 3px solid #1a3a5c; padding-bottom: 15px; margin-bottom: 20px; }
        .header h1 { font-size: 22px; color: #1a3a5c; margin: 0; }
        .info { background: #f8f9fa; padding: 15px; border-radius: 6px; margin: 15px 0; }
        .info p { margin: 5px 0; }
        .footer { margin-top: 25px; padding-top: 15px; border-top: 1px solid #e0e0e0; font-size: 13px; color: #999; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✅ HRD Noted Your FRF</h1>
          <div style="color: #666; font-size: 14px;">${reservation.referenceId}</div>
        </div>
        <p><strong>Dear ITO Team,</strong></p>
        <p>Human Resource Department (HRD) has <strong>noted</strong> the overtime staff assignments for the following FRF:</p>
        <div class="info">
          <p><strong>Reference:</strong> ${reservation.referenceId}</p>
          <p><strong>Event Type:</strong> ${reservation.type.replace('_', ' ')}</p>
          <p><strong>Date(s):</strong> ${reservation.dates.map(d => new Date(d.eventStart).toLocaleDateString()).join(', ')}</p>
          <p><strong>Assigned Staff:</strong> ${staffList}</p>
        </div>
        <p>You may now proceed with the final arrangements.</p>
        <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/forms/frf" style="display: inline-block; background: #1a3a5c; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px;">View Reservation</a></p>
        <div class="footer">
          This is a system-generated notification from <a href="${process.env.NEXT_PUBLIC_APP_URL}">NCST D-Forms</a>.
        </div>
      </div>
    </body>
    </html>
  `;

  // Send to ITO department heads
  for (const head of itoHeads) {
    await sendEmailWithRetry({ to: head.email, subject, html });
  }

  // Send to each assigned staff
  for (const staff of staffUsers) {
    await sendEmailWithRetry({ to: staff.email, subject, html });
  }
}

// ============================================
// FRF Reschedule Notification
// ============================================

export async function sendFRFRescheduleNotification(deptHeads, reservation, currentDept) {
  const subject = `📅 FRF Reschedule Request – ${reservation.referenceId}`;

  const datesSummary = reservation.dates.map(d => 
    new Date(d.eventStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  ).join(', ');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
        body { font-family: 'Inter', Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f7fa; }
        .container { max-width: 700px; margin: 20px auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); padding: 40px; }
        .header { border-bottom: 3px solid #f59e0b; padding-bottom: 20px; margin-bottom: 24px; }
        .header h1 { font-size: 22px; font-weight: 700; color: #d97706; margin: 0; }
        .header .subtitle { color: #666; font-size: 14px; margin-top: 4px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; padding: 16px; background-color: #f8f9fa; border-radius: 6px; }
        .info-grid .label { color: #666; font-size: 13px; font-weight: 600; }
        .info-grid .value { font-size: 14px; font-weight: 500; color: #1a3a5c; }
        .btn { display: inline-block; padding: 12px 24px; background-color: #1a3a5c; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; margin-top: 16px; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; font-size: 13px; color: #999; text-align: center; }
        .badge-reschedule { background: #fef3c7; color: #92400e; padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📅 FRF Reschedule Request</h1>
          <div class="subtitle">
            ${reservation.referenceId} &bull; <span class="badge-reschedule">RESCHEDULE</span>
            &bull; ${new Date().toLocaleString()}
          </div>
        </div>

        <div style="font-size: 15px; line-height: 1.6;">
          <p>Dear Department Head,</p>
          <p>A <strong>reschedule request</strong> has been submitted for this facility reservation.</p>
          <p><strong>Reason:</strong> ${reservation.requestorNotes || 'No reason provided.'}</p>
          <p><strong>Current Department:</strong> ${currentDept}</p>
        </div>

        <div class="info-grid">
          <div><div class="label">Reference</div><div class="value">${reservation.referenceId}</div></div>
          <div><div class="label">Type</div><div class="value">${reservation.type?.replace('_', ' ') || 'N/A'}</div></div>
          <div><div class="label">Requestor</div><div class="value">${reservation.requestor?.fname || ''} ${reservation.requestor?.lname || ''}</div></div>
          <div><div class="label">Department</div><div class="value">${reservation.requestorDept || 'N/A'}</div></div>
          <div style="grid-column: span 2;">
            <div class="label">New Event Dates</div>
            <div class="value">${datesSummary}</div>
          </div>
          <div style="grid-column: span 2;">
            <div class="label">Equipment</div>
            <div class="value">${reservation.equipmentRequests?.length > 0 ? reservation.equipmentRequests.map(eq => `${eq.equipment?.name || 'Unknown'} x${eq.quantityRequested}`).join(', ') : 'None'}</div>
          </div>
        </div>

        <div style="text-align: center;">
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/forms/frf" class="btn">Review Reschedule</a>
        </div>

        <div class="footer">
          <p>This is a system-generated notification from <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/forms/frf">NCST D-Forms</a>.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  for (const head of deptHeads) {
    await sendEmailWithRetry({ to: head.email, subject, html });
  }
}