// components/CreateMemoModal.tsx
'use client';

import {
  Modal,
  TextInput,
  Textarea,
  Select,
  MultiSelect,
  FileInput,
  Stack,
  Group,
  Button,
  SimpleGrid,
  Checkbox,
  Paper,
  Text,
  ActionIcon,
  ThemeIcon,
  Box,
  Divider,
} from '@mantine/core';
import { UseFormReturnType } from '@mantine/form';
import { MemoFormValues } from './types';
import {
  IconSend,
  IconTrash,
  IconFile,
  IconFileTypePdf,
  IconPhoto,
  IconUpload,
  IconDeviceFloppy,
} from '@tabler/icons-react';
import { useState } from 'react';

interface CreateMemoModalProps {
  opened: boolean;
  onClose: () => void;
  form: UseFormReturnType<MemoFormValues>;
  departments: { value: string; label: string }[];
  submitting: boolean;
  onSubmit: (values: MemoFormValues) => void;
  onSaveDraft?: (values: MemoFormValues) => void | Promise<void>;
  isReply: boolean;
  isDraftMode?: boolean;
  existingAttachments?: string[];
  setExistingAttachments?: (files: string[] | ((prev: string[]) => string[])) => void;
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getFileMeta = (file: File): { icon: React.ReactNode; color: string; label: string } => {
  if (file.type.startsWith('image/')) {
    return { icon: <IconPhoto size={20} />, color: 'grape', label: 'Image' };
  }
  if (file.type === 'application/pdf') {
    return { icon: <IconFileTypePdf size={20} />, color: 'red', label: 'PDF' };
  }
  return { icon: <IconFile size={20} />, color: 'gray', label: 'File' };
};

export default function CreateMemoModal({
  opened,
  onClose,
  form,
  departments,
  submitting,
  onSubmit,
  onSaveDraft,
  isReply,
  isDraftMode = false,
  existingAttachments = [],
  setExistingAttachments,
}: CreateMemoModalProps) {
  const [sendToAll, setSendToAll] = useState(false);

  const handleSendToAllChange = (checked: boolean) => {
    setSendToAll(checked);
    if (checked) {
      const allValues = departments.map(d => d.value);
      form.setFieldValue('targetDepts', allValues);
    } else {
      form.setFieldValue('targetDepts', []);
    }
  };

  const handleSaveDraftClick = async () => {
    // Only require a subject for drafts — allow partial content/targetDepts
    const subjectResult = form.validateField('subject');
    if (subjectResult.hasError) {
      alert('Please provide a subject before saving as draft.');
      return;
    }
    if (!onSaveDraft) return;

    try {
      await onSaveDraft({
        ...form.values,
        existingAttachments,
      });
    } catch (err) {
      console.error('Save-draft error:', err);
      alert('Failed to save draft');
    }
  };

  // Title handling
  const title = isDraftMode
    ? '📝 Edit Draft Memorandum'
    : isReply
    ? '📝 Write Response Memo'
    : '📝 Construct New Memorandum';

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={title}
      size="lg"
      radius="md"
      centered
      closeOnClickOutside={false}
      zIndex={5000}
      styles={{
        inner: {
          paddingLeft: 'var(--sidebar-offset, 0)',
          transition: 'padding-left 0.25s ease',
        },
      }}
    >
      <form onSubmit={form.onSubmit(onSubmit)}>
        <Stack gap="md">
          <TextInput
            label="Subject Reference Header"
            placeholder="What will the memorandum be about..."
            required
            {...form.getInputProps('subject')}
            disabled={isReply && !isDraftMode}
          />

          <SimpleGrid cols={2}>
            <Select
              label="Priority Level Flags"
              data={['ROUTINE', 'URGENT', 'RUSH']}
              comboboxProps={{ zIndex: 6000 }}
              {...form.getInputProps('priority')}
            />
            <Select
              label="Routing Core Purpose"
              data={['FYI', 'SIGNATURE', 'ACTION', 'COMMENTS', 'APPROVAL', 'REQUEST']}
              comboboxProps={{ zIndex: 6000 }}
              {...form.getInputProps('purpose')}
            />
          </SimpleGrid>

          <MultiSelect
            label="Target Recipient Departments"
            data={departments.filter(d => d.value && d.label)}
            placeholder="Select one or more departments"
            comboboxProps={{ zIndex: 6000 }}
            required={!isDraftMode}
            disabled={isReply || sendToAll}
            {...form.getInputProps('targetDepts')}
            searchable
            description={
              isDraftMode
                ? 'You can leave this empty for now and set recipients before submitting.'
                : undefined
            }
          />

          {!isReply && departments.length > 0 && (
            <Checkbox
              label="All departments"
              checked={sendToAll}
              onChange={(event) => handleSendToAllChange(event.currentTarget.checked)}
            />
          )}

          <Textarea
            label="Memorandum Body Content"
            placeholder="Type the core message here..."
            minRows={6}
            autosize
            required={!isDraftMode}
            {...form.getInputProps('content')}
            description={
              isDraftMode
                ? 'You can leave this partially filled and finish before submitting.'
                : undefined
            }
          />

          {/* ============ EXISTING ATTACHMENTS (draft edit mode) ============ */}
          {isDraftMode && existingAttachments.length > 0 && setExistingAttachments && (
            <Box>
              <Divider
                label={`Currently Attached (${existingAttachments.length})`}
                labelPosition="left"
                mb="xs"
              />
              <Stack gap="xs">
                {existingAttachments.map((url) => {
                  const fileName = url.split('/').pop()?.replace(/^\d+-(\d+-)?/, '') || 'Attachment';
                  const lower = fileName.toLowerCase();
                  const isPdf = lower.endsWith('.pdf');
                  const isImage = /\.(png|jpe?g|gif|webp)$/i.test(lower);
                  return (
                    <Paper
                      key={url}
                      withBorder
                      p="xs"
                      radius="md"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                      }}
                    >
                      <Group gap="sm" style={{ flex: 1, minWidth: 0 }}>
                        <ThemeIcon
                          color={isPdf ? 'red' : isImage ? 'grape' : 'gray'}
                          variant="light"
                          size="md"
                        >
                          {isPdf ? <IconFileTypePdf size={16} /> : isImage ? <IconPhoto size={16} /> : <IconFile size={16} />}
                        </ThemeIcon>
                        <Box style={{ minWidth: 0, flex: 1 }}>
                          <Text size="sm" fw={500} lineClamp={1} title={fileName}>
                            {fileName}
                          </Text>
                          <Text size="xs" c="dimmed">
                            Already uploaded · click to preview
                          </Text>
                        </Box>
                      </Group>
                      <ActionIcon
                        color="red"
                        variant="light"
                        size="md"
                        onClick={() =>
                          setExistingAttachments((prev) => prev.filter((p) => p !== url))
                        }
                        aria-label={`Remove ${fileName}`}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Paper>
                  );
                })}
              </Stack>
            </Box>
          )}

          {/* ============ NEW FILE UPLOAD ============ */}
          <Box>
            <Text fw={600} size="sm" mb={4}>
              {isDraftMode ? 'Add New Attachments' : 'Optional Attachment Document'}
            </Text>
            <Text size="xs" c="dimmed" mb="xs">
              Upload PDF or image files. You can add multiple files.
            </Text>

            <FileInput
              placeholder="Click to upload files or drag and drop"
              clearable
              multiple
              accept="application/pdf,image/*"
              leftSection={<IconUpload size={16} />}
              {...form.getInputProps('memoAttachments')}
              styles={(theme) => ({
                input: {
                  borderStyle: 'dashed',
                  borderWidth: '2px',
                  borderColor: theme.colors.gray[4],
                  padding: '10px 12px',
                  cursor: 'pointer',
                  transition: 'all 150ms ease',
                  '&:hover': {
                    borderColor: theme.colors.blue[4],
                    backgroundColor: theme.colors.blue[0],
                  },
                },
              })}
            />

            {form.values.memoAttachments && form.values.memoAttachments.length > 0 && (
              <Box mt="md">
                <Group justify="space-between" mb="xs">
                  <Text size="xs" fw={600} c="dimmed">
                    New Files ({form.values.memoAttachments.length})
                  </Text>
                  <Text
                    size="xs"
                    c="red"
                    style={{ cursor: 'pointer', textDecoration: 'underline' }}
                    onClick={() => form.setFieldValue('memoAttachments', [])}
                  >
                    Remove all
                  </Text>
                </Group>

                <Stack gap="xs">
                  {form.values.memoAttachments.map((file: File, index: number) => {
                    const { icon, color, label } = getFileMeta(file);
                    return (
                      <Paper
                        key={`${file.name}-${index}`}
                        withBorder
                        p="xs"
                        radius="md"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
                      >
                        <Group gap="sm" style={{ flex: 1, minWidth: 0 }}>
                          <ThemeIcon color={color} variant="light" size="lg" radius="md">
                            {icon}
                          </ThemeIcon>
                          <Box style={{ minWidth: 0, flex: 1 }}>
                            <Text size="sm" fw={500} lineClamp={1} title={file.name}>
                              {file.name}
                            </Text>
                            <Group gap={6} mt={2}>
                              <Text size="xs" c="dimmed">{formatFileSize(file.size)}</Text>
                              <Text size="xs" c="dimmed">·</Text>
                              <Text size="xs" c={color} fw={600}>{label}</Text>
                            </Group>
                          </Box>
                        </Group>

                        <ActionIcon
                          color="red"
                          variant="light"
                          size="lg"
                          radius="md"
                          onClick={() => {
                            const updated = form.values.memoAttachments.filter(
                              (_: File, i: number) => i !== index
                            );
                            form.setFieldValue('memoAttachments', updated);
                          }}
                          aria-label={`Remove ${file.name}`}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Paper>
                    );
                  })}
                </Stack>
              </Box>
            )}
          </Box>

          <Group justify="flex-end" mt="md">
            <Button variant="light" color="gray" onClick={onClose} type="button">
              Cancel
            </Button>
            {onSaveDraft && (
              <Button
                variant="light"
                color="grape"
                type="button"
                leftSection={<IconDeviceFloppy size={16} />}
                onClick={handleSaveDraftClick}
                disabled={submitting}
              >
                Save as Draft
              </Button>
            )}
            <Button type="submit" loading={submitting} leftSection={<IconSend size={16} />}>
              Submit for Review
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}