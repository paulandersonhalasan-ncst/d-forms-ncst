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
} from '@mantine/core';
import { UseFormReturnType } from '@mantine/form';
import { MemoFormValues } from './types';
import { IconSend } from '@tabler/icons-react';

interface CreateMemoModalProps {
    opened: boolean;
    onClose: () => void;
    form: UseFormReturnType<MemoFormValues>;
    departments: { value: string; label: string }[];
    submitting: boolean;
    onSubmit: (values: MemoFormValues) => void;
    isReply: boolean;
}

export default function CreateMemoModal({
  opened,
  onClose,
  form,
  departments,
  submitting,
  onSubmit,
  isReply,
}: CreateMemoModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={isReply ? '📝 Write Response Memo' : '📝 Construct New Memorandum'}
      size="lg"
      radius="md"
      centered
      closeOnClickOutside={false}
    >
      <form onSubmit={form.onSubmit(onSubmit)}>
        <Stack gap="md">
          <TextInput
            label="Subject Reference Header"
            placeholder="What will the memorandum be about..."
            required
            {...form.getInputProps('subject')}
          />

          <SimpleGrid cols={2}>
            <Select
              label="Priority Level Flags"
              data={['ROUTINE', 'URGENT', 'RUSH']}
              {...form.getInputProps('priority')}
            />
            <Select
              label="Routing Core Purpose"
              data={['FYI', 'SIGNATURE', 'ACTION', 'COMMENTS', 'APPROVAL', 'REQUEST']}
              {...form.getInputProps('purpose')}
            />
          </SimpleGrid>

          <MultiSelect
            label="Target Recipient Departments"
            data={departments}
            placeholder="Select one or more departments"
            required
            disabled={isReply}
            {...form.getInputProps('targetDepts')}
            searchable
          />

          <Textarea
            label="Memorandum Body Content"
            placeholder="Type the core message here..."
            minRows={6}
            autosize
            required
            {...form.getInputProps('content')}
          />

          <FileInput
            label="Optional Attachment Document"
            placeholder="Choose file to upload (Optional)"
            clearable
            multiple
            accept="application/pdf,image/*"
            {...form.getInputProps('memoAttachments')}
          />

          <Group justify="flex-end" mt="md">
            <Button variant="light" color="gray" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting} leftSection={<IconSend size={16} />}>
              Authorize & Transmit
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}