// app/dashboard/super/privacy/page.tsx
'use client';

import {
  Container, Card, Title, Text, Group, TextInput, Textarea, Button,
  Stack, Paper, Divider, FileInput, Image, Alert, LoadingOverlay, Box,
  ActionIcon, ThemeIcon, Badge, Grid, Skeleton, Center, Loader,
} from '@mantine/core';
import {
  IconShieldCheck, IconArrowLeft, IconUpload, IconTrash, IconDeviceFloppy,
  IconInfoCircle, IconUser, IconMail, IconPhone, IconMapPin, IconCalendar,
} from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface PrivacySettingsData {
  id: string;
  dpoBadgeUrl: string | null;
  dpoRegistrationNo: string | null;
  dpoOfficerName: string | null;
  dpoContactEmail: string | null;
  dpoContactPhone: string | null;
  dpoOfficeAddress: string | null;
  noticeText: string | null;
  lastUpdated: string | null;
  updatedAt: string | null;
  updatedByName: string | null;
}

// ==================================================
// OUTER WRAPPER: handles fetching + loading state
// ==================================================
export default function PrivacySettingsPage() {
  const { data, mutate, isLoading } = useSWR<{ success: boolean; data: PrivacySettingsData }>(
    '/api/super/privacy/setting',
    fetcher,
    {
      // 🆕 Don't revalidate on window focus — prevents re-render flashes
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      // 🆕 Keep showing the loaded data during mutate() instead of falling back to loading
      keepPreviousData: true,
    }
  );

  if (isLoading || !data?.data) {
    return (
      <Container fluid py="md">
        <Card withBorder radius="lg" p="lg">
          <Group gap="sm" mb="md">
            <Skeleton circle height={40} />
            <Skeleton height={24} width={260} />
          </Group>
          <Stack gap="md">
            <Skeleton height={100} />
            <Skeleton height={80} />
            <Skeleton height={200} />
            <Skeleton height={300} />
          </Stack>
        </Card>
      </Container>
    );
  }

  // 🆕 keyed on updatedAt — remounts form only when saved data actually changes
  return <PrivacySettingsForm key={data.data.updatedAt || 'empty'} initial={data.data} mutate={mutate} />;
}

