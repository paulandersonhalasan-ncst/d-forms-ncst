'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDisclosure } from '@mantine/hooks';
import {
  Container,
  Card,
  Title,
  Group,
  Text,
  Button,
  Badge,
  Tabs,
  Stack,
  TextInput,
  LoadingOverlay,
  Box,
  SegmentedControl,
  ScrollArea,
  SimpleGrid,
  ActionIcon,
  Alert, 
  Collapse,
} from '@mantine/core';
import { IconPlus, IconInbox, IconSend, IconCircleCheck, IconUserCheck, IconInfoCircle, IconSettings, IconChevronDown } from '@tabler/icons-react';
import useSWR from 'swr';

import {
  FacilityReservation,
  FacilityApproval,
  EventPlace,
  Equipment,
  UserContext,
  PendingAction,
  FRFActionType,
  ITOAssignment,
  OCMFinalEditData,
  FRFFormValues,
  DateEntry,
  isActiveHeadOrOIC,
  ReservationType,
  OriginalDateEntry
} from './component/types';
import RequestCard from './component/requestCard';
import RequestStepper from './component/requestStepper';
import RequestDetailModal from './component/requestDetailModal';
import PasswordGateModal from './component/passwordGateModal';
import ITOAssignmentModal from './component/itoAssignmentModal';
import OCMFinalEditModal from './component/ocmFinalEditModal';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function CollapsibleAlert({
  title,
  icon,
  color = 'blue',
  children,
  defaultOpen = true,
}: {
  title: string;
  icon?: React.ReactNode;
  color?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [opened, setOpened] = useState(defaultOpen);

  return (
    <Alert
      color={color}
      radius="md"
      mb="md"
      p="sm"
      autoContrast
      style={{ cursor: 'pointer', userSelect: 'none' }}
      onClick={() => setOpened((o) => !o)}
      styles={(theme) => ({
        root: { border: `1px solid ${theme.colors[color]?.[3] ?? theme.colors.blue[3]}` },
        title: { width: '100%' },
        body: { width: '100%' },
      })}
      title={
        <Group justify="space-between" wrap="nowrap" style={{ width: '100%' }}>
          <Group gap="xs" wrap="nowrap">
            {icon}
            <Text fw={500} size="sm">{title}</Text>
          </Group>
          <ActionIcon variant="subtle" color={color}>
            <IconChevronDown
              size={16}
              style={{
                transform: opened ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 150ms ease',
              }}
            />
          </ActionIcon>
        </Group>
      }
    >
      <Collapse expanded={opened}>
        <Text size="xs" mt="xs" lh={1.6}>
          {children}
        </Text>
      </Collapse>
    </Alert>
  );
}

export default function FRFDashboardPage() {
  const router = useRouter();

  // ---- Disclosures ----
  const [opened, { open, close }] = useDisclosure(false);
  const [detailOpened, { open: openDetail, close: closeDetail }] = useDisclosure(false);
  const [passModalOpened, { open: openPassModal, close: closePassModal }] = useDisclosure(false);
  const [itoModalOpened, { open: openItoModal, close: closeItoModal }] = useDisclosure(false);
  const [ocmModalOpened, { open: openOcmModal, close: closeOcmModal }] = useDisclosure(false);

  // ---- State ----
  const [currentUser, setCurrentUser] = useState<UserContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<FacilityReservation | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>('my_requests');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'tile' | 'kanban'>('tile');

  // ---- Editing state ----
  const [editingReservation, setEditingReservation] = useState<FacilityReservation | null>(null);
  const [isEditingMode, setIsEditingMode] = useState(false);

  // ---- Password gate state ----
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [passLoading, setPassLoading] = useState(false);
  const [passError, setPassError] = useState('');

  // ---- Assignment and OCM state ----
  const [assignmentData, setAssignmentData] = useState<{ assignments: ITOAssignment[] } | null>(null);
  const [ocmData, setOcmData] = useState<OCMFinalEditData | null>(null);

  // ---- SWR ----
  const { data: reservationsData, mutate: mutateReservations } = useSWR<{ data: FacilityReservation[] }>(
    '/api/frf/reservation',
    fetcher,
    { refreshInterval: 15000 }
  );
  const reservations = reservationsData?.data || [];

  const [stepperKey, setStepperKey] = useState(0);

  const { data: placesData } = useSWR<{ data: EventPlace[] }>('/api/frf/places', fetcher);
  const places = placesData?.data || [];

  const { data: equipmentData } = useSWR<{ data: Equipment[] }>('/api/frf/equipment', fetcher);
  const equipment = equipmentData?.data || [];

  const [isRescheduleMode, setIsRescheduleMode] = useState(false);

  const isHeadOrOIC = isActiveHeadOrOIC(currentUser);

  // ---- Get current user ----
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (data.success) setCurrentUser(data.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

  const isHRD = currentUser?.departmentCode === 'HRD';

  // ---- Filtered lists ----
  const myRequests = reservations.filter((r) => r.requestorId === currentUser?.id);

  // Pending Approval: only for non-HRD users
  const pendingApproval = reservations.filter((r) => {
    if (isHRD) return false;
    const status = r.status as string;
    if (status === 'COMPLETED' || status === 'REJECTED') return false;
    const myApproval = r.approvals.find((a) => a.departmentCode === currentUser?.departmentCode);
    if (!myApproval) return false;
    // ✅ Show ANY request where this department's approval is PENDING
    return myApproval.status === 'PENDING';
  });

  // Action Board:
  // - For HRD: show COMPLETED reservations where HRD is PENDING or not yet noted
  // - For non-HRD: show reservations where they already approved, waiting for others
  // - Also show RESCHEDULE_PENDING for all users (no action if not next approver)
  const actionBoard = reservations.filter((r) => {
    const status = r.status as string;
    if (status === 'REJECTED') return false;

    if (status === 'RESCHEDULE_PENDING') return true;

    if (isHRD) {
      if (status !== 'COMPLETED') return false;
      const hrdApproval = r.approvals.find(a => a.departmentCode === 'HRD');
      if (!hrdApproval) return false;
      const isPending = hrdApproval.status === 'PENDING';
      const isAcknowledgedButNotNoted = hrdApproval.status === 'ACKNOWLEDGED' && !hrdApproval.remarks?.includes('Noted by');
      if (!isPending && !isAcknowledgedButNotNoted) return false;
      const allPreviousApproved = r.approvals
        .filter(a => a.departmentCode !== 'HRD')
        .every(a => a.status === 'APPROVED' || a.status === 'ACKNOWLEDGED');
      return allPreviousApproved;
    }

    if (status === 'REVISION_REQUESTED') return true;

    if (status === 'COMPLETED' || status === 'REJECTED') return false;
    return r.approvals.some((a) => a.departmentCode === currentUser?.departmentCode && a.status === 'APPROVED');
  });

  // Assigned to Me: show COMPLETED reservations where current user is assigned
  // Kasi kapag COMPLETED na, ibig sabihin approved na ang event at sure na ang assignment
  const assignedToMe = reservations.filter((r) =>
    r.assignments.some((a) => a.userId === currentUser?.id) && r.status === 'COMPLETED'
  );

  // Helper: check if current user is involved in the reservation
  const isUserInvolved = (r: FacilityReservation): boolean => {
    if (!currentUser) return false;
    if (r.requestorId === currentUser.id) return true;
    if (r.assignments.some(a => a.userId === currentUser.id)) return true;
    if (r.approvals.some(a => a.departmentCode === currentUser.departmentCode)) return true;
    if (r.approvals.some(a => a.performedById === currentUser.id)) return true;
    return false;
  };

  // Completed:
  // - For HRD: only show if HRD approval is ACKNOWLEDGED with "Noted by"
  // - For non-HRD: show COMPLETED or REJECTED only if the user is involved
  const completed = reservations.filter((r) => {
    const status = r.status as string;

    if (status === 'REJECTED') {
      return isUserInvolved(r);
    }

    if (isHRD) {
      if (status !== 'COMPLETED') return false;
      const hrdApproval = r.approvals.find(a => a.departmentCode === 'HRD');
      if (!hrdApproval) return false;
      return hrdApproval.status === 'ACKNOWLEDGED' && hrdApproval.remarks?.includes('Noted by');
    }

    if (status === 'COMPLETED') {
      return isUserInvolved(r);
    }

    return false;
  });

  const getFiltered = (list: FacilityReservation[]) => {
    if (!searchTerm) return list;
    return list.filter((r) =>
      r.referenceId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.dates && r.dates.some(d => (d.place?.name || d.placeOther || '').toLowerCase().includes(searchTerm.toLowerCase())))
    );
  };

  const handlePrintFRF = (reservation: FacilityReservation) => {
    const toDate = (val: unknown): Date => {
      if (val instanceof Date) return val;
      if (typeof val === 'string') return new Date(val);
      if (typeof val === 'number') return new Date(val);
      return new Date(); // fallback
    };

    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) return;

    const formatDate = (dateVal: string | Date): string => {
      if (!dateVal) return 'N/A';
      const d = typeof dateVal === 'string' ? new Date(dateVal) : dateVal;
      return d.toLocaleString();
    };

    const formatDateOnly = (dateVal: string | Date): string => {
      if (!dateVal) return 'N/A';
      const d = typeof dateVal === 'string' ? new Date(dateVal) : dateVal;
      return d.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    };

    const formatTimeOnly = (dateVal: string | Date): string => {
      if (!dateVal) return 'N/A';
      const d = typeof dateVal === 'string' ? new Date(dateVal) : dateVal;
      return d.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    };

    const renderApprovalsTable = (approvals: FacilityApproval[], title: string) => {
      if (!approvals || approvals.length === 0) return '';
      const sorted = [...approvals].sort((a, b) => a.stepOrder - b.stepOrder);
      const rows = sorted.map(approval => {
        const statusLabel = approval.status === 'ACKNOWLEDGED' && approval.remarks?.includes('Noted by')
          ? 'Noted'
          : approval.status;
        const performer = approval.performedBy 
          ? `${approval.performedBy.fname} ${approval.performedBy.lname}` 
          : approval.performedById 
          ? `User ${approval.performedById}` 
          : '—';
        const performedAt = approval.performedAt ? formatDate(approval.performedAt) : '—';
        const remark = approval.remarks || approval.revisionReason || '—';
        return `
          <tr style="border-bottom: 1px dashed #ccc;">
            <td style="padding: 6px 8px; font-weight: 600;">${approval.departmentCode}</td>
            <td style="padding: 6px 8px;">
              <span style="padding: 2px 8px; border-radius: 4px; font-size: 11px; background: ${
                approval.status === 'APPROVED' ? '#d4edda' :
                approval.status === 'ACKNOWLEDGED' && approval.remarks?.includes('Noted by') ? '#d1ecf1' :
                approval.status === 'ACKNOWLEDGED' ? '#cce5ff' :
                approval.status === 'REJECTED' ? '#f8d7da' :
                approval.status === 'REVISION_REQUESTED' ? '#fff3cd' :
                '#e9ecef'
              };">
                ${statusLabel}
              </span>
            </td>
            <td style="padding: 6px 8px; font-size: 12px;">${performer}</td>
            <td style="padding: 6px 8px; font-size: 11px; color: #666;">${performedAt}</td>
            <td style="padding: 6px 8px; font-size: 12px; max-width: 200px; word-wrap: break-word;">${remark}</td>
          </tr>
        `;
      }).join('');

      return `
        <div class="section">
          <div class="section-title">${title}</div>
          <table>
            <thead>
              <tr>
                <th style="width:15%;">Department</th>
                <th style="width:12%;">Status</th>
                <th style="width:20%;">Performed By</th>
                <th style="width:20%;">Timestamp</th>
                <th style="width:33%;">Remarks</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `;
    };

    // Build event dates HTML
    const datesHtml = reservation.dates.map((d, i) => `
      <div style="margin: 6px 0; padding: 4px 8px; border-left: 3px solid #010203; background: #f8f9fa;">
        <div style="font-weight: 600; font-size: 13px;">Date ${i + 1}: ${formatDateOnly(d.eventStart)}</div>
        <div style="font-size: 12px; margin-top: 2px;">
          <b>Setup:</b> ${formatTimeOnly(d.setupTime)} &bull;
          <b>Event:</b> ${formatTimeOnly(d.eventStart)} – ${formatTimeOnly(d.eventEnd)} &bull;
          <b>Pack-up:</b> ${formatTimeOnly(d.teardownTime)}
          <b>Place:</b> ${d.place?.name || d.placeOther || 'N/A'}
        </div>
      </div>
    `).join('');

    // Equipment table
    const equipmentRows = reservation.equipmentRequests.length > 0
      ? reservation.equipmentRequests.map((eq, idx) => `
        <tr style="border-bottom: 1px dashed #ccc;">
          <td style="padding: 4px 8px; text-align: center; font-size: 12px;">${idx + 1}</td>
          <td style="padding: 4px 8px; font-size: 12px;">${eq.equipment.name}</td>
          <td style="padding: 4px 8px; font-size: 12px;">${eq.equipment.departmentCode}</td>
          <td style="padding: 4px 8px; text-align: center; font-size: 12px;">${eq.quantityRequested}</td>
        </tr>
      `).join('')
      : `<tr><td colspan="4" style="padding: 8px; text-align: center; font-style: italic; color: #999;">No equipment requested</td></tr>`;

    const equipmentTable = `
      <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 4px;">
        <thead>
          <tr style="border-bottom: 2px solid #000;">
            <th style="padding: 4px 8px; text-align: center; font-weight: 700; width: 10%;">#</th>
            <th style="padding: 4px 8px; text-align: left; font-weight: 700; width: 45%;">Equipment Name</th>
            <th style="padding: 4px 8px; text-align: left; font-weight: 700; width: 25%;">Department</th>
            <th style="padding: 4px 8px; text-align: center; font-weight: 700; width: 20%;">Quantity</th>
          </tr>
        </thead>
        <tbody>${equipmentRows}</tbody>
      </table>
    `;

    // Assignments HTML
    const assignmentsHtml = reservation.assignments.map(ass => {
      const dutyTypeLabel = ass.dutyType === 'SETUP' ? 'Setup' : 'Teardown / Pack-up';
      return `
        <div style="margin: 4px 0; padding: 4px 8px; background: #f8f9fa; border-radius: 4px; font-size: 13px;">
          <b>${ass.user.fname} ${ass.user.lname}</b>
          <span style="color: #666; font-size: 12px;">(${dutyTypeLabel})</span>
          <span style="margin-left: 12px; font-size: 12px; color: #555;">
            ${formatTimeOnly(ass.dutyStart)} – ${formatTimeOnly(ass.dutyEnd)}
          </span>
        </div>
      `;
    }).join('') || '<div style="color: #999; font-style: italic;">No staff assigned</div>';

    const eventTitle = reservation.eventName || '—';

    const getUniqueVenues = (dates: DateEntry[]): string => {
      const venueMap = new Map<string, string>();
      dates.forEach(d => {
        const raw = d.place?.name || d.placeOther || 'TBA';
        const normalized = raw.trim().toLowerCase();
        if (!venueMap.has(normalized)) {
          venueMap.set(normalized, raw.trim());
        }
      });
      return Array.from(venueMap.values()).join(', ');
    };

    // --- Approval sections ---
    let approvalSectionsHtml = '';
    if (reservation.isReschedule && reservation.originalApprovals && reservation.originalApprovals.length > 0) {
      approvalSectionsHtml += renderApprovalsTable(reservation.originalApprovals, 'Original Approval Flow');
      approvalSectionsHtml += `<div style="margin: 16px 0; border-bottom: 2px dashed #ccc;"></div>`;
    }
    approvalSectionsHtml += renderApprovalsTable(reservation.approvals, reservation.isReschedule ? 'New Approval Flow (Reschedule)' : 'Approval Flow');

    // Inside handlePrintFRF
    let originalDatesHtml = '';
    if (reservation.isReschedule && reservation.originalDates && reservation.originalDates.length > 0) {
      originalDatesHtml = `
        <div class="section">
          <div class="section-title">Original Dates</div>
          ${reservation.originalDates.map((d: OriginalDateEntry, i) => {
            const placeName = (typeof d.place === 'object' && d.place && 'name' in d.place) ? d.place.name : (d.placeOther || 'N/A');
            return `
              <div style="margin: 6px 0; padding: 4px 8px; border-left: 3px solid #ffc107; background: #fff8e1;">
                <div style="font-weight: 600; font-size: 13px;">Date ${i + 1}: ${formatDateOnly(toDate(d.date))}</div>
                <div style="font-size: 12px; margin-top: 2px;">
                  <b>Setup:</b> ${formatTimeOnly(toDate(d.setupTime))} &bull;
                  <b>Event:</b> ${formatTimeOnly(toDate(d.eventStart))} – ${formatTimeOnly(toDate(d.eventEnd))} &bull;
                  <b>Pack-up:</b> ${formatTimeOnly(toDate(d.teardownTime))}
                  <b>Place:</b> ${placeName}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    // Build final HTML document
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>For Printing - ${reservation.referenceId}</title>
          <style>
            body { font-family: 'Arial', monospace; margin: 30px 40px; color: #000; font-size: 13px; line-height: 1.5; }
            .header { text-align: center; font-weight: bold; font-size: 18px; letter-spacing: 1px; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 16px; }
            .sub-header { text-align: center; font-size: 14px; margin-bottom: 16px; color: #333; }
            .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 20px; margin: 12px 0; padding: 12px; border: 1px solid #ccc; border-radius: 4px; }
            .meta-item { padding: 2px 0; }
            .meta-label { font-weight: 600; display: inline-block; min-width: 100px; }
            .section { margin-top: 16px; border-top: 1px solid #ccc; padding-top: 12px; }
            .section-title { font-weight: 700; font-size: 14px; margin-bottom: 8px; text-decoration: underline; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 6px; }
            thead th { border-bottom: 2px solid #000; padding: 4px 8px; text-align: left; font-weight: 700; }
            td { padding: 4px 8px; vertical-align: top; }
            .footer { margin-top: 30px; padding-top: 12px; border-top: 1px solid #ccc; font-size: 10px; text-align: center; color: #666; }
            .note-block { padding: 8px 12px; background: #f8f9fa; border-left: 3px solid #585858; margin: 6px 0; font-size: 13px; white-space: pre-wrap; }
            .reschedule-badge { display: inline-block; background: #ffc107; color: #000; padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: 700; margin-left: 8px; }
            @media print { body { margin: 20px 30px; } .no-print { display: none; } }
          </style>
        </head>
        <body>
          <div class="header">
            NCST D-FORMS | FACILITY RESERVATION FORM (FRF)
            ${reservation.isReschedule ? '<span class="reschedule-badge">RESCHEDULE</span>' : ''}
          </div>
          <div class="sub-header">
            ${reservation.referenceId} &bull; ${formatDate(reservation.createdAt)}
            ${reservation.isReschedule ? ' &bull; <strong>Reschedule Request</strong>' : ''}
          </div>

          <div class="meta-grid">
            <div class="meta-item"><span class="meta-label">Status:</span> ${reservation.status}</div>
            <div class="meta-item"><span class="meta-label">Type:</span> ${reservation.type.replace('_', ' ')}</div>
            <div class="meta-item"><span class="meta-label">Event Title:</span> ${eventTitle}</div>
            <div class="meta-item"><span class="meta-label">Requestor:</span> ${reservation.requestor.fname} ${reservation.requestor.lname}</div>
            <div class="meta-item"><span class="meta-label">Department:</span> ${reservation.requestorDept || 'N/A'}</div>
            <div class="meta-item"><span class="meta-label">Attendees:</span> ${reservation.attendeesCount}</div>
            <div class="meta-item"><span class="meta-label">Venue/s:</span> ${getUniqueVenues(reservation.dates)}</div>
            <div class="meta-item"><span class="meta-label">Usage Hours:</span> ${reservation.usageHours || 'N/A'}</div>
            <div class="meta-item"><span class="meta-label">With Charge:</span> ${reservation.withCharge ? 'Yes' : 'No'}</div>
          </div>

          ${reservation.requestorNotes ? `
            <div class="section">
              <div class="section-title">Requestor Notes</div>
              <div class="note-block">${reservation.requestorNotes}</div>
            </div>
          ` : ''}

          ${originalDatesHtml}

          <div class="section">
            <div class="section-title">${reservation.isReschedule ? 'New Event Dates' : 'Event Dates'}</div>
            ${datesHtml}
          </div>

          <div class="section">
            <div class="section-title">Equipment Requested</div>
            ${equipmentTable}
          </div>

          ${reservation.assignments.length > 0 ? `
            <div class="section">
              <div class="section-title">ITO Staff Assignment/s</div>
              ${assignmentsHtml}
            </div>
          ` : ''}

          ${approvalSectionsHtml}

          <div class="footer">
            This is a system-generated document from NCST D-Forms.<br>
            Printed on ${new Date().toLocaleString()}
          </div>

          <script>
            window.onload = function() { window.print(); };
            window.onafterprint = function() { window.close(); };
          <\/script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // ---- Password gate handlers ----
  const handleAction = (type: FRFActionType, data: Record<string, unknown>) => {
    if (type === 'RESUBMIT') {
      const id = data.id as string;
      const reservation = reservations.find(r => r.id === id);
      if (reservation) {
        setEditingReservation(reservation);
        setIsEditingMode(true);
        setIsRescheduleMode(false);
        setStepperKey((k) => k + 1);
        closeDetail();
        open();
      }
      return;
    }
    if (type === 'RESCHEDULE') {
      const id = data.id as string;
      const reservation = reservations.find(r => r.id === id);
      if (reservation) {
        setEditingReservation(reservation);
        setIsRescheduleMode(true);
        setIsEditingMode(false);
        setStepperKey((k) => k + 1);
        closeDetail();
        open();
      }
      return;
    }
    setPendingAction({ type, data });
    setPassError('');
    openPassModal();
  };

  // Magdagdag ng state para sa mode
  const [assignmentMode, setAssignmentMode] = useState<'assign' | 'approve'>('assign');

  const handleApproveWithAssign = () => {
    if (!selectedRequest) return;
    setAssignmentMode('approve');
    openItoModal();
  };

  const handleResubmit = async (
    id: string,
    values: FRFFormValues,
    password: string,
    attachmentsToKeep: string[]
  ) => {
    setPassLoading(true);
    setPassError('');
    try {
      const formData = new FormData();
      formData.append('id', id);
      formData.append('action', 'resubmit');
      formData.append('isVenueOnly', String(values.isVenueOnly || false));
      formData.append('password', password);
      formData.append('type', values.type);
      if (values.eventName) formData.append('eventName', values.eventName);
      formData.append('attendeesCount', String(values.attendeesCount));
      if (values.usageHours) formData.append('usageHours', String(values.usageHours));
      formData.append('withCharge', String(values.withCharge));
      if (values.requestorNotes) formData.append('requestorNotes', values.requestorNotes);
      formData.append('dates', JSON.stringify(
        values.dates.map(d => ({
          date: d.date.toISOString(),
          setupTime: d.setupTime.toISOString(),
          eventStart: d.eventStart.toISOString(),
          eventEnd: d.eventEnd.toISOString(),
          teardownTime: d.teardownTime.toISOString(),
          placeId: d.placeId,
          placeOther: d.placeOther,
        }))
      ));
      formData.append('equipmentRequests', JSON.stringify(values.equipmentRequests));
      formData.append('attachmentsToKeep', JSON.stringify(attachmentsToKeep));

      // Ilagay ang mga bagong file
      for (const file of values.attachments) {
        formData.append('newAttachments', file);
      }

      const res = await fetch('/api/frf/reservation', {
        method: 'PATCH',
        body: formData,
      });

      const result = await res.json();
      if (res.ok) {
        mutateReservations();
        closePassModal();
        alert('Reservation resubmitted successfully!');
        handleModalClose();
      } else {
        setPassError(result.message || 'Resubmit failed');
      }
    } catch (err) {
      setPassError('An error occurred');
    } finally {
      setPassLoading(false);
    }
  };

  const handleModalClose = () => {
    close();
    setEditingReservation(null);
    setIsEditingMode(false);
    setIsRescheduleMode(false);
    setStepperKey((k) => k + 1);
  };

  const handlePasswordSubmit = async (password: string, remarks: string) => {
    if (!pendingAction) return;
    setPassLoading(true);
    setPassError('');
    try {
      const payload: {
        id: string;
        action: string;
        password: string;
        remarks: string;
        assignments?: ITOAssignment[];
        finalEditData?: OCMFinalEditData;
      } = {
        id: pendingAction.data.id as string,
        action: pendingAction.type.toLowerCase(),
        password,
        remarks,
      };

      if (pendingAction.type === 'APPROVE' && assignmentData) {
        payload.assignments = assignmentData.assignments;
      }

      if (pendingAction.type === 'ASSIGN' && assignmentData) {
        payload.assignments = assignmentData.assignments;
      }

      if (pendingAction.type === 'OCM_FINALIZE' && ocmData) {
        payload.finalEditData = ocmData;
      }

      const res = await fetch('/api/frf/reservation', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (res.ok) {
        mutateReservations();
        closePassModal();
        setPendingAction(null);
        setAssignmentData(null);
        setOcmData(null);
        if (detailOpened) closeDetail();
        if (itoModalOpened) closeItoModal();
        if (ocmModalOpened) closeOcmModal();
        alert('Action completed successfully!');
      } else {
        setPassError(result.message || 'Action failed');
      }
    } catch (err) {
      setPassError('An error occurred');
    } finally {
      setPassLoading(false);
    }
  };

  // ---- Assignment and OCM flow ----
  const handleAssignConfirm = (assignments: ITOAssignment[]) => {
    if (!selectedRequest) return;
    setAssignmentData({ assignments });
    if (assignmentMode === 'approve') {
      handleAction('APPROVE', { id: selectedRequest.id, assignments });
    } else {
      handleAction('ASSIGN', { id: selectedRequest.id });
    }
    setAssignmentMode('assign');
  };

  const handleReschedule = async (
    id: string,
    data: { 
      dates: DateEntry[]; 
      reason: string;
      type?: ReservationType;
      eventName?: string;
      attendeesCount?: number;
      equipmentRequests?: { equipmentId: string; quantity: number }[];
      withCharge?: boolean;
      requestorNotes?: string;
    },
    password: string
  ) => {
    setPassLoading(true);
    setPassError('');
    try {
      const payload = {
        id,
        action: 'reschedule',
        password,
        dates: data.dates.map(d => ({
          date: d.date.toISOString(),
          setupTime: d.setupTime.toISOString(),
          eventStart: d.eventStart.toISOString(),
          eventEnd: d.eventEnd.toISOString(),
          teardownTime: d.teardownTime.toISOString(),
          placeId: d.placeId,
          placeOther: d.placeOther,
        })),
        reason: data.reason,
        // 🆕 Include optional fields if provided
        ...(data.type && { type: data.type }),
        ...(data.eventName && { eventName: data.eventName }),
        ...(data.attendeesCount !== undefined && { attendeesCount: data.attendeesCount }),
        ...(data.equipmentRequests && { equipmentRequests: data.equipmentRequests }),
        ...(data.withCharge !== undefined && { withCharge: data.withCharge }),
        ...(data.requestorNotes && { requestorNotes: data.requestorNotes }),
      };

      const res = await fetch('/api/frf/reservation', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (res.ok) {
        mutateReservations();
        closePassModal();
        alert('Reschedule request submitted successfully!');
        handleModalClose();
      } else {
        setPassError(result.message || 'Reschedule failed');
      }
    } catch (err) {
      setPassError('An error occurred');
    } finally {
      setPassLoading(false);
    }
  };

  const handleOcmConfirm = (data: OCMFinalEditData) => {
    if (!selectedRequest) return;
    setOcmData(data);
    handleAction('OCM_FINALIZE', { id: selectedRequest.id });
  };

  const openDetailModal = (req: FacilityReservation) => {
    setSelectedRequest(req);
    openDetail();
  };

  if (loading) {
    return <LoadingOverlay visible />;
  }

  const canManage = 
    currentUser?.role === 'SuperUser' ||
    (isHeadOrOIC && currentUser?.departmentCode === 'ITO-MAIN') ||
    currentUser?.departmentCode === 'PSMO/FMO' ||
    currentUser?.departmentCode === 'CDO';

  return (
    <Container fluid py="md">
      <Card withBorder radius="lg" p="lg" shadow="sm">
        <Group justify="space-between" align="center" mb="xl">
          <Stack gap={2}>
            <Title order={2} fw={800}>Facility Reservation Workspace</Title>
            <Group gap={6}>
              <Text size="xs" c="dimmed">Department:</Text>
              <Badge color="blue" variant="light" size="sm">{currentUser?.departmentCode || 'N/A'}</Badge>
              <Badge color="gray" variant="light" size="sm">{currentUser?.role || 'N/A'}</Badge>
            </Group>
          </Stack>
          <Group>
            {canManage && (
              <Button
                leftSection={<IconSettings size={16} />}
                onClick={() => router.push('/dashboard/forms/frf/manage')}
                variant="outline"
                color="gray"
              >
                Manage
              </Button>
            )}
            <Button leftSection={<IconPlus size={16} />} onClick={open} radius="md">
              New Reservation
            </Button>
          </Group>
        </Group>

        <Box>
          <Card withBorder radius="md" mb="md" p="sm" bg="light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-8))">
            <Group justify="space-between" align="flex-end">
              <TextInput
                placeholder="Search by reference or place..."
                label="Search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.currentTarget.value)}
                style={{ flex: 1 }}
              />
              <SegmentedControl
                value={viewMode}
                onChange={(val) => setViewMode(val as 'tile' | 'kanban')}
                data={[
                  { label: 'Tile', value: 'tile' },
                  { label: 'Kanban', value: 'kanban' },
                ]}
                size="xs"
              />
            </Group>
          </Card>

          <ScrollArea style={{ height: 'calc(100vh - 320px)' }} type="auto">
            <Tabs value={activeTab} onChange={setActiveTab} radius="md" variant="pills">
              <Tabs.List mb="lg">
                <Tabs.Tab value="my_requests" leftSection={<IconSend size={15} />}>
                  My Requests <Badge size="xs" variant="light" ml={6}>{myRequests.length}</Badge>
                </Tabs.Tab>
                <Tabs.Tab value="pending_approval" leftSection={<IconInbox size={15} />}>
                  Pending Approval <Badge size="xs" variant="light" ml={6}>{pendingApproval.length}</Badge>
                </Tabs.Tab>
                <Tabs.Tab value="action_board" leftSection={<IconInfoCircle size={15} />}>
                  Action Board <Badge size="xs" variant="light" ml={6}>{actionBoard.length}</Badge>
                </Tabs.Tab>
                <Tabs.Tab value="assigned_to_me" leftSection={<IconUserCheck size={15} />}>
                  Assigned to Me <Badge size="xs" variant="light" ml={6}>{assignedToMe.length}</Badge>
                </Tabs.Tab>
                <Tabs.Tab value="completed" leftSection={<IconCircleCheck size={15} />}>
                  Fully Approved / Rejected<Badge size="xs" variant="light" ml={6}>{completed.length}</Badge>
                </Tabs.Tab>
              </Tabs.List>

              {['my_requests', 'pending_approval', 'action_board', 'assigned_to_me', 'completed'].map((tab) => {
                let list: FacilityReservation[] = [];
                if (tab === 'my_requests') list = myRequests;
                else if (tab === 'pending_approval') list = pendingApproval;
                else if (tab === 'action_board') list = actionBoard;
                else if (tab === 'assigned_to_me') list = assignedToMe;
                else if (tab === 'completed') list = completed;

                const filtered = getFiltered(list);

                // 🆕 Info card content per tab
                const tabInfo: Record<string, { title: string; color: string; body: React.ReactNode }> = {
                  my_requests: {
                    title: 'My Requests',
                    color: 'blue',
                    body: (
                      <>
                        All facility reservation requests you have submitted. Track their status here — from
                        <b> Pending Approval</b> to <b> Completed</b> or <b> Rejected</b>.
                        <br /><br />
                        Makikita rito ang lahat ng requests na ikaw ang gumawa. Sundan ang
                        status nito — mula sa <b>Pending Approval</b> hanggang sa <b>Completed</b> o <b>Rejected</b>.
                      </>
                    ),
                  },
                  pending_approval: {
                    title: 'Pending Approval',
                    color: 'orange',
                    body: (
                      <>
                        Requests currently waiting for your department&apos;s approval. Review details, then choose
                        <b> Approve</b>, <b> Reject</b>, or <b> Return for Revision</b>. If no other action is available except printing the request, it means that it has not yet been approved by other departments and you must wait for their action before you can approve it.
                        <br /><br />
                        Mga request na naghihintay ng approval ng iyong departamento. Suriin ang detalye, at piliin ang
                        <b> Approve</b>, <b> Reject</b>, o <b> Return for Revision</b>. Kung walang ibang aksyon na pwede gawin bukod sa i-print ang request, ibig sabihin nito ay hindi pa ito naa-aprubahan ng ibang departamento at kailangan mo munang hintayin ang kanilang aksyon bago ka makapag-apruba.
                      </>
                    ),
                  },
                  action_board: {
                    title: 'Action Board',
                    color: 'grape',
                    body: (
                      <>
                        Requests you&apos;ve already acted on that are still in progress (e.g., waiting for other
                        departments, or returned for revision). This is your monitoring queue.
                        <br /><br />
                        Mga request na may aksyon ka na pero hindi pa tapos (hal. naghihintay sa ibang departamento,
                        o ibinalik para sa rebisyon). Ito ang iyong monitoring queue.
                      </>
                    ),
                  },
                  assigned_to_me: {
                    title: 'Assigned to Me',
                    color: 'teal',
                    body: (
                      <>
                        Completed reservations where you are assigned as ITO staff for OT rendering. Check your
                        schedule and event details here.
                        <br /><br />
                        Mga kumpletong reservation kung saan ikaw ay nakatalagang ITO staff para sa OT rendering.
                        Tingnan ang iyong iskedyul at detalye ng event dito.
                      </>
                    ),
                  },
                  completed: {
                    title: 'Fully Approved / Rejected',
                    color: 'gray',
                    body: (
                      <>
                        Finalized reservations — either fully approved (Completed) or rejected. Only requests you
                        are involved in are shown here.
                        <br /><br />
                        Mga natapos na reservation — alinman sa tuluyang naaprubahan (Completed) o tinanggihan
                        (Rejected). Mga request na may kinalaman ka lamang ang ipinapakita rito.
                      </>
                    ),
                  },
                };

                const info = tabInfo[tab];

                return (
                  <Tabs.Panel key={tab} value={tab}>
                    {/* 🆕 Collapsible info alert */}
                    {info && (
                      <CollapsibleAlert
                        title={info.title}
                        color={info.color}
                        icon={<IconInfoCircle size={16} />}
                        defaultOpen={true}
                      >
                        {info.body}
                      </CollapsibleAlert>
                    )}

                    {filtered.length === 0 ? (
                      <Text c="dimmed" ta="center" py="xl">No reservations found.</Text>
                    ) : (
                      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
                        {filtered.map((req) => (
                          <RequestCard
                            key={req.id}
                            request={req}
                            currentUser={currentUser}
                            onView={() => openDetailModal(req)}
                            onAssign={() => {
                              setSelectedRequest(req);
                              openItoModal();
                            }}
                            onFinalize={() => {
                              setSelectedRequest(req);
                              openOcmModal();
                            }}
                            onAction={handleAction}
                          />
                        ))}
                      </SimpleGrid>
                    )}
                  </Tabs.Panel>
                );
              })}
            </Tabs>
          </ScrollArea>
        </Box>
      </Card>

      {/* ---- Modals ---- */}
      <RequestStepper
        key={stepperKey}
        opened={opened}
        onClose={handleModalClose}
        places={places}
        equipment={equipment}
        currentUser={currentUser}
        onSuccess={() => {
          mutateReservations();
          handleModalClose();
        }}
        editData={editingReservation}
        isEditing={isEditingMode}
        isRescheduleMode={isRescheduleMode}
        onResubmit={handleResubmit}
        onReschedule={handleReschedule} 
      />

      <RequestDetailModal
        opened={detailOpened}
        onClose={closeDetail}
        request={selectedRequest}
        currentUser={currentUser}
        onAction={handleAction}
        onApproveWithAssign={handleApproveWithAssign}
        onAssign={() => {
          closeDetail();
          setAssignmentMode('assign');
          openItoModal();
        }}
        onFinalize={() => {
          closeDetail();
          openOcmModal();
        }}
        onPrint={handlePrintFRF}
      />

      <PasswordGateModal
        opened={passModalOpened}
        onClose={() => {
          closePassModal();
          setPendingAction(null);
          setPassError('');
        }}
        action={pendingAction?.type || ''}
        onSubmit={handlePasswordSubmit}
        loading={passLoading}
        error={passError}
        requireRemarks={pendingAction?.type === 'REJECT' || pendingAction?.type === 'RETURN' || pendingAction?.type === 'APPROVE'}
      />

      <ITOAssignmentModal
        opened={itoModalOpened}
        onClose={closeItoModal}
        request={selectedRequest}
        currentUser={currentUser}
        onConfirm={handleAssignConfirm}
        loading={passLoading}
        mode={assignmentMode}
      />

      <OCMFinalEditModal
        key={selectedRequest?.id}
        opened={ocmModalOpened}
        onClose={closeOcmModal}
        request={selectedRequest}
        currentUser={currentUser}
        places={places}
        onConfirm={handleOcmConfirm}
        loading={passLoading}
      />
    </Container>
  );
}