// app/dashboard/privacy/page.tsx
'use client';

import {
  Container, Paper, Text, Title, Group, Stack, Badge, Divider,
  ThemeIcon, Box, Center, Loader, Button, Alert, Image,
} from '@mantine/core';
import {
  IconShieldCheck, IconMail, IconPhone, IconMapPin, IconArrowLeft, IconAlertCircle,
} from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface PrivacySettingsData {
  dpoBadgeUrl: string | null;
  dpoRegistrationNo: string | null;
  dpoOfficerName: string | null;
  dpoContactEmail: string | null;
  dpoContactPhone: string | null;
  dpoOfficeAddress: string | null;
  noticeText: string | null;
  lastUpdated: string | null;
}

export default function InAppPrivacyNoticePage() {
  const router = useRouter();
  const { data, isLoading, error } = useSWR<{ success: boolean; data: PrivacySettingsData }>(
    '/api/super/privacy/setting',
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );

  const settings = data?.data;

  const formatDate = (val?: string | null) => {
    if (!val) return '—';
    try {
      return new Date(val).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return '—';
    }
  };

  const handlePrint = () => window.print();

  return (
    <Container size="md" py="md">
      {/* Header row */}
      <Group justify="space-between" align="center" mb="md" wrap="wrap">
        <Group gap="sm">
          <ThemeIcon size="lg" radius="md" variant="light" color="teal">
            <IconShieldCheck size={22} />
          </ThemeIcon>
          <Stack gap={0}>
            <Title order={2} style={{ fontSize: 'clamp(1.1rem, 3vw, 1.75rem)' }}>
              Data Privacy Notice
            </Title>
            <Text size="xs" c="dimmed">
              Compliant with the Data Privacy Act of 2012 (RA 10173)
            </Text>
          </Stack>
        </Group>
      </Group>

      {isLoading && (
        <Center py="xl">
          <Loader size="md" />
        </Center>
      )}

      {error && (
        <Alert icon={<IconAlertCircle size={16} />} color="red" title="Failed to load">
          Could not load the privacy notice. Please try again later.
        </Alert>
      )}

      {!isLoading && !error && settings && (
        <Paper withBorder radius="lg" p="xl" shadow="sm">
          <Badge variant="light" color="teal" size="sm" mb="lg">
            {settings.dpoRegistrationNo
              ? `NPC Registration No.: ${settings.dpoRegistrationNo}`
              : 'NPC-registered Personal Information Controller'}
          </Badge>

          <Divider my="lg" />

          {/* NPC Badge */}
          {settings.dpoBadgeUrl && (
            <Box
              mb="xl"
              p="md"
              style={{
                borderRadius: 12,
                border: '1px solid light-dark(var(--mantine-color-regalNavy-2), var(--mantine-color-dark-4))',
              }}
            >
              <Text size="xs" tt="uppercase" fw={700} c="dimmed" ta="center" mb="sm">
                NPC Data Protection Officer (DPO) Registration
              </Text>
              <Box
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  padding: 8,
                  background: 'white',
                  borderRadius: 8,
                  maxWidth: 420,
                  margin: '0 auto',
                }}
              >
                <img
                    src={settings.dpoBadgeUrl}
                    alt="NPC DPO Registration Badge"
                    style={{
                        display: 'block',
                        maxWidth: '75%',
                        height: 'auto',
                        objectFit: 'contain',
                    }}
                />
              </Box>
            </Box>
          )}

          {/* Notice body */}
          <Title order={3} mb="sm" size="h4">
            Our Commitment
          </Title>
          <Text
            mb="xl"
            style={{
              whiteSpace: 'pre-wrap',
              fontSize: 15,
              lineHeight: 1.7,
              color: 'light-dark(var(--mantine-color-dark-7), var(--mantine-color-gray-1))',
            }}
          >
            {settings.noticeText ||
              'The Data Privacy Notice has not been published yet. Please contact the site administrator.'}
          </Text>

          {/* DPO Contact */}
          {(settings.dpoOfficerName ||
            settings.dpoContactEmail ||
            settings.dpoContactPhone ||
            settings.dpoOfficeAddress) && (
            <>
              <Divider my="xl" label="Data Protection Officer" labelPosition="center" />
              <Stack gap="sm">
                {settings.dpoOfficerName && (
                  <Group gap="xs">
                    <ThemeIcon variant="light" color="regalNavy" radius="md">
                      <IconShieldCheck size={16} />
                    </ThemeIcon>
                    <Text size="sm">
                      <b>DPO Officer:</b> {settings.dpoOfficerName}
                    </Text>
                  </Group>
                )}
                {settings.dpoContactEmail && (
                  <Group gap="xs">
                    <ThemeIcon variant="light" color="regalNavy" radius="md">
                      <IconMail size={16} />
                    </ThemeIcon>
                    <Text size="sm">
                      <b>Email:</b>{' '}
                      <a
                        href={`mailto:${settings.dpoContactEmail}`}
                        style={{ color: 'var(--mantine-color-regalNavy-6)' }}
                      >
                        {settings.dpoContactEmail}
                      </a>
                    </Text>
                  </Group>
                )}
                {settings.dpoContactPhone && (
                  <Group gap="xs">
                    <ThemeIcon variant="light" color="grape" radius="md">
                      <IconPhone size={16} />
                    </ThemeIcon>
                    <Text size="sm">
                      <b>Phone:</b> {settings.dpoContactPhone}
                    </Text>
                  </Group>
                )}
                {settings.dpoOfficeAddress && (
                  <Group gap="xs" align="flex-start">
                    <ThemeIcon variant="light" color="orange" radius="md">
                      <IconMapPin size={16} />
                    </ThemeIcon>
                    <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                      <b>Office Address:</b> {settings.dpoOfficeAddress}
                    </Text>
                  </Group>
                )}
              </Stack>
            </>
          )}

          <Divider my="xl" />

          <Text size="xs" c="dimmed" ta="center">
            Last updated: <b>{formatDate(settings.lastUpdated)}</b>
          </Text>
        </Paper>
      )}
    </Container>
  );
}