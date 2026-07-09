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
  IconCircleCheck
} from '@tabler/icons-react';
import { Memo, UserContext } from './types';

interface MemoCardProps {
  memo: Memo;
  isApprovalTab: boolean;
  currentUser: UserContext | null;
  activeDepartment: string;
  isAdminOrSuper: boolean;
  isDepartmentHead: boolean;
  processOICAllowance: boolean;
  threadCount: number;
  onReply: (memo: Memo) => void;
  onPrint: (memo: Memo) => void;
  onViewThread: (memo: Memo) => void;
  onExpand: (memo: Memo) => void;
  onSuperEdit: (memo: Memo) => void;
  triggerActionPasswordCheck: (
    type: 'CREATE' | 'ACKNOWLEDGE' | 'START_PROCESSING' | 'DENY' | 'CLOSED' | 'APPROVE_MEMO' | 'DISAPPROVE_DRAFT' | 'JOIN_PROCESSING',
    data: Record<string, unknown>
  ) => void;
  allMemos: Memo[]; // not used but kept for compatibility
}

export default function MemoCard({
  memo,
  isApprovalTab,
  currentUser,
  activeDepartment,
  isAdminOrSuper,
  isDepartmentHead,
  processOICAllowance,
  threadCount,
  onReply,
  onPrint,
  onViewThread,
  onExpand,
  onSuperEdit,
  triggerActionPasswordCheck,
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
        minHeight: '420px',
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
          padding: '20px',
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
            <b>TO:</b> {memo.recipients?.map((r) => r.departmentName).join(', ')}
          </Text>
          <Group gap={6} align="center">
            <Text size="xs">
              <b>FROM:</b> {memo.senderName} ({memo.sender?.branch ? `${memo.sender.branch} - ` : ''}
              {memo.senderDept})
            </Text>
            {memo.isRevisedByHead && (
              <Badge color="grape" variant="light" size="9px" radius="sm">
                Amended by Head
              </Badge>
            )}
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
          SUBJECT: {memo.subject}
        </Text>

        <Divider my="xs" w="100%" style={{ opacity: 0.5 }} />
        <Text fz="sm" c="dimmed" lineClamp={4} style={{ whiteSpace: 'pre-wrap' }}>
          {memo.content}
        </Text>
      </UnstyledButton>

      {/* ----- CARD FOOTER: Buttons ----- */}
      <Group
        justify="space-between"
        p="md"
        style={{
          borderTop: '1px solid light-dark(var(--mantine-color-gray-2), var(--mantine-color-dark-5))',
          backgroundColor: 'light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-8))',
          marginTop: 'auto',
        }}
      >
        <Group gap="xs">
          {hasThread && (
            <Button
              size="xs"
              variant="outline"
              color="teal"
              leftSection={<IconGitBranch size={13} />}
              onClick={() => onViewThread(memo)}
            >
              History Thread
            </Button>
          )}
          <Button
            size="xs"
            variant="outline"
            color="gray"
            leftSection={<IconPrinter size={13} />}
            onClick={() => onPrint(memo)}
          >
            Print
          </Button>
        </Group>

        <Group gap="xs">
          {/* Approval tab: Department Head actions */}
          {isApprovalTab && (isDepartmentHead || isAdminOrSuper) && (
            <Group gap={4}>
              <Button
                size="xs"
                color="indigo"
                leftSection={<IconEdit size={13} />}
                onClick={() => onSuperEdit(memo)}
              >
                Review & Approve
              </Button>
              <Button
                size="xs"
                color="red"
                onClick={() =>
                  triggerActionPasswordCheck('DISAPPROVE_DRAFT', { memoId: memo.id })
                }
              >
                Disapprove
              </Button>
            </Group>
          )}

          {/* Recipient actions */}
          {isDepartmentHead && myRecipientInfo?.status === 'PENDING' && !isApprovalTab && (
            <Group gap={4}>
              <Button
                size="xs"
                color="green"
                leftSection={<IconCheck size={13} />}
                onClick={() =>
                  triggerActionPasswordCheck('ACKNOWLEDGE', {
                    memoId: memo.id,
                    departmentName: activeDepartment,
                  })
                }
              >
                {memo.purpose === 'FYI' ? 'Acknowledge & Close' : 'Acknowledge'}
              </Button>
              <Button
                size="xs"
                color="red"
                onClick={() =>
                  triggerActionPasswordCheck('DENY', {
                    memoId: memo.id,
                    departmentName: activeDepartment,
                  })
                }
              >
                Deny Inbound
              </Button>
            </Group>
          )}

          {myRecipientInfo?.status === 'ACKNOWLEDGED' && (
            <Button
              size="xs"
              color="orange"
              leftSection={<IconPlayerPlay size={13} />}
              onClick={() =>
                triggerActionPasswordCheck('START_PROCESSING', {
                  memoId: memo.id,
                  departmentName: activeDepartment,
                })
              }
            >
              Process
            </Button>
          )}

          {/* Sender: Resolve & Close */}
          {amISender && memo.status === 'APPROVED' && memo.purpose !== 'FYI' && 
            memo.recipients?.every(r => {
              // ✅ Kasama na ang COMPLETED bilang tapos na
              if (['CLOSED', 'DENIED', 'COMPLETED'].includes(r.status)) return true;
              return false;
            }) && (
              <Button
                size="xs"
                color="teal"
                leftSection={<IconFileCheck size={13} />}
                onClick={() =>
                  triggerActionPasswordCheck('CLOSED', {
                    memoId: memo.id,
                    isSenderClosing: true,
                  })
                }
              >
                Resolve & Close
              </Button>
            )}
            
          {/* Complete button - para sa recipient staff */}
          {!amISender && memo.status === 'APPROVED' && memo.purpose !== 'FYI' && 
          myRecipientInfo?.status === 'PROCESSING' && !myRecipientInfo?.recipientConfirmedAt && (
            <Button
              size="xs"
              color="green"
              leftSection={<IconCircleCheck size={13} />}
              onClick={() =>
                triggerActionPasswordCheck('CLOSED', {
                  memoId: memo.id,
                  departmentName: activeDepartment,
                  isSenderClosing: false,
                })
              }
            >
              Mark as Completed
            </Button>
          )}

          {/* Advanced collaboration & override block */}
          {(() => {
            const isUnderProcessing = myRecipientInfo?.status === 'PROCESSING';
            const isAcknowledged = myRecipientInfo?.status === 'ACKNOWLEDGED';

            return (
              <Group gap={4}>
                {/* Department Head: Force Complete */}
                {isDepartmentHead && (isUnderProcessing || isAcknowledged) && (
                  <Button
                    size="xs"
                    color="teal"
                    variant="filled"
                    onClick={() =>
                      triggerActionPasswordCheck('CLOSED', {
                        memoId: memo.id,
                        departmentName: activeDepartment,
                        isSenderClosing: false, // ✅ ito ay recipient closing
                      })
                    }
                  >
                    Head Force Complete
                  </Button>
                )}

                {/* Staff: Complete (kapag PROCESSING at hindi pa confirmed) */}
                {isUnderProcessing && !isDepartmentHead && memo.purpose !== 'FYI' && (
                  <Group gap={4}>
                    {!amIAlreadyProcessing && (
                      <Button
                        size="xs"
                        color="indigo"
                        variant="light"
                        onClick={() =>
                          triggerActionPasswordCheck('JOIN_PROCESSING', {
                            memoId: memo.id,
                            departmentName: activeDepartment,
                          })
                        }
                      >
                        Join Process
                      </Button>
                    )}
                    <Button
                      size="xs"
                      color="green"
                      onClick={() =>
                        triggerActionPasswordCheck('CLOSED', {
                          memoId: memo.id,
                          departmentName: activeDepartment,
                          isSenderClosing: false, // ✅ explicit
                        })
                      }
                    >
                      Complete
                    </Button>
                  </Group>
                )}
              </Group>
            );
          })()}

          {/* Reply button */}
          {(() => {
            const isMemoDenied = memo.recipients?.some((r) => r.status === 'DENIED');
            const isAlreadyResponded = memo.recipients?.some((r) => r.status === 'RESPONDED');
            const finalDisableReply = disableReply || isMemoDenied || isAlreadyResponded;
            let buttonText = 'Reply';
            if (isMemoDenied) buttonText = 'Reply Disabled (Denied)';
            if (isAlreadyResponded) buttonText = 'Already Responded';

            return (
              <Button
                size="xs"
                variant={finalDisableReply ? 'subtle' : 'light'}
                color={finalDisableReply ? 'gray' : 'blue'}
                disabled={finalDisableReply}
                leftSection={<IconMessageReply size={13} />}
                onClick={() => onReply(memo)}
              >
                {buttonText}
              </Button>
            );
          })()}
        </Group>
      </Group>
    </Card>
  );
}