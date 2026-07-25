// app/api/cron/overdue-rush-reminder/route.js
import { NextResponse } from 'next/server';
import { prisma } from '../../../../prisma/prisma';
import { getDepartmentHeads } from '../../../lib/email_notification';
import { sendEmailWithRetry } from '../../../lib/email_service';

export async function GET(request) {
  try {
    const now = new Date();
    console.log('🔍 Current time (UTC):', now.toISOString());

    // 1. Find all overdue RUSH memos (not closed)
    const overdueMemos = await prisma.memo.findMany({
      where: {
        priority: 'RUSH',
        status: { not: 'CLOSED' },
        deadlineAt: { lt: now },
      },
      include: {
        sender: true,
        recipients: true,
      },
    });

    if (overdueMemos.length === 0) {
      return NextResponse.json({ message: 'No overdue RUSH memos found.' });
    }

    console.log(`⏰ Overdue RUSH memos: ${overdueMemos.length}`);

    // 2. Group memos by RECIPIENT department (hindi sender)
    const groupedByRecipientDept = {};

    for (const memo of overdueMemos) {
      // Kunin ang lahat ng recipient departments ng memo
      const recipientDepts = memo.recipients.map(r => r.departmentName);
      
      for (const dept of recipientDepts) {
        if (!groupedByRecipientDept[dept]) {
          groupedByRecipientDept[dept] = [];
        }
        // I-add ang memo sa bawat recipient department (para ma-notify sila)
        groupedByRecipientDept[dept].push(memo);
      }
    }

    console.log('📋 Recipient departments with overdue memos:', Object.keys(groupedByRecipientDept));

    // 3. For each recipient department, get department heads & OICs, then send email
    const emailPromises = Object.entries(groupedByRecipientDept).map(async ([deptCode, memos]) => {
      const heads = await getDepartmentHeads(deptCode);
      
      if (heads.length === 0) {
        console.log(`⚠️ No department heads found for ${deptCode}`);
        return;
      }

      console.log(`📧 Sending email to ${heads.length} head(s) of ${deptCode} for ${memos.length} memos`);

      const memoListHtml = memos.map((m) => `
        <tr>
          <td>${m.referenceId}</td>
          <td>${m.subject}</td>
          <td>${m.senderName} (${m.senderDept})</td>
          <td>${new Date(m.createdAt).toLocaleDateString()}</td>
          <td>${new Date(m.deadlineAt).toLocaleDateString()}</td>
          <td>${m.status}</td>
          <td>${m.recipients.map(r => r.departmentName).join(', ')}</td>
        </tr>
      `).join('');

      const subject = `🚨 OVERDUE RUSH MEMOS – ${deptCode}`;
      const html = `
        <h2>⚠️ Overdue RUSH Memos</h2>
        <p>This is an automated reminder for the following RUSH memos that are <strong>past their 3-day processing deadline</strong>.</p>
        <p><strong>Your Department:</strong> ${deptCode}</p>
        <p><strong>Total Overdue Memos:</strong> ${memos.length}</p>

        <table border="1" cellpadding="8" style="border-collapse: collapse; width: 100%;">
          <thead>
            <tr style="background: #f5f5f5;">
              <th>Reference ID</th>
              <th>Subject</th>
              <th>Sender</th>
              <th>Created</th>
              <th>Deadline</th>
              <th>Status</th>
              <th>All Recipients</th>
            </tr>
          </thead>
          <tbody>
            ${memoListHtml}
          </tbody>
        </table>

        <p style="margin-top: 20px;">
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/forms/iom?tab=action_board">
            Click here to view and process these memos.
          </a>
        </p>
        <p style="color: #666; font-size: 12px;">This is an automated system email. Please do not reply.</p>
      `;

      for (const head of heads) {
        await sendEmailWithRetry({
          to: head.email,
          subject,
          html,
        });
      }
    });

    await Promise.all(emailPromises);

    // 4. Count total recipients notified
    const totalRecipients = Object.values(groupedByRecipientDept).reduce(
      (acc, memos) => acc + memos.length, 0
    );

    return NextResponse.json({
      success: true,
      message: `Emails sent for ${overdueMemos.length} overdue RUSH memos to ${Object.keys(groupedByRecipientDept).length} recipient departments.`,
      memoCount: overdueMemos.length,
      recipientDepartments: Object.keys(groupedByRecipientDept),
    });
  } catch (error) {
    console.error('❌ Cron job failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}