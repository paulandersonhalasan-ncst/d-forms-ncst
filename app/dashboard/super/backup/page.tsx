// app/dashboard/super/backup/page.tsx
'use client';

import { useState } from 'react';
import {
  Container,
  Card,
  Title,
  Stack,
  Group,
  Button,
  Text,
  Select,
  Checkbox,
  LoadingOverlay,
  Alert,
  Tabs,
  Badge,
  SimpleGrid,
  Table,
  Modal,
  ScrollArea,
  Divider,
  ActionIcon,
  Collapse,
  Paper,
  useMantineColorScheme,
  TextInput,
  Radio,
  ThemeIcon
} from '@mantine/core';
import { IconDownload, IconCalendar, IconFileExport, IconTrash, IconInfoCircle, IconChevronDown, IconMail, IconRefresh, IconAlertCircle, IconCircleCheck, IconAlertTriangle, IconArrowDown, IconFileText, IconUsers, IconBuilding, IconMapPin, IconTool, IconLink, IconSettings, } from '@tabler/icons-react';
import useSWR from 'swr';
import { DatePicker } from '@mantine/dates';
import dayjs from 'dayjs';
import { upload } from '@vercel/blob/client';

interface LastActionData {
  data: {
    user?: {
      fname?: string;
      lname?: string;
      email?: string;
    } | null;
    email?: string | null;
    details?: string | { count?: number; imported?: number; [key: string]: unknown } | null;
    createdAt: string;
  } | null;
}

const RESTORE_SCOPE_META = [
  { key: 'memos',           label: 'Memos',             color: 'blue',   icon: IconFileText  },
  { key: 'users',           label: 'Users',             color: 'cyan',   icon: IconUsers     },
  { key: 'departments',     label: 'Departments',       color: 'indigo', icon: IconBuilding  },
  { key: 'eventPlaces',     label: 'Event Places',      color: 'teal',   icon: IconMapPin    },
  { key: 'equipment',       label: 'Equipment',         color: 'grape',  icon: IconTool      },
  { key: 'equipmentPlaces', label: 'Equipment Links',   color: 'violet', icon: IconLink      },
  { key: 'frf',             label: 'Reservations',      color: 'orange', icon: IconCalendar  },
  { key: 'system',          label: 'System Settings',   color: 'gray',   icon: IconSettings  },
] as const;

