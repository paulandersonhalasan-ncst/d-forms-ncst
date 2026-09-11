'use client';

import {
  Modal,
  Stack,
  Card,
  SimpleGrid,
  Text,
  Group,
  Badge,
  Divider,
  Alert,
  Paper,
  ThemeIcon,
  Button,
  Box,
  ActionIcon,
  Select
} from '@mantine/core';
import {
  IconInfoCircle,
  IconFile,
  IconFileTypePdf,
  IconPhoto,
  IconDownload,
  IconPrinter,
  IconCheck,
  IconPlayerPlay,
  IconCircleCheck,
  IconMessageReply,
  IconUserCheck,
  IconThumbUp,
  IconEdit,
  IconGitBranch,
  IconFileCheck,
} from '@tabler/icons-react';
import { Memo, UserContext } from './types';
import { useState } from 'react';

interface ViewMemoModalProps {
  opened: boolean;
  onClose: () => void;
  memo: Memo | null;
  currentUser: UserContext | null;
  activeDepartment: string;
  isAdminOrSuper: boolean;
  isDepartmentHead: boolean;
  processOICAllowance: boolean;
  totalDepartments: number;
  isApprovalTab: boolean;
  isHeadOrOIC: boolean;
  onSuperEdit: (memo: Memo, mode: 'edit' | 'approve') => void;
  departmentStaff: { id: string; fname: string; lname: string }[];
  allMemos: Memo[];
  onReply: (memo: Memo) => void;
  onPrint: (memo: Memo) => void;
  triggerActionPasswordCheck: (
    type: 'CREATE' | 'ACKNOWLEDGE' | 'START_PROCESSING' | 'DENY' | 'CLOSED' | 'APPROVE' | 'DISAPPROVE_DRAFT' | 'JOIN_PROCESSING' | 'ASSIGN',
    data: Record<string, unknown>
  ) => void;
  onViewThread?: (memo: Memo) => void;
}

