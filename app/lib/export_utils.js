// app/lib/export_utils.js
import { prisma } from '../../prisma/prisma';

export async function fetchMemosForExport({ startDate, endDate, departmentCode = null, includeHistory = false }) {
  const where = {
    createdAt: {
      gte: new Date(`${startDate}T00:00:00`),
      lte: new Date(`${endDate}T23:59:59.999`),
    },
  };
  if (departmentCode) where.senderDept = departmentCode;

  const memos = await prisma.memo.findMany({
    where,
    include: {
      sender: true,
      recipients: true,
      history: includeHistory,
    },
    orderBy: { createdAt: 'asc' },
  });
  return memos;
}

export function convertMemosToRows(memos, includeHistory = false) {
  const headers = [
    'Reference ID', 'Subject', 'Content', 'Sender Name', 'Sender Department',
    'Status', 'Priority', 'Purpose', 'Created At', 'Deadline',
    'Recipients (Dept:Status)', 'Last Activity',
  ];
  if (includeHistory) headers.push('History Remarks');

  const rows = memos.map((memo) => {
    const recipientsStr = memo.recipients.map((r) => `${r.departmentName}:${r.status}`).join('; ');
    const row = [
      memo.referenceId || '',
      memo.subject || '',
      memo.content || '',
      memo.senderName || '',
      memo.senderDept || '',
      memo.status || '',
      memo.priority || '',
      memo.purpose || '',
      memo.createdAt.toISOString(),
      memo.deadlineAt ? memo.deadlineAt.toISOString() : '',
      recipientsStr,
      memo.lastActivityAt ? memo.lastActivityAt.toISOString() : '',
    ];
    if (includeHistory) {
      const historyRemarks = memo.history.map((h) => `${h.action} (${h.performedByName}): ${h.remarks || ''}`).join(' | ');
      row.push(historyRemarks);
    }
    return row;
  });

  return { headers, rows };
}

export function generateCSV(headers, rows) {
  const escape = (str) => {
    if (str === null || str === undefined) return '';
    const s = String(str);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const headerLine = headers.map(escape).join(',');
  const dataLines = rows.map((row) => row.map(escape).join(','));
  return [headerLine, ...dataLines].join('\n');
}