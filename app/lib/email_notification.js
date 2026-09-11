import { sendEmailWithRetry } from './email_service';
import { prisma } from '../../prisma/prisma';

/**
 * Get active Department Heads (including OIC) for a given department code
 * OIC = user with oic_start and oic_end covering current date/time
 */
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
  const subject = `FRF Approved – ${reservation.referenceId}`;

  // ----- Safe dates list -----
  const datesList = reservation.dates?.length > 0
    ? reservation.dates.map((d) => {
        const dateStr = new Date(d.eventStart).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        const timeStr = `${new Date(d.eventStart).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} – ${new Date(d.eventEnd).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
        const placeStr = d.place?.name || d.placeOther || 'TBA';
        return `<div style="margin: 4px 0;">${dateStr} &bull; ${timeStr} &bull; ${placeStr}</div>`;
      }).join('')
    : 'N/A';

  // ----- Safe equipment list -----
  const equipmentList = reservation.equipmentRequests?.length > 0
    ? reservation.equipmentRequests.map(eq => {
        const name = eq.equipment?.name || eq.equipmentId || 'Unknown';
        return `${name} x${eq.quantityRequested}`;
      }).join(', ')
    : 'None';

  // ----- Safe location -----
  const firstDate = reservation.dates?.[0];
  const location = firstDate?.place?.name || firstDate?.placeOther || 'TBA';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
        body { font-family: 'Inter', Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f7fa; }
        .container { max-width: 700px; margin: 20px auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); padding: 40px; }
        .header { border-bottom: 3px solid #22c55e; padding-bottom: 20px; margin-bottom: 24px; }
        .header h1 { font-size: 22px; font-weight: 700; color: #16a34a; margin: 0; }
        .header .subtitle { color: #666; font-size: 14px; margin-top: 4px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; padding: 16px; background-color: #f8f9fa; border-radius: 6px; }
        .info-grid .label { color: #666; font-size: 13px; font-weight: 600; }
        .info-grid .value { font-size: 14px; font-weight: 500; color: #1a3a5c; }
        .btn { display: inline-block; padding: 12px 24px; background-color: #1a3a5c; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; margin-top: 16px; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; font-size: 13px; color: #999; text-align: center; }
        @media print { .container { box-shadow: none; padding: 20px; } body { background-color: white; } }
        @media (max-width: 600px) { .container { padding: 20px; } .info-grid { grid-template-columns: 1fr; } }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✅ Facility Reservation Approved</h1>
          <div class="subtitle">${reservation.referenceId} &bull; ${new Date().toLocaleString()}</div>
        </div>

        <div style="font-size: 15px; line-height: 1.6;">
          <p>Dear ${requestor.fname} ${requestor.lname},</p>
          <p>Your facility reservation request has been <strong style="color: #16a34a;">fully approved</strong>.</p>
          <p>The facility is now reserved for your event.</p>
        </div>

        <div class="info-grid">
          <div><div class="label">Reference</div><div class="value">${reservation.referenceId}</div></div>
          <div><div class="label">Type</div><div class="value">${reservation.type?.replace('_', ' ') || 'N/A'}</div></div>
          <div><div class="label">Attendees</div><div class="value">${reservation.attendeesCount}</div></div>
          <div><div class="label">Location</div><div class="value">${location}</div></div>
          <div style="grid-column: span 2;">
            <div class="label">Event Dates</div>
            <div class="value">${datesList}</div>
          </div>
          <div style="grid-column: span 2;">
            <div class="label">Equipment Requested</div>
            <div class="value">${equipmentList}</div>
          </div>
        </div>

        <div style="text-align: center;">
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/forms/frf" class="btn">View Reservation</a>
        </div>

        <div class="footer">
          <p>This is a system-generated notification from <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/forms/frf">NCST D-Forms</a>.</p>
          <p style="font-size: 11px; color: #bbb;">Printed on ${new Date().toLocaleString()}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmailWithRetry({ to: requestor.email, subject, html });
}

export async function sendFRFApprovalToNextDepartments(nextDeptHeads, reservation, previousDept) {
  const subject = `📨 FRF Pending Approval – ${reservation.referenceId}`;

  // ----- Safe date summary -----
  const datesSummary = reservation.dates?.length > 0
    ? reservation.dates.map(d =>
        new Date(d.eventStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      ).join(', ')
    : 'N/A';

  // ----- Safe location (from first date) -----
  const firstDate = reservation.dates?.[0];
  const location = firstDate?.place?.name || firstDate?.placeOther || 'TBA';

  // ----- Safe equipment list (eq.equipment might be undefined) -----
  const equipmentList = reservation.equipmentRequests?.length > 0
    ? reservation.equipmentRequests.map(eq => {
        const name = eq.equipment?.name || eq.equipmentId || 'Unknown';
        return `${name} x${eq.quantityRequested}`;
      }).join(', ')
    : 'None';

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
        @media print { .container { box-shadow: none; padding: 20px; } body { background-color: white; } }
        @media (max-width: 600px) { .container { padding: 20px; } .info-grid { grid-template-columns: 1fr; } }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📨 FRF Pending Approval</h1>
          <div class="subtitle">${reservation.referenceId} &bull; ${new Date().toLocaleString()}</div>
        </div>

        <div style="font-size: 15px; line-height: 1.6;">
          <p>Dear Department Head,</p>
          <p>A facility reservation request is pending your <strong>signature/approval</strong>.</p>
          <p><strong>Approved by:</strong> ${previousDept}</p>
        </div>

        <div class="info-grid">
          <div><div class="label">Reference</div><div class="value">${reservation.referenceId}</div></div>
          <div><div class="label">Type</div><div class="value">${reservation.type?.replace('_', ' ') || 'N/A'}</div></div>
          <div><div class="label">Requestor</div><div class="value">${reservation.requestor?.fname || ''} ${reservation.requestor?.lname || ''}</div></div>
          <div><div class="label">Department</div><div class="value">${reservation.requestorDept || 'N/A'}</div></div>
          <div><div class="label">Location</div><div class="value">${location}</div></div>
          <div><div class="label">Event Dates</div><div class="value">${datesSummary}</div></div>
          <div style="grid-column: span 2;">
            <div class="label">Equipment Requested</div>
            <div class="value">${equipmentList}</div>
          </div>
        </div>

        <div style="text-align: center;">
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/forms/frf" class="btn">Review & Approve</a>
        </div>

        <div class="footer">
          <p>This is a system-generated notification from <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/forms/frf">NCST D-Forms</a>.</p>
          <p style="font-size: 11px; color: #bbb;">Printed on ${new Date().toLocaleString()}</p>
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