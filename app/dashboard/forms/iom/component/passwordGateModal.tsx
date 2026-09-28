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
  zIndex = 5000,
}: PasswordGateModalProps) {
  const actionType = pendingAction?.type;

  // Determine modal title and colors
  const isApprove = actionType === 'APPROVE';
  const isDenyOrDisapprove = actionType === 'DENY' || actionType === 'DISAPPROVE_DRAFT';
  const isAcknowledge = actionType === 'ACKNOWLEDGE';

  const titleIconColor = isApprove ? 'green' : isDenyOrDisapprove ? 'red' : 'blue';
  const titleText = isApprove
    ? 'Approve Memorandum'
    : isDenyOrDisapprove
    ? 'Deny / Disapprove'
    : 'Security Signature Verification';

  const descriptionText = isApprove
    ? 'Confirm approval of this memorandum. Enter your feedback and signature password.'
    : isDenyOrDisapprove
    ? 'Confirm rejection of this memorandum. You must provide a clear reason.'
    : 'Confirm transaction authorization using your signature password.';

  const buttonColor = isApprove ? 'green' : isDenyOrDisapprove ? 'red' : 'blue';
  const buttonText = isApprove
    ? 'Confirm Approval'
    : isDenyOrDisapprove
    ? 'Confirm Denial'
    : 'Confirm Signature Authorization';

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      zIndex={zIndex}
      title={
        <Group gap="xs">
          <IconLock size={18} color={titleIconColor} />
          <Text fw={700}>{titleText}</Text>
        </Group>
      }
      centered
      size="sm"
      radius="md"
    >
      <Stack gap="sm">
        <Text size="xs" c="dimmed">
          {descriptionText}
        </Text>

        {/* ===== APPROVE – required feedback ===== */}
        {isApprove && (
          <Textarea
            label="Approval Feedback / Remarks"
            placeholder="Enter your approval remarks..."
            required
            value={feedbackNote}
            onChange={(e) => setFeedbackNote(e.currentTarget.value)}
            rows={3}
            error={!feedbackNote && passError ? 'Feedback note is required for approval.' : null}
          />
        )}

        {/* ===== DENY / DISAPPROVE_DRAFT – required feedback ===== */}
        {isDenyOrDisapprove && (
          <Textarea
            label="Reason for Denial / Disapproval"
            placeholder="State the clear reason why this memorandum is rejected..."
            required
            value={feedbackNote}
            onChange={(e) => setFeedbackNote(e.currentTarget.value)}
            rows={3}
            error={!feedbackNote && passError ? 'Feedback note is strictly required for denials.' : null}
          />
        )}

        {/* ===== Other non-ACKNOWLEDGE actions – required feedback ===== */}
        {!isApprove &&
          !isDenyOrDisapprove &&
          !isAcknowledge && (
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

        {/* ===== ACKNOWLEDGE – optional feedback ===== */}
        {isAcknowledge && (
          <Textarea
            label="Remarks / Feedback Note (Optional)"
            placeholder="Enter your remarks (optional)"
            value={feedbackNote}
            onChange={(e) => setFeedbackNote(e.currentTarget.value)}
            rows={2}
          />
        )}

        {/* ===== File upload for recipient CLOSED (optional) =====
        {actionType === 'CLOSED' && !pendingAction?.data?.isSenderClosing && (
          <FileInput
            label="Supporting Attachment (Optional)"
            description="Upload proof of completion or signed document."
            placeholder="Click to upload file"
            value={actionAttachment}
            onChange={setActionAttachment}
            rightSection={<IconFile size={14} />}
            clearable
          />
        )} */}

        {/* ===== Password ===== */}
        <PasswordInput
          label="Confirm Security Password / Signature"
          placeholder="Enter your password to sign"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.currentTarget.value)}
          error={passError}
          required
        />

        <Button
          fullWidth
          color={buttonColor}
          loading={submitting}
          onClick={onSubmit}
          mt="xs"
        >
          {buttonText}
        </Button>
      </Stack>
    </Modal>
  );
}