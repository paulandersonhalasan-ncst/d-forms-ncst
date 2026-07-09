// components/PasswordGateModal.tsx
'use client';

import {
  Modal,
  Stack,
  Text,
  PasswordInput,
  Textarea,
  FileInput,
  Button,
  Group,
  Alert,
} from '@mantine/core';
import { IconLock, IconFile } from '@tabler/icons-react';

interface PasswordGateModalProps {
    opened: boolean;
    onClose: () => void;
    pendingAction: { type: string; data: Record<string, unknown> } | null;
    confirmPassword: string;
    setConfirmPassword: (val: string) => void;
    passError: string;
    feedbackNote: string;
    setFeedbackNote: (val: string) => void;
    actionAttachment: File | null;
    setActionAttachment: (file: File | null) => void;
    submitting: boolean;
    onSubmit: () => void;
    zIndex?: number;

}

export default function PasswordGateModal({
  opened,
  onClose,
  pendingAction,
  confirmPassword,
  setConfirmPassword,
  passError,
  feedbackNote,
  setFeedbackNote,
  actionAttachment,
  setActionAttachment,
  submitting,
  onSubmit,
  zIndex = 1000,
}: PasswordGateModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      zIndex={zIndex}
      title={
        <Group gap="xs">
          <IconLock size={18} color="red" />
          <Text fw={700}>Security Signature Verification</Text>
        </Group>
      }
      centered
      size="sm"
      radius="md"
    >
      <Stack gap="sm">
        <Text size="xs" c="dimmed">
          Confirm transaction authorization status using your cryptography signing phrase key.
        </Text>

        {/* For DENY / DISAPPROVE_DRAFT – always required */}
        {(pendingAction?.type === 'DENY' || pendingAction?.type === 'DISAPPROVE_DRAFT') && (
          <Textarea
            label="Reason for Denial / Disapproval"
            placeholder="State the clear reason why this inbound memorandum is rejected..."
            required
            value={feedbackNote}
            onChange={(e) => setFeedbackNote(e.currentTarget.value)}
            rows={3}
            error={!feedbackNote && passError ? 'Feedback note is strictly required for denials.' : null}
          />
        )}

        {/* For all other non-ACKNOWLEDGE actions – required */}
        {pendingAction?.type !== 'ACKNOWLEDGE' &&
        pendingAction?.type !== 'DENY' &&
        pendingAction?.type !== 'DISAPPROVE_DRAFT' && (
          <Textarea
            label="Remarks / Feedback Note"
            placeholder="Enter your remarks here (required)"
            required
            value={feedbackNote}
            onChange={(e) => setFeedbackNote(e.currentTarget.value)}
            rows={3}
            error={!feedbackNote && passError ? 'Remarks are required for this action.' : null}
          />
        )}

        {/* ACKNOWLEDGE – optional remarks */}
        {pendingAction?.type === 'ACKNOWLEDGE' && (
          <Textarea
            label="Remarks / Feedback Note (optional)"
            placeholder="Enter your remarks here (optional)"
            value={feedbackNote}
            onChange={(e) => setFeedbackNote(e.currentTarget.value)}
            rows={2}
          />
        )}

        {/* File upload for recipient RESOLVE (not sender closing) */}
        {pendingAction?.type === 'CLOSED' && !pendingAction?.data?.isSenderClosing && (
          <FileInput
            label="Supporting Attachment (Optional)"
            description="Upload proof of completion or signed document."
            placeholder="Click to upload file"
            value={actionAttachment}
            onChange={setActionAttachment}
            rightSection={<IconFile size={14} />}
            clearable
          />
        )}

        <PasswordInput
          label="Confirm Security Password / Signature"
          placeholder="Enter your password to sign"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.currentTarget.value)}
          error={passError}
          required
        />

        <Button fullWidth color="red" loading={submitting} onClick={onSubmit} mt="xs">
          Confirm Signature Authorization
        </Button>
      </Stack>
    </Modal>
  );
}