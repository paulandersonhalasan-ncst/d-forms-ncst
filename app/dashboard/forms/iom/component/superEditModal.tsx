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
  retainedAttachments: string[];
  setRetainedAttachments: (val: string[] | ((prev: string[]) => string[])) => void;
  newAttachments: File[];
  setNewAttachments: (val: File[] | ((prev: File[]) => File[])) => void;
  confirmPassword: string;
  setConfirmPassword: (val: string) => void;
  passError: string;
  submitting: boolean;
  onSubmit: () => void;
}

export default function SuperEditModal({
  opened,
  onClose,
  subject,
  setSubject,
  content,
  setContent,
  retainedAttachments,
  setRetainedAttachments,
  newAttachments,
  setNewAttachments,
  confirmPassword,
  setConfirmPassword,
  passError,
  submitting,
  onSubmit,
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
        <Alert icon={<IconInfoCircle size={16} />} title="Super Editor System Control" color="indigo" radius="md">
          As Department Head, any inline edits made to the original subject or text below will flag
          the finalized memo as <Badge color="grape" size="xs" variant="filled">Amended by Head</Badge>{' '}
          across recipient trackers.
        </Alert>

        <TextInput
          label="Subject Reference Header"
          value={subject}
          onChange={(e) => setSubject(e.currentTarget.value)}
          required
        />

        <Textarea
          label="Memorandum Body Content"
          value={content}
          onChange={(e) => setContent(e.currentTarget.value)}
          minRows={6}
          autosize
          required
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