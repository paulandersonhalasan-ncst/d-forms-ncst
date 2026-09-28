import { sendEmailWithRetry } from './email_service';
import { prisma } from '../../prisma/prisma';

/**
 * Get active Department Heads (including OIC) for a given department code
 * OIC = user with oic_start and oic_end covering current date/time
 */

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

// ============================================
// 🆕 Brand Palette (matches Mantine theme)
// ============================================
const BRAND = {
  // Primary — regalNavy
  navy:          '#003980',   // regalNavy[9]  — headings, CTA
  navyMid:       '#377ff5',   // regalNavy[5]  — mid accent
  navyLight:     '#ebf4ff',   // regalNavy[0]  — subtle tint

  // Accent — customCreamYellow
  cream:         '#feb118',   // creamYellow[6] — attention/pending
  creamMid:      '#feb625',   // creamYellow[5]
  creamDark:     '#a86f00',   // darker cream for text on cream bg
  creamBg:       '#fff8e5',   // creamYellow[0] — info block bg
  creamBorder:   '#fedf9e',   // creamYellow[2] — borders

  // Neutrals
  seashell:      '#fff8f2',   // page background
  carbon:        '#242424',   // body text
  white:         '#ffffff',
  gray:          '#666666',
  grayLight:     '#999999',
  borderWarm:    '#f0e6d8',   // warm divider

  // Semantic (keep)
  success:       '#16a34a',
  successBg:     '#d4edda',
  successText:   '#155724',
  danger:        '#dc2626',
  dangerBg:      '#f8d7da',
  dangerText:    '#721c24',
  revision:      '#fff3cd',   // pending revision bg
  revisionText:  '#856404',
};

