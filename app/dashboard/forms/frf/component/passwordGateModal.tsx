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
      case 'PACKUP_DONE': return 'Mark Pack Up Done';
      case 'REQUEST_STAFF_CHANGE': return 'Request Staff Change';
      default: return 'Confirm Action';
    }
  };

  // 🆕 Helper para sa dynamic label ng remarks
  const getRemarksLabel = () => {
    switch (action) {
      case 'PACKUP_DONE': return 'Notes / Remarks';
      case 'REQUEST_STAFF_CHANGE': return 'Reason for Staff Change';
      default: return 'Remarks';
    }
  };

  const getRemarksPlaceholder = () => {
    switch (action) {
      case 'PACKUP_DONE':
        return 'All equipment are returned in good condition.';
      case 'REQUEST_STAFF_CHANGE':
        return 'Include reason why staff change is needed.';
      default:
        return 'Explain why...';
    }
  };

  const isRemarksRequired = ['reject', 'return', 'PACKUP_DONE', 'REQUEST_STAFF_CHANGE' ].includes(action) || requireRemarks;

  return (
    <Modal opened={opened} onClose={onClose} title={getTitle()} centered zIndex={1000}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
      >
        <Stack gap="sm">
          <Text size="sm">Please enter your password to confirm this action.</Text>
          {isRemarksRequired && (
            <Textarea
              label={getRemarksLabel()}
              placeholder={getRemarksPlaceholder()}
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
            <Button
              variant="light"
              onClick={onClose}
              type="button"           /* 🆕 huwag mag-submit */
            >
              Cancel
            </Button>
            <Button
              color={action === 'reject' ? 'red' : 'blue'}
              loading={loading}
              type="submit"           /* 🆕 para sumagot sa Enter key */
            >
              Confirm
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}