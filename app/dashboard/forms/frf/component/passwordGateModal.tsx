// app/dashboard/forms/frf/components/PasswordGateModal.tsx
'use client';

import { Modal, Stack, Text, PasswordInput, Textarea, Button, Group, FileInput, Box } from '@mantine/core';
import { IconLock, IconPhoto } from '@tabler/icons-react';
import { useState } from 'react';

interface PasswordGateModalProps {
  opened: boolean;
  onClose: () => void;
  action: string; // 'approve', 'reject', 'return', 'resubmit', 'assign', 'ocm-finalize'
  onSubmit: (password: string, remarks: string, photos?: File[]) => void;
  loading: boolean;
  error?: string;
  requireRemarks?: boolean; // for reject/return
  enablePhotoUpload?: boolean; // 🆕 for packup-done
}

export default function PasswordGateModal({
  opened,
  onClose,
  action,
  onSubmit,
  loading,
  error,
  requireRemarks = false,
  enablePhotoUpload = false,
}: PasswordGateModalProps) {
  const [password, setPassword] = useState('');
  const [remarks, setRemarks] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);

  const handleSubmit = () => {
    if (!password) return;
    if (requireRemarks && !remarks) return;
    if (enablePhotoUpload && photos.length === 0) return; // 🆕 photo required for packup
    onSubmit(password, remarks, photos);
    setPassword('');
    setRemarks('');
    setPhotos([]);
  };

  const handleClose = () => {
    setPassword('');
    setRemarks('');
    setPhotos([]);
    onClose();
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
      default: return 'Confirm Action';
    }
  };

  const isRemarksRequired = ['reject', 'return', 'PACKUP_DONE'].includes(action) || requireRemarks;

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={getTitle()}
      centered
      zIndex={1000}
      size={enablePhotoUpload ? 'lg' : 'md'}
    >
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
              label={action === 'PACKUP_DONE' ? 'Notes / Remarks' : 'Remarks'}
              placeholder={action === 'PACKUP_DONE'
                ? 'Halimbawa: Nailigpit na lahat ng equipment, walang nawala, at ibinalik sa storage.'
                : 'Explain why...'}
              required
              value={remarks}
              onChange={(e) => setRemarks(e.currentTarget.value)}
              minRows={2}
            />
          )}

          {enablePhotoUpload && (
            <Box>
              <FileInput
                label="Pack Up Photos (required)"
                description="Upload photos taken with your GPS camera app as proof of pack up."
                placeholder="Click to upload photos"
                multiple
                accept="image/*"
                leftSection={<IconPhoto size={16} />}
                value={photos}
                onChange={(files) => setPhotos(files || [])}
                required
                styles={(theme) => ({
                  input: {
                    borderStyle: 'dashed',
                    borderWidth: '2px',
                  },
                })}
              />
              {photos.length > 0 && (
                <Text size="xs" c="dimmed" mt={6}>
                  {photos.length} photo{photos.length > 1 ? 's' : ''} ready to upload
                </Text>
              )}
            </Box>
          )}

          <PasswordInput
            label="Password"
            placeholder="Your password"
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
            error={error}
            required
            leftSection={<IconLock size={16} />}
          />

          <Group justify="flex-end">
            <Button
              variant="light"
              onClick={handleClose}
              type="button"           /* 🆕 huwag mag-submit */
            >
              Cancel
            </Button>
            <Button
              color={action === 'reject' ? 'red' : action === 'PACKUP_DONE' ? 'teal' : 'blue'}
              type="submit"           /* 🆕 ito na ang sasagot sa Enter */
              loading={loading}
              disabled={
                !password ||
                (isRemarksRequired && !remarks) ||
                (enablePhotoUpload && photos.length === 0)
              }
            >
              Confirm
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}