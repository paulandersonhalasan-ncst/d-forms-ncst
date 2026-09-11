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
  IconReportMoney
} from '@tabler/icons-react';

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
}: RequestDetailModalProps) {
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
  
  const canNote =
    !isVenueOnly &&
    isHRD &&
    hrdApproval &&
    (hrdApproval.status === 'ACKNOWLEDGED' || hrdApproval.status === 'PENDING') &&
    !hrdApproval.remarks?.includes('Noted by');
    
  const hasAnyAction =
    canApprove || canReject || canReturn || canAssign || canFinalize || canResubmit || canNote;

  const showActions =
    (isNextPending && !isTerminal) ||
    (isRequestor && request.status === 'REVISION_REQUESTED') ||
    (isRequestor && (request.status === 'APPROVED' || request.status === 'COMPLETED') && !request.isReschedule) ||
    canNote;

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

  return (
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
            <b>Requestor:</b> {request.requestorDept} – {request.requestor?.fname} {request.requestor?.lname} ({request.requestor?.email})
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
                title="HRD – Overtime Staff for Noting"
              >
                {request.isReschedule && (
                  <>
                    <strong>⚠️ Reminder:</strong> This is a reschedule of an event that has been moved to a new schedule/venue. Please note the OT staff assignments for the new dates (if the date of event was changed).
                    <br /><br />
                  </>
                )}
                This is a copy of the ITO staff assignments for OT noting purposes as the following personnel will render an overtime in mentioned date/s above to provide necessary assistance for event/s written in this request.
                Please review the list below and click <strong>&ldquo;Noted&ldquo;</strong> to confirm.
                <br /><br />
                Ito ay kopya at listahan ng mga ITO staff na nakatalaga sa mga petsa at oras na nabanggit sa taas dahil sila ay magre-render ng kanilang overtime para mag bigay ng teknikal na tulong para sa pag se-setup at pagliligpit sa events na nakasaad sa request na ito. Suriin at pindutin ang <strong>&ldquo;Noted&ldquo;</strong> upang makumpirma na na-note na ng departamento nyo ito.
              </Alert>
            )}
            <Group gap="xs" mb="sm">
              <ThemeIcon variant="light" color="grape" size="sm">
                <IconUserCheck size={14} />
              </ThemeIcon>
              <Text fw={600} size="sm">ITO Staff | OT Renders</Text>
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
                This reservation has been completed and is now archived.
                {canNote && ' Please note the OT staff assignments below.'}
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
  );
}