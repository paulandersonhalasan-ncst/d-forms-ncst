// app/privacy/page.tsx
'use client';

import { Container, Paper, Text, Title, Group, Stack, Badge, Divider, Button, Skeleton, ThemeIcon, Box, Center, Loader } from '@mantine/core';
import { IconShieldCheck, IconMail, IconPhone, IconMapPin, IconArrowLeft, IconExternalLink } from '@tabler/icons-react';
import Link from 'next/link';
import useSWR from 'swr';
import classes from './PrivacyNotice.module.css';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function PrivacyNoticePage() {
  const { data, isLoading } = useSWR<{
    success: boolean;
    data: {
      dpoBadgeUrl: string | null;
      dpoRegistrationNo: string | null;
      dpoOfficerName: string | null;
      dpoContactEmail: string | null;
      dpoContactPhone: string | null;
      dpoOfficeAddress: string | null;
      noticeText: string | null;
      lastUpdated: string | null;
    };
    }>('/api/super/privacy/setting', fetcher, {
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
    });

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

  return (
    <div className={classes.page}>
      {/* Top bar */}
      <div className={classes.topbar}>
        <Container size="md" py="md">
          <Group justify="space-between" wrap="nowrap">
            <Group gap="sm">
              <img src="/favicon.ico" alt="NCST" width={28} height={28} style={{ borderRadius: 6 }} />
              <Text fw={800} size="sm" c="white">NCST D-Forms</Text>
            </Group>
            <Button
              component={Link}
              href="/"
              variant="subtle"
              color="gray"
              size="xs"
              leftSection={<IconArrowLeft size={14} />}
              styles={{ root: { color: 'white' } }}
            >
              Back to Login
            </Button>
          </Group>
        </Container>
      </div>

      <Container size="md" py="xl">
        <Paper withBorder radius="lg" p="xl" shadow="sm">

          {/* Header */}
          <Stack gap="xs" align="center" mb="lg">
            <ThemeIcon size={56} radius="xl" variant="light" color="teal">
              <IconShieldCheck size={32} />
            </ThemeIcon>
            <Title order={1} ta="center" style={{ fontSize: 'clamp(1.5rem, 4vw, 2rem)' }}>
              Data Privacy Notice
            </Title>
            <Badge variant="light" color="teal" size="sm">
              Compliant with the Data Privacy Act of 2012 (RA 10173)
            </Badge>
          </Stack>

          <Divider my="lg" />

          {isLoading || !data?.success ? (
            <Center py="xl">
              <Loader size="md" />
            </Center>
          ) : (
            <>
              {/* NPC DPO Registration Badge */}
              {settings?.dpoBadgeUrl && (
                <Box className={classes.badgeSection} mb="xl">
                  <Text size="xs" tt="uppercase" fw={700} c="dimmed" ta="center" mb="sm">
                    NPC Data Protection Officer (DPO) Registration
                  </Text>
                  <Box className={classes.badgeImageWrapper}>
                    <img
                    src={settings.dpoBadgeUrl}
                    alt="NPC DPO Registration Badge"
                    style={{
                        display: 'block',
                        maxWidth: '100%',
                        height: 'auto',
                        objectFit: 'contain',
                    }}
                    />
                  </Box>
                  {settings.dpoRegistrationNo && (
                    <Text size="sm" ta="center" c="dimmed" mt="sm">
                      Registration No.: <b>{settings.dpoRegistrationNo}</b>
                    </Text>
                  )}
                </Box>
              )}

              {/* Notice Body */}
              <Title order={3} mb="sm" size="h4">Our Commitment</Title>
              <Text className={classes.noticeBody} mb="xl">
                {settings?.noticeText || 'The Data Privacy Notice has not been published yet. Please contact the site administrator.'}
              </Text>

              {/* DPO Contact */}
              {(settings?.dpoOfficerName || settings?.dpoContactEmail || settings?.dpoContactPhone || settings?.dpoOfficeAddress) && (
                <>
                  <Divider my="xl" label="Data Protection Officer" labelPosition="center" />
                  <Stack gap="sm">
                    {settings.dpoOfficerName && (
                      <Group gap="xs">
                        <ThemeIcon variant="light" color="regalNavy" radius="md"><IconShieldCheck size={16} /></ThemeIcon>
                        <Text size="sm">
                          <b>DPO Officer:</b> {settings.dpoOfficerName}
                        </Text>
                      </Group>
                    )}
                    {settings.dpoContactEmail && (
                      <Group gap="xs">
                        <ThemeIcon variant="light" color="blue" radius="md"><IconMail size={16} /></ThemeIcon>
                        <Text size="sm">
                          <b>Email:</b>{' '}
                          <a href={`mailto:${settings.dpoContactEmail}`} style={{ color: 'var(--mantine-color-blue-6)' }}>
                            {settings.dpoContactEmail}
                          </a>
                        </Text>
                      </Group>
                    )}
                    {settings.dpoContactPhone && (
                      <Group gap="xs">
                        <ThemeIcon variant="light" color="grape" radius="md"><IconPhone size={16} /></ThemeIcon>
                        <Text size="sm">
                          <b>Phone:</b> {settings.dpoContactPhone}
                        </Text>
                      </Group>
                    )}
                    {settings.dpoOfficeAddress && (
                      <Group gap="xs" align="flex-start">
                        <ThemeIcon variant="light" color="orange" radius="md"><IconMapPin size={16} /></ThemeIcon>
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
                Last updated: <b>{formatDate(settings?.lastUpdated)}</b>
              </Text>
            </>
          )}
        </Paper>

        {/* External links */}
        <Group justify="center" mt="lg" gap="lg" wrap="wrap">
          <Button
            component="a"
            href="https://privacy.gov.ph"
            target="_blank"
            rel="noopener noreferrer"
            variant="subtle"
            size="xs"
            rightSection={<IconExternalLink size={12} />}
          >
            National Privacy Commission
          </Button>
          <Button
            component="a"
            href="https://privacy.gov.ph/data-privacy-act/"
            target="_blank"
            rel="noopener noreferrer"
            variant="subtle"
            size="xs"
            rightSection={<IconExternalLink size={12} />}
          >
            Data Privacy Act of 2012
          </Button>
        </Group>
      </Container>
    </div>
  );
}