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
  rem,
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
} from '@tabler/icons-react';
import { useState } from 'react';

interface CreateMemoModalProps {
    opened: boolean;
    onClose: () => void;
    form: UseFormReturnType<MemoFormValues>;
    departments: { value: string; label: string }[];
    submitting: boolean;
    onSubmit: (values: MemoFormValues) => void;
    isReply: boolean;
}

// Helper: format file size (B, KB, MB)
const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Helper: icon at color based on file type
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
  isReply,
}: CreateMemoModalProps) {

  const [sendToAll, setSendToAll] = useState(false);

  const handleSendToAllChange = (checked: boolean) => {
    setSendToAll(checked);
    if (checked) {
      // Piliin lahat ng departments
      const allValues = departments.map(d => d.value);
      form.setFieldValue('targetDepts', allValues);
    } else {
      // I‑clear ang selection
      form.setFieldValue('targetDepts', []);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={isReply ? '📝 Write Response Memo' : '📝 Construct New Memorandum'}
      size="lg"
      radius="md"
      centered
      closeOnClickOutside={false}
      zIndex={5000}
    >
      <form onSubmit={form.onSubmit(onSubmit)}>
        <Stack gap="md">
          <TextInput
            label="Subject Reference Header"
            placeholder="What will the memorandum be about..."
            required
            {...form.getInputProps('subject')}
            disabled={isReply}
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
            required
            disabled={isReply || sendToAll}
            {...form.getInputProps('targetDepts')}
            searchable
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
            required
            {...form.getInputProps('content')}
          />

          {/* ============ ATTACHMENTS SECTION ============ */}
          <Box>
            <Text fw={600} size="sm" mb={4}>
              Optional Attachment Document
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

            {/* === LIST OF UPLOADED FILES === */}
            {form.values.memoAttachments && form.values.memoAttachments.length > 0 && (
              <Box mt="md">
                <Group justify="space-between" mb="xs">
                  <Text size="xs" fw={600} c="dimmed">
                    Uploaded Files ({form.values.memoAttachments.length})
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
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12,
                          transition: 'all 150ms ease',
                        }}
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
                              <Text size="xs" c="dimmed">
                                {formatFileSize(file.size)}
                              </Text>
                              <Text size="xs" c="dimmed">
                                ·
                              </Text>
                              <Text size="xs" c={color} fw={600}>
                                {label}
                              </Text>
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
                          title="Remove file"
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
            <Button variant="light" color="gray" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting} leftSection={<IconSend size={16} />}>
              Submit for Review
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}