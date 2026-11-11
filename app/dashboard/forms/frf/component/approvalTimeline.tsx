// app/dashboard/forms/frf/components/approvalTimeline.tsx

'use client';

import {
  Group,
  Box,
  Text,
  Badge,
  ThemeIcon,
  Paper,
  Stack,
  Popover,
  useMantineColorScheme,
  Divider,
} from '@mantine/core';
import { IconCheck, IconX, IconClock, IconRefresh, IconInfoCircle } from '@tabler/icons-react';
import { useState, useRef, useEffect } from 'react';
import { useMediaQuery } from '@mantine/hooks';
import { FacilityApproval } from './types';
import ElapsedIndicator from '../../shared_components/ElapsedIndicator';
import { getFRFApprovalAnchor } from '../../../../lib/timeElapsed';

interface ApprovalTimelineProps {
  approvals: FacilityApproval[];
  requestorDept?: string;
  isReschedule?: boolean;
  originalApprovals?: FacilityApproval[];
  reservationMeta?: {
    createdAt?: string;
    updatedAt?: string;
    isReschedule?: boolean;
  };
}

type StepMode = 'approval' | 'ack';

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

  const isMobile = useMediaQuery('(max-width: 768px)');

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  const [prevIsMobile, setPrevIsMobile] = useState(isMobile);
  if (isMobile !== prevIsMobile) {
    setPrevIsMobile(isMobile);
    if (openedPopover !== null) {
      setOpenedPopover(null);
    }
  }

  // Split into approval steps vs ack steps so each can be rendered as its
  // own visual block. ACKs are independent of the sequential flow, so they
  // don't belong on the same continuous line.
  const sortedAll = [...approvals].sort((a, b) => a.stepOrder - b.stepOrder);
  const sortedApprovals = sortedAll.filter((a) => a.stepType !== 'ACKNOWLEDGEMENT');
  const sortedAcks = sortedAll.filter((a) => a.stepType === 'ACKNOWLEDGEMENT');

  const sortedOriginal = originalApprovals
    ? [...originalApprovals].sort((a, b) => a.stepOrder - b.stepOrder)
    : [];

  const getStatusProps = (
    status: string,
    approval: FacilityApproval | undefined,
    mode: StepMode,
  ) => {
    switch (status) {
      case 'APPROVED':
        return { icon: <IconCheck size={14} />, color: 'green', label: 'Approved' };
      case 'REJECTED':
        return { icon: <IconX size={14} />, color: 'red', label: 'Rejected' };
      case 'REVISION_REQUESTED':
        return { icon: <IconRefresh size={14} />, color: 'orange', label: 'Revision' };
      case 'ACKNOWLEDGED': {
        const isNoted =
          mode === 'ack' ||
          approval?.stepType === 'ACKNOWLEDGEMENT' ||
          approval?.remarks?.includes('Noted by');
        return {
          icon: <IconCheck size={14} />,
          color: isNoted ? 'teal' : 'blue',
          label: isNoted ? 'Noted' : 'Acknowledged',
        };
      }
      default:
        return {
          icon: <IconClock size={14} />,
          color: 'gray',
          label: mode === 'ack' ? 'Awaiting Ack' : 'Pending',
        };
    }
  };

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleString();

  const getBackgroundColor = (status: string) => {
    if (status === 'APPROVED')
      return isDark ? 'var(--mantine-color-green-9)' : 'var(--mantine-color-green-1)';
    if (status === 'REJECTED')
      return isDark ? 'var(--mantine-color-red-9)' : 'var(--mantine-color-red-1)';
    if (status === 'REVISION_REQUESTED')
      return isDark ? 'var(--mantine-color-orange-9)' : 'var(--mantine-color-orange-1)';
    return 'transparent';
  };

  const getBorderColor = (status: string) => {
    if (status === 'APPROVED')
      return isDark ? 'var(--mantine-color-green-5)' : 'var(--mantine-color-green-4)';
    if (status === 'REJECTED')
      return isDark ? 'var(--mantine-color-red-5)' : 'var(--mantine-color-red-4)';
    if (status === 'REVISION_REQUESTED')
      return isDark ? 'var(--mantine-color-orange-5)' : 'var(--mantine-color-orange-4)';
    return isDark ? 'var(--mantine-color-dark-4)' : 'var(--mantine-color-gray-3)';
  };

  // ACK card style — dashed border, teal accent, lighter weight
  const getAckCardStyle = (status: string) => ({
    borderStyle: 'dashed' as const,
    borderColor:
      status === 'ACKNOWLEDGED'
        ? isDark
          ? 'var(--mantine-color-teal-5)'
          : 'var(--mantine-color-teal-4)'
        : isDark
        ? 'var(--mantine-color-dark-4)'
        : 'var(--mantine-color-gray-4)',
    backgroundColor:
      status === 'ACKNOWLEDGED'
        ? isDark
          ? 'var(--mantine-color-teal-9)'
          : 'var(--mantine-color-teal-0)'
        : 'transparent',
  });

  const clearCloseTimer = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const handleDesktopEnter = (popoverId: string) => {
    if (isMobile) return;
    clearCloseTimer();
    setOpenedPopover(popoverId);
  };

  const handleDesktopLeave = () => {
    if (isMobile) return;
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      setOpenedPopover(null);
    }, 200);
  };

  const handleTap = (popoverId: string) => {
    if (!isMobile) return;
    setOpenedPopover((prev) => (prev === popoverId ? null : popoverId));
  };

  const renderRow = (
    approvalsList: FacilityApproval[],
    isOriginal: boolean,
    mode: StepMode,
  ) => {
    const firstApproval = approvalsList.length > 0 ? approvalsList[0] : null;
    const isRequestorFirst =
      mode === 'approval' &&
      firstApproval &&
      requestorDept &&
      firstApproval.departmentCode === requestorDept;

    return (
      <Group gap={0} wrap="nowrap" align="center" style={{ flexShrink: 0 }}>
        {approvalsList.map((approval, index) => {
          const { icon, color, label } = getStatusProps(approval.status, approval, mode);
          const isLast = index === approvalsList.length - 1;
          const isFirst = index === 0;
          const isRequestorStep = isFirst && isRequestorFirst;
          const popoverId = approval.id || `${approval.departmentCode}-${approval.stepOrder}`;
          const isOpened = openedPopover === popoverId;

          const performerName = approval.performedBy
            ? `${approval.performedBy.fname} ${approval.performedBy.lname}`
            : approval.performedById
            ? `User ${approval.performedById}`
            : '—';

          const pendingAnchor =
            !isOriginal &&
            reservationMeta &&
            approval.status === 'PENDING'
              ? getFRFApprovalAnchor(approval, approvalsList, reservationMeta)
              : null;

          const ackCardStyle = mode === 'ack' ? getAckCardStyle(approval.status) : {};

          return (
            <Group key={approval.id || index} gap={0} wrap="nowrap" style={{ flexShrink: 0 }}>
              <Popover
                opened={isOpened}
                onChange={(opened) => {
                  if (!opened) setOpenedPopover(null);
                }}
                position="bottom"
                withArrow
                shadow="md"
                width={isMobile ? 260 : 280}
                closeOnClickOutside={isMobile}
                closeOnEscape={true}
                trapFocus={false}
                withinPortal
                zIndex={1100}
                styles={{ dropdown: { pointerEvents: 'auto' } }}
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
                      justifyContent: 'center',
                      width: isMobile ? 120 : 140,
                      height: 96,
                      flexShrink: 0,
                      padding: '8px 6px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      ...(mode === 'ack'
                        ? ackCardStyle
                        : {
                            backgroundColor: getBackgroundColor(approval.status),
                            borderColor: getBorderColor(approval.status),
                          }),
                      borderWidth: isOpened ? 2 : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (isMobile) return;
                      handleDesktopEnter(popoverId);
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = 'var(--mantine-shadow-sm)';
                    }}
                    onMouseLeave={(e) => {
                      if (isMobile) return;
                      handleDesktopLeave();
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                    onClick={() => handleTap(popoverId)}
                  >
                    <ThemeIcon color={color} variant="light" radius="xl" size="sm">
                      {icon}
                    </ThemeIcon>
                    <Group gap={4} mt={4} align="center">
                      <Text size="xs" fw={600} ta="center" style={{ fontSize: 11 }}>
                        {approval.departmentCode}
                        {isRequestorStep && (
                          <Text
                            component="span"
                            size="10px"
                            fw={400}
                            style={{ display: 'inline', marginLeft: 4, fontSize: 9 }}
                          >
                            (Requestor)
                          </Text>
                        )}
                      </Text>
                    </Group>
                    <Badge
                      size="xs"
                      color={color}
                      variant={mode === 'ack' ? 'light' : 'filled'}
                      mt={2}
                      styles={{ label: { fontSize: 10 } }}
                    >
                      {label}
                    </Badge>
                  </Paper>
                </Popover.Target>

                <Popover.Dropdown
                  onMouseEnter={() => {
                    if (!isMobile) clearCloseTimer();
                  }}
                  onMouseLeave={() => {
                    if (!isMobile) handleDesktopLeave();
                  }}
                >
                  <Paper p="sm" radius="md" withBorder>
                    <Stack gap={4}>
                      <Group gap="xs" wrap="nowrap" justify="space-between">
                        <Text size="xs" fw={700}>
                          {approval.departmentCode}
                        </Text>
                        {mode === 'ack' && (
                          <Badge size="xs" color="teal" variant="light">
                            Acknowledgment
                          </Badge>
                        )}
                      </Group>
                      <Badge
                        size="xs"
                        color={color}
                        variant={mode === 'ack' ? 'light' : 'filled'}
                        styles={{ label: { fontSize: 10 } }}
                      >
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
                        <Text
                          size="xs"
                          c="dimmed"
                          style={{
                            borderTop: '1px solid var(--mantine-color-gray-2)',
                            paddingTop: 4,
                          }}
                        >
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
                    width: isMobile ? 20 : 30,
                    height: 2,
                    flexShrink: 0,
                    ...(mode === 'ack'
                      ? {
                          // Dashed connector signals "parallel / independent", not sequential
                          backgroundImage: `repeating-linear-gradient(to right, ${
                            isDark
                              ? 'var(--mantine-color-dark-4)'
                              : 'var(--mantine-color-gray-4)'
                          } 0 4px, transparent 4px 8px)`,
                          backgroundColor: 'transparent',
                        }
                      : {
                          backgroundColor: isDark
                            ? 'var(--mantine-color-dark-4)'
                            : 'var(--mantine-color-gray-4)',
                        }),
                  }}
                />
              )}
            </Group>
          );
        })}
      </Group>
    );
  };

  const hasApprovals = sortedApprovals.length > 0;
  const hasAcks = sortedAcks.length > 0;

  return (
    <Box
      style={{
        overflowX: 'auto',
        padding: '8px 0',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {isMobile && (
        <Text size="10px" c="dimmed" mb={4} fs="italic">
          👆 Tap a step to see details
        </Text>
      )}

      {isReschedule && (
        <Badge color="yellow" size="xs" variant="filled" mb="md">
          Reschedule
        </Badge>
      )}

      {/* ── Original approval flow (reschedule only) ─────────────────── */}
      {isReschedule && sortedOriginal.length > 0 && (
        <>
          <Group gap="xs" mb="xs">
            <Badge color="gray" size="sm" variant="light">
              Original Approval Flow
            </Badge>
          </Group>
          {renderRow(sortedOriginal, true, 'approval')}
          <Box
            my="md"
            style={{ borderBottom: '1px dashed var(--mantine-color-gray-3)' }}
          />
        </>
      )}

      {/* ── Current approval flow (sequential, gates completion) ─────── */}
      {hasApprovals && (
        <>
          <Group gap="xs" mb="xs">
          </Group>
          {renderRow(sortedApprovals, false, 'approval')}
        </>
      )}

      {/* ── Acknowledgements (parallel, informational) ───────────────── */}
      {hasAcks && (
        <>
          <Box my="md" style={{ borderBottom: '1px dashed var(--mantine-color-gray-4)' }} />
          <Group gap="xs" mb="xs" wrap="wrap">
            <Text size="sm" variant="light">
              Acknowledgements
            </Text>
            <Group gap={4} wrap="nowrap">
              <IconInfoCircle size={11} color="var(--mantine-color-teal-6)" />
              <Text size="10px" fs="italic">
                Informational · non-blocking · independent of the flow above
              </Text>
            </Group>
          </Group>
          {renderRow(sortedAcks, false, 'ack')}
        </>
      )}
    </Box>
  );
}