// components/MemoCard.tsx
'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  Group,
  Text,
  Badge,
  Button,
  Stack,
  Divider,
  UnstyledButton,
  SimpleGrid,
  Select,
  Alert
} from '@mantine/core';
import {
  IconGitBranch,
  IconPrinter,
  IconMessageReply,
  IconCheck,
  IconPlayerPlay,
  IconFileCheck,
  IconEdit,
  IconDownload,
  IconThumbUp,
  IconInfoCircle
} from '@tabler/icons-react';
import { Memo, UserContext } from './types';

interface MemoCardProps {
  memo: Memo;
  isApprovalTab: boolean;
  currentUser: UserContext | null;
  activeDepartment: string;
  isAdminOrSuper: boolean;
  isHeadOrOIC: boolean;
  processOICAllowance: boolean;
  threadCount: number;
  totalDepartments: number;
  onReply?: (memo: Memo) => void;
  onPrint: (memo: Memo) => void;
  onViewThread: (memo: Memo) => void;
  onExpand: (memo: Memo) => void;
  onSuperEdit: (memo: Memo, mode: 'edit' | 'approve') => void;
  triggerActionPasswordCheck: (
    type: 'CREATE' | 'ACKNOWLEDGE' | 'START_PROCESSING' | 'DENY' | 'CLOSED' | 'APPROVE' | 'DISAPPROVE_DRAFT' | 'JOIN_PROCESSING' | 'ASSIGN',
    data: Record<string, unknown>
  ) => void;
  allMemos: Memo[];
  departmentStaff: { id: string; fname: string; lname: string }[];
}

