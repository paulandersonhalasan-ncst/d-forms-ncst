// components/SuperEditModal.tsx
'use client';

import {
  Modal,
  Stack,
  TextInput,
  Textarea,
  Group,
  Button,
  PasswordInput,
  Divider,
  Text,
  Paper,
  ThemeIcon,
  ActionIcon,
  FileInput,
  Alert,
  Badge
} from '@mantine/core';
import { IconEdit, IconInfoCircle, IconFile, IconTrash, IconThumbUp } from '@tabler/icons-react';

interface SuperEditModalProps {
  opened: boolean;
  onClose: () => void;
  subject: string;
  setSubject: (val: string) => void;
  content: string;
  setContent: (val: string) => void;
  headNote: string;
  setHeadNote: (val: string) => void;
  retainedAttachments: string[];
  setRetainedAttachments: (val: string[] | ((prev: string[]) => string[])) => void;
  newAttachments: File[];
  setNewAttachments: (val: File[] | ((prev: File[]) => File[])) => void;
  confirmPassword: string;
  setConfirmPassword: (val: string) => void;
  passError: string;
  submitting: boolean;
  onSubmit: () => void;
  feedbackNote: string;
  setFeedbackNote: (val: string) => void;
}

export default function SuperEditModal({
  opened,
  onClose,
  subject,
  setSubject,
  content,
  setContent,
  headNote,
  setHeadNote,
  retainedAttachments,
  setRetainedAttachments,
  newAttachments,
  setNewAttachments,
  confirmPassword,
  setConfirmPassword,
  passError,
  submitting,
  onSubmit,
  feedbackNote,
  setFeedbackNote
}: SuperEditModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconEdit size={18} color="indigo" />
          <Text fw={700}>Review, Edit & Authorize Dispatch</Text>
        </Group>
      }
      size="lg"
      radius="md"
    >
      <Stack gap="md">
        <Alert icon={<IconInfoCircle size={16} />} title="Super Editor Review" color="indigo" radius="md">
          As Department Head, you can include your own <b>additional notes</b> to this draft. The original content will remain.
          <br />
          <Badge color="grape" size="xs" variant="filled" mt={4}>Original content is read-only</Badge>
        </Alert>

        <TextInput
          label="Subject Reference Header"
          value={subject}
          onChange={(e) => setSubject(e.currentTarget.value)}
          required
        />

        {/* ✅ Original content - read only */}
        <Textarea
          label="Original Memorandum Body Content (Read-Only)"
          value={content}
          readOnly
          minRows={6}
          autosize
          styles={{ input: { backgroundColor: 'var(--mantine-color-gray-1)' } }}
        />

        {/* ✅ Head Note - additional remarks */}
        <Textarea
          label="Department Head Notes (Optional)"
          placeholder="Add your feedback, corrections, or additional instructions here..."
          value={headNote}
          onChange={(e) => setHeadNote(e.currentTarget.value)}
          minRows={3}
          autosize
          required
          description="This note will be appended to the memo content and visible to all recipients."
        />

        <Textarea
          label="Feedback Note (Required)"
          placeholder="State your reason or feedback for this approval..."
          required
          value={feedbackNote}
          onChange={(e) => setFeedbackNote(e.currentTarget.value)}
          minRows={2}
          description="This will be recorded in the audit trail and visible to all parties."
        />

        <Stack>
          <Text fw={600}>Current Attachments</Text>
          <Stack gap="xs">
            {retainedAttachments.map((file) => (
              <Paper
                key={file}
                component="a"
                href={file}
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
                    <ThemeIcon variant="light" color="blue" size="lg">
                      <IconFile size={16} />
                    </ThemeIcon>
                    <div style={{ overflow: 'hidden' }}>
                      <Text size="sm" fw={500} truncate c="dark">
                        {file.split('/').pop()}
                      </Text>
                      <Text size="xs" c="dimmed">
                        Click to preview attachment
                      </Text>
                    </div>
                  </Group>
                  <ActionIcon
                    color="red"
                    variant="subtle"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setRetainedAttachments((prev) => prev.filter((p) => p !== file));
                    }}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Group>
              </Paper>
            ))}
          </Stack>

          <FileInput
            multiple
            label="Add New Attachments"
            placeholder="Add Additional File/s if necessary..."
            value={newAttachments}
            onChange={(files) => setNewAttachments(files || [])}
          />
        </Stack>

        <Divider my="xs" label="Digital Verification Signature" labelPosition="center" />

        <PasswordInput
          label="Your Signature Security Password"
          placeholder="Your NCST E-Forms password..."
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.currentTarget.value)}
          error={passError}
        />

        <Group justify="flex-end" mt="md">
          <Button variant="light" color="gray" onClick={onClose}>
            Cancel
          </Button>
          <Button color="indigo" loading={submitting} leftSection={<IconThumbUp size={16} />} onClick={onSubmit}>
            Approve, Sign & Dispatch
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}