export default function ViewMemoModal({
  opened,
  onClose,
  memo,
  currentUser,
  activeDepartment,
  isAdminOrSuper,
  isDepartmentHead,
  processOICAllowance,
  onPrint,
  triggerActionPasswordCheck,
  totalDepartments = 0,
  isApprovalTab = false,
  isHeadOrOIC = false,
  onSuperEdit,
  departmentStaff = [],
  allMemos = [],
  onReply,
  onViewThread
}: ViewMemoModalProps) {

  const [assignedStaffId, setAssignedStaffId] = useState<string | null>(null);
  if (!memo) return null;
  const isSenderOfExpanded = memo.senderId === currentUser?.id;
  const recipientRow = memo.recipients?.find((r) => r.departmentName === activeDepartment);
  const hasResponded = recipientRow && ['RESPONDED', 'COMPLETED', 'CLOSED', 'DENIED'].includes(recipientRow.status);

  const isImported = memo.referenceId?.startsWith('IMPORT-') || false;

  const isRecipient = !!recipientRow;

  // ✅ Check kung ang current user ay ang sender o kabilang sa sender department
  const isSender = memo.senderDept === activeDepartment;

  // ✅ Check kung ang recipient ay pending (para sa Start Processing at Deny)
  const isPending = recipientRow?.status === 'PENDING';

  // ✅ Check kung ang recipient ay processing (para sa Mark as Completed)
  const isProcessing = recipientRow?.status === 'PROCESSING';

  // ✅ Check kung Department Head ang current user (may override)
  const canForceClose = isDepartmentHead || isAdminOrSuper;

  const currentUserName = currentUser ? `${currentUser.fname} ${currentUser.lname}` : '';
  const amIAlreadyProcessing = recipientRow?.processedByName?.includes(currentUserName) || false;

  // ==========================================
  // COMPUTED VARIABLES (PARA SA MGA ACTIONS)
  // ==========================================
  const amISender = memo.senderId === currentUser?.id;
  const isAcknowledged = recipientRow?.status === 'ACKNOWLEDGED';

  const isMemoResolvedForMe = ['COMPLETED', 'RESPONDED', 'DENIED', 'CLOSED'].includes(
    recipientRow?.status || ''
  );

  const isAllResolved =
    memo.senderId === currentUser?.id &&
    memo.recipients?.every((r) => ['COMPLETED', 'RESPONDED', 'DENIED', 'CLOSED'].includes(r.status));

  const disableReply =
    isImported ||
    (!isAdminOrSuper && (isMemoResolvedForMe || isAllResolved || memo.status === 'FOR_APPROVAL'));

  // Thread count
  const rootId = memo.rootMemoId || memo.id;
  const threadCount = allMemos.filter((m) => m.rootMemoId === rootId || m.id === rootId).length;

  // Processing recipients
  const processingRecipients = memo.recipients?.filter((r) => r.status === 'PROCESSING') || [];
  const isBeingProcessed = processingRecipients.length > 0;

  const displaySubject = memo.revisedSubject || memo.subject;
  const displayHeadNote = memo.revisedHeadNote || memo.headNote;

  const hasAmended = !!(memo.revisedSubject || memo.revisedHeadNote || memo.isRevisedByHead);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={displaySubject}
      size="lg"
      radius="md"
      zIndex={5000}
    >
      <Stack gap="md">
        <Card withBorder p="md" bg="light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-8))">
          <SimpleGrid cols={2} spacing="xs">
            <Text size="xs">
              <b>Reference ID:</b> {memo.referenceId || 'DRAFT (Review Queue)'}
            </Text>
            <Text size="xs">
              <b>Date:</b> {new Date(memo.createdAt).toLocaleString()}
            </Text>
            <Group gap={6} align="center">
              <Text size="xs">
                <b>From:</b> {memo.senderName} ({memo.senderDept})
              </Text>
              {hasAmended && (
                <Badge color="grape" size="xs" variant="light">
                  Amended by Head
                </Badge>
              )}
            </Group>
            <Text size="xs">
              <b>Purpose:</b> {memo.purpose}
            </Text>
          </SimpleGrid>

          {memo.isRevisedByHead && (
            <Alert color="grape" p="xs" mt="sm" icon={<IconInfoCircle size={14} />}>
              Note: This memorandum was modified and fine-tuned directly by the Department Head
              before approval.
              <br />
              <br />
              Paalala: ang memorandum na ito ay direktang binago ng pinanggalingang Department Head
              bago na-aprubahan.
            </Alert>
          )}

          <Divider my="sm" />
          <Text size="sm" fw={700} mb="xs">
            SUBJECT: {displaySubject}   {/* ← palitan ang memo.subject */}
          </Text>
          <Text size="sm" style={{ whiteSpace: 'pre-wrap' }} c="dimmed">
            {memo.content}
          </Text>

          {/* Attachments - lalabas lang kung may files */}
          {memo.attachmentPaths && memo.attachmentPaths.length > 0 && (
            <Stack gap="xs" mt="md">
              <Text size="sm" fw={700}>
                📎 Attachment/s:
              </Text>
              {memo.attachmentPaths.map((pathString, index) => {
                const fileName =
                  pathString.split('/').pop()?.replace(/^\d+-(\d+-)?/, '') || `Attachment ${index + 1}`;
                const lowerName = fileName.toLowerCase();
                const isPdf = lowerName.endsWith('.pdf');
                const isImage =
                  lowerName.endsWith('.png') ||
                  lowerName.endsWith('.jpg') ||
                  lowerName.endsWith('.jpeg') ||
                  lowerName.endsWith('.webp');

                return (
                  <Paper
                    key={index}
                    component="a"
                    href={pathString}
                    target="_blank"
                    withBorder
                    p="sm"
                    radius="md"
                    style={{
                      textDecoration: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = 'var(--mantine-shadow-sm)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '';
                    }}
                  >
                    <Group justify="space-between" wrap="nowrap">
                      <Group gap="sm" wrap="nowrap">
                        <ThemeIcon
                          variant="light"
                          color={isPdf ? 'red' : isImage ? 'green' : 'blue'}
                          size="lg"
                        >
                          {isPdf ? <IconFileTypePdf size={16} /> : isImage ? <IconPhoto size={16} /> : <IconFile size={16} />}
                        </ThemeIcon>
                        <div style={{ overflow: 'hidden' }}>
                          <Text size="sm" fw={500} truncate>
                            {fileName}
                          </Text>
                          <Text size="xs" c="dimmed">
                            Click to view or download
                          </Text>
                        </div>
                      </Group>
                      <ThemeIcon variant="light" color="blue">
                        <IconDownload size={14} />
                      </ThemeIcon>
                    </Group>
                  </Paper>
                );
              })}
            </Stack>
          )}
        </Card>

        {/* Recipient matrix */}
        <Text size="xs" fw={700}>
          Recipients Status:
        </Text>
        <Stack gap={6}>
          {memo.recipients?.map((rec) => {
            // ✅ Determine timestamp based on status
            let actionTimestamp = null;
            let actionLabel = '';

            if (rec.status === 'PENDING') {
              actionTimestamp = null;
              actionLabel = 'Awaiting action';
            } else if (rec.status === 'ACKNOWLEDGED') {
              actionTimestamp = rec.acknowledgedAt || rec.respondedAt;
              actionLabel = 'Acknowledged';
            } else if (rec.status === 'PROCESSING') {
              actionTimestamp = rec.processedAt || rec.respondedAt;
              actionLabel = 'Processing';
            } else if (rec.status === 'COMPLETED') {
              actionTimestamp = rec.completedAt || rec.recipientConfirmedAt;
              actionLabel = 'Completed';
            } else if (rec.status === 'CLOSED') {
              actionTimestamp = rec.closedAt || rec.senderConfirmedAt || rec.recipientConfirmedAt;
              actionLabel = 'Closed';
            } else if (rec.status === 'DENIED') {
              actionTimestamp = rec.deniedAt;
              actionLabel = 'Denied';
            } else if (rec.status === 'RESPONDED') {
              actionTimestamp = rec.respondedAt;
              actionLabel = 'Replied';
            }

            // ✅ Kunin ang pinakabagong history entry para sa department na ito
            const deptHistory = memo.history
              ?.filter((h) => h.departmentName === rec.departmentName)
              ?.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) || [];

            const latestDeptRemark = deptHistory.length > 0 ? deptHistory[0] : null;

            // ✅ Kung pending, walang remark
            const showRemark = rec.status !== 'PENDING' && latestDeptRemark?.remarks;

            return (
              <Group
                key={rec.id}
                justify="space-between"
                p="xs"
                style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: '6px' }}
              >
                <Stack gap={2} style={{ flex: 1 }}>
                  <Text size="xs" fw={700}>
                    {rec.departmentName}
                  </Text>

                  {/* Remarks from recipient's feedbackNote */}
                  {rec.feedbackNote && (
                    <Text size="xs" c="orange">
                      Remarks: {rec.feedbackNote}
                    </Text>
                  )}

                  {/* ✅ Per-department latest remark (hindi na global) */}
                  {showRemark && (
                    <Paper withBorder p="sm" radius="md" bg="light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-8))">
                      <Stack gap={2}>
                        <Group gap="xs">
                          <Text size="xs" fw={700}>Latest Remark:</Text>
                          <Text size="xs" c="dimmed" style={{ whiteSpace: 'pre-wrap' }}>
                            {latestDeptRemark.remarks}
                          </Text>
                        </Group>
                        <Group gap="xs">
                          <Text size="10px" c="dimmed">
                            <b>By:</b> {latestDeptRemark.performedByName}
                            ({latestDeptRemark.actorRole === 'SENDER' ? 'Sender' :
                              latestDeptRemark.actorRole === 'RECIPIENT' ? 'Recipient' : 'System'})
                          </Text>
                          <Text size="10px" c="dimmed">
                            <b>At:</b> {new Date(latestDeptRemark.createdAt).toLocaleString()}
                          </Text>
                        </Group>
                      </Stack>
                    </Paper>
                  )}

                  {/* ✅ Kung pending, magpakita ng placeholder */}
                  {rec.status === 'PENDING' && (
                    <Text size="xs" c="dimmed" fs="italic">
                      No action taken yet — awaiting acknowledgment.
                    </Text>
                  )}

                  {/* Timestamp for action */}
                  {actionTimestamp && (
                    <Text size="13px" c="dimmed">
                      {actionLabel}: {new Date(actionTimestamp).toLocaleString()}
                    </Text>
                  )}

                  {/* Closed by information */}
                  {rec.status === 'CLOSED' && rec.closedByName && (
                    <Text size="13px" c="dimmed">
                      Closed by: {rec.closedByName}
                    </Text>
                  )}
                </Stack>

                <Badge
                  color={
                    rec.status === 'RESPONDED'
                      ? 'green'
                      : rec.status === 'DENIED'
                      ? 'red'
                      : rec.status === 'PROCESSING'
                      ? 'orange'
                      : rec.status === 'CLOSED'
                      ? 'blue'
                      : 'gray'
                  }
                  variant="filled"
                  size="xs"
                >
                  {rec.status}
                </Badge>
              </Group>
            );
          })}
        </Stack>

        {/* Assigned to (array) */}
          {recipientRow?.assignedToNames && recipientRow.assignedToNames.length > 0 && (
            <Text size="xs" c="dimmed">
              <b>Assigned to:</b> {recipientRow.assignedToNames.join(', ')}
              {recipientRow.assignedAt && ` (${new Date(recipientRow.assignedAt).toLocaleString()})`}
            </Text>
          )}

        {/* Dynamic footer: All Buttons in One Row */}
        <Group gap="xs" wrap="wrap" mt="xl" pt="md" style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}>
          {/* Thread History - laging visible */}
          {threadCount > 1 && (
            <Button
              size="xs"
              variant="outline"
              color="teal"
              leftSection={<IconGitBranch size={13} />}
              onClick={() => onViewThread && onViewThread(memo)}
            >
              History Thread ({threadCount})
            </Button>
          )}

          {/* Print - laging visible */}
          <Button
            size="xs"
            variant="outline"
            color="gray"
            leftSection={<IconPrinter size={13} />}
            onClick={() => onPrint(memo)}
          >
            Print Document
          </Button>

          {/* ✅ Lahat ng actions ay naka-wrap sa !isImported */}
          {!isImported && (
            <>
              {/* ===== APPROVAL TAB ACTIONS ===== */}
              {isApprovalTab && (isHeadOrOIC || isAdminOrSuper) && (
                <>
                  <Button
                    size="xs"
                    color="indigo"
                    variant="light"
                    leftSection={<IconEdit size={13} />}
                    onClick={() => onSuperEdit(memo, 'edit')}
                  >
                    Revise
                  </Button>
                  <Button
                    size="xs"
                    color="green"
                    leftSection={<IconThumbUp size={13} />}
                    onClick={() => triggerActionPasswordCheck('APPROVE', { memoId: memo.id })}
                  >
                    Approve
                  </Button>
                  <Button
                    size="xs"
                    color="red"
                    onClick={() => triggerActionPasswordCheck('DISAPPROVE_DRAFT', { memoId: memo.id })}
                  >
                    Disapprove
                  </Button>
                </>
              )}

              {/* ===== RECIPIENT ACTIONS (HEAD/OIC ONLY) ===== */}
              {isHeadOrOIC && isPending && !isApprovalTab && (
                <>
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
                </>
              )}

              {/* ===== STAFF: PROCESS BUTTON ===== */}
              {!isHeadOrOIC && recipientRow?.status === 'ACKNOWLEDGED' && (
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
                  Process (Assign to Me)
                </Button>
              )}

              {/* ===== SENDER: RESOLVE & CLOSE ===== */}
              {amISender && memo.status === 'APPROVED' && memo.purpose !== 'FYI' &&
                memo.recipients?.every(r => {
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

              {/* ===== ADVANCED COLLABORATION ===== */}
              {(() => {
                const isUnderProcessing = recipientRow?.status === 'PROCESSING';
                return (
                  <>
                    {isHeadOrOIC && (isUnderProcessing || isAcknowledged) && (
                      <Button
                        size="xs"
                        color="teal"
                        variant="filled"
                        onClick={() =>
                          triggerActionPasswordCheck('CLOSED', {
                            memoId: memo.id,
                            departmentName: activeDepartment,
                            isSenderClosing: false,
                          })
                        }
                      >
                        Head Force Complete
                      </Button>
                    )}

                    {isUnderProcessing && !isHeadOrOIC && memo.purpose !== 'FYI' && (
                      <>
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
                        {amIAlreadyProcessing && !recipientRow?.recipientConfirmedAt && (
                          <Button
                            size="xs"
                            color="green"
                            onClick={() =>
                              triggerActionPasswordCheck('CLOSED', {
                                memoId: memo.id,
                                departmentName: activeDepartment,
                                isSenderClosing: false,
                              })
                            }
                          >
                            Complete
                          </Button>
                        )}
                      </>
                    )}
                  </>
                );
              })()}

              {/* ===== DEPARTMENT HEAD: ASSIGN TO STAFF ===== */}
              {isHeadOrOIC && recipientRow?.status === 'ACKNOWLEDGED' && (
                <>
                  <Select
                    size="xs"
                    placeholder="Assign to staff..."
                    data={departmentStaff.map((s) => ({
                      value: s.id,
                      label: `${s.fname} ${s.lname}`,
                    }))}
                    value={assignedStaffId}
                    onChange={setAssignedStaffId}
                    style={{ width: 120 }}
                    styles={{
                      dropdown: { zIndex: 5000 },
                    }}
                  />
                  <Button
                    size="xs"
                    color="indigo"
                    onClick={() => {
                      if (assignedStaffId) {
                        triggerActionPasswordCheck('ASSIGN', {
                          memoId: memo.id,
                          departmentName: activeDepartment,
                          assignedToId: assignedStaffId,
                        });
                        setAssignedStaffId(null);
                      }
                    }}
                    disabled={!assignedStaffId}
                  >
                    Assign
                  </Button>
                </>
              )}

              {/* ===== REPLY BUTTON ===== */}
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
                    onClick={() => onReply && onReply(memo)}
                  >
                    {buttonText}
                  </Button>
                );
              })()}
            </>
          )}

          {/* ===== CLOSE WINDOW - laging visible ===== */}
          <Button size="xs" color="dark" onClick={onClose}>
            Close Window
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}