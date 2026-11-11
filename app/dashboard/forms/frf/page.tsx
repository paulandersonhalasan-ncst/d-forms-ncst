'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
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
  Select
} from '@mantine/core';
import { IconPlus, IconInbox, IconSend, IconCircleCheck, IconUserCheck, IconInfoCircle, IconSettings, IconChevronDown, IconCopy, IconFileImport } from '@tabler/icons-react';
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
import { useSearchParams } from 'next/navigation';

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

  const searchParams = useSearchParams();
  const urlTab = searchParams.get('tab');

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


  const [activeTab, setActiveTab] = useState<string | null>(urlTab || 'my_requests');
  const [prevUrlTab, setPrevUrlTab] = useState(urlTab);
  if (urlTab !== prevUrlTab) {
    setPrevUrlTab(urlTab);
    if (urlTab) {
      setActiveTab(urlTab);
    }
  }

  const [searchTerm, setSearchTerm] = useState('');

  const [isDraftMode, setIsDraftMode] = useState(false);

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

  const [itoModalKey, setItoModalKey] = useState(0);

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

  const isITOMain = currentUser?.departmentCode === 'ITO-MAIN';
  const isHRDorSuper = 
    currentUser?.departmentCode === 'HRD' || 
    currentUser?.role === 'SuperUser' || 
    currentUser?.role === 'Admin';

  const isMobile = useMediaQuery('(max-width: 768px)');

  // ---- Helpers (MUST be declared before the filter block below) ----
  const isImportedFRF = (r: FacilityReservation): boolean =>
    r.referenceId?.startsWith('IMPORT-') ?? false;

  const isUserInvolved = (r: FacilityReservation): boolean => {
    if (!currentUser) return false;
    if (r.requestorId === currentUser.id) return true;
    if (r.assignments.some(a => a.userId === currentUser.id)) return true;
    if (r.approvals.some(a => a.departmentCode === currentUser.departmentCode)) return true;
    if (r.approvals.some(a => a.performedById === currentUser.id)) return true;
    return false;
  };

  // ---- Filtered lists ----
  const myRequests = reservations.filter(
    (r) => r.requestorId === currentUser?.id && !isImportedFRF(r)  // 🆕
  );

  // Pending Approval — APPROVAL steps only (ACKs live in their own tab)
  const pendingApproval = reservations.filter((r) => {
    if (isImportedFRF(r)) return false;
    const status = r.status as string;
    if (status === 'COMPLETED' || status === 'REJECTED') return false;
    const myApproval = r.approvals.find(
      (a) => a.departmentCode === currentUser?.departmentCode && a.stepType !== 'ACKNOWLEDGEMENT'
    );
    if (!myApproval) return false;

    return myApproval.status === 'PENDING';
  });

  // 🆕 For Acknowledgement — PENDING ACK steps for the user's dept (any status except REJECTED)
  const acknowledgementQueue = reservations.filter((r) => {
    if (isImportedFRF(r)) return false;
    if (r.status === 'REJECTED') return false;
    const myAck = r.approvals.find(
      (a) =>
        a.departmentCode === currentUser?.departmentCode &&
        a.stepType === 'ACKNOWLEDGEMENT' &&
        a.status === 'PENDING'
    );
    return !!myAck;
  });

  // Action Board:
  // - For HRD: show COMPLETED reservations where HRD is PENDING or not yet noted
  // - For non-HRD: show reservations where they already approved, waiting for others
  // - Also show RESCHEDULE_PENDING for all users (no action if not next approver)
  const actionBoard = reservations.filter((r) => {
    if (isImportedFRF(r)) return false; 
    const status = r.status as string;
    if (status === 'REJECTED') return false;

    if (status === 'RESCHEDULE_PENDING') return true;

    if (status === 'REVISION_REQUESTED') return true;

    if (status === 'COMPLETED' || status === 'REJECTED') return false;
    return r.approvals.some(
      (a) =>
        a.departmentCode === currentUser?.departmentCode &&
        (a.status === 'APPROVED' || a.status === 'ACKNOWLEDGED')
    );
  });

  // Assigned to Me: show COMPLETED reservations where current user is assigned
  // Kasi kapag COMPLETED na, ibig sabihin approved na ang event at sure na ang assignment
  // Assigned to Me: show COMPLETED reservations where current user is assigned
  // 🆕 Pero EXCLUDE kapag Pack Up Done na (lilipat na kasi siya sa completed tab)

  const assignedToMe = reservations.filter(
    (r) =>
      !isImportedFRF(r) &&  // 🆕
      r.assignments.some((a) => a.userId === currentUser?.id) &&
      r.status === 'COMPLETED' &&
      !r.packUpDoneAt
  );

  const hrCopyReservations = isHRDorSuper
    ? reservations.filter((r) => !isImportedFRF(r))  // 🆕
    : [];

  const importedFRFs = reservations.filter((r) => {
    if (!isImportedFRF(r)) return false;
    if (currentUser?.role === 'SuperUser' || currentUser?.role === 'Admin') return true;
    return isUserInvolved(r);
  });

  const completed = reservations.filter((r) => {
    if (isImportedFRF(r)) return false;
    const status = r.status as string;

    if (status !== 'REJECTED' && status !== 'COMPLETED') return false;

    // 🆕 If user has a PENDING ACK here, it belongs in For Acknowledgement, not Completed
    const myPendingAck = r.approvals.find(
      (a) =>
        a.departmentCode === currentUser?.departmentCode &&
        a.stepType === 'ACKNOWLEDGEMENT' &&
        a.status === 'PENDING'
    );
    if (myPendingAck) return false;

    return isUserInvolved(r);
  });

  const getFiltered = (list: FacilityReservation[]) => {
    if (!searchTerm) return list;
    return list.filter((r) =>
      r.referenceId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.dates && r.dates.some(d => (d.place?.name || d.placeOther || '').toLowerCase().includes(searchTerm.toLowerCase())))
    );
  };

  // ---- Notification focus-highlight state ----
  const focusId = searchParams.get('focus');
  const [focusedCardId, setFocusedCardId] = useState<string | null>(null);
  const [lastFocusId, setLastFocusId] = useState<string | null>(focusId);
  const [handledFocusId, setHandledFocusId] = useState<string | null>(null);

  // ---- Focus-highlight: scroll + clean URL (no setState — external side effects only) ----
  useEffect(() => {
    if (!focusId || focusedCardId !== focusId) return;

    const el = document.getElementById(`card-${focusId}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });

    const params = new URLSearchParams(window.location.search);
    if (params.has('focus')) {
      params.delete('focus');
      const qs = params.toString();
      router.replace(window.location.pathname + (qs ? `?${qs}` : ''));
    }
  }, [focusId, focusedCardId, router]);

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

    // Assignments HTML (as a table)
    const assignmentsHtml = reservation.assignments.length > 0
      ? `
        <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 6px;">
          <thead>
            <tr style="border-bottom: 2px solid #000;">
              <th style="padding: 4px 8px; text-align: left; font-weight: 700; width: 16%;">Date</th>
              <th style="padding: 4px 8px; text-align: left; font-weight: 700; width: 22%;">Staff</th>
              <th style="padding: 4px 8px; text-align: left; font-weight: 700; width: 14%;">Duty Type</th>
              <th style="padding: 4px 8px; text-align: center; font-weight: 700; width: 8%;">OT?</th>
              <th style="padding: 4px 8px; text-align: left; font-weight: 700; width: 12%;">Start</th>
              <th style="padding: 4px 8px; text-align: left; font-weight: 700; width: 12%;">End</th>
              <th style="padding: 4px 8px; text-align: left; font-weight: 700; width: 24%;">Notes</th>
            </tr>
          </thead>
          <tbody>
            ${reservation.assignments.map(ass => {
              const dutyTypeLabel = ass.dutyType === 'SETUP'
                ? 'Setup'
                : ass.dutyType === 'TEARDOWN'
                ? 'Pack-up'
                : ass.dutyType === 'OPERATOR'
                ? 'Operator'
                : ass.dutyType === 'ASSISTANT'
                ? 'Assistant'
                : ass.dutyType;
              const dateStr = formatDateOnly(ass.dutyStart);
              const notes = ass.notes ? ass.notes : '—';
              const otLabel = ass.isOvertime
                ? `<span style="padding: 2px 6px; border-radius: 3px; font-size: 10px; font-weight: 700; background: #d4edda; color: #155724;">OT</span>`
                : '—';
              return `
                <tr style="border-bottom: 1px dashed #ccc;">
                  <td style="padding: 4px 8px; font-size: 12px;">${dateStr}</td>
                  <td style="padding: 4px 8px; font-size: 12px; font-weight: 600;">
                    ${ass.user.fname} ${ass.user.lname}
                  </td>
                  <td style="padding: 4px 8px; font-size: 12px;">${dutyTypeLabel}</td>
                  <td style="padding: 4px 8px; font-size: 12px; text-align: center;">${otLabel}</td>
                  <td style="padding: 4px 8px; font-size: 12px;">${formatTimeOnly(ass.dutyStart)}</td>
                  <td style="padding: 4px 8px; font-size: 12px;">${formatTimeOnly(ass.dutyEnd)}</td>
                  <td style="padding: 4px 8px; font-size: 12px; color: #444; word-wrap: break-word;">
                    ${notes}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `
      : `<div style="color: #999; font-style: italic; font-size: 12px;">No staff assigned</div>`;

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
    // 🆕 Pack Up Done section
    let packUpDoneHtml = '';
    if (reservation.packUpDoneAt) {
      const packUpDate = formatDate(reservation.packUpDoneAt);
      const packUpBy = reservation.packUpDoneBy
        ? `${reservation.packUpDoneBy.fname} ${reservation.packUpDoneBy.lname} (${reservation.packUpDoneBy.email}) - ${reservation.packUpDoneBy.departmentCode}`
        : 'N/A';
      const packUpNotes = reservation.packUpDoneNotes
        ? `<div style="margin-top: 6px; padding: 6px 10px; background: #e7f5ff; border-left: 3px solid #888888; font-size: 12px;">
            <b>Notes:</b> ${reservation.packUpDoneNotes}
          </div>`
        : '';

      const packUpPhotos = (reservation.packUpDonePhotos || []).length > 0
        ? `
          <div style="margin-top: 10px;">
            <div style="font-weight: 600; font-size: 11px; color: #333; margin-bottom: 4px;">Photo Proof:</div>
            <div style="display: flex; flex-wrap: wrap; gap: 6px;">
              ${(reservation.packUpDonePhotos || []).map(url => `
                <div style="border: 1px solid #ccc; border-radius: 3px; overflow: hidden; width: 120px; height: 90px;">
                  <img src="${url}" style="width: 100%; height: 100%; object-fit: cover;" />
                </div>
              `).join('')}
            </div>
          </div>
        `
        : '';

      packUpDoneHtml = `
        <div class="section" style="background: #f3f5f3; border: 1px solid #c0c0c0; padding: 12px; border-radius: 4px; margin-top: 16px;">
          <div style="font-weight: 700; font-size: 14px; text-decoration: underline; color: #858585; margin-bottom: 6px;">
            ✓ PACK UP DONE
          </div>
          <div style="font-size: 12px;">
            <div><b>Marked by:</b> ${packUpBy}</div>
            <div><b>Date & Time:</b> ${packUpDate}</div>
            <div style="margin-top: 4px; font-style: italic; color: #555;">
              All equipment quantities have been restored to inventory.
            </div>
            ${packUpNotes}
            ${packUpPhotos}
          </div>
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
            <div class="meta-item"><span class="meta-label">Requestor (Focal Person):</span> ${reservation.requestor.fname} ${reservation.requestor.lname}</div>
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

          ${packUpDoneHtml}

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

    const targetId = data.id as string | undefined;
    if (targetId) {
      const target = reservations.find((r) => r.id === targetId);
      if (target && target.referenceId?.startsWith('IMPORT-')) {
        alert('Imported records are read-only and cannot be modified.');
        return;
      }
    }

    if (type === 'SAVE_DRAFT') {
      const id = data.id as string;
      const reservation = reservations.find(r => r.id === id);
      if (reservation) {
        setEditingReservation(reservation);
        setIsDraftMode(true);
        setIsEditingMode(false);
        setIsRescheduleMode(false);
        setStepperKey(k => k + 1);
        closeDetail();
        open();
      }
      return;
    }
    if (type === 'DELETE_DRAFT') {
      handleDeleteDraft(data.id as string);
      return;
    }
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
    if (type === 'PACKUP_DONE') {
      setPendingAction({ type, data });
      setPassError('');
      openPassModal();
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
    handleOpenItoModal();
  };

  const handleOpenItoModal = () => {
    if (selectedRequest?.referenceId?.startsWith('IMPORT-')) {
      alert('Imported records are read-only.');
      return;
    }
    setItoModalKey((k) => k + 1);
    openItoModal();
  };

  const guardedOpenOcmModal = () => {
    if (selectedRequest?.referenceId?.startsWith('IMPORT-')) {
      alert('Imported records are read-only.');
      return;
    }
    openOcmModal();
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
      formData.append('hasPhysicalActivity', String(values.hasPhysicalActivity || false));
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

      if (values.assignments && values.assignments.length > 0) {
        formData.append('assignments', JSON.stringify(
          values.assignments.map(a => ({
            userId: a.userId,
            dutyStart: a.dutyStart instanceof Date ? a.dutyStart.toISOString() : a.dutyStart,
            dutyEnd: a.dutyEnd instanceof Date ? a.dutyEnd.toISOString() : a.dutyEnd,
            dutyType: a.dutyType,
            notes: a.notes,
            isOvertime: a.isOvertime,
          }))
        ));
      }

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

  const handleSaveDraft = async (
    draftId: string | null,
    values: FRFFormValues,
    attachmentsToKeep: string[]
  ) => {
    setPassLoading(true);
    try {
      const formData = new FormData();
      if (draftId) {
        formData.append('id', draftId);
        formData.append('action', 'save-draft');
      } else {
        formData.append('isDraft', 'true');
      }
      formData.append('type', values.type);
      if (values.eventName) formData.append('eventName', values.eventName);
      formData.append('attendeesCount', String(values.attendeesCount));
      if (values.usageHours) formData.append('usageHours', String(values.usageHours));
      formData.append('withCharge', String(values.withCharge));
      if (values.requestorNotes) formData.append('requestorNotes', values.requestorNotes);
      formData.append('isVenueOnly', String(values.isVenueOnly || false));
      formData.append('hasPhysicalActivity', String(values.hasPhysicalActivity || false));
      formData.append('dates', JSON.stringify(values.dates.map(d => ({
        date: d.date.toISOString(),
        setupTime: d.setupTime.toISOString(),
        eventStart: d.eventStart.toISOString(),
        eventEnd: d.eventEnd.toISOString(),
        teardownTime: d.teardownTime.toISOString(),
        placeId: d.placeId,
        placeOther: d.placeOther,
      }))));
      formData.append('equipmentItems', JSON.stringify(values.equipmentRequests));
      formData.append('attachmentsToKeep', JSON.stringify(attachmentsToKeep));
      for (const file of values.attachments) {
        formData.append('attachments', file);      // POST uses 'attachments'
        formData.append('newAttachments', file);   // PATCH uses 'newAttachments'
      }

      if (values.assignments && values.assignments.length > 0) {
        formData.append('assignments', JSON.stringify(
          values.assignments.map(a => ({
            userId: a.userId,
            dutyStart: a.dutyStart instanceof Date ? a.dutyStart.toISOString() : a.dutyStart,
            dutyEnd: a.dutyEnd instanceof Date ? a.dutyEnd.toISOString() : a.dutyEnd,
            dutyType: a.dutyType,
            notes: a.notes,
            isOvertime: a.isOvertime,
          }))
        ));
      }

      const method = draftId ? 'PATCH' : 'POST';
      const res = await fetch('/api/frf/reservation', { method, body: formData });
      const result = await res.json();
      if (res.ok) {
        mutateReservations();
        alert(draftId ? 'Draft updated!' : 'Draft saved!');
        handleModalClose();
      } else {
        alert(result.message || 'Failed to save draft');
      }
    } catch (err) {
      console.error('Save draft error:', err);
      alert('An error occurred while saving the draft');
    } finally {
      setPassLoading(false);
    }
  };

  const handleDeleteDraft = async (draftId: string) => {
    if (!confirm('Delete this draft? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/frf/reservation?id=${draftId}`, { method: 'DELETE' });
      const result = await res.json();
      if (res.ok) {
        mutateReservations();
        alert('Draft deleted');
      } else {
        alert(result.message || 'Failed to delete draft');
      }
    } catch (err) {
      console.error('Delete draft error:', err);
      alert('An error occurred');
    }
  };

  const handleModalClose = () => {
    close();
    setEditingReservation(null);
    setIsEditingMode(false);
    setIsRescheduleMode(false);
    setIsDraftMode(false);
    setStepperKey((k) => k + 1);
  };

  const handlePasswordSubmit = async (
    password: string,
    remarks: string,
    photos?: File[]
  ) => {
    if (!pendingAction) return;
    setPassLoading(true);
    setPassError('');
    try {
      const actionMap: Record<string, string> = {
        'PACKUP_DONE': 'packup-done',
        'OCM_FINALIZE': 'ocm-finalize',
        'ACKNOWLEDGE': 'acknowledge',
      };

      const actionName = actionMap[pendingAction.type] || pendingAction.type.toLowerCase();

      // 🆕 PACKUP_DONE → multipart (photos)
      if (pendingAction.type === 'PACKUP_DONE') {
        const formData = new FormData();
        formData.append('id', pendingAction.data.id as string);
        formData.append('action', 'packup-done');
        formData.append('password', password);
        formData.append('remarks', remarks);
        for (const file of photos || []) {
          formData.append('packUpPhotos', file);
        }

        const res = await fetch('/api/frf/reservation', {
          method: 'PATCH',
          body: formData,
        });

        const result = await res.json();
        if (res.ok) {
          mutateReservations();
          closePassModal();
          setPendingAction(null);
          if (detailOpened) closeDetail();
          alert('Pack Up Done recorded successfully!');
        } else {
          setPassError(result.message || 'Action failed');
        }
        return;
      }

      // Everything else → JSON
      const payload: {
        id: string;
        action: string;
        password: string;
        remarks: string;
        assignments?: ITOAssignment[];
        finalEditData?: OCMFinalEditData;
      } = {
        id: pendingAction.data.id as string,
        action: actionName,
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
      hasPhysicalActivity?: boolean;
      assignments?: ITOAssignment[];
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
        ...(data.hasPhysicalActivity !== undefined && { hasPhysicalActivity: data.hasPhysicalActivity }),
        ...(data.assignments && data.assignments.length > 0 && {
          assignments: data.assignments.map(a => ({
            userId: a.userId,
            dutyStart: a.dutyStart instanceof Date ? a.dutyStart.toISOString() : a.dutyStart,
            dutyEnd: a.dutyEnd instanceof Date ? a.dutyEnd.toISOString() : a.dutyEnd,
            dutyType: a.dutyType,
            notes: a.notes,
            isOvertime: a.isOvertime,
          })),
        }),
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
    if (focusedCardId === req.id) setFocusedCardId(null);
    setSelectedRequest(req);
    openDetail();
  };

  const tabOptions = useMemo(() => {
      const opts: { value: string; label: string }[] = [];

      // 🆕 HR Copy / All Requests tab
      if (isHRDorSuper) {
        const isAdminOrSuper = currentUser?.role === 'SuperUser' || currentUser?.role === 'Admin';
        const tabLabel = isAdminOrSuper
          ? `📋 All Requests (${hrCopyReservations.length})`
          : `📋 HR Copy — All Requests (${hrCopyReservations.length})`;
        opts.push({ value: 'hr_copy', label: tabLabel });
      }

      opts.push({ value: 'my_requests', label: `My Requests (${myRequests.length})` });
      opts.push({ value: 'pending_approval', label: `Pending Approval (${pendingApproval.length})` });
      opts.push({ value: 'for_acknowledgement', label: `For Acknowledgement (${acknowledgementQueue.length})` });
      opts.push({ value: 'action_board', label: `Action Board (${actionBoard.length})` });
      if (isITOMain) {
        opts.push({ value: 'assigned_to_me', label: `Assigned to Me (${assignedToMe.length})` });
      }
      opts.push({ value: 'completed', label: `Fully Approved / Rejected (${completed.length})` });
      opts.push({ value: 'imported', label: `Imported FRF (${importedFRFs.length})` });
      return opts;
    }, [
      isHRDorSuper,
      currentUser?.role,
      hrCopyReservations.length,
      myRequests.length,
      pendingApproval.length,
      acknowledgementQueue.length,
      actionBoard.length,
      assignedToMe.length,
      completed.length,
      isITOMain,
      importedFRFs.length
    ]);

  if (loading) {
    return <LoadingOverlay visible />;
  }

  // ---- Focus resolution (render-phase sync — no refs, no effect setState) ----

  // Reset state only when a NEW non-null focusId arrives. Do NOT clear when
  // focusId becomes null — that happens after URL cleanup, and the ring should persist.
  if (focusId !== lastFocusId) {
    setLastFocusId(focusId);
    if (focusId) {
      setFocusedCardId(null);
      setHandledFocusId(null);
    }
  }

  // Resolve once per focusId, after reservations + user are ready.
  if (
    focusId &&
    handledFocusId !== focusId &&
    reservations.length > 0 &&
    currentUser
  ) {
    const target = reservations.find((r) => r.id === focusId);
    if (target) {
      setHandledFocusId(focusId);
      setFocusedCardId(focusId);

      const tabLists: Record<string, FacilityReservation[]> = {
        hr_copy: hrCopyReservations,
        my_requests: myRequests,
        pending_approval: pendingApproval,
        for_acknowledgement: acknowledgementQueue,
        action_board: actionBoard,
        assigned_to_me: assignedToMe,
        completed: completed,
      };

      const currentList = tabLists[activeTab || ''] || [];
      if (!currentList.some((x) => x.id === target.id)) {
        const tabOrder: string[] = [
          ...(isHRDorSuper ? ['hr_copy'] : []),
          'my_requests',
          'pending_approval',
          ...(acknowledgementQueue.length > 0 ? ['for_acknowledgement'] : []),
          'action_board',
          ...(isITOMain ? ['assigned_to_me'] : []),
          'completed',
        ];
        const fallback = tabOrder.find((t) =>
          tabLists[t]?.some((x) => x.id === target.id),
        );
        if (fallback) setActiveTab(fallback);
      }
    }
  }

  const canManage = 
    currentUser?.role === 'SuperUser' ||
    (isHeadOrOIC && currentUser?.departmentCode === 'ITO-MAIN') ||
    currentUser?.departmentCode === 'PSMO/FMO' ||
    currentUser?.departmentCode === 'CDO';
  
  console.log("canmanageness? ", canManage);
  
  const visibleTabs = [
    ...(isHRDorSuper ? ['hr_copy'] : []),
    'my_requests',
    'pending_approval',
    'for_acknowledgement',
    'action_board',
    ...(isITOMain ? ['assigned_to_me'] : []),
    'completed',
    'imported',
  ];

  return (
    <Container fluid py="md">
      <Card withBorder radius="lg" p="lg" shadow="sm">
        <Group justify="space-between" align="center" mb="xl" wrap="wrap">
          <Stack gap={2}>
            <Title order={2} fw={800} style={{ fontSize: 'clamp(1.25rem, 4vw, 2rem)' }}>Facility Reservation Workspace</Title>
            <Group gap={6}>
              <Text size="xs" c="dimmed">Department:</Text>
              <Badge color="blue" variant="light" size="sm">{currentUser?.departmentCode || 'N/A'}</Badge>
              <Badge color="gray" variant="light" size="sm">{currentUser?.role || 'N/A'}</Badge>
            </Group>
          </Stack>
          <Group wrap="wrap">
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
            <Group justify="space-between" align="flex-end" wrap="wrap">
              <TextInput
                placeholder="Search by reference or place..."
                label="Search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.currentTarget.value)}
                style={{ flex: 1, minWidth: 200 }}
              />
            </Group>
          </Card>

          <ScrollArea style={{ height: 'calc(100vh - 320px)' }} type="auto">
            <Tabs value={activeTab} onChange={setActiveTab} radius="md" variant="pills">
              {isMobile ? (
                <Select
                  value={activeTab}
                  onChange={setActiveTab}
                  data={tabOptions}
                  mb="md"
                  size="sm"
                  comboboxProps={{ zIndex: 5000 }}
                  allowDeselect={false}
                />
              ) : (
              <Tabs.List mb="lg" style={{ overflowX: 'auto', flexWrap: 'nowrap' }}>
                {/* 🆕 HR Copy — ALL Requests (HR only) */}
                {isHRDorSuper && (
                  <Tabs.Tab value="hr_copy" leftSection={<IconCopy size={15} />}>
                    {(currentUser?.role === 'SuperUser' || currentUser?.role === 'Admin')
                      ? 'All Requests'
                      : 'HR Copy — All Requests'}{' '}
                    <Badge size="xs" variant="light" ml={6} styles={{ label: { fontSize: 10 } }}>
                      {hrCopyReservations.length}
                    </Badge>
                  </Tabs.Tab>
                )}

                <Tabs.Tab value="my_requests" leftSection={<IconSend size={15} />}>
                  My Requests <Badge size="xs" variant="light" ml={6}>{myRequests.length}</Badge>
                </Tabs.Tab>
                <Tabs.Tab value="pending_approval" leftSection={<IconInbox size={15} />}>
                  Pending Approval{' '}
                  <Badge size="xs" variant="light" ml={6} styles={{ label: { fontSize: 10 } }}>
                    {pendingApproval.length}
                  </Badge>
                </Tabs.Tab>
                <Tabs.Tab value="for_acknowledgement" leftSection={<IconCircleCheck size={15} />}>
                  For Acknowledgement{' '}
                  <Badge size="xs" variant="light" ml={6} styles={{ label: { fontSize: 10 } }}>
                    {acknowledgementQueue.length}
                  </Badge>
                </Tabs.Tab>
                <Tabs.Tab value="action_board" leftSection={<IconInfoCircle size={15} />}>
                  Action Board <Badge size="xs" variant="light" ml={6} styles={{ label: { fontSize: 10 } }}>
                    {actionBoard.length}
                  </Badge>
                </Tabs.Tab>
                {isITOMain && (
                  <Tabs.Tab value="assigned_to_me" leftSection={<IconUserCheck size={15} />}>
                    Assigned to Me <Badge size="xs" variant="light" ml={6} styles={{ label: { fontSize: 10 } }}>
                      {assignedToMe.length}
                    </Badge>
                  </Tabs.Tab>
                )}
                <Tabs.Tab value="completed" leftSection={<IconCircleCheck size={15} />}>
                  Fully Approved / Rejected<Badge size="xs" variant="light" ml={6} styles={{ label: { fontSize: 10 } }}>
                    {completed.length}
                  </Badge>
                </Tabs.Tab>
                <Tabs.Tab value="imported" leftSection={<IconFileImport size={15} />}>
                  Imported FRF <Badge size="xs" variant="light" ml={6} styles={{ label: { fontSize: 10 } }}>
                    {importedFRFs.length}
                  </Badge>
                </Tabs.Tab>
              </Tabs.List>
              )}

              {visibleTabs.map((tab) => {
                let list: FacilityReservation[] = [];
                if (tab === 'hr_copy') list = hrCopyReservations;
                else if (tab === 'my_requests') list = myRequests;
                else if (tab === 'pending_approval') list = pendingApproval;
                else if (tab === 'for_acknowledgement') list = acknowledgementQueue;
                else if (tab === 'action_board') list = actionBoard;
                else if (tab === 'assigned_to_me') list = assignedToMe;
                else if (tab === 'completed') list = completed;
                else if (tab === 'imported') list = importedFRFs;

                const filtered = getFiltered(list);

                const isAdminOrSuper = currentUser?.role === 'SuperUser' || currentUser?.role === 'Admin';

                const tabInfo: Record<string, { title: string; color: string; body: React.ReactNode }> = {
                  // 🆕 HR Copy — exclusive sa HR
                  hr_copy: {
                    title: isAdminOrSuper
                      ? 'All Requests (Admin / SuperUser View)'
                      : 'HR Copy — All Requests (Read-Only)',
                    color: 'blue',
                    body: isAdminOrSuper ? (
                      <>
                        A complete view of <b>every</b> facility reservation across all departments for administrative monitoring and oversight.
                        <br /><br />
                        Kumpletong view ng <b>lahat</b> ng facility reservation sa lahat ng departamento para sa pamamahala at pagsubaybay.
                      </>
                    ) : (
                      <>
                        A complete, read-only view of <b>every</b> facility reservation across all departments. HR
                        receives an automatic copy of each request but <b>does not approve</b> — this tab is purely
                        for visibility and record-keeping.
                        <br /><br />
                        Kumpletong read-only view ng <b>lahat</b> ng facility reservation sa lahat ng department.
                        Awtomatikong natatanggap ng HR ang kopya ng bawat request ngunit <b>hindi nag-a-approve</b> —
                        ang tab na ito ay para lamang sa visibility at record-keeping.
                      </>
                    ),
                  },
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
                        <b> Approve</b>, <b> Reject</b>, or <b> Return for Revision</b>. Informational-only
                        acknowledgements live in the <b>For Acknowledgement</b> tab.
                        <br /><br />
                        Mga request na naghihintay ng approval ng iyong departamento. Suriin ang detalye, at piliin ang
                        <b> Approve</b>, <b> Reject</b>, o <b> Return for Revision</b>. Ang informational-only
                        acknowledgements ay nasa <b>For Acknowledgement</b> tab.
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
                  for_acknowledgement: {
                    title: 'For Acknowledgement',
                    color: 'teal',
                    body: (
                      <>
                        Reservations where your department has been tagged as an <b>informational recipient</b>.
                        You can acknowledge at any time — this is independent of the approval chain and does not
                        gate the reservation&apos;s completion.
                        <br /><br />
                        Mga reservation kung saan ang iyong departamento ay <b>informational recipient</b>.
                        Maaari kang mag-acknowledge anumang oras — ito ay hiwalay sa approval chain at hindi
                        naghihintay sa mga approval steps.
                      </>
                    ),
                  },
                  assigned_to_me: {
                    title: 'Assigned to Me',
                    color: 'teal',
                    body: (
                      <>
                        Completed reservations where you are assigned as ITO staff for OT rendering.
                        Check your schedule and event details here. Once the event is over, click
                        <b> Pack Up Done</b> in the request details to finalize it.
                        <br /><br />
                        Mga kumpletong reservation kung saan ikaw ay nakatalagang ITO staff para sa OT rendering.
                        Tingnan ang iyong iskedyul at detalye ng event dito. Kapag tapos na ang event, i-click ang
                        <b> Pack Up Done</b> sa detalye ng request para maisara na ito.
                      </>
                    ),
                  },
                  completed: {
                    title: 'Fully Approved / Rejected',
                    color: 'gray',
                    body: (
                      <>
                        Finalized reservations — either fully approved and packed up (Completed) or rejected.
                        Only requests you are involved in are shown here. (For HRD Department, this includes requests that have been noted.)
                        <br /><br />
                        Mga natapos na reservation — alinman sa tuluyang naaprubahan at na-pack up (Completed) o
                        tinanggihan (Rejected). Mga request na may kinalaman ka lamang ang ipinapakita rito. (Para sa HRD Department, kasama rito ang mga request na na-noted na.)
                      </>
                    ),
                  },
                  imported: {
                    title: 'Imported FRF Records',
                    color: 'violet',
                    body: (
                      <>
                        These are facility reservations restored from a JSON backup file. They have an
                        <b> IMPORT-</b> prefix in their reference ID. Imported records are read-only —
                        they cannot be approved, rejected, reassigned, or rescheduled. For archival
                        viewing and printing only.
                        <br /><br />
                        Ang mga ito ay mga facility reservation na naibalik mula sa isang JSON backup file.
                        Mayroon silang <b>IMPORT-</b> na prefix sa kanilang reference ID. Ang mga imported
                        na record ay read-only — hindi sila maaaring aprubahan, tanggihan, i-reassign, o
                        i-reschedule. Para lamang sa archival viewing at pag-print.
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
                      <Text c="dimmed" ta="center" py="xl">
                        {tab === 'for_acknowledgement'
                          ? acknowledgementQueue.length === 0
                            ? "You're all caught up. No pending acknowledgements."
                            : 'No reservations match your search.'
                          : 'No reservations found.'}
                      </Text>
                    ) : (
                      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
                        {filtered.map((req) => (
                          <RequestCard
                            key={req.id}
                            request={req}
                            currentUser={currentUser}
                            isFocused={req.id === focusedCardId}
                            isReadOnly={isImportedFRF(req)} 
                            onView={() => openDetailModal(req)}
                            onAssign={() => {
                              closeDetail();
                              setAssignmentMode('assign');
                              handleOpenItoModal();
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
        key={`stepper-${stepperKey}`}
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
        isDraftMode={isDraftMode} 
        onResubmit={handleResubmit}
        onReschedule={handleReschedule}
        onSaveDraft={handleSaveDraft} 
      />

      <RequestDetailModal
        opened={detailOpened}
        onClose={closeDetail}
        request={selectedRequest}
        currentUser={currentUser}
        isReadOnly={
          selectedRequest?.referenceId?.startsWith('IMPORT-') ?? false
        }  
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
        onPackUpDone={(id) => handleAction('PACKUP_DONE', { id })}
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
        requireRemarks={['REJECT', 'RETURN', 'APPROVE', 'PACKUP_DONE', 'ACKNOWLEDGE'].includes(pendingAction?.type || '')}
        enablePhotoUpload={pendingAction?.type === 'PACKUP_DONE'}
      />

      <ITOAssignmentModal
        key={`ito-${itoModalKey}`}
        opened={itoModalOpened}
        onClose={() => {
          closeItoModal();
          setAssignmentData(null);
        }}
        request={selectedRequest}
        currentUser={currentUser}
        onConfirm={handleAssignConfirm}
        loading={passLoading}
        mode={assignmentMode}
      />

      <OCMFinalEditModal
        key={`ocm-${selectedRequest?.id ?? 'empty'}`}
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