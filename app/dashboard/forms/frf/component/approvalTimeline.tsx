// app/dashboard/forms/frf/components/approvalTimeline.tsx

'use client';

import { Group, Box, Text, Badge, ThemeIcon, Paper, Stack, Popover, useMantineColorScheme, Divider } from '@mantine/core';
import { IconCheck, IconX, IconClock, IconRefresh } from '@tabler/icons-react';
import { useState, useRef } from 'react';
import { FacilityApproval } from './types';
import ElapsedIndicator from '../../shared_components/ElapsedIndicator';
import { getFRFApprovalAnchor } from '../../../../lib/timeElapsed';

interface ApprovalTimelineProps {
  approvals: FacilityApproval[];
  requestorDept?: string;
  isReschedule?: boolean;
  originalApprovals?: FacilityApproval[];
  // 🆕 Reservation meta para makapag-compute ng elapsed anchor
  reservationMeta?: {
    createdAt?: string;
    updatedAt?: string;
    isReschedule?: boolean;
  };
}

export default function ApprovalTimeline({
  approvals,
  requestorDept,
  isReschedule,
  originalApprovals,
  reservationMeta,
}: ApprovalTimelineProps) {
  const [openedPopover, setOpenedPopover] = useState<string | null>(null);
  const closeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';

  const sorted = [...approvals].sort((a, b) => a.stepOrder - b.stepOrder);
  const sortedOriginal = originalApprovals ? [...originalApprovals].sort((a, b) => a.stepOrder - b.stepOrder) : [];

  const getStatusProps = (status: string, approval?: FacilityApproval) => {
    switch (status) {
      case 'APPROVED':
        return { icon: <IconCheck size={14} />, color: 'green', label: 'Approved' };
      case 'REJECTED':
        return { icon: <IconX size={14} />, color: 'red', label: 'Rejected' };
      case 'REVISION_REQUESTED':
        return { icon: <IconRefresh size={14} />, color: 'orange', label: 'Revision' };
      case 'ACKNOWLEDGED': {
        const isNoted = approval?.remarks?.includes('Noted by');
        return {
          icon: <IconCheck size={14} />,
          color: isNoted ? 'teal' : 'blue',
          label: isNoted ? 'Noted' : 'Acknowledged',
        };
      }
      default:
        return { icon: <IconClock size={14} />, color: 'gray', label: 'Pending' };
    }
  };

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleString();

  const getBackgroundColor = (status: string) => {
    if (status === 'APPROVED') return isDark ? 'var(--mantine-color-green-9)' : 'var(--mantine-color-green-1)';
    if (status === 'REJECTED') return isDark ? 'var(--mantine-color-red-9)' : 'var(--mantine-color-red-1)';
    if (status === 'REVISION_REQUESTED') return isDark ? 'var(--mantine-color-orange-9)' : 'var(--mantine-color-orange-1)';
    return 'transparent';
  };

  const getBorderColor = (status: string) => {
    if (status === 'APPROVED') return isDark ? 'var(--mantine-color-green-5)' : 'var(--mantine-color-green-4)';
    if (status === 'REJECTED') return isDark ? 'var(--mantine-color-red-5)' : 'var(--mantine-color-red-4)';
    if (status === 'REVISION_REQUESTED') return isDark ? 'var(--mantine-color-orange-5)' : 'var(--mantine-color-orange-4)';
    return isDark ? 'var(--mantine-color-dark-4)' : 'var(--mantine-color-gray-3)';
  };

  // Helper to render a single timeline row
  const renderRow = (
    approvalsList: FacilityApproval[],
    rowLabel: string,
    badgeColor: string,
    isOriginal: boolean
  ) => {
    const firstApproval = approvalsList.length > 0 ? approvalsList[0] : null;
    const isRequestorFirst = firstApproval && requestorDept && firstApproval.departmentCode === requestorDept;

    const handleMouseEnter = (popoverId: string) => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      setOpenedPopover(popoverId);
    };

    const handleMouseLeave = () => {
      closeTimerRef.current = setTimeout(() => {
        setOpenedPopover(null);
      }, 200);
    };

    const handlePopoverEnter = () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };

    return (
      <Group gap={0} wrap="nowrap" align="center" style={{ flexShrink: 0 }}>
        {approvalsList.map((approval, index) => {
          const { icon, color, label } = getStatusProps(approval.status, approval);
          const isLast = index === approvalsList.length - 1;
          const isFirst = index === 0;
          const isRequestorStep = isFirst && isRequestorFirst;
          const popoverId = approval.id || `${approval.departmentCode}-${approval.stepOrder}`;

          const performerName = approval.performedBy
            ? `${approval.performedBy.fname} ${approval.performedBy.lname}`
            : approval.performedById
            ? `User ${approval.performedById}`
            : '—';

          // 🆕 Compute anchor for the CURRENT pending step only
          const pendingAnchor =
            !isOriginal &&
            reservationMeta &&
            approval.status === 'PENDING'
              ? getFRFApprovalAnchor(approval, approvalsList, reservationMeta)
              : null;

          return (
            <Group key={approval.id || index} gap={0} wrap="nowrap" style={{ flexShrink: 0 }}>
              <Popover
                opened={openedPopover === popoverId}
                position="bottom"
                withArrow
                shadow="md"
                width={280}
                closeOnClickOutside={false}
                closeOnEscape={false}
                styles={{
                  dropdown: {
                    pointerEvents: 'auto',
                  },
                }}
              >
                <Popover.Target>
                  <Paper
                    withBorder
                    radius="md"
                    p="xs"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      width: 140,
                      flexShrink: 0,
                      padding: '8px 6px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      backgroundColor: getBackgroundColor(approval.status),
                      borderColor: getBorderColor(approval.status),
                    }}
                    onMouseEnter={(e) => {
                      handleMouseEnter(popoverId);
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = 'var(--mantine-shadow-sm)';
                    }}
                    onMouseLeave={(e) => {
                      handleMouseLeave();
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <ThemeIcon color={color} variant="light" radius="xl" size="sm">
                      {icon}
                    </ThemeIcon>
                    <Group gap={4} mt={4} align="center">
                      <Text size="xs" fw={600} ta="center">
                        {approval.departmentCode}
                        {isRequestorStep && (
                          <Text component="span" size="10px" fw={400} style={{ display: 'inline', marginLeft: 4 }}>
                            (Requestor)
                          </Text>
                        )}
                      </Text>
                    </Group>
                    <Badge size="xs" color={color} variant="filled" mt={2}>
                      {label}
                    </Badge>
                  </Paper>
                </Popover.Target>
                <Popover.Dropdown
                  onMouseEnter={handlePopoverEnter}
                  onMouseLeave={handleMouseLeave}
                >
                  <Paper p="sm" radius="md" withBorder>
                    <Stack gap={4}>
                      <Text size="xs" fw={700}>
                        {approval.departmentCode}
                      </Text>
                      <Badge size="xs" color={color} variant="filled">
                        {label}
                      </Badge>
                      {performerName && performerName !== '—' && (
                        <Text size="xs" c="dimmed">
                          <b>By:</b> {performerName}
                        </Text>
                      )}
                      {approval.performedAt && (
                        <Text size="xs" c="dimmed">
                          <b>At:</b> {formatDate(approval.performedAt)}
                        </Text>
                      )}
                      {approval.remarks && (
                        <Text size="xs" c="dimmed" style={{ borderTop: '1px solid var(--mantine-color-gray-2)', paddingTop: 4 }}>
                          <b>Remarks:</b> {approval.remarks}
                        </Text>
                      )}
                      {approval.revisionReason && (
                        <Text size="xs" c="orange">
                          <b>Revision Reason:</b> {approval.revisionReason}
                          {approval.status === 'APPROVED' && approval.performedAt && (
                            <span style={{ color: 'green', marginLeft: 4 }}>
                              (Resolved on {formatDate(approval.performedAt)})
                            </span>
                          )}
                        </Text>
                      )}

                      {/* 🆕 Elapsed indicator para sa pending steps */}
                      {pendingAnchor && (
                        <>
                          <Divider my={4} />
                          <ElapsedIndicator
                            start={pendingAnchor}
                            label="Waiting"
                            size="xs"
                            withTooltip={false}
                          />
                        </>
                      )}
                    </Stack>
                  </Paper>
                </Popover.Dropdown>
              </Popover>

              {!isLast && (
                <Box
                  style={{
                    width: 30,
                    height: 2,
                    backgroundColor: isDark ? 'var(--mantine-color-dark-4)' : 'var(--mantine-color-gray-4)',
                    flexShrink: 0,
                  }}
                />
              )}
            </Group>
          );
        })}
      </Group>
    );
  };

  return (
    <Box style={{ overflowX: 'auto', padding: '8px 0' }}>
      {isReschedule && <Badge color="yellow" size="xs" variant="filled" mb="md">Reschedule</Badge>}

      {isReschedule && sortedOriginal.length > 0 && (
        <>
          <Group gap="xs" mb="xs">
            <Badge color="gray" size="sm" variant="light">Original Approval Flow</Badge>
          </Group>
          {renderRow(sortedOriginal, 'Original', 'gray', true)}
          <Box my="md" style={{ borderBottom: '1px dashed var(--mantine-color-gray-3)' }} />
        </>
      )}

      <Group gap="xs" mb="xs">
        <Badge color={isReschedule ? 'yellow' : 'blue'} size="sm" variant="light">
          {isReschedule ? 'New Approval Flow (Reschedule)' : 'Approval Flow'}
        </Badge>
      </Group>
      {renderRow(sorted, 'Current', 'blue', false)}
    </Box>
  );
}