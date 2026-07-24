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
    <p>Please review and approve this memo via the E-Forms dashboard.</p>
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