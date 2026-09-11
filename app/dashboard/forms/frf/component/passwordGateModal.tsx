// app/dashboard/forms/frf/components/PasswordGateModal.tsx
'use client';

import { Modal, Stack, Text, PasswordInput, Textarea, Button, Group } from '@mantine/core';
import { IconLock } from '@tabler/icons-react';
import { useState } from 'react';

interface PasswordGateModalProps {
  opened: boolean;
  onClose: () => void;
  action: string; // 'approve', 'reject', 'return', 'resubmit', 'assign', 'ocm-finalize'
  onSubmit: (password: string, remarks: string) => void;
  loading: boolean;
  error?: string;
  requireRemarks?: boolean; // for reject/return
}

export default function PasswordGateModal({
  opened,
  onClose,
  action,
  onSubmit,
  loading,
  error,
  requireRemarks = false,
}: PasswordGateModalProps) {
  const [password, setPassword] = useState('');
  const [remarks, setRemarks] = useState('');

  const handleSubmit = () => {
    if (!password) return;
    if (requireRemarks && !remarks) return;
    onSubmit(password, remarks);
    setPassword('');
    setRemarks('');
  };

  const getTitle = () => {
    switch (action) {
      case 'approve': return 'Approve Reservation';
      case 'reject': return 'Reject Reservation';
      case 'return': return 'Return for Revision';
      case 'resubmit': return 'Resubmit Revision';
      case 'assign': return 'Assign ITO Staff';
      case 'ocm-finalize': return 'OCM Final Edit';
      case 'note': return 'Mark as Noted';
      default: return 'Confirm Action';
    }
  };

  const isRemarksRequired = ['reject', 'return'].includes(action) || requireRemarks;

  return (
    <Modal opened={opened} onClose={onClose} title={getTitle()} centered zIndex={1000}>
      <Stack gap="sm">
        <Text size="sm">Please enter your password to confirm this action.</Text>
        {isRemarksRequired && (
          <Textarea
            label="Remarks"
            placeholder="Explain why..."
            required
            value={remarks}
            onChange={(e) => setRemarks(e.currentTarget.value)}
            minRows={2}
          />
        )}
        <PasswordInput
          label="Password"
          placeholder="Your password"
          value={password}
          onChange={(e) => setPassword(e.currentTarget.value)}
          error={error}
          required
        />
        <Group justify="flex-end">
          <Button variant="light" onClick={onClose}>Cancel</Button>
          <Button color={action === 'reject' ? 'red' : 'blue'} loading={loading} onClick={handleSubmit}>
            Confirm
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}