export default function MemoCard({
  memo,
  isApprovalTab,
  currentUser,
  activeDepartment,
  isAdminOrSuper,
  isHeadOrOIC,
  processOICAllowance,
  threadCount,
  onReply,
  onPrint,
  onViewThread,
  onExpand,
  onSuperEdit,
  triggerActionPasswordCheck,
  allMemos,
  departmentStaff,
  totalDepartments = 0,
}: MemoCardProps) {
  const amISender = memo.senderId === currentUser?.id;
  const myRecipientInfo = memo.recipients?.find(
    (r) => r.departmentName === activeDepartment
  );
  const processingRecipients = memo.recipients?.filter((r) => r.status === 'PROCESSING') || [];
  const isBeingProcessed = processingRecipients.length > 0;

  const isMemoResolvedForMe = ['COMPLETED', 'RESPONDED', 'DENIED', 'CLOSED'].includes(myRecipientInfo?.status || '');
  const isAllResolved =
    memo.senderId === currentUser?.id &&
    memo.recipients?.every((r) => ['COMPLETED', 'RESPONDED', 'DENIED', 'CLOSED'].includes(r.status));
  const disableReply =
    !isAdminOrSuper && (isMemoResolvedForMe || isAllResolved || memo.status === 'FOR_APPROVAL');
  
  const hasAmended = !!(memo.revisedSubject || memo.revisedHeadNote || memo.isRevisedByHead);

  // Priority / deadline badge
  let badgeText: string = memo.priority;
  let badgeColor = 'blue';
  if (memo.priority === 'RUSH' && memo.deadlineAt && !isMemoResolvedForMe && !isAllResolved) {
    const diffTime = new Date(memo.deadlineAt).getTime() - Date.now(); // eslint-disable-line
    const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) {
      badgeText = 'OVERDUE';
      badgeColor = 'red';
    } else if (daysLeft === 0 || daysLeft === 1) {
      badgeText = 'DUE TODAY';
      badgeColor = 'red';
    } else {
      badgeText = `${daysLeft} days left`;
      badgeColor = 'orange';
    }
  } else if (memo.priority === 'RUSH') {
    badgeText = 'RUSH';
    badgeColor = 'gray';
  } else if (memo.priority === 'URGENT') {
    badgeColor = isMemoResolvedForMe || isAllResolved ? 'gray' : 'pink';
  }

  const hasThread = threadCount > 1;

  // Check if current user is already in processing list
  const currentUserName = currentUser ? `${currentUser.fname} ${currentUser.lname}` : '';
  const amIAlreadyProcessing = myRecipientInfo?.processedByName?.includes(currentUserName);

  // ✅ Kunin ang lahat ng assignments mula sa lahat ng recipients
  const allAssignments = memo.recipients
    ?.filter(r => r.assignedToNames && r.assignedToNames.length > 0)
    .map(r => `${r.departmentName}: ${r.assignedToNames?.join(', ') || ''}`)
    .join(' | ') || '';
  const hasAssignments = allAssignments.length > 0;

  console.log('🔍 MemoCard debug:', {
    id: memo.id,
    amISender,
    memoStatus: memo.status,
    purpose: memo.purpose,
    recipients: memo.recipients?.map(r => ({
      status: r.status,
      recipientConfirmedAt: r.recipientConfirmedAt,
      senderConfirmedAt: r.senderConfirmedAt,
    })),
    condition: amISender && memo.status === 'APPROVED' && memo.purpose !== 'FYI' && 
      memo.recipients?.every(r => {
        if (['CLOSED', 'DENIED', 'COMPLETED'].includes(r.status)) return true;
        if (r.status === 'PROCESSING' && r.recipientConfirmedAt) return true;
        return false;
      }),
  });

  const [assignedStaffId, setAssignedStaffId] = useState<string | null>(null);

  const displaySubject = memo.revisedSubject || memo.subject;

  const hasPendingRevisions = !!(memo.revisedSubject || memo.revisedHeadNote);

  const displayHeadNote = memo.revisedHeadNote || memo.headNote;

  return (
    <Card
      withBorder={!isBeingProcessed}
      radius="md"
      shadow={isBeingProcessed ? 'md' : 'sm'}
      style={{
        border: isBeingProcessed
          ? '2px solid var(--mantine-color-orange-filled)'
          : '1px solid light-dark(var(--mantine-color-gray-3), var(--mantine-color-dark-4))',
        boxShadow: isBeingProcessed ? '0 0 12px rgba(255, 165, 0, 0.4)' : undefined,
        display: 'flex',
        flexDirection: 'column',
        padding: 0,
        transition: 'all 0.2s ease',
      }}
    >
      {/* ----- CARD BODY: Click to expand ----- */}
      <UnstyledButton
        onClick={() => onExpand(memo)}
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          padding: '12px 16px',
          textAlign: 'left',
          backgroundColor: 'transparent',
          borderRadius: '8px',
          transition: 'all 0.2s ease',
          cursor: 'pointer',
        }}
        onMouseEnter={(e) => {
          const isDarkMode = document.documentElement.getAttribute('data-mantine-color-scheme') === 'dark';
          e.currentTarget.style.backgroundColor = isDarkMode
            ? 'var(--mantine-color-dark-5)'
            : 'var(--mantine-color-gray-0)';
          e.currentTarget.style.transform = 'translateY(-1px)';
          e.currentTarget.style.boxShadow = 'var(--mantine-shadow-xs)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
          e.currentTarget.style.transform = 'none';
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        {/* Header row: Reference, badges, purpose, priority */}
        <Group justify="space-between" w="100%" mb="xs">
          <Group gap="xs" onClick={(e) => e.stopPropagation()}>
            <Text ff="monospace" fw={700} c="blue" size="sm">
              {memo.referenceId || 'DRAFT-DPT'}
            </Text>
            {memo.attachmentPaths && memo.attachmentPaths.length > 0 && (
              <Badge color="indigo" variant="filled" size="xs" leftSection={<IconDownload size={12} />}>
                HAS {memo.attachmentPaths.length} FILE(S) ATTACHED
              </Badge>
            )}
            {amISender && (
              <Badge color="gray" variant="light" size="xs">
                CREATED BY YOU
              </Badge>
            )}
            {memo.status === 'FOR_APPROVAL' && (
              <Badge color="orange" variant="filled" size="xs">
                Draft/For Review
              </Badge>
            )}
            {hasThread && (
              <Badge
                color="teal"
                variant="outline"
                size="xs"
                leftSection={<IconGitBranch size={10} />}
                style={{ cursor: 'pointer' }}
                onClick={(e) => {
                  e.stopPropagation();
                  onViewThread(memo);
                }}
              >
                In a Thread
              </Badge>
            )}
            {/* Show assigned to info (array) */}
            {myRecipientInfo?.assignedToNames && myRecipientInfo.assignedToNames.length > 0 && (
              <Badge color="grape" size="xs" variant="light">
                Assigned to: {myRecipientInfo.assignedToNames.join(', ')}
              </Badge>
            )}
            {hasAmended && (
              <Badge color="grape" variant="light" size="xs">
                Amended by Head
              </Badge>
            )}
          </Group>
          <Group gap="xs">
            <Badge color="cyan" variant="light" size="sm">
              {memo.purpose}
            </Badge>
            <Badge color={badgeColor} variant="filled" size="sm">
              {badgeText}
            </Badge>
          </Group>
        </Group>

        {/* Meta info: TO, FROM, CLOSED BY, DATE */}
        <Stack gap={4} my="xs" p="xs" w="100%" bg="light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-7))" style={{ borderRadius: '6px' }}>
          <Text size="xs">
            <b>TO:</b>{' '}
              {memo.recipients && memo.recipients.length === totalDepartments && totalDepartments > 0 ? (
                'All Departments'
              ) : (
                memo.recipients?.map((r) => r.departmentName).join(', ') || 'None'
              )}
          </Text>
          {/* ✅ Idagdag ito — assignment summary para sa lahat */}
          {hasAssignments && (
            <Text size="xs" c="grape">
              <b>Assigned to:</b> {allAssignments}
            </Text>
          )}
          <Group gap={6} align="center">
            <Text size="xs">
              <b>FROM:</b> {memo.senderName} ({memo.sender?.branch ? `${memo.sender.branch} - ` : ''}
              {memo.senderDept})
            </Text>
          </Group>
          {memo.recipients?.some(r => r.status === 'CLOSED') && (
            <Text size="xs" c="dimmed">
              <b>CLOSED BY:</b>{' '}
              {memo.recipients
                ?.filter(r => r.status === 'CLOSED')
                .map(r => `${r.departmentName} (${r.closedByName || 'Unknown'})`)
                .join(', ')}
            </Text>
          )}
          <Text size="xs" c="dimmed">
            <b>DATE:</b> {new Date(memo.createdAt).toLocaleString()}
          </Text>

          {isBeingProcessed &&
            processingRecipients.map(
              (pr) =>
                pr.processedByName && (
                  <Group gap={4} mt={2} key={pr.id}>
                    <Badge color="orange" variant="light" size="xs" style={{ textTransform: 'none', letterSpacing: 0 }}>
                      ⚙️ {pr.departmentName} processing by: <b>{pr.processedByName}</b>
                    </Badge>
                  </Group>
                )
            )}
        </Stack>

        <Text fz="sm" fw={700} mt="xs" w="100%" lineClamp={1}>
          SUBJECT: {displaySubject}
        </Text>
      </UnstyledButton>
    </Card>
  );
}