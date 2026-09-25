// app/dashboard/forms/frf/components/RequestDetailModal.tsx
'use client';

import {
  Modal,
  Stack,
  Group,
  Badge,
  Text,
  Divider,
  Button,
  Paper,
  SimpleGrid,
  ThemeIcon,
  Anchor,
  Alert,
  Box,
  Table
} from '@mantine/core';
import { FacilityReservation, UserContext, FRFActionType, isActiveHeadOrOIC, FacilityApproval } from './types';
import ApprovalTimeline from './approvalTimeline';
import {
  IconCheck,
  IconX,
  IconRefresh,
  IconCalendarEvent,
  IconUsers,
  IconMapPin,
  IconClock,
  IconDeviceFloppy,
  IconFile,
  IconPhoto,
  IconFileTypePdf,
  IconAlertCircle,
  IconUserCheck,
  IconInfoCircle,
  IconPrinter,
  IconSchool,
  IconReportMoney,
  IconBuildingPavilion
} from '@tabler/icons-react';
import Image from 'next/image';
import { useState } from 'react';
import { useDisclosure } from '@mantine/hooks';

interface RequestDetailModalProps {
  opened: boolean;
  onClose: () => void;
  request: FacilityReservation | null;
  currentUser: UserContext | null;
  onAction: (type: FRFActionType, data: Record<string, unknown>) => void;
  onAssign: () => void;
  onFinalize: () => void;
  onApproveWithAssign?: () => void;
  onPrint?: (request: FacilityReservation) => void;
  onPackUpDone?: (id: string) => void;
}

// Helper to get color per department
const getDepartmentColor = (deptCode: string): string => {
  const colors: Record<string, string> = {
    'PSMO/FMO': 'blue',
    'ITO-MAIN': 'grape',
    'ITO': 'grape',
    'OP': 'green',
    'OSA': 'orange',
    'OCM': 'teal',
    'SAFETY-SECURITY': 'red',
    'HRD': 'pink',
    'ACAD': 'indigo',
  };
  return colors[deptCode] || 'gray';
};