// ==================================================
// INNER FORM: pre-populated at mount, no prefill effect
// ==================================================
function PrivacySettingsForm({
  initial,
  mutate,
}: {
  initial: PrivacySettingsData;
  mutate: () => void;
}) {
  const router = useRouter();

  const [dpoBadgeUrl, setDpoBadgeUrl] = useState<string | null>(initial.dpoBadgeUrl);
  const [dpoRegistrationNo, setDpoRegistrationNo] = useState(initial.dpoRegistrationNo || '');
  const [dpoOfficerName, setDpoOfficerName] = useState(initial.dpoOfficerName || '');
  const [dpoContactEmail, setDpoContactEmail] = useState(initial.dpoContactEmail || '');
  const [dpoContactPhone, setDpoContactPhone] = useState(initial.dpoContactPhone || '');
  const [dpoOfficeAddress, setDpoOfficeAddress] = useState(initial.dpoOfficeAddress || '');
  const [noticeText, setNoticeText] = useState(initial.noticeText || '');
  const [lastUpdated, setLastUpdated] = useState(
    initial.lastUpdated
      ? new Date(initial.lastUpdated).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10)
  );
  const [badgeFile, setBadgeFile] = useState<File | null>(null);
  const [removeBadge, setRemoveBadge] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // 🆕 Memoize preview URL — creates a fresh blob URL only when badgeFile changes,
  // eliminates per-render flicker + stops URL leak
  const badgePreviewUrl = useMemo(() => {
    if (badgeFile) return URL.createObjectURL(badgeFile);
    return dpoBadgeUrl || '';
  }, [badgeFile, dpoBadgeUrl]);

  const handleBadgeChange = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Badge image must be under 5 MB.');
      return;
    }
    setBadgeFile(file);
    setRemoveBadge(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('noticeText', noticeText);
      fd.append('dpoRegistrationNo', dpoRegistrationNo);
      fd.append('dpoOfficerName', dpoOfficerName);
      fd.append('dpoContactEmail', dpoContactEmail);
      fd.append('dpoContactPhone', dpoContactPhone);
      fd.append('dpoOfficeAddress', dpoOfficeAddress);
      fd.append('lastUpdated', lastUpdated ? new Date(lastUpdated).toISOString() : new Date().toISOString());
      fd.append('keepBadge', String(!!dpoBadgeUrl && !removeBadge && !badgeFile));
      if (badgeFile) fd.append('badge', badgeFile);

      const res = await fetch('/api/super/privacy/setting', { method: 'PUT', body: fd });
      const result = await res.json();
      if (res.ok) {
        await mutate();
        setBadgeFile(null);
        setRemoveBadge(false);
        alert('Privacy settings saved!');
      } else {
        setError(result.message || 'Failed to save.');
      }
    } catch (err) {
      console.error(err);
      setError('An error occurred while saving.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Container fluid py="md" pos="relative">
      <LoadingOverlay visible={saving} overlayProps={{ blur: 2 }} />

      <Card withBorder radius="lg" p="lg" shadow="sm">
        <Group justify="space-between" align="center" mb="md" wrap="wrap">
          <Stack gap={2}>
            <Group gap="sm">
              <ThemeIcon size="lg" radius="md" variant="light" color="teal">
                <IconShieldCheck size={22} />
              </ThemeIcon>
              <Title order={2} style={{ fontSize: 'clamp(1.1rem, 3vw, 1.75rem)' }}>
                Data Privacy & DPO Settings
              </Title>
            </Group>
            <Text size="xs" c="dimmed">
              Publicly visible on <b>/privacy</b>. Editable only by SuperUser.
            </Text>
          </Stack>
        </Group>

        <Alert icon={<IconInfoCircle size={16} />} color="blue" radius="md" mb="lg">
          Fill in as much as you have. All fields are optional — the public page gracefully hides
          empty sections. You can add the NPC badge image and notice text whenever they&apos;re ready.
        </Alert>

        {/* NPC Badge */}
        <Paper withBorder p="md" radius="md" mb="lg">
          <Group justify="space-between" align="center" mb="sm">
            <Text fw={600} size="sm">NPC DPO Registration Badge</Text>
            {dpoBadgeUrl && !removeBadge && (
              <Badge color="teal" variant="light" leftSection={<IconShieldCheck size={10} />}>
                Uploaded
              </Badge>
            )}
          </Group>

          {(dpoBadgeUrl && !removeBadge) || badgeFile ? (
            <Box
              style={{
                display: 'flex', alignItems: 'center', gap: 16, padding: 12,
                border: '1px solid var(--mantine-color-gray-3)', borderRadius: 8,
              }}
            >
              <Box
                style={{
                  width: 120, height: 60, borderRadius: 6, overflow: 'hidden',
                  background: 'var(--mantine-color-gray-1)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}
              >
                <Image
                  src={badgePreviewUrl}
                  alt="Badge preview"
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                />
              </Box>
              <Text size="xs" c="dimmed" style={{ flex: 1 }}>
                {badgeFile ? `New upload: ${badgeFile.name}` : 'Currently saved on the public privacy page.'}
              </Text>
              <ActionIcon
                color="red"
                variant="light"
                onClick={() => {
                  setBadgeFile(null);
                  setRemoveBadge(true);
                }}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Box>
          ) : (
            <FileInput
              placeholder="Upload NPC registration badge (PNG/JPG, max 5 MB)"
              accept="image/*"
              leftSection={<IconUpload size={16} />}
              onChange={handleBadgeChange}
              clearable
              styles={{ input: { borderStyle: 'dashed', borderWidth: 2 } }}
            />
          )}
        </Paper>

        {/* Registration + DPO Contact */}
        <Divider label="NPC Registration & DPO Contact" labelPosition="left" mb="md" />
        <Grid mb="lg">
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <TextInput
              label="NPC Registration No."
              placeholder="e.g., DPO-2024-XXXXXX"
              leftSection={<IconShieldCheck size={14} />}
              value={dpoRegistrationNo}
              onChange={(e) => setDpoRegistrationNo(e.currentTarget.value)}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <TextInput
              label="Effective Date of Notice"
              type="date"
              leftSection={<IconCalendar size={14} />}
              value={lastUpdated}
              onChange={(e) => setLastUpdated(e.currentTarget.value)}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <TextInput
              label="DPO Officer Name"
              placeholder="Full name of the Data Protection Officer"
              leftSection={<IconUser size={14} />}
              value={dpoOfficerName}
              onChange={(e) => setDpoOfficerName(e.currentTarget.value)}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <TextInput
              label="DPO Email"
              type="email"
              placeholder="dpo@ncst.edu.ph"
              leftSection={<IconMail size={14} />}
              value={dpoContactEmail}
              onChange={(e) => setDpoContactEmail(e.currentTarget.value)}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <TextInput
              label="DPO Phone"
              placeholder="+63 9XX XXX XXXX"
              leftSection={<IconPhone size={14} />}
              value={dpoContactPhone}
              onChange={(e) => setDpoContactPhone(e.currentTarget.value)}
            />
          </Grid.Col>
          <Grid.Col span={12}>
            <Textarea
              label="DPO Office Address"
              placeholder="Full office address"
              leftSection={<IconMapPin size={14} />}
              value={dpoOfficeAddress}
              onChange={(e) => setDpoOfficeAddress(e.currentTarget.value)}
              minRows={2}
              autosize
            />
          </Grid.Col>
        </Grid>

        <Divider label="Privacy Notice Body" labelPosition="left" mb="md" />
        <Textarea
          placeholder="Write your full Data Privacy Notice here. Line breaks are preserved on the public page."
          value={noticeText}
          onChange={(e) => setNoticeText(e.currentTarget.value)}
          minRows={12}
          autosize
          maxRows={30}
          description="This is the main text displayed on /privacy. Markdown is NOT rendered — plain text with preserved line breaks."
        />

        {error && (
          <Alert color="red" mt="md" title="Save failed">
            {error}
          </Alert>
        )}

        {initial.updatedAt && (
          <Text size="xs" c="dimmed" mt="md">
            Last saved: <b>{new Date(initial.updatedAt).toLocaleString()}</b>
            {initial.updatedByName && ` by ${initial.updatedByName}`}
          </Text>
        )}

        <Group justify="flex-end" mt="xl">
          <Button
            variant="light"
            onClick={() => router.push('/dashboard/forms/frf/manage')}
          >
            Cancel
          </Button>
          <Button
            color="teal"
            leftSection={<IconDeviceFloppy size={16} />}
            loading={saving}
            onClick={handleSave}
          >
            Save Privacy Settings
          </Button>
        </Group>
      </Card>
    </Container>
  );
}