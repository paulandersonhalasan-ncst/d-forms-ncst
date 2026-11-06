import { prisma } from '../../prisma/prisma';
import { convertMemosToRows, generateCSV } from './export_utils';

const sanitizeUserSelect = {
  id: true,
  employee_id: true,
  email: true,
  fname: true,
  lname: true,
  role: true,
  branch: true,
  departmentCode: true,
  oic_start: true,
  oic_end: true,
  disabled: true,
  last_login: true,
  createdAt: true,
  updatedAt: true,
  // Password, resetToken, resetTokenExpiry, forgot_password intentionally excluded
};

export async function buildBackupPayload(scopesInput, {
  startDate,
  endDate,
  departmentCode = null,
  includeHistory = false,
} = {}) {
  // Normalize: accept string (legacy), array (new), or 'full' (legacy superset)
  const scopes = new Set(
    Array.isArray(scopesInput) ? scopesInput : [scopesInput].filter(Boolean),
  );
  if (scopes.has('full')) {
    scopes.add('memos');
    scopes.add('frf');
    scopes.add('users');
    scopes.add('system');
    scopes.delete('full');
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    version: '2.0',
    scope: Array.from(scopes).sort(),
    meta: { startDate, endDate, departmentCode, includeHistory },
  };

  // ----- MEMOS -----
  if (scopes.has('memos')) {
    const where = {};
    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(`${startDate}T00:00:00`),
        lte: new Date(`${endDate}T23:59:59.999`),
      };
    }
    if (departmentCode) where.senderDept = departmentCode;

    payload.memos = await prisma.memo.findMany({
      where,
      include: {
        sender: { select: sanitizeUserSelect },
        recipients: true,
        history: includeHistory,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ----- FRF -----
  if (scopes.has('frf')) {
    payload.facilityReservations = await prisma.facilityReservation.findMany({
      include: {
        requestor: { select: sanitizeUserSelect },
        approvals: true,
        assignments: {
          include: { user: { select: sanitizeUserSelect } },
        },
        dates: {
          include: { place: true },
        },
        equipmentRequests: { include: { equipment: true } },
        packUpDoneBy: { select: sanitizeUserSelect },
      },
      orderBy: { createdAt: 'asc' },
    });

    payload.eventPlaces = await prisma.eventPlace.findMany();
    payload.equipment = await prisma.equipment.findMany();
    payload.equipmentPlaces = await prisma.equipmentPlace.findMany();
  }

  // ----- USERS -----
  if (scopes.has('users')) {
    payload.users = await prisma.user.findMany({
      select: sanitizeUserSelect,
      orderBy: { createdAt: 'asc' },
    });
    payload.departments = await prisma.department.findMany();
  }

  // ----- SYSTEM (settings, privacy, notifications) -----
  if (scopes.has('system')) {
    payload.formSettings = await prisma.formSettings.findMany();
    payload.privacySettings = await prisma.privacySettings.findMany();
    payload.notifications = await prisma.notification.findMany({
      orderBy: { createdAt: 'asc' },
    });
  }

  return payload;
}

// ==========================================
// FORMAT-AWARE FILE BUILDER (Sprint 6.1)
// ==========================================
export async function buildBackupFile(scopes, format, {
  startDate,
  endDate,
  departmentCode = null,
  includeHistory = false,
} = {}) {
  const scopeSet = new Set(scopes);

  // ---- JSON: full nested payload ----
  if (format === 'json') {
    const payload = await buildBackupPayload(scopes, {
      startDate, endDate, departmentCode, includeHistory,
    });
    return {
      buffer: Buffer.from(JSON.stringify(payload, null, 2), 'utf8'),
      mimeType: 'application/json',
      extension: 'json',
    };
  }

  // ---- XLSX: one sheet per scope ----
  if (format === 'xlsx') {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    const payload = await buildBackupPayload(scopes, {
      startDate, endDate, departmentCode, includeHistory,
    });

    if (payload.memos) {
      const { headers, rows } = convertMemosToRows(payload.memos, includeHistory);
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws['!cols'] = headers.map(() => ({ wch: 22 }));
      XLSX.utils.book_append_sheet(wb, ws, 'Memos');
    }

    if (payload.facilityReservations) {
      const rows = payload.facilityReservations.map((r) => {
        const venueSet = new Set();
        (r.dates || []).forEach((d) => venueSet.add(d.place?.name || d.placeOther || 'TBA'));
        return {
          Reference: r.referenceId,
          EventName: r.eventName || '',
          Requestor: `${r.requestor?.fname || ''} ${r.requestor?.lname || ''}`.trim(),
          RequestorDept: r.requestorDept,
          Type: r.type,
          Status: r.status,
          Attendees: r.attendeesCount,
          Venues: Array.from(venueSet).join(', '),
          DatesCount: (r.dates || []).length,
          EquipmentCount: (r.equipmentRequests || []).length,
          AssignmentsCount: (r.assignments || []).length,
          ApprovalsCount: (r.approvals || []).length,
          CreatedAt: r.createdAt,
        };
      });
      const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Info: 'No reservations' }]);
      XLSX.utils.book_append_sheet(wb, ws, 'FRF');
    }

    if (payload.users) {
      const userRows = payload.users.map((u) => ({
        EmployeeID: u.employee_id,
        Email: u.email,
        Name: `${u.fname} ${u.lname}`.trim(),
        Role: u.role,
        Branch: u.branch,
        Department: u.departmentCode,
        OIC_Start: u.oic_start || '',
        OIC_End: u.oic_end || '',
        Disabled: u.disabled ? 'Yes' : 'No',
        LastLogin: u.last_login || '',
        CreatedAt: u.createdAt,
      }));
      const wsU = XLSX.utils.json_to_sheet(userRows.length ? userRows : [{ Info: 'No users' }]);
      XLSX.utils.book_append_sheet(wb, wsU, 'Users');

      const deptRows = (payload.departments || []).map((d) => ({ Code: d.code, CreatedAt: d.createdAt }));
      const wsD = XLSX.utils.json_to_sheet(deptRows.length ? deptRows : [{ Info: 'No departments' }]);
      XLSX.utils.book_append_sheet(wb, wsD, 'Departments');
    }

    if (payload.formSettings || payload.privacySettings) {
      const kv = [];
      (payload.formSettings || []).forEach((s) => {
        Object.entries(s).forEach(([k, v]) => {
          if (typeof v !== 'object') kv.push({ Setting: `formSettings.${k}`, Value: String(v ?? '') });
        });
      });
      (payload.privacySettings || []).forEach((s) => {
        Object.entries(s).forEach(([k, v]) => {
          if (typeof v !== 'object') kv.push({ Setting: `privacySettings.${k}`, Value: String(v ?? '') });
        });
      });
      const wsS = XLSX.utils.json_to_sheet(kv.length ? kv : [{ Info: 'No settings' }]);
      XLSX.utils.book_append_sheet(wb, wsS, 'System Settings');
    }

    if (wb.SheetNames.length === 0) {
      const ws = XLSX.utils.json_to_sheet([{ Info: 'Empty backup' }]);
      XLSX.utils.book_append_sheet(wb, ws, 'Empty');
    }

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return {
      buffer,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      extension: 'xlsx',
    };
  }

  // ---- CSV: memos only ----
  if (format === 'csv') {
    if (scopeSet.size !== 1 || !scopeSet.has('memos')) {
      throw new Error('CSV format only supports the Memos scope. Use XLSX or JSON for multi-scope exports.');
    }
    const payload = await buildBackupPayload(['memos'], {
      startDate, endDate, departmentCode, includeHistory,
    });
    const { headers, rows } = convertMemosToRows(payload.memos, includeHistory);
    return {
      buffer: Buffer.from(generateCSV(headers, rows), 'utf8'),
      mimeType: 'text/csv',
      extension: 'csv',
    };
  }

  throw new Error(`Unsupported format: ${format}`);
}