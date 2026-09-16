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
  Checkbox
} from '@mantine/core';
import { UseFormReturnType } from '@mantine/form';
import { MemoFormValues } from './types';
import { IconSend } from '@tabler/icons-react';
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
            disabled={isReply}  // ✅ I-disable lang kung reply
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
              Submit for Review
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}