function CollapsibleAlert({
  title,
  icon,
  color = "blue",
  children,
  defaultOpen = true,
}: {
  title: string;
  icon?: React.ReactNode;
  color?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [opened, setOpened] = useState(defaultOpen);

  return (
    <Alert
      color={color}
      radius="md"
      mb="md"
      p="sm"
      autoContrast
      style={{
        cursor: "pointer",
        userSelect: "none",
      }}
      onClick={() => setOpened((o) => !o)}
      styles={(theme) => ({
        root: {
          border: `1px solid ${theme.colors[color]?.[3] ?? theme.colors.blue[3]}`,
        },
        title: {
          width: "100%",
        },
        body: {
          width: "100%",
        },
      })}
      title={
        <Group
          justify="space-between"
          wrap="nowrap"
          onClick={() => setOpened((o) => !o)}
          style={{ cursor: "pointer", width: "100%" }}
        >
          <Group gap="xs" wrap="nowrap">
            {icon}
            <Text fw={500} size="sm">
              {title}
            </Text>
          </Group>
          <ActionIcon variant="subtle" color={color}>
            <IconChevronDown
              size={16}
              style={{
                transform: opened ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 150ms ease",
              }}
            />
          </ActionIcon>
        </Group>
      }
    >
      <Collapse expanded={opened}>
        <Text component="div" size="xs" mt="xs" lh={1.6}>
          {children}
        </Text>
      </Collapse>
    </Alert>
  );
}

interface Department {
  code: string;
  name?: string;
}

interface MemoPreview {
  id: string;
  referenceId: string;
  subject: string;
  senderName: string;
  senderDept: string;
  status: string;
  priority: string;
  purpose: string;
  createdAt: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function BackupPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Export tab state
  const [exportStartDate, setExportStartDate] = useState<string | null>(null);
  const [exportEndDate, setExportEndDate] = useState<string | null>(null);
  const [exportDepartment, setExportDepartment] = useState<string | null>(null);
  const [exportIncludeHistory, setExportIncludeHistory] = useState(false);
  const [exportScopes, setExportScopes] = useState<string[]>(['memos']);
  const [exportFormat, setExportFormat] = useState<string | null>('json');

  // Delete tab state
  const [deleteStartDate, setDeleteStartDate] = useState<string | null>(null);
  const [deleteEndDate, setDeleteEndDate] = useState<string | null>(null);
  const [deleteDepartment, setDeleteDepartment] = useState<string | null>(null);
  const [deleteFormat, setDeleteFormat] = useState<string | null>('json');
  const [previewMemos, setPreviewMemos] = useState<MemoPreview[]>([]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteCount, setDeleteCount] = useState(0);

  // ---- Email Backup tab state ----
  const [emailScopes, setEmailScopes] = useState<string[]>(['memos']);
  const [emailFormat, setEmailFormat] = useState<string>('json');
  const [emailStartDate, setEmailStartDate] = useState<string | null>(null);
  const [emailEndDate, setEmailEndDate] = useState<string | null>(null);
  const [emailDepartment, setEmailDepartment] = useState<string | null>(null);
  const [emailIncludeHistory, setEmailIncludeHistory] = useState(false);
  const [emailAdditionalRecipient, setEmailAdditionalRecipient] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [emailResult, setEmailResult] = useState<{
    filename: string;
    sizeBytes: number;
    deliveryMode: 'attached' | 'link';
    downloadUrl: string | null;
    recipientEmails: string[];
  } | null>(null);

  // ---- Backup history ----
  const { data: historyData, mutate: mutateHistory } = useSWR(
    '/api/super/backup/history',
    fetcher,
    { refreshInterval: 30000 },
  );
  const backupHistory = (historyData?.data || []) as Array<{
    id: string;
    filename: string;
    sizeBytes: number;
    deliveryMode: 'attached' | 'link';
    blobUrl?: string | null;
    recipientEmails: string[];
    scope: string;
    createdAt: string;
    downloadCount: number;
    lastDownloadedAt: string | null;
    createdBy: { fname: string; lname: string; email: string };
  }>;

  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  const { data: deptData, isLoading: deptLoading } = useSWR('/api/department/get', fetcher);
  const departments = (deptData?.data as Department[]) || [];
  const deptOptions = departments.map((d) => ({
    value: d.code,
    label: d.code,
  }));

  // Last action data
  const { data: lastExportData } = useSWR('/api/super/last_action?action=ADMIN_EXPORT_MEMOS', fetcher, {
  refreshInterval: 300000, // refresh every 30 seconds
  });
  const { data: lastDeleteData } = useSWR('/api/super/last_action?action=ADMIN_DELETE_MEMOS', fetcher, {
    refreshInterval: 300000,
  });
  const { data: lastImportData } = useSWR('/api/super/last_action?action=ADMIN_IMPORT_MEMOS', fetcher, {
    refreshInterval: 300000,
  });

  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [detectedScopes, setDetectedScopes] = useState<{
    memos: number; users: number; departments: number;
    frf: number; eventPlaces: number; equipment: number;
    formSettings: number; privacySettings: number;
  } | null>(null);
  const [selectedImportScopes, setSelectedImportScopes] = useState<string[]>([]);
  const [settingsMode, setSettingsMode] = useState<'skip' | 'overwrite'>('skip');
  const [importResult, setImportResult] = useState<{
    results: Record<string, { imported?: number; skipped?: number; action?: string }>;
    errors: string[];
  } | null>(null);

  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';

  const handleImport = async () => {
    if (!importFile) { setError('Please select a file first.'); return; }
    if (selectedImportScopes.length === 0) { setError('Select at least one category.'); return; }

    setImporting(true);
    setError('');
    setImportResult(null);

    try {
      // 1. Browser → Blob directly. Never touches the function body limit.
      const blob = await upload(importFile.name, importFile, {
        access: 'private',                       // or 'public' if your SDK predates private blobs
        handleUploadUrl: '/api/super/import/upload',
      });

      // 2. Small JSON payload → import route reads the blob server-side
      const res = await fetch('/api/super/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blobUrl: blob.url,
          scopes: selectedImportScopes,
          settingsMode,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');

      setImportResult({ results: data.results, errors: data.errors || [] });
      setImportFile(null);
      setDetectedScopes(null);
      setSelectedImportScopes([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  };

type PerformExportParams = {
  startDate: string | null;
  endDate: string | null;
  department: string | null;
  includeHistory: boolean;
  format: string;
  scopes?: string[];
  fileNamePrefix?: string;
};

const performExport = async (params: PerformExportParams) => {
  const { startDate, endDate, department, includeHistory, format, scopes = ['memos'], fileNamePrefix = 'ncst-backup' } = params;

    console.log('📤 performExport called with:', { startDate, endDate, department, includeHistory, format, fileNamePrefix });

    setLoading(true);
    setError('');
    try {
       const urlParams = new URLSearchParams({
          startDate: startDate || '',
          endDate: endDate || '',
          includeHistory: String(includeHistory),
          format,
          scopes: scopes.join(','),
        });
      if (department) urlParams.append('departmentCode', department);

      const url = `/api/super/backup?${urlParams.toString()}`;
      console.log('📤 Fetching:', url);

      const res = await fetch(url);
      if (!res.ok) {
        let errorMsg = 'Export failed';
        try {
          const errData = await res.json();
          errorMsg = errData.error || errorMsg;
        } catch {
          errorMsg = `Server error (${res.status})`;
        }
        throw new Error(errorMsg);
      }

      const blob = await res.blob();
      console.log(`📤 Blob size: ${blob.size} bytes, type: ${blob.type}`);

      const urlBlob = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = urlBlob;
      const ext = format === 'csv' ? 'csv' : format === 'xlsx' ? 'xlsx' : 'json';
      a.download = `${fileNamePrefix}_${scopes.join('-')}_${startDate || 'all'}_to_${endDate || 'all'}.${ext}`;
      a.click();
      window.URL.revokeObjectURL(urlBlob);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
      console.error('❌ performExport error:', err);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const formatLastAction = (data: LastActionData) => {
    if (!data?.data) return 'No recent action.';
    const log = data.data;
    const user = log.user || { fname: 'System', lname: '', email: log.email || 'Unknown' };
    const name = `${user.fname} ${user.lname}`.trim() || user.email || 'System';
    
    // Safely extract the count from details (handle both object and string)
    let count = 0;
    if (log.details) {
      if (typeof log.details === 'string') {
        try {
          const parsed = JSON.parse(log.details);
          count = parsed.count || parsed.imported || 0;
        } catch {
          count = 0;
        }
      } else {
        count = log.details.count || log.details.imported || 0;
      }
    }
    
  const time = dayjs(log.createdAt).format('MMM D, YYYY h:mm A');
  // details may carry 'count' (export/delete) or 'imported' (import) or 'totalImported'
  let parsed: Record<string, unknown> = {};
  if (typeof log.details === 'string') {
    try { parsed = JSON.parse(log.details); } catch { parsed = {}; }
  } else if (log.details && typeof log.details === 'object') {
    parsed = log.details as Record<string, unknown>;
  }
  const total =
    (parsed.totalImported as number) ??
    (parsed.count as number) ??
    (parsed.imported as number) ??
    count;
  return `Last: ${time} by ${name} (${total} record${total === 1 ? '' : 's'})`;
  };

  const handleExport = async (start: Date, end: Date) => {
    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];
    await performExport({
      startDate: startStr,
      endDate: endStr,
      department: exportDepartment,
      includeHistory: exportIncludeHistory,
      format: exportFormat || 'json',
      scopes: exportScopes,
      fileNamePrefix: 'ncst-backup',
    });
  };

  const handleExportCustom = () => {
    const needsDates = exportScopes.includes('memos');
    if (needsDates && (!exportStartDate || !exportEndDate)) {
      setError('Start and end dates are required when including Memos.');
      return;
    }
    performExport({
      startDate: needsDates ? exportStartDate : null,
      endDate: needsDates ? exportEndDate : null,
      department: needsDates ? exportDepartment : null,
      includeHistory: needsDates ? exportIncludeHistory : false,
      format: exportFormat || 'json',
      scopes: exportScopes,
      fileNamePrefix: 'ncst-backup',
    });
  };

  // --- Delete preview ---
  const handlePreviewDelete = async () => {
    if (!deleteStartDate || !deleteEndDate) {
      setError('Please select both start and end dates for deletion.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        startDate: deleteStartDate,
        endDate: deleteEndDate,
        preview: 'true',
      });
      if (deleteDepartment) params.append('departmentCode', deleteDepartment);

      const res = await fetch(`/api/super/backup?${params.toString()}`);
      if (!res.ok) {
        if (res.status === 403) throw new Error('Unauthorized. SuperUser access required.');
        const err = await res.json();
        throw new Error(err.error || 'Failed to preview');
      }
      const data = await res.json();
      setPreviewMemos(data.memos || []);
      setDeleteCount(data.memos?.length || 0);
      setDeleteConfirmOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed');
    } finally {
      setLoading(false);
    }
  };

  // --- Delete confirmation (uses shared export) ---
  const handleConfirmDelete = async () => {
    console.log('🗑️ handleConfirmDelete started');
    setLoading(true);
    setError('');
    try {
      console.log('🗑️ Dates for export:', { deleteStartDate, deleteEndDate });

      const exportSuccess = await performExport({
        startDate: deleteStartDate!,
        endDate: deleteEndDate!,
        department: deleteDepartment,
        includeHistory: false,
        format: deleteFormat || 'json',
        scopes: ['memos'],
        fileNamePrefix: 'memos_deleted',
      });

      if (!exportSuccess) {
        throw new Error('Export before deletion failed');
      }

      // Step 2: Delete (POST)
      const deletePayload = {
        startDate: deleteStartDate,
        endDate: deleteEndDate,
        departmentCode: deleteDepartment,
      };
      console.log('🗑️ Sending DELETE payload:', deletePayload);

      const deleteRes = await fetch('/api/super/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deletePayload),
      });
      const deleteData = await deleteRes.json();
      if (!deleteRes.ok) {
        throw new Error(deleteData.error || 'Deletion failed');
      }

      alert(`Successfully deleted ${deleteData.count} memo(s).`);
      setDeleteConfirmOpen(false);
      setPreviewMemos([]);
      setDeleteCount(0);
      setDeleteStartDate(null);
      setDeleteEndDate(null);
      setDeleteDepartment(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deletion process failed');
      console.error('❌ handleConfirmDelete error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportFormatChange = (val: string | null) => {
    if (!val) return;
    setExportFormat(val);
    if (val === 'csv') setExportScopes(['memos']);
  };

  const handleSendBackupEmail = async () => {
    if (emailScopes.length === 0) {
      setError('Select at least one scope to include in the backup.');
      return;
    }
    const needsDates = emailScopes.includes('memos');
    if (needsDates && (!emailStartDate || !emailEndDate)) {
      setError('Start and end dates are required when including memos.');
      return;
    }
    setEmailSending(true);
    setError('');
    setEmailResult(null);
    try {
      const res = await fetch('/api/super/backup/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scopes: emailScopes,
          format: emailFormat,
          startDate: needsDates ? emailStartDate : null,
          endDate: needsDates ? emailEndDate : null,
          departmentCode: needsDates ? emailDepartment : null,
          includeHistory: needsDates ? emailIncludeHistory : false,
          recipientEmail: emailAdditionalRecipient.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send backup');
      setEmailResult({
        filename: data.filename,
        sizeBytes: data.sizeBytes,
        deliveryMode: data.deliveryMode,
        downloadUrl: data.downloadUrl,
        recipientEmails: data.recipientEmails,
      });
      mutateHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Send failed');
    } finally {
      setEmailSending(false);
    }
  };

  const handleDeleteBackup = async (id: string) => {
    if (!confirm('Permanently delete this backup from the server? The download link in the email will stop working.')) return;
    try {
      const res = await fetch(`/api/super/backup/history?id=${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Delete failed');
      }
      mutateHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleDownloadBackup = (id: string) => {
    // Trigger the signed-URL route — it serves the blob with
    // Content-Disposition: attachment, so the browser downloads directly.
    window.open(`/api/super/backup/download?id=${id}`, '_blank');

    // Give the server a beat to increment downloadCount / lastDownloadedAt,
    // then revalidate SWR so the row reflects it without manual refresh.
    setTimeout(() => mutateHistory(), 1500);
  };

  const handleEmailFormatChange = (val: string | null) => {
    if (!val) return;
    setEmailFormat(val);
    // CSV only supports memos — force-consistent scope list
    if (val === 'csv') {
      setEmailScopes(['memos']);
    }
  };

  const handleFileSelect = async (file: File) => {
    setImportFile(file);
    setImportResult(null);
    setError('');
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      const detected = {
        memos: Array.isArray(data.memos) ? data.memos.length : 0,
        users: Array.isArray(data.users) ? data.users.length : 0,
        departments: Array.isArray(data.departments) ? data.departments.length : 0,
        frf: Array.isArray(data.facilityReservations) ? data.facilityReservations.length : 0,
        eventPlaces: Array.isArray(data.eventPlaces) ? data.eventPlaces.length : 0,
        equipment: Array.isArray(data.equipment) ? data.equipment.length : 0,
        formSettings: Array.isArray(data.formSettings) ? data.formSettings.length : 0,
        privacySettings: Array.isArray(data.privacySettings) ? data.privacySettings.length : 0,
      };
      setDetectedScopes(detected);

      const defaults: string[] = [];
      if (detected.memos > 0) defaults.push('memos');
      if (detected.users > 0 || detected.departments > 0) defaults.push('users');
      if (detected.frf > 0) defaults.push('frf');
      if (detected.formSettings > 0 || detected.privacySettings > 0) defaults.push('system');
      setSelectedImportScopes(defaults);
    } catch {
      setError('That file is not valid JSON.');
      setDetectedScopes(null);
      setSelectedImportScopes([]);
    }
  };

  const currentYear = new Date().getFullYear();
  const lastFiveYears = Array.from({ length: 5 }, (_, i) => currentYear - 5 + i);

  return (
    <Container fluid py="md">
      <Card withBorder radius="lg" p="xl" shadow="sm" pos="relative">
        <LoadingOverlay visible={loading} />
        <Stack gap="lg">
          <Group justify="space-between">
            <Title order={2}>Data Backup & Management</Title>
            <Badge size="lg" color="red" variant="filled">SuperUser Only</Badge>
          </Group>
          <Text size="sm" c="dimmed">
            Export or permanently delete memorandum data. All deletions are logged and require a prior export.
          </Text>

          {error && <Alert color="red" title="Error">{error}</Alert>}

          <Tabs defaultValue="export" variant="pills" radius="md">
            <Tabs.List>
              <Tabs.Tab value="export" leftSection={<IconFileExport size={16} />}>
                Export
              </Tabs.Tab>

              <Tabs.Tab value="delete" leftSection={<IconTrash size={16} />}>
                Delete
              </Tabs.Tab>

              <Tabs.Tab value="restore" leftSection={<IconCalendar size={16} />}>
                Restore
              </Tabs.Tab>

              <Tabs.Tab value="email" leftSection={<IconMail size={16} />}>
                Email Backup
              </Tabs.Tab>

            </Tabs.List>

            {/* ========== EXPORT TAB ========== */}
            <Tabs.Panel value="export" pt="md">
              <Stack gap="md">
                <Badge size="md" ml={6} color="gray" variant="light">
                  {lastExportData ? formatLastAction(lastExportData) : 'No logs yet/Waiting to load...'}
                </Badge>
                <CollapsibleAlert
                  title="Restorable Format"
                  icon={<IconInfoCircle size={16} />}
                  color="yellow"
                  defaultOpen={true}
                >
                  Only <strong>JSON</strong> exports can be restored later via the <strong>Restore</strong> tab.
                  CSV and Excel (XLSX) are for data viewing purposes only and cannot be re-imported.
                  <br></br><br></br>
                  Mga <strong>JSON</strong> format na mga backup lamang ang puwedeng mai-balik sa system sa pamamagitan ng <strong>Restore</strong> tab. Ang CSV at Excel (.xlsx) ay para lamang sa pagtingin ng data at hindi puwedeng ma-reimport.
                </CollapsibleAlert>
                <Stack gap="xs">
                  <Text size="sm" fw={500}>Quick Export by Year:</Text>
                  <SimpleGrid cols={5} spacing="md">
                    {lastFiveYears.map((year) => (
                      <Button
                        key={year}
                        variant={selectedYear === year ? 'filled' : 'light'}
                        color="regalNavy"
                        onClick={() => setSelectedYear(year)}
                      >
                        {year}
                      </Button>
                    ))}
                  </SimpleGrid>
                  {selectedYear && (
                    <Group>
                      <Button
                        leftSection={<IconDownload size={16} />}
                        onClick={() => {
                          const start = new Date(selectedYear, 0, 1);
                          const end = new Date(selectedYear, 11, 31);
                          handleExport(start, end);
                        }}
                      >
                        Export {selectedYear} Data
                      </Button>
                      <Text size="xs" c="dimmed">January 1 – December 31, {selectedYear}</Text>
                    </Group>
                  )}
                </Stack>

                <Divider />

                <Stack gap="md">
                  <Text size="sm" fw={500}>Custom Range Export:</Text>

                  <Checkbox.Group
                    value={exportScopes}
                    onChange={setExportScopes}
                    label={<Text size="sm" fw={600} mb={4}>What to export</Text>}
                    description={
                      exportFormat === 'csv'
                        ? 'CSV only supports Memos — other options disabled.'
                        : 'Pick one or more. If you include Memos, you must also set the date range.'
                    }
                  >
                    <Stack gap={8} mt="xs">
                      <Checkbox value="memos" label="IOM - Memos (with recipients and history)" />
                      <Checkbox value="frf" label="FRF - Facility Reservations (approvals, assignments, equipment)" disabled={exportFormat === 'csv'} />
                      <Checkbox value="users" label="Users & Departments (no passwords)" disabled={exportFormat === 'csv'} />
                      <Checkbox value="system" label="System settings, privacy notice, notifications" disabled={exportFormat === 'csv'} />
                    </Stack>
                  </Checkbox.Group>

                  {exportScopes.includes('memos') && (
                    <Group grow align="flex-end">
                      <div>
                        <Text size="sm" fw={500} mb={4}>Start Date</Text>
                        <DatePicker
                          value={exportStartDate}
                          onChange={setExportStartDate}
                          maxDate={exportEndDate ? new Date(exportEndDate) : new Date()}
                          hideOutsideDates
                        />
                      </div>
                      <div>
                        <Text size="sm" fw={500} mb={4}>End Date</Text>
                        <DatePicker
                          value={exportEndDate}
                          onChange={setExportEndDate}
                          minDate={exportStartDate ? new Date(exportStartDate) : undefined}
                          maxDate={new Date()}
                          hideOutsideDates
                        />
                      </div>
                    </Group>
                  )}

                  <Group grow>
                    <Select
                      label="Department (optional)"
                      placeholder="All departments"
                      data={deptOptions}
                      value={exportDepartment}
                      onChange={setExportDepartment}
                      clearable
                      disabled={deptLoading || !exportScopes.includes('memos')}
                    />
                    <Select
                      label="Export Format"
                      data={[
                        { value: 'csv', label: 'CSV (memos only, not restorable)' },
                        { value: 'json', label: 'JSON (restorable, full data)' },
                        { value: 'xlsx', label: 'Excel — .xlsx (multi-sheet, not restorable)' },
                      ]}
                      value={exportFormat}
                      onChange={handleExportFormatChange}
                      clearable={false}
                    />
                  </Group>

                  {exportScopes.includes('memos') && (
                    <Checkbox
                      label="Include History Remarks"
                      checked={exportIncludeHistory}
                      onChange={(e) => setExportIncludeHistory(e.currentTarget.checked)}
                    />
                  )}

                  <Button
                    leftSection={<IconDownload size={16} />}
                    onClick={handleExportCustom}
                    disabled={
                      exportScopes.length === 0 ||
                      (exportScopes.includes('memos') && (!exportStartDate || !exportEndDate))
                    }
                  >
                    Export Custom Range
                  </Button>
                </Stack>
              </Stack>
            </Tabs.Panel>

            {/* ========== DELETE TAB ========== */}
            <Tabs.Panel value="delete" pt="md">
              <Stack gap="md">
                <Badge size="md" ml={6} color="gray" variant="light">
                  {lastDeleteData ? formatLastAction(lastDeleteData) : 'No logs yet/Waiting to load...'}
                </Badge>
                <CollapsibleAlert
                  title="Permanent Deletion"
                  icon={<IconInfoCircle size={16} />}
                  color="red"
                  defaultOpen={true}
                >
                  <Text size="xs" lh={1.6}>
                    Deletion is permanent and cannot be undone. All matching memos will be removed from the database.
                    You will be required to export a copy before deletion. To ensure you can restore deleted memos in the future, choose <strong>JSON</strong> as your
                    export format. CSV and Excel exports are <strong>not restorable</strong>.

                    <br></br><br></br>

                    Ang pagbura ay isang permanenteng aksyon na hindi na maibabalik (maliban kung may <strong>JSON</strong> file na backup). 
                    Lahat ng memo na tumutugma sa iyong itinakdang petsa ay tatanggalin mula sa database. 
                    Awtomatikong magba-backup ang NCST D-Forms na idadownload ng iyong browser. 
                    Upang masiguro na maibabalik ang mga na-delete na memo sa hinaharap, piliin ang <strong>JSON</strong> bilang pre-delete export format. 
                    Ang CSV at Excel exports ay <strong>hindi maibabalik</strong>.
                  </Text>
                </CollapsibleAlert>

                <Group grow align="flex-end">
                  <div>
                    <Text size="sm" fw={500} mb={4}>Start Date</Text>
                    <DatePicker
                      value={deleteStartDate}
                      onChange={setDeleteStartDate}
                      maxDate={deleteEndDate ? new Date(deleteEndDate) : new Date()}
                      hideOutsideDates
                    />
                  </div>
                  <div>
                    <Text size="sm" fw={500} mb={4}>End Date</Text>
                    <DatePicker
                      value={deleteEndDate}
                      onChange={setDeleteEndDate}
                      minDate={deleteStartDate ? new Date(deleteStartDate) : undefined}
                      maxDate={new Date()}
                      hideOutsideDates
                    />
                  </div>
                </Group>

                <Group grow>
                  <Select
                    label="Department (optional)"
                    placeholder="All departments"
                    data={deptOptions}
                    value={deleteDepartment}
                    onChange={setDeleteDepartment}
                    clearable
                    disabled={deptLoading}
                  />
                  <Select
                    label="Pre-delete Export Format"
                    placeholder="Select format"
                    data={[
                      { value: 'csv', label: 'CSV (non-restorable)' },
                      { value: 'json', label: 'JSON (restorable)' },
                      { value: 'xlsx', label: 'Excel (non-restorable)' },
                    ]}
                    value={deleteFormat}
                    onChange={setDeleteFormat}
                    clearable={false}
                  />
                </Group>

                <Button
                  color="red"
                  leftSection={<IconTrash size={16} />}
                  onClick={handlePreviewDelete}
                  disabled={!deleteStartDate || !deleteEndDate || !deleteFormat}
                >
                  Preview & Delete
                </Button>

                {/* Confirmation Modal */}
                <Modal
                  opened={deleteConfirmOpen}
                  onClose={() => setDeleteConfirmOpen(false)}
                  title="Confirm Deletion"
                  size="lg"
                >
                  <Stack gap="md">
                    <Text>
                      You are about to permanently delete <strong>{deleteCount}</strong> memo(s) within the specified date range.
                      A backup file will be downloaded before deletion.
                    </Text>

                    {/* 🚨 Dynamic warning with null check */}
                    {deleteFormat === 'json' ? (
                      <Alert color="green" title="✅ Restorable Backup">
                        You are exporting in <strong>JSON</strong> format.
                        This backup can be restored later via the <strong>Restore</strong> tab.
                      </Alert>
                    ) : (
                      deleteFormat !== null && (
                        <Alert color="orange" title="⚠️ Backup Not Restorable">
                          You are exporting in <strong>{deleteFormat.toUpperCase()}</strong> format.
                          This backup <strong>cannot be restored</strong> later.
                          Please use <strong>JSON</strong> if you plan to restore these memos in the future.
                        </Alert>
                      )
                    )}

                    {deleteFormat === null && (
                      <Alert color="red" title="⚠️ No Format Selected">
                        Please select an export format before proceeding.
                      </Alert>
                    )}

                    <Text size="sm" c="dimmed">Are you sure you want to proceed?</Text>

                    {previewMemos.length > 0 && (
                      <ScrollArea h={200}>
                        <Table striped highlightOnHover>
                          <Table.Thead>
                            <Table.Tr>
                              <Table.Th>Ref ID</Table.Th>
                              <Table.Th>Subject</Table.Th>
                              <Table.Th>Sender</Table.Th>
                              <Table.Th>Status</Table.Th>
                              <Table.Th>Created</Table.Th>
                            </Table.Tr>
                          </Table.Thead>
                          <Table.Tbody>
                            {previewMemos.map((memo) => (
                              <Table.Tr key={memo.id}>
                                <Table.Td>{memo.referenceId}</Table.Td>
                                <Table.Td>{memo.subject}</Table.Td>
                                <Table.Td>{memo.senderName}</Table.Td>
                                <Table.Td>{memo.status}</Table.Td>
                                <Table.Td>{dayjs(memo.createdAt).format('YYYY-MM-DD')}</Table.Td>
                              </Table.Tr>
                            ))}
                          </Table.Tbody>
                        </Table>
                      </ScrollArea>
                    )}

                    <Group justify="flex-end">
                      <Button variant="light" onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
                      <Button color="red" onClick={handleConfirmDelete} disabled={!deleteFormat}>
                        Confirm Export & Delete
                      </Button>
                    </Group>
                  </Stack>
                </Modal>
              </Stack>
            </Tabs.Panel>

            {/* ========== RESTORE TAB ========== */}
            <Tabs.Panel value="restore" pt="md">
              <Stack gap="md">
                <Badge size="md" ml={6} color="gray" variant="light">
                  {lastImportData ? formatLastAction(lastImportData) : 'No logs yet/Waiting to load...'}
                </Badge>

                <CollapsibleAlert
                  title="Restore From Backup"
                  icon={<IconInfoCircle size={16} />}
                  color="blue"
                  defaultOpen={true}
                >
                  Upload a JSON file previously exported from this system. Choose what to restore,
                  then confirm. Imported users receive a random password and must reset before their first login.
                  <br /><br />
                  Mag-upload ng JSON backup. Piliin kung ano ang ire-restore. Ang mga imported na user ay
                  may random password at kailangang mag-reset bago maka-login.
                </CollapsibleAlert>

                {/* File drop / picker */}
                <Paper
                  withBorder
                  p="xl"
                  radius="md"
                  style={{
                    border: `2px dashed ${isDark ? 'var(--mantine-color-blue-6)' : 'var(--mantine-color-blue-4)'}`,
                    backgroundColor: isDark ? 'var(--mantine-color-blue-9)' : 'var(--mantine-color-blue-0)',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = isDark ? 'var(--mantine-color-blue-5)' : 'var(--mantine-color-blue-6)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = isDark ? 'var(--mantine-color-blue-6)' : 'var(--mantine-color-blue-4)';
                  }}
                  onClick={() => document.getElementById('file-upload')?.click()}
                >
                  <Stack gap="sm" align="center">
                    <IconFileExport size={48} stroke={1.5} color={isDark ? 'var(--mantine-color-blue-3)' : 'var(--mantine-color-blue-6)'} />
                    <Text fw={600} size="lg">
                      {importFile ? 'Change File' : 'Click to Select JSON File'}
                    </Text>
                    <Text size="sm" c="dimmed">
                      {importFile
                        ? `${importFile.name} (${(importFile.size / 1024).toFixed(2)} KB)`
                        : 'Browse or drag & drop a JSON backup'}
                    </Text>
                    <Badge color="blue" variant="light" size="lg">.json only</Badge>
                  </Stack>
                </Paper>

                <input
                  id="file-upload"
                  type="file"
                  accept=".json"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileSelect(f);
                    e.target.value = '';
                  }}
                />

                {/* Detection + scope checkboxes */}
                {detectedScopes && (
                  <Paper withBorder p="md" radius="md">
                    <Stack gap="sm">
                      <Text size="sm" fw={600}>Detected in file</Text>

                      <Checkbox.Group
                        value={selectedImportScopes}
                        onChange={setSelectedImportScopes}
                      >
                        <Stack gap={8} mt="xs">
                          {detectedScopes.memos > 0 && (
                            <Checkbox
                              value="memos"
                              label={`Memos — ${detectedScopes.memos} record(s) with recipients & history`}
                            />
                          )}
                          {(detectedScopes.users > 0 || detectedScopes.departments > 0) && (
                            <Checkbox
                              value="users"
                              label={`Users & Departments — ${detectedScopes.users} user(s), ${detectedScopes.departments} dept(s); skipped if email exists`}
                            />
                          )}
                          {detectedScopes.frf > 0 && (
                            <Checkbox
                              value="frf"
                              label={`Facility Reservations — ${detectedScopes.frf} record(s) with dates, approvals, assignments`}
                            />
                          )}
                          {(detectedScopes.formSettings > 0 || detectedScopes.privacySettings > 0) && (
                            <Checkbox
                              value="system"
                              label="System Settings — FormSettings + PrivacySettings"
                            />
                          )}
                        </Stack>
                      </Checkbox.Group>

                      {selectedImportScopes.includes('system') && (
                        <Paper p="sm" radius="sm" bg={isDark ? 'var(--mantine-color-dark-7)' : 'var(--mantine-color-gray-0)'}>
                          <Radio.Group
                            label="System settings mode"
                            value={settingsMode}
                            onChange={(val) => setSettingsMode(val as 'skip' | 'overwrite')}
                            description="The active settings in your system today will either be kept or replaced by the file's values."
                          >
                            <Stack gap={4} mt="xs">
                              <Radio value="skip" label="Keep current settings (don't import)" />
                              <Radio value="overwrite" label="Overwrite current settings with imported" color="red" />
                            </Stack>
                          </Radio.Group>
                        </Paper>
                      )}
                    </Stack>
                  </Paper>
                )}

                {/* Action buttons */}
                <Group justify="flex-end">
                  {importFile && (
                    <Button variant="subtle" color="red" onClick={() => {
                      setImportFile(null);
                      setDetectedScopes(null);
                      setSelectedImportScopes([]);
                    }}>
                      Remove File
                    </Button>
                  )}
                  <Button
                    color="blue"
                    leftSection={<IconFileExport size={16} />}
                    onClick={handleImport}
                    loading={importing}
                    disabled={!importFile || selectedImportScopes.length === 0}
                  >
                    Restore Selected
                  </Button>
                </Group>

                {/* Results summary */}
                {importResult && (() => {
                  const results = importResult.results ?? {};
                  const totalImported = RESTORE_SCOPE_META.reduce(
                    (sum, meta) => sum + (results[meta.key]?.imported ?? 0),
                    0,
                  );
                  const totalSkipped = RESTORE_SCOPE_META.reduce(
                    (sum, meta) => sum + (results[meta.key]?.skipped ?? 0),
                    0,
                  );

                  return (
                    <Card
                      withBorder
                      radius="md"
                      p="lg"
                      bg="light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-7))"
                    >
                      {/* ── Header ─────────────────────────────────────────── */}
                      <Group justify="space-between" align="center" wrap="wrap" gap="md">
                        <Group gap="sm" wrap="nowrap">
                          <ThemeIcon color="green" size={44} radius="xl" variant="light">
                            <IconCircleCheck size={24} />
                          </ThemeIcon>
                          <Stack gap={0}>
                            <Text fw={700} size="md" lh={1.2}>Restore Complete</Text>
                            <Text size="xs" c="dimmed">
                              {totalImported} record{totalImported === 1 ? '' : 's'} imported
                              {totalSkipped > 0 && ` · ${totalSkipped} skipped`}
                            </Text>
                          </Stack>
                        </Group>

                        <Group gap="xs" wrap="nowrap">
                          <Badge
                            color="green"
                            variant="filled"
                            size="lg"
                            leftSection={<IconArrowDown size={12} />}
                          >
                            {totalImported} imported
                          </Badge>
                          {totalSkipped > 0 && (
                            <Badge color="orange" variant="light" size="lg">
                              {totalSkipped} skipped
                            </Badge>
                          )}
                        </Group>
                      </Group>

                      <Divider my="md" />

                      {/* ── Per-scope tiles ────────────────────────────────── */}
                      <SimpleGrid cols={{ base: 1, xs: 2, sm: 3, md: 4 }} spacing="sm">
                        {RESTORE_SCOPE_META.map((meta) => {
                          const r = results[meta.key] as
                            | { imported?: number; skipped?: number; action?: string }
                            | undefined;
                          if (!r) return null;

                          const imported = r.imported ?? 0;
                          const skipped  = r.skipped  ?? 0;
                          const action   = r.action;
                          const isIdle   = imported === 0 && skipped === 0 && !action;
                          const Icon     = meta.icon;

                          return (
                            <Paper
                              key={meta.key}
                              withBorder
                              p="sm"
                              radius="md"
                              style={{ opacity: isIdle ? 0.55 : 1, transition: 'opacity 150ms ease' }}
                            >
                              <Group gap={6} mb={6} wrap="nowrap">
                                <ThemeIcon variant="light" color={meta.color} size={22} radius="sm">
                                  <Icon size={12} />
                                </ThemeIcon>
                                <Text size="xs" fw={600} c="dimmed" truncate>
                                  {meta.label}
                                </Text>
                              </Group>

                              <Group gap={4} wrap="wrap">
                                {imported > 0 && (
                                  <Badge color="green" variant="light" size="sm">
                                    +{imported}
                                  </Badge>
                                )}
                                {skipped > 0 && (
                                  <Badge color="orange" variant="light" size="sm">
                                    {skipped} skipped
                                  </Badge>
                                )}
                                {action && (
                                  <Badge color="blue" variant="light" size="sm">
                                    {action}
                                  </Badge>
                                )}
                                {isIdle && (
                                  <Text size="xs" c="dimmed" fs="italic">
                                    nothing to restore
                                  </Text>
                                )}
                              </Group>
                            </Paper>
                          );
                        })}
                      </SimpleGrid>

                      {/* ── Errors ─────────────────────────────────────────── */}
                      {importResult.errors.length > 0 && (
                        <Alert
                          color="orange"
                          mt="md"
                          icon={<IconAlertTriangle size={16} />}
                          title={`${importResult.errors.length} non-fatal error${
                            importResult.errors.length === 1 ? '' : 's'
                          }`}
                        >
                          <ScrollArea h={120} type="auto">
                            {importResult.errors.map((e: string, i: number) => (
                              <Text key={i} size="xs" mb={4} style={{ fontFamily: 'monospace' }}>
                                • {e}
                              </Text>
                            ))}
                          </ScrollArea>
                        </Alert>
                      )}
                    </Card>
                  );
                })()}
              </Stack>
            </Tabs.Panel>

            {/* ========== EMAIL BACKUP TAB ========== */}
              <Tabs.Panel value="email" pt="md">
                <Stack gap="md">
                  <CollapsibleAlert
                    title="Email Backup — Send to Your Inbox"
                    icon={<IconInfoCircle size={16} />}
                    color="blue"
                    defaultOpen={true}
                  >
                    Backups up to <b>5 MB</b> will be sent as a direct email attachment.
                    Larger backups will be uploaded to secure storage and emailed as a{' '}
                    <b>download link</b> (no login required). The link stays valid until a
                    SuperUser deletes the backup from the history table below.
                    <br /><br />
                    Ang mga backup na <b>≤ 5 MB</b> ay direktang ipapadala bilang email attachment.
                    Ang mas malalaking backup ay mae-upload sa secure storage at ipapadala bilang{' '}
                    <b>download link</b> (hindi na kailangan ng login).
                  </CollapsibleAlert>

                  <Select
                    label="File format"
                    description="JSON is restorable. XLSX and CSV are for human viewing only."
                    data={[
                      { value: 'json', label: 'JSON (restorable, full data)' },
                      { value: 'xlsx', label: 'Excel — .xlsx (multi-sheet, not restorable)' },
                      { value: 'csv', label: 'CSV (memos only, not restorable)' },
                    ]}
                    value={emailFormat}
                    onChange={handleEmailFormatChange}
                    clearable={false}
                    required
                  />

                  <Checkbox.Group
                    value={emailScopes}
                    onChange={setEmailScopes}
                    label={
                      <Text size="sm" fw={600} mb={4}>
                        What to include in the backup
                      </Text>
                    }
                    description={
                      emailFormat === 'csv'
                        ? 'CSV only supports Memos — other options disabled.'
                        : "Pick one or more. If you include Memos, you'll need to specify a date range."
                    }
                  >
                    <Stack gap={8} mt="xs">
                      <Checkbox value="memos" label="IOM - Memos (with recipients and history)" />
                      <Checkbox
                        value="frf"
                        label="FRF - Facility Reservations (approvals, assignments, equipment)"
                        disabled={emailFormat === 'csv'}
                      />
                      <Checkbox
                        value="users"
                        label="Users & Departments (no passwords)"
                        disabled={emailFormat === 'csv'}
                      />
                      <Checkbox
                        value="system"
                        label="System settings, privacy notice, notifications"
                        disabled={emailFormat === 'csv'}
                      />
                    </Stack>
                  </Checkbox.Group>

                  {emailScopes.includes('memos') && (
                    <>
                      <Group grow align="flex-end">
                        <div>
                          <Text size="sm" fw={500} mb={4}>Start Date</Text>
                          <DatePicker
                            value={emailStartDate}
                            onChange={setEmailStartDate}
                            maxDate={emailEndDate ? new Date(emailEndDate) : new Date()}
                            hideOutsideDates
                          />
                        </div>
                        <div>
                          <Text size="sm" fw={500} mb={4}>End Date</Text>
                          <DatePicker
                            value={emailEndDate}
                            onChange={setEmailEndDate}
                            minDate={emailStartDate ? new Date(emailStartDate) : undefined}
                            maxDate={new Date()}
                            hideOutsideDates
                          />
                        </div>
                      </Group>
                      <Group grow>
                        <Select
                          label="Department (optional)"
                          placeholder="All departments"
                          data={deptOptions}
                          value={emailDepartment}
                          onChange={setEmailDepartment}
                          clearable
                          disabled={deptLoading}
                        />
                        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                          <Checkbox
                            label="Include history remarks"
                            checked={emailIncludeHistory}
                            onChange={(e) => setEmailIncludeHistory(e.currentTarget.checked)}
                          />
                        </div>
                      </Group>
                    </>
                  )}

                  <TextInput
                    label="Additional recipient (optional)"
                    description="In addition to your own email address. Leave empty to send only to yourself."
                    placeholder="another.admin@ncst.edu.ph"
                    value={emailAdditionalRecipient}
                    onChange={(e) => setEmailAdditionalRecipient(e.currentTarget.value)}
                    type="email"
                  />

                  <Group justify="flex-end">
                    <Button
                      leftSection={<IconMail size={16} />}
                      onClick={handleSendBackupEmail}
                      loading={emailSending}
                      disabled={emailScopes.length === 0}
                    >
                      Send Backup Email
                    </Button>
                  </Group>

                  {emailResult && (
                    <Alert color="green" title="Backup Sent">
                      <Stack gap={4}>
                        <Text size="sm">
                          <b>{emailResult.filename}</b> ({(emailResult.sizeBytes / (1024 * 1024)).toFixed(2)} MB)
                          sent via <b>{emailResult.deliveryMode === 'attached' ? 'email attachment' : 'download link'}</b>.
                        </Text>
                        <Text size="xs" c="dimmed">
                          Recipients: {emailResult.recipientEmails.join(', ')}
                        </Text>
                        {emailResult.downloadUrl && (
                          <Text size="xs" c="dimmed" style={{ wordBreak: 'break-all' }}>
                            Download: <a href={emailResult.downloadUrl} target="_blank" rel="noreferrer">{emailResult.downloadUrl}</a>
                          </Text>
                        )}
                      </Stack>
                    </Alert>
                  )}

                  <Divider label="Backup History" labelPosition="left" />

                  <Group justify="flex-end">
                    <Button
                      size="xs"
                      variant="subtle"
                      leftSection={<IconRefresh size={14} />}
                      onClick={() => mutateHistory()}
                    >
                      Refresh
                    </Button>
                  </Group>

                  {backupHistory.length === 0 ? (
                    <Text size="sm" c="dimmed" ta="center" py="md">
                      No backups sent yet.
                    </Text>
                  ) : (
                    <Table striped highlightOnHover withTableBorder>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Created</Table.Th>
                          <Table.Th>By</Table.Th>
                          <Table.Th>Scope</Table.Th>
                          <Table.Th>Size</Table.Th>
                          <Table.Th>Mode</Table.Th>
                          <Table.Th>Downloads</Table.Th>
                          <Table.Th>Actions</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {backupHistory.map((b) => (
                          <Table.Tr key={b.id}>
                            <Table.Td>
                              <Text size="xs">{dayjs(b.createdAt).format('MMM D, YYYY h:mm A')}</Text>
                            </Table.Td>
                            <Table.Td>
                              <Text size="xs">{b.createdBy.fname} {b.createdBy.lname}</Text>
                            </Table.Td>
                            <Table.Td>
                              <Badge size="sm" variant="light">{b.scope}</Badge>
                            </Table.Td>
                            <Table.Td>
                              <Text size="xs">{(b.sizeBytes / (1024 * 1024)).toFixed(2)} MB</Text>
                            </Table.Td>
                            <Table.Td>
                              <Group gap={4}>
                                {b.scope.split(',').map((s) => (
                                  <Badge key={s} size="sm" variant="light">{s}</Badge>
                                ))}
                                <Badge size="sm" variant="outline" color="gray">
                                  {(b.filename.split('.').pop() || 'json').toUpperCase()}
                                </Badge>
                              </Group>
                            </Table.Td>
                            <Table.Td>
                              {b.deliveryMode === 'link' ? (
                                <Group gap={4} wrap="nowrap">
                                  <Text size="xs" fw={600}>{b.downloadCount}</Text>
                                  {b.lastDownloadedAt && (
                                    <Text size="10px" c="dimmed">
                                      · last {dayjs(b.lastDownloadedAt).format('MMM D h:mm A')}
                                    </Text>
                                  )}
                                </Group>
                              ) : (
                                <Text size="xs" c="dimmed" fs="italic">—</Text>
                              )}
                            </Table.Td>
                            <Table.Td>
                              {b.deliveryMode === 'link' ? (
                                <Group gap={6} wrap="nowrap">
                                  <Button
                                    size="xs"
                                    variant="light"
                                    color="blue"
                                    leftSection={<IconDownload size={12} />}
                                    onClick={() => handleDownloadBackup(b.id)}
                                    title="Download this backup file from the server"
                                  >
                                    Download
                                  </Button>
                                  <Button
                                    size="xs"
                                    variant="light"
                                    color="red"
                                    leftSection={<IconTrash size={12} />}
                                    onClick={() => handleDeleteBackup(b.id)}
                                    disabled={b.downloadCount === 0}
                                    title={
                                      b.downloadCount === 0
                                        ? 'Download it at least once before deleting'
                                        : 'Delete from server (link in email will stop working)'
                                    }
                                  >
                                    Delete
                                  </Button>
                                </Group>
                              ) : (
                                <Text size="xs" c="dimmed" fs="italic">
                                  Sent via email only — no server copy
                                </Text>
                              )}
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  )}
                </Stack>
              </Tabs.Panel>
          </Tabs>
        </Stack>
      </Card>
    </Container>
  );
}