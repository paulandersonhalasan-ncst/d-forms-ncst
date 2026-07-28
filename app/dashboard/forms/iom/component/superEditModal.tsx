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
  mode: 'edit' | 'approve';
  subject: string;
  setSubject: (val: string) => void;
  content: string;
  setContent: (val: string) => void; // hindi na ginagamit, nandito lang para sa type
  headNote: string;
  setHeadNote: (val: string) => void;
  feedbackNote: string;
  setFeedbackNote: (val: string) => void;
  retainedAttachments: string[];
  setRetainedAttachments: (val: string[] | ((prev: string[]) => string[])) => void;
  newAttachments: File[];
  setNewAttachments: (val: File[] | ((prev: File[]) => File[])) => void;
  confirmPassword: string;
  setConfirmPassword: (val: string) => void;
  passError: string;
  submitting: boolean;
  onSubmit: () => void;
  onRevert: () => void;
  reverting?: boolean;
}

export default function SuperEditModal({
  opened,
  onClose,
  mode,
  subject,
  setSubject,
  content,
  setContent, // hindi ginagamit
  headNote,
  setHeadNote,
  feedbackNote,
  setFeedbackNote,
  retainedAttachments,
  setRetainedAttachments,
  newAttachments,
  setNewAttachments,
  confirmPassword,
  setConfirmPassword,
  passError,
  submitting,
  onSubmit,
  reverting = false,
  onRevert,
}: SuperEditModalProps) {
  const isEditMode = mode === 'edit';

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconEdit size={18} color={isEditMode ? 'blue' : 'indigo'} />
          <Text fw={700}>
            {isEditMode ? 'Revise Draft' : 'Approve & Dispatch'}
          </Text>
        </Group>
      }
      size="lg"
      radius="md"
    >
      <Stack gap="md">
        <Alert
          icon={<IconInfoCircle size={16} />}
          title={isEditMode ? 'Edit Draft' : 'Review & Dispatch'}
          color={isEditMode ? 'blue' : 'indigo'}
          radius="md"
        >
          {isEditMode
            ? 'Edit the subject and add your notes. The draft will remain pending approval.'
            : 'Finalize the memo. Your head note will be appended to the content.'}
        </Alert>

        <TextInput
          label="Subject Reference Header"
          value={subject}
          onChange={(e) => setSubject(e.currentTarget.value)}
          required
        />

        {/* Original content - read only */}
        <Textarea
          label="Original Memorandum Body Content (Read-Only)"
          value={content}
          readOnly
          minRows={6}
          autosize
          styles={{ input: { backgroundColor: 'var(--mantine-color-gray-1)' } }}
        />

        {/* Head Note - additional remarks */}
        <Textarea
          label="Department Head Notes (Optional)"
          placeholder="Add your feedback, corrections, or additional instructions here..."
          value={headNote}
          onChange={(e) => setHeadNote(e.currentTarget.value)}
          minRows={3}
          autosize
          description={
            isEditMode
              ? 'Stored separately; will be appended on approval.'
              : 'Will be appended to the memo content.'
          }
        />

        {/* Feedback note - required only for approve mode */}
        <Textarea
          label="Feedback Note"
          placeholder={
            isEditMode
              ? 'Optional feedback for the staff...'
              : 'State your reason or feedback for this approval...'
          }
          value={feedbackNote}
          onChange={(e) => setFeedbackNote(e.currentTarget.value)}
          minRows={2}
          required={!isEditMode}
          description={
            isEditMode
              ? 'Optional – will be recorded in audit trail.'
              : 'This will be recorded in the audit trail and visible to all parties.'
          }
          error={!isEditMode && !feedbackNote && passError ? 'Feedback note is required for approval.' : null}
        />

        {/* Attachments */}
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
          placeholder="Your NCST D-Forms password..."
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.currentTarget.value)}
          error={passError}
        />

        <Group justify="flex-end" mt="md">
          {isEditMode && (
            <Button variant="outline" color="gray" onClick={onRevert} loading={reverting}>
              Revert to Original
            </Button>
          )}
          <Button variant="light" color="gray" onClick={onClose}>
            Cancel
          </Button>
          <Button
            color={isEditMode ? 'blue' : 'green'}
            loading={submitting}
            leftSection={isEditMode ? <IconEdit size={16} /> : <IconThumbUp size={16} />}
            onClick={onSubmit}
          >
            {isEditMode ? 'Save Revision' : 'Approve & Dispatch'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}