export default function RequestDetailModal({
  opened,
  onClose,
  request,
  currentUser,
  onAction,
  onAssign,
  onFinalize,
  onApproveWithAssign,
  onPrint,
  onPackUpDone,
}: RequestDetailModalProps) {

  const [packUpGalleryOpened, { open: openPackUpGallery, close: closePackUpGallery }] = useDisclosure(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  if (!request) return null;

  const isRejected = request.status === 'REJECTED';
  const isCompleted = request.status === 'COMPLETED';
  const isTerminal = isRejected;

  const myApproval = request.approvals.find((a) => a.departmentCode === currentUser?.departmentCode);
  const isHRD = currentUser?.departmentCode === 'HRD';
  const ocmApproval = request.approvals.find(a => a.departmentCode === 'OCM');
  
  const isHeadOrOIC = isActiveHeadOrOIC(currentUser);

  // Determine if this user is the next pending approver
  const hasEarlierPending = myApproval
    ? request.approvals.some(a => a.stepOrder < myApproval.stepOrder && a.status === 'PENDING')
    : false;
  const isNextPending = myApproval?.status === 'PENDING' && !hasEarlierPending;

  const canNoteOCM = isNextPending && (ocmApproval?.status === 'PENDING' || ocmApproval?.status === 'ACKNOWLEDGED');

  const isReschedulePending = request.status === 'RESCHEDULE_PENDING';

  // Non‑HRD actions
  const canApprove = !isHRD && !isTerminal && myApproval?.status === 'PENDING' && isHeadOrOIC;
  const canReject = !isHRD && !isTerminal && myApproval?.status === 'PENDING' && isHeadOrOIC;
  const canReturn =
    !isHRD &&
    !isTerminal &&
    myApproval?.status === 'PENDING' && isHeadOrOIC;
  
  const isVenueOnly = request.isVenueOnly;

  const canAssign =
    !isTerminal &&
    !isVenueOnly &&
    !request.isReschedule && // use 'request' not 'reservation'
    currentUser?.departmentCode === 'ITO-MAIN' &&
    request.status === 'APPROVED' &&
    request.assignments.length === 0;

  const canFinalize =
    !isTerminal &&
    currentUser?.departmentCode === 'OCM' &&
    (request.status === 'APPROVED' || request.status === 'COMPLETED');

  const isRequestor = request.requestorId === currentUser?.id;
  const canResubmit =
    !isTerminal &&
    request.status === 'REVISION_REQUESTED' &&
    isRequestor;

  const isITO = currentUser?.departmentCode === 'ITO-MAIN';

  // HRD "Noted" – kahit COMPLETED, available ito
  const hrdApproval = request.approvals.find(a => a.departmentCode === 'HRD');

  const isAlreadyNoted =
    hrdApproval?.status === 'ACKNOWLEDGED' &&
    !!hrdApproval?.remarks?.includes('Noted by');
  
  const isAwaitingStaffChange = !!request.staffChangeRequestedAt;

  const canNote =
    !isVenueOnly &&
    isHRD &&
    hrdApproval &&
    (hrdApproval.status === 'ACKNOWLEDGED' || hrdApproval.status === 'PENDING') &&
    !hrdApproval.remarks?.includes('Noted by') &&
    !isAwaitingStaffChange;
    
  const hasAnyAction =
    canApprove || canReject || canReturn || canAssign || canFinalize || canResubmit || canNote;

  const showActions =
    (isNextPending && !isTerminal) ||
    (isRequestor && request.status === 'REVISION_REQUESTED') ||
    (isRequestor && (request.status === 'APPROVED' || request.status === 'COMPLETED') && !request.isReschedule) ||
    canNote ||
    (isHRD && isCompleted && !isAwaitingStaffChange && !request.staffChangeRequestedAt);

  // Formatting helpers
  const formatDate = (dateVal: string | Date): string => {
    if (!dateVal) return 'N/A';
    const d = typeof dateVal === 'string' ? new Date(dateVal) : dateVal;
    return d.toLocaleString('en-US', {
      timeZone: 'Asia/Manila',
    });
  };

  const formatDateOnly = (dateVal: string | Date): string => {
    if (!dateVal) return 'N/A';
    const d = typeof dateVal === 'string' ? new Date(dateVal) : dateVal;
    return d.toLocaleDateString('en-US', {
      timeZone: 'Asia/Manila',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTimeOnly = (dateVal: string | Date): string => {
    if (!dateVal) return 'N/A';
    const d = typeof dateVal === 'string' ? new Date(dateVal) : dateVal;
    return d.toLocaleTimeString('en-US', {
      timeZone: 'Asia/Manila',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const dates = request.dates || [];
  const assignments = request.assignments || [];
  // If the reservation is a pending reschedule, map assignments to the new dates
  let displayAssignments = assignments;
  if (request.isReschedule && request.status === 'RESCHEDULE_PENDING' && request.dates.length > 0) {
    const newDates = request.dates;
    displayAssignments = assignments.map((ass, index) => {
      const dateIndex = index % newDates.length;
      const newDateObj = new Date(newDates[dateIndex].eventStart); // or .date
      const oldStart = new Date(ass.dutyStart);
      const oldEnd = new Date(ass.dutyEnd);
      const newStart = new Date(newDateObj);
      newStart.setHours(oldStart.getHours(), oldStart.getMinutes(), 0, 0);
      const newEnd = new Date(newDateObj);
      newEnd.setHours(oldEnd.getHours(), oldEnd.getMinutes(), 0, 0);
      return {
        ...ass,
        dutyStart: newStart.toISOString(),
        dutyEnd: newEnd.toISOString(),
      };
    });
  }

  const canReschedule =
    (request.status === 'APPROVED' || request.status === 'COMPLETED') &&
    isRequestor &&
    !request.isReschedule;
  
  const isPackUpDone = !!request.packUpDoneAt;

  const isUserAssignedToEvent = request.assignments.some(
    (a) => a.userId === currentUser?.id
  );

  const isITOHeadOrOIC =
  currentUser?.departmentCode === 'ITO-MAIN' && isHeadOrOIC;

  // Latest event end across all dates
  const latestEventEnd = (request.dates || []).reduce((latest, d) => {
    const end = new Date(d.eventEnd);
    return end > latest ? end : latest;
  }, new Date(0));

  const isEventEnded = new Date() >= latestEventEnd;

  const canPackUpDone =
    !isTerminal &&
    !isPackUpDone &&
    isEventEnded &&
    request.status === 'COMPLETED' &&
    (isUserAssignedToEvent ||
      isITOHeadOrOIC ||
      currentUser?.role === 'SuperUser');

  return (
  <>
    <Modal
      opened={opened}
      onClose={onClose}
      size="80%"
      title={`Reservation ${request.referenceId}`}
      padding="lg"
      radius="md"
      zIndex={100}
    >
      <Stack gap="lg">
        {/* Header: Status & Dates */}
        <Group justify="space-between">
          <Group gap="xs">
            <Badge
              size="lg"
              color={
                request.status === 'PENDING_APPROVAL'
                  ? 'orange'
                  : request.status === 'APPROVED'
                  ? 'green'
                  : request.status === 'REJECTED'
                  ? 'red'
                  : request.status === 'COMPLETED'
                  ? 'blue'
                  : 'gray'
              }
            >
              {request.status.replace('_', ' ')}
            </Badge>
            {request.isVenueOnly && (
              <Badge color="gray" size="lg" variant="outline">
                Venue Only
              </Badge>
            )}
          </Group>
          <Text size="sm" c="dimmed">
            Created: {formatDate(request.createdAt)}
          </Text>
        </Group>

        {/* Basic Details */}
        <Paper withBorder p="md" radius="md">
          <Text fw={600} size="sm" mb="sm">
            Event Details
          </Text>
          <Text size="sm" mb="xs">
            <b>Event Name / Activity:</b> {request.eventName}
          </Text>
          <Text size="sm" mb="xs">
            <b>Requestor (Focal Person):</b> {request.requestorDept} – {request.requestor?.fname} {request.requestor?.lname} ({request.requestor?.email})
          </Text>
          <SimpleGrid cols={2} spacing="xs" verticalSpacing="xs">
            <Group gap="xs">
              <ThemeIcon variant="light" color="blue" size="sm">
                <IconCalendarEvent size={14} />
              </ThemeIcon>
              <Text size="sm">
                <b>Type:</b> {request.type.replace('_', ' ')}
              </Text>
            </Group>
            <Group gap="xs">
              <ThemeIcon variant="light" color="blue" size="sm">
                <IconUsers size={14} />
              </ThemeIcon>
              <Text size="sm">
                <b>Attendees:</b> {request.attendeesCount}
              </Text>
            </Group>
            {request.usageHours && (
              <Group gap="xs">
                <ThemeIcon variant="light" color="blue" size="sm">
                  <IconDeviceFloppy size={14} />
                </ThemeIcon>
                <Text size="sm">
                  <b>Usage Hours:</b> {request.usageHours}
                </Text>
              </Group>
            )}
            <Group gap="xs">
              <ThemeIcon variant="light" color="blue" size="sm">
                <IconReportMoney size={14} />
              </ThemeIcon>
              <Text size="sm">
                <b>With Charge:</b> {request.withCharge ? 'Yes' : 'No'}
              </Text>
            </Group>
            <Group gap="xs">
              <ThemeIcon variant="light" color="blue" size="sm">
                <IconBuildingPavilion size={14} />
              </ThemeIcon>
              <Text size="sm">
                <b>Venue Only:</b> {request.isVenueOnly ? 'Yes' : 'No'}
              </Text>
            </Group>
          </SimpleGrid>
          {request.requestorNotes && (
            <Text
              size="sm"
              c="dimmed"
              mt="sm"
              style={{ borderLeft: '3px solid var(--mantine-color-blue-3)', paddingLeft: 10 }}
            >
              <b>{request.isReschedule ? 'Reschedule Reason:' : 'Notes:'}</b> {request.requestorNotes}
            </Text>
          )}
        </Paper>

        {request.staffChangeRequestedAt && isITOHeadOrOIC && (
          <Alert color="pink" title="Staff Change Requested" icon={<IconInfoCircle size={16} />}>
            HRD has requested a staff change on {formatDate(request.staffChangeRequestedAt)}.
            {request.staffChangeReason && (
              <Text size="xs" mt={4}><b>Reason:</b> {request.staffChangeReason}</Text>
            )}
            {isITOHeadOrOIC && ' Please update the staff assignments.'}
          </Alert>
        )}

        {/* 🆕 Alert para sa HRD habang naghihintay */}
        {isHRD && isAwaitingStaffChange && (
          <Alert
            color="orange"
            title="Awaiting Staff Change"
            icon={<IconClock size={16} />}
          >
            <Stack gap={4}>
              <Text size="sm">
                You have requested a staff change on{' '}
                <b>{formatDate(request.staffChangeRequestedAt!)}</b>.
                Waiting for <b>ITO-MAIN</b> to update the staff assignments.
              </Text>
              {request.staffChangeReason && (
                <Text size="xs" c="dimmed">
                  <b>Reason:</b> {request.staffChangeReason}
                </Text>
              )}
              <Text size="xs" c="orange" fw={600}>
                You cannot mark the OT as Noted until ITO-MAIN submits the new staff lineup.
              </Text>
            </Stack>
          </Alert>
        )}

        {/* Event Dates Section */}
        <Paper withBorder p="md" radius="md">
          <Group gap="xs" mb="sm">
            <ThemeIcon variant="light" color="blue" size="sm">
              <IconCalendarEvent size={14} />
            </ThemeIcon>
            <Text fw={600} size="sm">
              Event Dates {dates.length > 1 && `(${dates.length} dates)`}
            </Text>
          </Group>

          {dates.length === 0 ? (
            <Text size="sm" c="dimmed">No dates specified.</Text>
          ) : (
            <Stack gap="sm">
              {dates.map((dateEntry, index) => (
                <Box
                  key={dateEntry.id || index}
                  p="xs"
                  style={{
                    borderLeft: '3px solid var(--mantine-color-blue-3)',
                    paddingLeft: 10,
                    borderRadius: '4px',
                  }}
                >
                  <Group gap="xs" mb={2}>
                    <Badge size="xs" color="blue" variant="light">
                      Date {index + 1}
                    </Badge>
                    <Text size="xs" c="dimmed">
                      {formatDateOnly(dateEntry.eventStart)}
                    </Text>
                  </Group>
                  <SimpleGrid cols={2} spacing="xs" verticalSpacing={2}>
                    <Text size="xs">
                      <b>Starting Time:</b> {formatTimeOnly(dateEntry.setupTime)}
                    </Text>
                    <Text size="xs">
                      <b>Event:</b> {formatTimeOnly(dateEntry.eventStart)} – {formatTimeOnly(dateEntry.eventEnd)}
                    </Text>
                    <Text size="xs">
                      <b>Actual Time End:</b> {formatTimeOnly(dateEntry.teardownTime)}
                    </Text>
                    <Text size="xs">
                      <b>Place:</b> {dateEntry.place?.name || dateEntry.placeOther || 'N/A'}
                    </Text>
                  </SimpleGrid>
                </Box>
              ))}
            </Stack>
          )}
        </Paper>

        {/* Equipment Section */}
        <Paper withBorder p="md" radius="md">
          <Text fw={600} size="sm" mb="sm">
            Equipment
          </Text>
          {request.equipmentRequests.length === 0 ? (
            <Text size="sm" c="dimmed">None</Text>
          ) : (
            <Group gap="xs">
              {request.equipmentRequests.map((eq) => {
                const dept = eq.equipment.departmentCode;
                const color = getDepartmentColor(dept);
                return (
                  <Badge key={eq.id} color={color} variant="filled" size="md">
                    {eq.equipment.name} x {eq.quantityRequested} ({dept})
                  </Badge>
                );
              })}
            </Group>
          )}
        </Paper>

        {/* Attachments */}
        <Paper withBorder p="md" radius="md">
          <Text fw={600} size="sm" mb="sm">
            Attachment/s
          </Text>
          {request.attachments.length === 0 ? (
            <Text size="sm" c="dimmed" fs="italic">No attachments</Text>
          ) : (
            <Stack gap="xs">
              {request.attachments.map((path, i) => {
                const fileName = path.split('/').pop() || `Attachment ${i + 1}`;
                const ext = fileName.split('.').pop()?.toLowerCase();
                const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '');
                const isPdf = ext === 'pdf';
                
                const icon = isImage ? <IconPhoto size={18} /> : isPdf ? <IconFileTypePdf size={18} /> : <IconFile size={18} />;
                const color = isImage ? 'grape' : isPdf ? 'red' : 'gray';

                return (
                  <Paper
                    key={i}
                    component="a"
                    href={path}
                    target="_blank"
                    withBorder
                    p="xs"
                    radius="sm"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      textDecoration: 'none',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateX(4px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateX(0)';
                    }}
                  >
                    <ThemeIcon color={color} variant="light" size="sm">
                      {icon}
                    </ThemeIcon>
                    <Text size="sm" fw={500} style={{ flex: 1 }}>
                      {fileName}
                    </Text>
                    <Text size="xs" c="dimmed" style={{ marginLeft: 'auto' }}>
                      ↗
                    </Text>
                  </Paper>
                );
              })}
            </Stack>
          )}
        </Paper>

        {/* Approval Timeline */}
        <Paper withBorder p="md" radius="md">
          <Text fw={600} size="sm" mb="sm">
            Approval Flow
          </Text>
          <ApprovalTimeline
            approvals={request.approvals}
            requestorDept={request.requestorDept}
            isReschedule={request.isReschedule}
            originalApprovals={request.originalApprovals}
          />
        </Paper>

        {/* ITO Staff Assignments */}
        {displayAssignments.length > 0 && (
          <Paper withBorder p="md" radius="md">
            {isHRD && (
              <Alert
                icon={<IconInfoCircle size={16} />}
                color="blue"
                mb="sm"
                title="HRD – ITO Staff for Noting"
              >
                {request.isReschedule && (
                  <>
                    <strong>⚠️ Reminder:</strong> This is a reschedule of an event that has been moved to a new schedule/venue. Please note the ITO staff assignments for the new dates (if the date of event was changed).
                    <br /><br />
                  </>
                )}
                Below is the list of <b>all ITO staff</b> assigned to this event. Duties marked with an{' '}
                <b>OT badge</b> are rendered <b>outside regular working hours</b> (overtime). Duties{' '}
                <b>without an OT mark</b> are rendered within regular duty hours. Please review and click <strong>&ldquo;Noted&rdquo;</strong> to confirm.
                <br /><br />
                Ito ang listahan ng <b>lahat ng ITO staff</b> na nakatalaga sa event na ito. Ang mga duty na may{' '}
                <b>OT badge</b> ay ginawa <b>lampas sa regular working hours</b> (overtime). Ang mga duty na{' '}
                <b>walang OT mark</b> ay ginawa sa loob ng regular duty hours. Suriin ang listahan at pindutin ang <strong>&ldquo;Noted&rdquo;</strong> upang makumpirma na na-note na ng departamento nyo ito.
              </Alert>
            )}
            <Group gap="xs" mb="sm">
              <ThemeIcon variant="light" color="grape" size="sm">
                <IconUserCheck size={14} />
              </ThemeIcon>
              <Text fw={600} size="sm">ITO Staff | Event Duty Line-up</Text>
              {request.isReschedule && request.status === 'RESCHEDULE_PENDING' && (
                <Badge color="yellow" size="sm">Proposed Assignments (Pending Approval)</Badge>
              )}
            </Group>

            <Table withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Date</Table.Th>
                  <Table.Th>Staff</Table.Th>
                  <Table.Th>Duty Type</Table.Th>
                  <Table.Th ta="center">OT?</Table.Th>
                  <Table.Th>Start</Table.Th>
                  <Table.Th>End</Table.Th>
                  <Table.Th>Notes</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {displayAssignments.map((ass) => {
                  const dateStr = formatDateOnly(ass.dutyStart);
                  return (
                    <Table.Tr key={ass.id}>
                      <Table.Td>{dateStr}</Table.Td>
                      <Table.Td>{ass.user.fname} {ass.user.lname}</Table.Td>
                      <Table.Td>
                        <Badge
                          color={ass.dutyType === 'SETUP' ? 'blue' : ass.dutyType === 'TEARDOWN' ? 'orange' : 'grape'}
                          size="sm"
                        >
                          {ass.dutyType === 'TEARDOWN' ? 'PACK-UP' : ass.dutyType}
                        </Badge>
                      </Table.Td>
                      <Table.Td ta="center">
                        {ass.isOvertime ? (
                          <Badge color="green" variant="filled" size="sm">OT</Badge>
                        ) : (
                          <Text size="xs" c="dimmed">—</Text>
                        )}
                      </Table.Td>
                      <Table.Td>{formatTimeOnly(ass.dutyStart)}</Table.Td>
                      <Table.Td>{formatTimeOnly(ass.dutyEnd)}</Table.Td>
                      <Table.Td>
                        <Text size="xs" c="dimmed" style={{ whiteSpace: 'pre-wrap' }}>
                          {ass.notes || '—'}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Paper>
        )}

        {/* ======== Actions Section ======== */}
        <Divider />

        {isRejected ? (
          <Alert
            icon={<IconAlertCircle size={16} />}
            color="red"
            title="Reservation Rejected"
          >
            This reservation has been rejected and cannot be modified.
          </Alert>
        ) : (
          <>
            {isCompleted && (
              <Alert
                icon={<IconAlertCircle size={16} />}
                color="blue"
                title="Reservation Completed"
                mb="md"
              >
                This reservation has been completely approved and is now archived.
                {canNote && ' Please note the OT staff assignments below.'}
              </Alert>
            )}

                        {isPackUpDone && (
              <Alert
                icon={<IconCheck size={16} />}
                color="teal"
                title="Pack Up Done"
                mb="md"
              >
                This event has been marked as packed up on{' '}
                <b>{formatDateOnly(request.packUpDoneAt!)} at {formatTimeOnly(request.packUpDoneAt!)}</b>
                {request.packUpDoneBy && (
                  <>
                    {' '}by <b>{request.packUpDoneBy.fname} {request.packUpDoneBy.lname} ({request.packUpDoneBy.departmentCode})</b>
                  </>
                )}.
                Equipment quantities have been restored.
                {request.packUpDoneNotes && (
                  <Text size="xs" mt={4} c="dimmed">
                    <b>Notes:</b> {request.packUpDoneNotes}
                  </Text>
                )}

                {request.packUpDonePhotos && request.packUpDonePhotos.length > 0 && (
                  <Box mt="md">
                    <Button
                      variant="filled"
                      color="teal"
                      size="xs"
                      leftSection={<IconPhoto size={14} />}
                      onClick={openPackUpGallery}
                    >
                      View Pack Up Photos ({request.packUpDonePhotos.length})
                    </Button>
                  </Box>
                )}
              </Alert>
            )}

            <Group justify="flex-end" gap="xs" wrap="wrap">
              {showActions  && (
                <>
                  {!isTerminal && canApprove && (
                    <>
                      {isITO ? (
                        <Button
                          color="green"
                          leftSection={<IconCheck size={16} />}
                          onClick={onApproveWithAssign}
                        >
                          {request.isReschedule ? 'Review & Approve Reschedule' : 'Assign Staff & Approve'}
                        </Button>
                      ) : (
                        <Button
                          color="green"
                          leftSection={<IconCheck size={16} />}
                          onClick={() => onAction('APPROVE', { id: request.id })}
                        >
                          Approve
                        </Button>
                      )}
                    </>
                  )}

                  {!isTerminal && canReject && (
                    <Button
                      color="red"
                      leftSection={<IconX size={16} />}
                      onClick={() => onAction('REJECT', { id: request.id })}
                    >
                      Reject
                    </Button>
                  )}

                  {!isTerminal && canReturn && (
                    <Button
                      color="orange"
                      leftSection={<IconRefresh size={16} />}
                      onClick={() => onAction('RETURN', { id: request.id })}
                    >
                      Return for Revision
                    </Button>
                  )}

                  {!isTerminal && canAssign && (
                    <Button color="indigo" onClick={onAssign}>
                      Assign ITO Staff
                    </Button>
                  )}

                  {!isTerminal && canFinalize && (
                    <Button color="blue" onClick={onFinalize}>
                      OCM Final Edit
                    </Button>
                  )}

                  {!isTerminal && canResubmit && (
                    <Button
                      color="teal"
                      leftSection={<IconRefresh size={16} />}
                      onClick={() => onAction('RESUBMIT', { id: request.id })}
                    >
                      Revise Request
                    </Button>
                  )}

                  {(canNote) && (
                    <Button
                      color="blue"
                      leftSection={<IconCheck size={16} />}
                      onClick={() => onAction('NOTE', { id: request.id })}
                    >
                      Noted
                    </Button>
                  )}

                  {/* HRD: Request Staff Change — hindi na lumalabas kapag na-noted na */}
                  {isHRD && isHeadOrOIC && isCompleted && !isAlreadyNoted && !request.staffChangeRequestedAt && (
                    <Button
                      color="pink"
                      leftSection={<IconUsers size={16} />}
                      onClick={() => onAction('REQUEST_STAFF_CHANGE', { id: request.id })}
                    >
                      Request Staff Change
                    </Button>
                  )}

                  {canReschedule && (
                    <Button
                      color="yellow"
                      leftSection={<IconCalendarEvent size={16} />}
                      onClick={() => onAction('RESCHEDULE', { id: request.id })}
                    >
                      Request Reschedule
                    </Button>
                  )}
                </>
              )}

              {isITOHeadOrOIC && request.staffChangeRequestedAt && (
                <Button color="indigo" onClick={onAssign}>
                  Edit Staff Assignment
                </Button>
              )}

              {canPackUpDone && (
                <Button
                  color="teal"
                  leftSection={<IconCheck size={16} />}
                  onClick={() => onPackUpDone?.(request.id)}
                >
                  Pack Up Done
                </Button>
              )}

              <Button
                color="gray"
                leftSection={<IconPrinter size={16} />}
                onClick={() => onPrint?.(request)}
              >
                Print FRF
              </Button>

              <Button variant="light" onClick={onClose}>
                Close
              </Button>
            </Group>
          </>
        )}
      </Stack>
    </Modal>

    {/* 🆕 Pack Up Photos Gallery Modal */}
    <Modal
      opened={packUpGalleryOpened}
      onClose={closePackUpGallery}
      title={`Pack Up Photos (${request.packUpDonePhotos?.length || 0})`}
      size="xl"
      centered
      zIndex={200}
    >
      {request.packUpDonePhotos && request.packUpDonePhotos.length > 0 && (
        <Stack gap="md">
          {/* Main large preview */}
          <Box
            style={{
              width: '100%',
              height: 500,
              backgroundColor: 'var(--mantine-color-gray-0)',
              borderRadius: 8,
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <Image
              src={request.packUpDonePhotos[activePhotoIndex]}
              alt={`Pack up photo ${activePhotoIndex + 1}`}
              fill
              unoptimized
              sizes="100vw"
              style={{ objectFit: 'contain' }}
            />
          </Box>

          {/* Thumbnail strip (only if more than 1 photo) */}
          {request.packUpDonePhotos.length > 1 && (
            <SimpleGrid cols={{ base: 4, sm: 5, md: 6 }} spacing="xs">
              {request.packUpDonePhotos.map((url, i) => (
                <Paper
                  key={i}
                  withBorder
                  radius="sm"
                  style={{
                    cursor: 'pointer',
                    overflow: 'hidden',
                    aspectRatio: '4/3',
                    position: 'relative',
                    borderColor:
                      i === activePhotoIndex
                        ? 'var(--mantine-color-teal-5)'
                        : undefined,
                    borderWidth: i === activePhotoIndex ? 2 : 1,
                  }}
                  onClick={() => setActivePhotoIndex(i)}
                >
                  <Image
                    src={url}
                    alt={`Thumbnail ${i + 1}`}
                    fill
                    unoptimized
                    sizes="(max-width: 768px) 25vw, 16vw"
                    style={{ objectFit: 'cover' }}
                  />
                </Paper>
              ))}
            </SimpleGrid>
          )}

          {/* Action buttons */}
          <Group justify="space-between">
            <Button
              variant="light"
              color="gray"
              component="a"
              href={request.packUpDonePhotos[activePhotoIndex]}
              target="_blank"
              leftSection={<IconPhoto size={14} />}
            >
              Open in new tab
            </Button>
            <Button variant="light" onClick={closePackUpGallery}>
              Close
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  </>
);
}