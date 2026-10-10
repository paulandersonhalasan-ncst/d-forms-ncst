// app/dashboard/forms/frf/components/RequestCard.tsx
'use client';

import { Card, Group, Text, Badge, Stack, UnstyledButton} from '@mantine/core';
import { FacilityReservation, UserContext, FRFActionType, isActiveHeadOrOIC  } from './types';

interface RequestCardProps {
  request: FacilityReservation;
  currentUser: UserContext | null;
  onView: () => void;
  onAssign?: () => void;
  onFinalize?: () => void;
  onAction: (type: FRFActionType, data: Record<string, unknown>) => void;
}

export default function RequestCard({
  request,
  currentUser,
  onView,
  onAssign,
  onFinalize,
  onAction,
}: RequestCardProps) {
  const myApproval = request.approvals.find((a) => a.departmentCode === currentUser?.departmentCode);
  const isHeadOrOIC = isActiveHeadOrOIC(currentUser);
  const canApprove = myApproval?.status === 'PENDING' && isHeadOrOIC;
  const canReject = myApproval?.status === 'PENDING' && isHeadOrOIC;
  const canReturn = myApproval?.status === 'PENDING' && isHeadOrOIC;
  const canAssign = currentUser?.departmentCode === 'ITO' && request.status === 'APPROVED' && request.assignments.length === 0;
  const canFinalize = currentUser?.departmentCode === 'OCM' && request.status === 'APPROVED';
  const isRequestor = request.requestorId === currentUser?.id;
  const canResubmit = request.status === 'REVISION_REQUESTED' && isRequestor;

  const isMyTurn = myApproval?.status === 'PENDING' && request.approvals
  .filter(a => a.stepOrder < myApproval.stepOrder)
  .every(a => a.status === 'APPROVED' || a.status === 'ACKNOWLEDGED');

  // Helper to format date as "September 8, 2026"
  const formatDateReadable = (dateVal: string | Date | undefined): string => {
    if (!dateVal) return 'N/A';
    const d = typeof dateVal === 'string' ? new Date(dateVal) : dateVal;
    if (isNaN(d.getTime())) return 'N/A';
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <Card withBorder shadow="sm" radius="md" padding="sm">
      <UnstyledButton onClick={onView} style={{ width: '100%' }}>
        <Stack gap={4}>
          <Group justify="space-between" align="center" wrap="nowrap">
            <Text fw={700} size="sm">{request.referenceId}</Text>
            <Group gap={6} wrap="nowrap">
              <Badge
                color={
                  request.status === 'PENDING_APPROVAL' ? 'orange' :
                  request.status === 'APPROVED' ? 'green' :
                  request.status === 'REJECTED' ? 'red' :
                  request.status === 'COMPLETED' ? 'blue' :
                  request.status === 'REVISION_REQUESTED' ? 'orange' :
                  request.status === 'RESCHEDULE_PENDING' ? 'yellow' :
                  'gray'
                }
              >
                {request.status.replace('_', ' ')}
              </Badge>
            </Group>
          </Group>
          <Text size="sm">{request.eventName}</Text>
          <Text size="xs" c="dimmed">
            {request.type.replace('_', ' ')} | {request.dates && request.dates.length > 0
              ? formatDateReadable(request.dates[0].setupTime)
              : 'N/A'}
          </Text>
          <Text size="xs" c="dimmed">
            {request.dates && request.dates.length > 0 
              ? `Venues: ${request.dates.map(d => d.place?.name || d.placeOther || 'TBA').join(', ')}` 
              : 'Place: N/A'}
          </Text>
          <Group gap={4}>
            <Badge size="xs" variant="light" styles={{ label: { fontSize: 10 } }}>
              {request.equipmentRequests.length} equipment
            </Badge>
            <Badge size="xs" variant="light" styles={{ label: { fontSize: 10 } }}>
              {request.attendeesCount} attendees
            </Badge>
          </Group>
          <Text size="10px" c="dimmed">
            Step: {request.approvals.find(a => a.status === 'PENDING')?.departmentCode || 'Done'}
          </Text>
          {request.requestorNotes && (
            <Text size="xs" c="dimmed" lineClamp={2} style={{ marginTop: 2, fontStyle: 'italic' }}>
              <b>Requestor note:</b> {request.requestorNotes}
            </Text>
          )}
        </Stack>
      </UnstyledButton>

      {/* <Box mt="xs">
        <Group justify="flex-end">
          {canApprove && (
            <ActionIcon color="green" onClick={() => onAction('APPROVE', { id: request.id })}>
              <IconCheck size={16} />
            </ActionIcon>
          )}
          {canReject && (
            <ActionIcon color="red" onClick={() => onAction('REJECT', { id: request.id })}>
              <IconX size={16} />
            </ActionIcon>
          )}
          {canReturn && (
            <ActionIcon color="orange" onClick={() => onAction('RETURN', { id: request.id })}>
              <IconRefresh size={16} />
            </ActionIcon>
          )}
          {canResubmit && (
            <ActionIcon color="teal" onClick={() => onAction('RESUBMIT', { id: request.id })}>
              <IconRefresh size={16} />
            </ActionIcon>
          )}
          {canAssign && (
            <ActionIcon color="indigo" onClick={onAssign}>
              Assign
            </ActionIcon>
          )}
          {canFinalize && (
            <ActionIcon color="blue" onClick={onFinalize}>
              Finalize
            </ActionIcon>
          )}
        </Group>
      </Box> */}
    </Card>
  );
}