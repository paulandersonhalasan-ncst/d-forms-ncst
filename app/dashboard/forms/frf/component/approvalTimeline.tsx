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
import { IconCheck, IconX, IconClock, IconRefresh } from '@tabler/icons-react';
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

  // 🆕 Cleanup timer on unmount (external system sync — OK ito)
  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  // 🆕 Auto-close popover kapag lumipat ng view mode (mobile ↔ desktop)
  // React-recommended pattern: adjust state during render, hindi sa effect.
  const [prevIsMobile, setPrevIsMobile] = useState(isMobile);
  if (isMobile !== prevIsMobile) {
    setPrevIsMobile(isMobile);
    if (openedPopover !== null) {
      setOpenedPopover(null);
    }
  }

  const sorted = [...approvals].sort((a, b) => a.stepOrder - b.stepOrder);

  const sortedOriginal = originalApprovals
    ? [...originalApprovals].sort((a, b) => a.stepOrder - b.stepOrder)
    : [];

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

  // 🆕 CLEAR hover timer
  const clearCloseTimer = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  // 🆕 DESKTOP: hover handlers (walang effect sa mobile)
  const handleDesktopEnter = (popoverId: string) => {
    if (isMobile) return;
    clearCloseTimer();
    setOpenedPopover(popoverId);
  };

  // 🆕 DESKTOP: leave handler — may grace period 200ms
  const handleDesktopLeave = () => {
    if (isMobile) return;
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      setOpenedPopover(null);
    }, 200);
  };

  // 🆕 MOBILE: tap toggle
  const handleTap = (popoverId: string) => {
    if (!isMobile) return;
    setOpenedPopover((prev) => (prev === popoverId ? null : popoverId));
  };

  // Helper to render a single timeline row
  const renderRow = (approvalsList: FacilityApproval[], isOriginal: boolean) => {
    const firstApproval = approvalsList.length > 0 ? approvalsList[0] : null;
    const isRequestorFirst =
      firstApproval && requestorDept && firstApproval.departmentCode === requestorDept;

    return (
      <Group gap={0} wrap="nowrap" align="center" style={{ flexShrink: 0 }}>
        {approvalsList.map((approval, index) => {
          const { icon, color, label } = getStatusProps(approval.status, approval);
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
                // 🆕 Desktop: hindi nag-clo-close sa outside click (hover-driven)
                // 🆕 Mobile: nag-clo-close sa outside tap
                closeOnClickOutside={isMobile}
                closeOnEscape={true}
                trapFocus={false}
                withinPortal
                zIndex={1100}
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
                    // 🆕 Add cursor style
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
                      backgroundColor: getBackgroundColor(approval.status),
                      borderColor: getBorderColor(approval.status),
                      borderWidth: isOpened ? 2 : 1,
                    }}
                    // 🆕 DESKTOP hover handlers
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
                    // 🆕 MOBILE tap handler (also works on desktop click as fallback)
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
                    <Badge size="xs" color={color} variant="filled" mt={2} styles={{ label: { fontSize: 10 } }}>
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
                      <Text size="xs" fw={700}>
                        {approval.departmentCode}
                      </Text>
                      <Badge size="xs" color={color} variant="filled" styles={{ label: { fontSize: 10 } }}>
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
                    backgroundColor: isDark
                      ? 'var(--mantine-color-dark-4)'
                      : 'var(--mantine-color-gray-4)',
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
    <Box
      style={{
        overflowX: 'auto',
        padding: '8px 0',
        // 🆕 Touch-friendly horizontal scroll sa mobile
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {/* 🆕 Mobile hint */}
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

      {isReschedule && sortedOriginal.length > 0 && (
        <>
          <Group gap="xs" mb="xs">
            <Badge color="gray" size="sm" variant="light">
              Original Approval Flow
            </Badge>
          </Group>
          {renderRow(sortedOriginal, true)}
          <Box
            my="md"
            style={{ borderBottom: '1px dashed var(--mantine-color-gray-3)' }}
          />
        </>
      )}

      <Group gap="xs" mb="xs">
        <Badge color={isReschedule ? 'yellow' : 'blue'} size="sm" variant="light">
          {isReschedule ? 'New Approval Flow (Reschedule)' : 'Approval Flow'}
        </Badge>
      </Group>
      {renderRow(sorted, false)}
    </Box>
  );
}