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
} from '@tabler/icons-react';
import { Memo, UserContext } from './types';

interface ViewMemoModalProps {
  opened: boolean;
  onClose: () => void;
  memo: Memo | null;
  currentUser: UserContext | null;
  activeDepartment: string;
  isAdminOrSuper: boolean;
  isDepartmentHead: boolean;
  processOICAllowance: boolean;
  onPrint: (memo: Memo) => void;
  triggerActionPasswordCheck: (
    type: 'CREATE' | 'ACKNOWLEDGE' | 'START_PROCESSING' | 'DENY' | 'CLOSED' | 'APPROVE_MEMO' | 'DISAPPROVE_DRAFT' | 'JOIN_PROCESSING',
    data: Record<string, unknown>
  ) => void;
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
}: ViewMemoModalProps) {
  if (!memo) return null;

  const isSenderOfExpanded = memo.senderId === currentUser?.id;
  const recipientRow = memo.recipients?.find((r) => r.departmentName === activeDepartment);
  const hasResponded = recipientRow && ['RESPONDED', 'COMPLETED', 'CLOSED', 'DENIED'].includes(recipientRow.status);

  const isRecipient = !!recipientRow;

  // ✅ Check kung ang current user ay ang sender o kabilang sa sender department
  const isSender = memo.senderDept === activeDepartment;

  // ✅ Check kung ang recipient ay pending (para sa Start Processing at Deny)
  const isPending = recipientRow?.status === 'PENDING';

  // ✅ Check kung ang recipient ay processing (para sa Mark as Completed)
  const isProcessing = recipientRow?.status === 'PROCESSING';

  // ✅ Check kung Department Head ang current user (may override)
  const canForceClose = isDepartmentHead || isAdminOrSuper;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={memo.subject}
      size="lg"
      radius="md"
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
              {memo.isRevisedByHead && (
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
            SUBJECT: {memo.subject}
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
          {memo.recipients?.map((rec) => (
            <Group
              key={rec.id}
              justify="space-between"
              p="xs"
              style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: '6px' }}
            >
              <Stack gap={2}>
                <Text size="xs" fw={700}>
                  {rec.departmentName}
                </Text>
                {rec.feedbackNote && (
                  <Text size="11px" c="orange">
                    Remarks: {rec.feedbackNote}<br></br>Timestamp: {rec.recipientConfirmedAt ? new Date(rec.recipientConfirmedAt).toLocaleString() : 'N/A'}
                  </Text>
                )}
                {/* 🆕 Closed by information */}
                {rec.status === 'CLOSED' && rec.closedByName && (
                  <Text size="10px" c="dimmed">
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
          ))}
        </Stack>

        {/* Dynamic footer: Print + Actions + Close */}
        <Group justify="space-between" mt="xl" pt="md" style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}>
          <Button
            size="xs"
            variant="outline"
            color="gray"
            leftSection={<IconPrinter size={13} />}
            onClick={() => onPrint(memo)}
          >
            Print Document
          </Button>

          <Group gap="xs">
            {memo && memo.status !== 'CLOSED' && memo.status !== 'DENIED' && recipientRow && (
              <>
                {/* ===== FYI ===== */}
                {memo.purpose === 'FYI' && recipientRow.status === 'PENDING' && (
                  <Button
                    size="xs"
                    color="blue"
                    leftSection={<IconCheck size={13} />}
                    onClick={() =>
                      triggerActionPasswordCheck('ACKNOWLEDGE', {
                        memoId: memo.id,
                        departmentName: activeDepartment,
                      })
                    }
                  >
                    Acknowledge & Close FYI
                  </Button>
                )}

                {/* ===== Non-FYI ===== */}
                {memo.purpose !== 'FYI' && (
                  <>
                    {/* Kapag PENDING: Start Processing at Deny */}
                    {recipientRow.status === 'PENDING' && (
                      <>
                        <Button
                          size="xs"
                          color="orange"
                          leftSection={<IconPlayerPlay size={13} />}
                          onClick={() =>
                            triggerActionPasswordCheck('ACKNOWLEDGE', {
                              memoId: memo.id,
                              departmentName: activeDepartment,
                            })
                          }
                        >
                          Start Processing
                        </Button>
                        <Button
                          size="xs"
                          color="red"
                          variant="light"
                          leftSection={<IconMessageReply size={13} />}
                          onClick={() =>
                            triggerActionPasswordCheck('DENY', {
                              memoId: memo.id,
                              departmentName: activeDepartment,
                            })
                          }
                        >
                          Deny / Return
                        </Button>
                      </>
                    )}

                    {/* Kapag PROCESSING: Complete at Deny (recipient side) */}
                    {recipientRow?.status === 'PROCESSING' && (
                      <>
                        {!recipientRow?.recipientConfirmedAt && (
                          <Button
                            size="xs"
                            color="green"
                            leftSection={<IconCircleCheck size={13} />}
                            onClick={() =>
                              triggerActionPasswordCheck('CLOSED', {
                                memoId: memo.id,
                                departmentName: recipientRow.departmentName,
                                isSenderClosing: false,
                              })
                            }
                          >
                            Mark as Completed
                          </Button>
                        )}
                        <Button
                          size="xs"
                          color="red"
                          variant="light"
                          leftSection={<IconMessageReply size={13} />}
                          onClick={() =>
                            triggerActionPasswordCheck('DENY', {
                              memoId: memo.id,
                              departmentName: activeDepartment,
                            })
                          }
                        >
                          Deny / Return
                        </Button>
                      </>
                    )}
                  </>
                )}

                {/* ===== Sender actions: Verify & Close (non-FYI only) ===== */}
                {memo.purpose !== 'FYI' &&
                  memo.senderDept === activeDepartment &&
                  recipientRow.status === 'PROCESSING' &&
                  !recipientRow.senderConfirmedAt && (
                    <Button
                      size="xs"
                      color="purple"
                      leftSection={<IconUserCheck size={13} />}
                      onClick={() =>
                        triggerActionPasswordCheck('CLOSED', {
                          memoId: memo.id,
                          departmentName: recipientRow.departmentName,
                          isSenderClosing: true,
                        })
                      }
                    >
                      Verify & Close (Sender Lock)
                    </Button>
                  )}
              </>
            )}

            <Button size="xs" color="dark" onClick={onClose}>
              Close Window
            </Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}