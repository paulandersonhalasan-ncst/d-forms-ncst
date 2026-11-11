// app/dashboard/forms/frf/components/PasswordGateModal.tsx
'use client';

import {
  Modal,
  Stack,
  Text,
  PasswordInput,
  Textarea,
  Button,
  Group,
  FileInput,
  Box,
  Paper,
  ActionIcon,
  ThemeIcon,
} from '@mantine/core';
import {
  IconLock,
  IconPhoto,
  IconTrash,
  IconFile,
  IconUpload,
} from '@tabler/icons-react';
import { useState } from 'react';
import { useMediaQuery } from '@mantine/hooks';

interface PasswordGateModalProps {
  opened: boolean;
  onClose: () => void;
  action: string;
  onSubmit: (password: string, remarks: string, photos?: File[]) => void;
  loading: boolean;
  error?: string;
  requireRemarks?: boolean;
  enablePhotoUpload?: boolean;
}

// Helper: format file size
const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

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
  const [hoveredPhoto, setHoveredPhoto] = useState<number | null>(null);
  const isMobile = useMediaQuery('(max-width: 768px)');

  const handleSubmit = () => {
    if (!password) return;
    if (requireRemarks && !remarks) return;
    if (enablePhotoUpload && photos.length === 0) return;
    onSubmit(password, remarks, photos);
    setPassword('');
    setRemarks('');
    setPhotos([]);
  };

  const handleClose = () => {
    setPassword('');
    setRemarks('');
    setPhotos([]);
    setHoveredPhoto(null);
    onClose();
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const getTitle = () => {
    switch (action) {
      case 'approve': return 'Approve Reservation';
      case 'reject': return 'Reject Reservation';
      case 'return': return 'Return for Revision';
      case 'resubmit': return 'Resubmit Revision';
      case 'assign': return 'Assign ITO Staff';
      case 'ocm-finalize': return 'OCM Final Edit';
      case 'PACKUP_DONE': return 'Mark Pack Up Done';
      case 'ACKNOWLEDGE': return 'Acknowledge Reservation';
      default: return 'Confirm Action';
    }
  };

  const isRemarksRequired =
    ['reject', 'return', 'PACKUP_DONE'].includes(action) || requireRemarks;

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={getTitle()}
      centered
      fullScreen={isMobile}
      zIndex={5000}
      size={enablePhotoUpload ? 'lg' : 'md'}
      styles={{
        inner: {
          paddingLeft: 'var(--sidebar-offset, 0)',
          transition: 'padding-left 0.25s ease',
        },
      }}
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
              placeholder={
                action === 'PACKUP_DONE'
                  ? 'Halimbawa: Nailigpit na lahat ng equipment, walang nawala, at ibinalik sa storage.'
                  : 'Explain why...'
              }
              required
              value={remarks}
              onChange={(e) => setRemarks(e.currentTarget.value)}
              minRows={2}
            />
          )}

          {/* ============ PACK UP PHOTOS SECTION ============ */}
          {enablePhotoUpload && (
            <Box>
              <Text fw={600} size="sm" mb={4}>
                Pack Up Photos <Text component="span" c="red">*</Text>
              </Text>
              <Text size="xs" c="dimmed" mb="xs">
                Upload photos taken with your GPS camera app as proof of pack up. You can add multiple photos.
              </Text>

              <FileInput
                placeholder="Click to upload photos or drag and drop"
                multiple
                accept="image/*"
                leftSection={<IconUpload size={16} />}
                value={photos}
                onChange={(files) => setPhotos(files || [])}
                required
                styles={(theme) => ({
                  input: {
                    borderStyle: 'dashed',
                    borderWidth: '2px',
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

              {/* === LIST OF UPLOADED PHOTOS === */}
              {photos.length > 0 && (
                <Box mt="md">
                  <Group justify="space-between" mb="xs">
                    <Text size="xs" fw={600} c="dimmed">
                      Uploaded Photos ({photos.length})
                    </Text>
                    <Text
                      size="xs"
                      c="red"
                      style={{ cursor: 'pointer', textDecoration: 'underline' }}
                      onClick={() => setPhotos([])}
                    >
                      Remove all
                    </Text>
                  </Group>

                  <Stack gap="xs">
                    {photos.map((file, index) => (
                      <Paper
                        key={`${file.name}-${index}`}
                        withBorder
                        p="xs"
                        radius="sm"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12,
                          transition: 'all 150ms ease',
                        }}
                      >
                        <Group gap="sm" style={{ flex: 1, minWidth: 0 }}>
                          <ThemeIcon color="grape" variant="light" size="lg" radius="md">
                            <IconPhoto size={18} />
                          </ThemeIcon>
                          <Box style={{ minWidth: 0, flex: 1 }}>
                            <Text size="sm" fw={500} lineClamp={1} title={file.name}>
                              {file.name}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {formatFileSize(file.size)}
                            </Text>
                          </Box>
                        </Group>

                        <ActionIcon
                          color="red"
                          variant="filled"
                          size={38}
                          radius="md"
                          onClick={() => removePhoto(index)}
                          aria-label={`Remove ${file.name}`}
                          onMouseEnter={() => setHoveredPhoto(index)}
                          onMouseLeave={() => setHoveredPhoto(null)}
                          style={{
                            opacity: hoveredPhoto === index ? 1 : 0.85,
                            transition: 'opacity 150ms ease',
                          }}
                        >
                          <IconTrash size={18} />
                        </ActionIcon>
                      </Paper>
                    ))}
                  </Stack>
                </Box>
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
            <Button variant="light" onClick={handleClose} type="button">
              Cancel
            </Button>
            <Button
              color={action === 'reject' ? 'red' : (action === 'PACKUP_DONE' || action === 'ACKNOWLEDGE') ? 'teal' : 'blue'}
              type="submit"
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