// ============================================
// 🎨 Shared email wrapper (para sa MEMO at iba pang simpleng notifications)
// ============================================
function renderEmailWrapper({
  title,
  icon = '',
  accentColor = BRAND.navy,
  subtitle = '',
  bodyContent = '',
  actionUrl = '',
  actionLabel = 'View on NCST D-Forms',
  footerNote = '',
}) {
  const nowStr = new Date().toLocaleString('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${esc(title)}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: ${BRAND.seashell}; font-family: 'Inter', Arial, Helvetica, sans-serif;">
      <div style="max-width: 760px; margin: 24px auto; background-color: ${BRAND.white}; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); overflow: hidden;">

        <!-- Header -->
        <div style="padding: 28px 40px 20px 40px; border-bottom: 3px solid ${accentColor};">
          <div style="font-size: 20px; font-weight: 700; color: ${accentColor}; letter-spacing: 0.3px;">
            ${icon ? icon + ' ' : ''}${esc(title)}
          </div>
          ${subtitle ? `<div style="color: ${BRAND.gray}; font-size: 13px; margin-top: 4px;">${subtitle}</div>` : ''}
        </div>

        <!-- Body -->
        <div style="padding: 24px 40px 32px 40px;">
          ${bodyContent}

          ${actionUrl ? `
            <div style="text-align: center; margin-top: 28px;">
              <a href="${actionUrl}" style="display: inline-block; padding: 12px 28px; background-color: ${BRAND.navy}; color: ${BRAND.white}; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
                ${esc(actionLabel)}
              </a>
            </div>
          ` : ''}

          ${footerNote ? `
            <p style="text-align: center; font-size: 11px; color: ${BRAND.grayLight}; margin: 14px 0 0 0;">
              ${esc(footerNote)}
            </p>
          ` : ''}
        </div>

        <!-- Footer -->
        <div style="padding: 20px 40px; border-top: 1px solid ${BRAND.borderWarm}; background: #fafafa; text-align: center; font-size: 12px; color: ${BRAND.grayLight};">
          <p style="margin: 0;">
            This is a system-generated notification from
            <a href="${baseUrl}" style="color: ${BRAND.navy}; text-decoration: none; font-weight: 600;">NCST D-Forms</a>.
          </p>
          <p style="margin: 6px 0 0 0; font-size: 11px; color: #bbb;">
            Printed on ${esc(nowStr)}
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function renderInfoGrid(items) {
  // items: [{ label, value, span?: 2 }]
  // value should be pre-escaped HTML string
  const rows = [];
  let i = 0;
  while (i < items.length) {
    if (items[i].span === 2) {
      rows.push(`
        <tr>
          <td colspan="2" style="padding: 10px 12px; border-bottom: 1px solid #e9ecef;">
            <div style="color: ${BRAND.gray}; font-size: 11px; font-weight: 600; letter-spacing: 0.4px; text-transform: uppercase;">${esc(items[i].label)}</div>
            <div style="font-size: 13px; color: ${BRAND.navy}; margin-top: 2px;">${items[i].value}</div>
          </td>
        </tr>`);
      i += 1;
      continue;
    }
    const left = items[i];
    const right = items[i + 1];
    rows.push(`
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e9ecef;">
          <div style="color: ${BRAND.gray}; font-size: 11px; font-weight: 600; letter-spacing: 0.4px; text-transform: uppercase;">${esc(left.label)}</div>
          <div style="font-size: 13px; color: ${BRAND.navy}; margin-top: 2px;">${left.value}</div>
        </td>
        ${right ? `
          <td style="padding: 10px 12px; border-bottom: 1px solid #e9ecef;">
            <div style="color: ${BRAND.gray}; font-size: 11px; font-weight: 600; letter-spacing: 0.4px; text-transform: uppercase;">${esc(right.label)}</div>
            <div style="font-size: 13px; color: ${BRAND.navy}; margin-top: 2px;">${right.value}</div>
          </td>
        ` : '<td style="padding: 10px 12px;"></td>'}
      </tr>`);
    i += right ? 2 : 1;
  }

  return `
    <table cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-collapse: collapse; background: #f8f9fa; border-radius: 6px; margin: 16px 0;">
      ${rows.join('')}
    </table>
  `;
}

function greetingBlock(name) {
  return `
    <p style="font-size: 14px; color: ${BRAND.carbon}; line-height: 1.6; margin: 0 0 12px 0;">
      Dear <b>${esc(name)}</b>,
    </p>`;
}

function bodyText(content) {
  // content should be pre-escaped HTML string
  return `<p style="font-size: 14px; color: ${BRAND.carbon}; line-height: 1.7; margin: 0 0 16px 0;">${content}</p>`;
}

function renderFRFDetailsHTML(reservation, options = {}) {
  const {
    showApprovals = false,
    showAssignments = false,
    showPackUp = false,
    accentColor = BRAND.navy,
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
  const actionUrl = `${baseUrl}/dashboard/forms/frf`;
  const accentColor = BRAND.navyMid; // teal

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
      console.log(`📧 [ASSIGN] Sending to ${staff.email}...`);
      const result = await sendEmailWithRetry({ to: staff.email, subject, html });
      if (result) {
        console.log(`✅ [ASSIGN] Sent to ${staff.email}`);
      } else {
        console.warn(`⚠️ [ASSIGN] Failed to send to ${staff.email} (sendEmailWithRetry returned false)`);
      }
    } catch (err) {
      console.error(`❌ [ASSIGN] Error sending to ${staff.email}:`, err);
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

// ============================================
// Memo Notification Helpers
// ============================================

export async function sendMemoSubmittedForApproval(staff, memo) {
  const deptHeads = await getDepartmentHeads(memo.senderDept);
  if (deptHeads.length === 0) return;

  const subject = `📝 New Draft Memo for Approval – ${memo.referenceId}`;

  const info = renderInfoGrid([
    { label: 'Reference', value: esc(memo.referenceId) },
    { label: 'From', value: `${esc(staff.fname)} ${esc(staff.lname)}` },
    { label: 'Department', value: esc(memo.senderDept) },
    { label: 'Priority', value: esc(memo.priority || 'ROUTINE') },
    { label: 'Subject', value: esc(memo.subject), span: 2 },
  ]);

  const html = renderEmailWrapper({
    title: 'Draft Memo Pending Your Approval',
    icon: '📝',
    accentColor: BRAND.cream,
    subtitle: `${esc(memo.referenceId)} &nbsp;·&nbsp; ${esc(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }))}`,
    bodyContent: `
      ${greetingBlock('Department Head')}
      ${bodyText(`A draft memo has been submitted and is pending your <b>signature / approval</b>.`)}
      ${info}
    `,
    actionUrl: `${baseUrl}/dashboard/forms/iom?tab=approval`,
    actionLabel: 'Review Memo on NCST D-Forms',
  });

  for (const head of deptHeads) {
    await sendEmailWithRetry({ to: head.email, subject, html });
  }
}

export async function sendMemoApproved(sender, memo) {
  const subject = `✅ Memo Approved – ${memo.referenceId}`;

  const info = renderInfoGrid([
    { label: 'Reference', value: esc(memo.referenceId) },
    { label: 'Priority', value: esc(memo.priority || 'ROUTINE') },
    { label: 'Subject', value: esc(memo.subject), span: 2 },
  ]);

  const html = renderEmailWrapper({
    title: 'Memo Approved',
    icon: '✅',
    accentColor: BRAND.success,
    subtitle: `${esc(memo.referenceId)} &nbsp;·&nbsp; ${esc(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }))}`,
    bodyContent: `
      ${greetingBlock(`${sender.fname} ${sender.lname}`)}
      ${bodyText(`Your memo has been <b style="color: ${BRAND.success};">approved</b> and sent to all recipients.`)}
      ${info}
    `,
    actionUrl: `${baseUrl}/dashboard/forms/iom?tab=outbound`,
    actionLabel: 'View Memo',
  });

  await sendEmailWithRetry({ to: sender.email, subject, html });
}

export async function sendMemoInbound(recipientHeads, memo) {
  const subject = `📨 Inbound Memo – ${memo.referenceId}`;

  const info = renderInfoGrid([
    { label: 'Reference', value: esc(memo.referenceId) },
    { label: 'Priority', value: esc(memo.priority || 'ROUTINE') },
    { label: 'From', value: esc(memo.senderName) },
    { label: 'Department', value: esc(memo.senderDept) },
    { label: 'Subject', value: esc(memo.subject), span: 2 },
  ]);

  const html = renderEmailWrapper({
    title: 'New Inbound Memo',
    icon: '📨',
    accentColor: BRAND.navy,
    subtitle: `${esc(memo.referenceId)} &nbsp;·&nbsp; ${esc(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }))}`,
    bodyContent: `
      ${greetingBlock('Department Head')}
      ${bodyText(`You have received a new inbound memo. Please <b>acknowledge</b> it in the system.`)}
      ${info}
    `,
    actionUrl: `${baseUrl}/dashboard/forms/iom?tab=inbound`,
    actionLabel: 'View Inbound Memo',
  });

  for (const head of recipientHeads) {
    await sendEmailWithRetry({ to: head.email, subject, html });
  }
}

export async function sendMemoAcknowledged(sender, memo, departmentName, acknowledgedBy) {
  const subject = `✅ Memo Acknowledged – ${memo.referenceId}`;

  const info = renderInfoGrid([
    { label: 'Reference', value: esc(memo.referenceId) },
    { label: 'Department', value: esc(departmentName) },
    { label: 'Acknowledged by', value: esc(acknowledgedBy) },
    { label: 'Subject', value: esc(memo.subject), span: 2 },
  ]);

  const html = renderEmailWrapper({
    title: 'Memo Acknowledged',
    icon: '✅',
    accentColor: BRAND.success,
    subtitle: `${esc(memo.referenceId)} &nbsp;·&nbsp; ${esc(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }))}`,
    bodyContent: `
      ${greetingBlock(`${sender.fname} ${sender.lname}`)}
      ${bodyText(`Your memo has been <b>acknowledged</b> by the recipient department.`)}
      ${info}
    `,
    actionUrl: `${baseUrl}/dashboard/forms/iom?tab=outbound`,
    actionLabel: 'View Memo',
  });

  await sendEmailWithRetry({ to: sender.email, subject, html });
}

export async function sendMemoProcessingStarted(sender, memo, processor) {
  const subject = `⚙️ Memo Processing Started – ${memo.referenceId}`;

  const info = renderInfoGrid([
    { label: 'Reference', value: esc(memo.referenceId) },
    { label: 'Processor', value: `${esc(processor.fname)} ${esc(processor.lname)}` },
    { label: 'Department', value: esc(processor.departmentCode) },
    { label: 'Subject', value: esc(memo.subject), span: 2 },
  ]);

  const html = renderEmailWrapper({
    title: 'Memo Processing Started',
    icon: '⚙️',
    accentColor: BRAND.navyMid,
    subtitle: `${esc(memo.referenceId)} &nbsp;·&nbsp; ${esc(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }))}`,
    bodyContent: `
      ${greetingBlock(`${sender.fname} ${sender.lname}`)}
      ${bodyText(`Your memo is now being <b>processed</b> by the recipient department.`)}
      ${info}
    `,
    actionUrl: `${baseUrl}/dashboard/forms/iom?tab=outbound`,
    actionLabel: 'View Memo',
  });

  await sendEmailWithRetry({ to: sender.email, subject, html });
}

export async function sendMemoAssigned(assignedStaff, memo) {
  const subject = `📌 Memo Assigned to You – ${memo.referenceId}`;

  const info = renderInfoGrid([
    { label: 'Reference', value: esc(memo.referenceId) },
    { label: 'Priority', value: esc(memo.priority || 'ROUTINE') },
    { label: 'Subject', value: esc(memo.subject), span: 2 },
  ]);

  const html = renderEmailWrapper({
    title: 'Memo Assigned to You',
    icon: '📌',
    accentColor: BRAND.navyMid,
    subtitle: `${esc(memo.referenceId)} &nbsp;·&nbsp; ${esc(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }))}`,
    bodyContent: `
      ${greetingBlock(`${assignedStaff.fname} ${assignedStaff.lname}`)}
      ${bodyText(`You have been <b>assigned</b> to process this memo. Please review and take the necessary action.`)}
      ${info}
    `,
    actionUrl: `${baseUrl}/dashboard/forms/iom?tab=assigned_to_me`,
    actionLabel: 'View Assigned Memos',
  });

  await sendEmailWithRetry({ to: assignedStaff.email, subject, html });
}

export async function sendMemoClosed(sender, memo, closerName, departmentName) {
  const subject = `🔒 Memo Closed – ${memo.referenceId}`;

  const info = renderInfoGrid([
    { label: 'Reference', value: esc(memo.referenceId) },
    { label: 'Closed by', value: esc(closerName) },
    { label: 'Department', value: esc(departmentName) },
    { label: 'Subject', value: esc(memo.subject), span: 2 },
  ]);

  const html = renderEmailWrapper({
    title: 'Memo Closed',
    icon: '🔒',
    accentColor: BRAND.gray,
    subtitle: `${esc(memo.referenceId)} &nbsp;·&nbsp; ${esc(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }))}`,
    bodyContent: `
      ${greetingBlock(`${sender.fname} ${sender.lname}`)}
      ${bodyText(`This memo has been <b>closed</b>. No further action is required.`)}
      ${info}
    `,
    actionUrl: `${baseUrl}/dashboard/forms/iom?tab=outbound`,
    actionLabel: 'View Memo',
  });

  await sendEmailWithRetry({ to: sender.email, subject, html });
}

export async function sendReplyNotification(originalSender, replyMemo) {
  const subject = `💬 Reply to Your Memo – ${replyMemo.referenceId}`;

  const info = renderInfoGrid([
    { label: 'Reference', value: esc(replyMemo.referenceId) },
    { label: 'From', value: esc(replyMemo.senderName) },
    { label: 'Department', value: esc(replyMemo.senderDept) },
    { label: 'Priority', value: esc(replyMemo.priority || 'ROUTINE') },
    { label: 'Subject', value: esc(replyMemo.subject), span: 2 },
  ]);

  const html = renderEmailWrapper({
    title: 'Reply Received',
    icon: '💬',
    accentColor: BRAND.navyMid,
    subtitle: `${esc(replyMemo.referenceId)} &nbsp;·&nbsp; ${esc(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }))}`,
    bodyContent: `
      ${greetingBlock(`${originalSender.fname} ${originalSender.lname}`)}
      ${bodyText(`You have received a <b>reply</b> to your memo.`)}
      ${info}
    `,
    actionUrl: `${baseUrl}/dashboard/forms/iom?tab=outbound`,
    actionLabel: 'View Reply',
  });

  await sendEmailWithRetry({ to: originalSender.email, subject, html });
}

export async function sendMemoDenied(sender, memo, departmentName, deniedBy, reason) {
  const subject = `🚫 Memo Denied – ${memo.referenceId}`;

  const reasonBlock = `
    <div style="margin: 16px 0; padding: 12px 16px; border-left: 3px solid ${BRAND.danger}; background: ${BRAND.dangerBg}; border-radius: 4px;">
      <div style="font-weight: 600; font-size: 12px; color: ${BRAND.dangerText}; margin-bottom: 4px;">REASON FOR DENIAL</div>
      <div style="font-size: 13px; color: #333; white-space: pre-wrap; line-height: 1.5;">${esc(reason || 'No reason provided.')}</div>
    </div>`;

  const info = renderInfoGrid([
    { label: 'Reference', value: esc(memo.referenceId) },
    { label: 'Denied by', value: esc(deniedBy) },
    { label: 'Department', value: esc(departmentName) },
    { label: 'Subject', value: esc(memo.subject), span: 2 },
  ]);

  const html = renderEmailWrapper({
    title: 'Memo Denied',
    icon: '🚫',
    accentColor: BRAND.danger,
    subtitle: `${esc(memo.referenceId)} &nbsp;·&nbsp; ${esc(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }))}`,
    bodyContent: `
      ${greetingBlock(`${sender.fname} ${sender.lname}`)}
      ${bodyText(`Unfortunately, your memo has been <b style="color: ${BRAND.danger};">denied</b>. Please review the reason and take the necessary action.`)}
      ${reasonBlock}
      ${info}
    `,
    actionUrl: `${baseUrl}/dashboard/forms/iom?tab=outbound`,
    actionLabel: 'View Memo',
  });

  await sendEmailWithRetry({ to: sender.email, subject, html });
}

export async function sendMemoCompleted(sender, memo, departmentName, completedBy, feedbackNote) {
  const subject = `✅ Memo Completed – ${memo.referenceId}`;

  const remarksBlock = feedbackNote ? `
    <div style="margin: 16px 0; padding: 12px 16px; border-left: 3px solid ${BRAND.success}; background: #f0f9f4; border-radius: 4px;">
      <div style="font-weight: 600; font-size: 12px; color: ${BRAND.successText}; margin-bottom: 4px;">REMARKS</div>
      <div style="font-size: 13px; color: #333; white-space: pre-wrap; line-height: 1.5;">${esc(feedbackNote)}</div>
    </div>` : '';

  const info = renderInfoGrid([
    { label: 'Reference', value: esc(memo.referenceId) },
    { label: 'Completed by', value: esc(completedBy) },
    { label: 'Department', value: esc(departmentName) },
    { label: 'Subject', value: esc(memo.subject), span: 2 },
  ]);

  const html = renderEmailWrapper({
    title: 'Memo Completed',
    icon: '✅',
    accentColor: BRAND.success,
    subtitle: `${esc(memo.referenceId)} &nbsp;·&nbsp; ${esc(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }))}`,
    bodyContent: `
      ${greetingBlock(`${sender.fname} ${sender.lname}`)}
      ${bodyText(`Your memo has been marked as <b style="color: ${BRAND.success};">completed</b> by the recipient department.`)}
      ${remarksBlock}
      ${info}
    `,
    actionUrl: `${baseUrl}/dashboard/forms/iom?tab=outbound`,
    actionLabel: 'View Memo',
  });

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

  const warningBlock = `
    <div style="margin: 16px 0; padding: 12px 16px; border-left: 3px solid ${BRAND.danger}; background: ${BRAND.dangerBg}; border-radius: 4px;">
      <div style="font-weight: 700; font-size: 13px; color: ${BRAND.dangerText};">⚠️ Suspicious Activity Detected</div>
      <div style="font-size: 12px; color: #333; margin-top: 4px; line-height: 1.5;">
        Please investigate immediately. This could be a brute-force attack or a compromised account.
      </div>
    </div>`;

  const info = renderInfoGrid([
    { label: 'User', value: `${esc(user.fname)} ${esc(user.lname)}` },
    { label: 'Email', value: esc(user.email) },
    { label: 'Department', value: esc(user.departmentCode) },
    { label: 'Failed Attempts (last 10 min)', value: `<b>${esc(attempts)}</b>` },
    { label: 'IP Address', value: `<code style="background: #e9ecef; padding: 1px 6px; border-radius: 3px; font-size: 12px;">${esc(ip)}</code>`, span: 2 },
  ]);

  const html = renderEmailWrapper({
    title: 'Security Alert — Failed Login Attempts',
    icon: '🚨',
    accentColor: BRAND.danger,
    subtitle: esc(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' })),
    bodyContent: `
      ${greetingBlock('Administrator / Department Head')}
      ${bodyText(`Multiple failed login attempts have been detected for the following account.`)}
      ${warningBlock}
      ${info}
    `,
    actionUrl: `${baseUrl}/dashboard/activity_logs`,
    actionLabel: 'View Activity Logs',
  });

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

  const subject = `✅ FRF Fully Approved – ${reservation.referenceId}`;

  const actionUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/forms/frf`;
  const detailsHtml = renderFRFDetailsHTML(reservation, {
    showApprovals: true,       // complete na lahat
    showAssignments: true,     // ITO staff lineup na
    showPackUp: !!reservation.packUpDoneAt,
    accentColor: BRAND.navy,    // green for approved
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
    accentColor: BRAND.cream,    // amber for "pending" state
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
        body { font-family: 'Inter', Arial, sans-serif; margin: 0; padding: 0; background-color: ${BRAND.seashell}; }
        .container { max-width: 700px; margin: 20px auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); padding: 40px; }
        .header { border-bottom: 3px solid ${BRAND.cream}; padding-bottom: 20px; margin-bottom: 24px; }
        .header h1 { font-size: 22px; font-weight: 700; color: ${BRAND.creamDark}; margin: 0; }
        .header .subtitle { color: ${BRAND.gray}; font-size: 14px; margin-top: 4px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; padding: 16px; background-color: ${BRAND.creamBg}; border-radius: 6px; }
        .info-grid .label { color: ${BRAND.gray}; font-size: 13px; font-weight: 600; }
        .info-grid .value { font-size: 14px; font-weight: 500; color: ${BRAND.navy}; }
        .btn { display: inline-block; padding: 12px 24px; background-color: ${BRAND.navy}; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; margin-top: 16px; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid ${BRAND.borderWarm}; font-size: 13px; color: ${BRAND.grayLight}; text-align: center; }
        .badge-reschedule { background: ${BRAND.creamMid}; color: ${BRAND.creamDark}; padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; }
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