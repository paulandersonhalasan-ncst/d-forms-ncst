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
  useMantineColorScheme
} from '@mantine/core';
import { IconDownload, IconCalendar, IconFileExport, IconTrash, IconInfoCircle, IconChevronDown } from '@tabler/icons-react';
import useSWR from 'swr';
import { DatePicker } from '@mantine/dates';
import dayjs from 'dayjs';

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
  const [exportFormat, setExportFormat] = useState<string | null>('json');

  // Delete tab state
  const [deleteStartDate, setDeleteStartDate] = useState<string | null>(null);
  const [deleteEndDate, setDeleteEndDate] = useState<string | null>(null);
  const [deleteDepartment, setDeleteDepartment] = useState<string | null>(null);
  const [deleteFormat, setDeleteFormat] = useState<string | null>('json');
  const [previewMemos, setPreviewMemos] = useState<MemoPreview[]>([]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteCount, setDeleteCount] = useState(0);

  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  const { data: deptData, isLoading: deptLoading } = useSWR('/api/department/get', fetcher);
  const departments = (deptData?.data as Department[]) || [];
  const deptOptions = departments.map((d) => ({
    value: d.code,
    label: d.code,
  }));

  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    importedCount: number;
    skippedCount: number;
    message: string;
  } | null>(null);

  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';

  const handleImport = async () => {
    if (!importFile) {
      setError('Please select a JSON file to import.');
      return;
    }
    setImporting(true);
    setError('');
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      const res = await fetch('/api/super/import', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Import failed');
      }
      setImportResult({
        importedCount: data.importedCount,
        skippedCount: data.skippedCount,
        message: data.message,
      });
      alert(`Successfully imported ${data.importedCount} memos. Skipped ${data.skippedCount}.`);
      setImportFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  // --- SHARED EXPORT FUNCTION (accepts string dates) ---
  const performExport = async (params: {
    startDate: string;
    endDate: string;
    department: string | null;
    includeHistory: boolean;
    format: string;
    fileNamePrefix?: string;
  }) => {
    const { startDate, endDate, department, includeHistory, format, fileNamePrefix = 'memos_backup' } = params;

    console.log('📤 performExport called with:', { startDate, endDate, department, includeHistory, format, fileNamePrefix });

    setLoading(true);
    setError('');
    try {
      const urlParams = new URLSearchParams({
        startDate,
        endDate,
        includeHistory: String(includeHistory),
        format,
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
      a.download = `${fileNamePrefix}_${startDate}_to_${endDate}.${ext}`;
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

  // --- Export function for Export tab (yearly) ---
  const handleExport = async (start: Date, end: Date) => {
    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];
    await performExport({
      startDate: startStr,
      endDate: endStr,
      department: exportDepartment,
      includeHistory: exportIncludeHistory,
      format: exportFormat || 'json',
      fileNamePrefix: 'memos_backup',
    });
  };

  const handleExportCustom = () => {
    if (!exportStartDate || !exportEndDate) {
      setError('Please select both start and end dates.');
      return;
    }
    performExport({
      startDate: exportStartDate,
      endDate: exportEndDate,
      department: exportDepartment,
      includeHistory: exportIncludeHistory,
      format: exportFormat || 'json',
      fileNamePrefix: 'memos_backup',
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
              <Tabs.Tab value="export" leftSection={<IconFileExport size={16} />}>Export</Tabs.Tab>
              <Tabs.Tab value="delete" leftSection={<IconTrash size={16} />}>Delete</Tabs.Tab>
              <Tabs.Tab value="restore" leftSection={<IconCalendar size={16} />}>Restore</Tabs.Tab>

            </Tabs.List>

            {/* ========== EXPORT TAB ========== */}
            <Tabs.Panel value="export" pt="md">
              <Stack gap="md">
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
                  <Group grow align="flex-end">
                    <div>
                      <Text size="sm" fw={500} mb={4}>Start Date</Text>
                      <DatePicker
                        value={exportStartDate}
                        onChange={setExportStartDate}
                        maxDate={new Date()}
                      />
                    </div>
                    <div>
                      <Text size="sm" fw={500} mb={4}>End Date</Text>
                      <DatePicker
                        value={exportEndDate}
                        onChange={setExportEndDate}
                        maxDate={new Date()}
                      />
                    </div>
                  </Group>
                  <Group grow>
                    <Select
                      label="Department (optional)"
                      placeholder="All departments"
                      data={deptOptions}
                      value={exportDepartment}
                      onChange={setExportDepartment}
                      clearable
                      disabled={deptLoading}
                    />
                    <Select
                      label="Export Format"
                      data={[
                        { value: 'csv', label: 'CSV' },
                        { value: 'json', label: 'JSON (Restorable)' },
                        { value: 'xlsx', label: 'Excel (.xlsx)' },
                      ]}
                      value={exportFormat}
                      onChange={setExportFormat}
                      clearable={false}
                    />
                  </Group>
                  <Checkbox
                    label="Include History Remarks"
                    checked={exportIncludeHistory}
                    onChange={(e) => setExportIncludeHistory(e.currentTarget.checked)}
                  />
                  <Button
                    leftSection={<IconDownload size={16} />}
                    onClick={handleExportCustom}
                    disabled={!exportStartDate || !exportEndDate}
                  >
                    Export Custom Range
                  </Button>
                </Stack>
              </Stack>
            </Tabs.Panel>

            {/* ========== DELETE TAB ========== */}
            <Tabs.Panel value="delete" pt="md">
              <Stack gap="md">
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
                      maxDate={deleteEndDate ? new Date(deleteEndDate) : undefined}
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
                <CollapsibleAlert
                  title="Restore Memos"
                  icon={<IconInfoCircle size={16} />}
                  color="blue"
                  defaultOpen={true}
                >
                  Upload a JSON file previously exported from this system to restore memos.
                  The system will create new records with new IDs. Existing memos with the same
                  reference ID will be skipped.

                  <br /><br />

                  Mag-upload ng JSON file na na-export mula sa system na ito upang maibalik ang mga memo.
                  Ang system ay gagawa ng bagong records na may bagong IDs. Ang mga umiiral na memo na may parehong
                  reference ID ay hindi isasama.
                </CollapsibleAlert>

                {/* File Upload Area */}
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
                    e.currentTarget.style.backgroundColor = isDark ? 'var(--mantine-color-blue-8)' : 'var(--mantine-color-blue-1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = isDark ? 'var(--mantine-color-blue-6)' : 'var(--mantine-color-blue-4)';
                    e.currentTarget.style.backgroundColor = isDark ? 'var(--mantine-color-blue-9)' : 'var(--mantine-color-blue-0)';
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
                        : 'Browse or drag & drop your JSON backup file here'}
                    </Text>
                    <Badge color="blue" variant="light" size="lg">
                      .json only
                    </Badge>
                  </Stack>
                </Paper>

                {/* Hidden file input */}
                <input
                  id="file-upload"
                  type="file"
                  accept=".json"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setImportFile(file);
                    // Reset para ma‑select ulit ang same file kung kailangan
                    e.target.value = '';
                  }}
                />

                {/* Action buttons */}
                <Group justify="flex-end">
                  {importFile && (
                    <Button
                      variant="subtle"
                      color="red"
                      onClick={() => setImportFile(null)}
                    >
                      Remove File
                    </Button>
                  )}
                  <Button
                    color="blue"
                    leftSection={<IconFileExport size={16} />}
                    onClick={handleImport}
                    loading={importing}
                    disabled={!importFile}
                  >
                    Restore from JSON
                  </Button>
                </Group>

                {importResult && (
                  <Alert color="green" title="Import Complete">
                    <Text size="sm">
                      {importResult.message}
                      {importResult.skippedCount > 0 && (
                        <Text c="orange" size="sm">
                          Skipped {importResult.skippedCount} memos (duplicates or missing senders).
                        </Text>
                      )}
                    </Text>
                  </Alert>
                )}
              </Stack>
            </Tabs.Panel>
          </Tabs>
        </Stack>
      </Card>
    </Container>
  );
}