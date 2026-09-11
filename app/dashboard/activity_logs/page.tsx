"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Table, Badge, Card, Text, Group, Stack, Code, ScrollArea, TextInput, UnstyledButton, Button, LoadingOverlay, SegmentedControl } from "@mantine/core";
import { IconSearch, IconTerminal2, IconChevronDown, IconChevronUp, IconSelector, IconDownload } from "@tabler/icons-react";
import {
  DatePicker,
} from "@mantine/dates";

interface AuditLog {
  id: string;
  userId: string | null;
  email: string | null;
  action: string;
  details: string | null;
  ipAddress: string | null;
  createdAt: string;
  user?: {
    fname: string;
    lname: string;
    role: string;
    departmentCode: string;
    branch: string;
    employee_id: string;
  } | null;
}

type SortField = "user" | "action" | "ipAddress" | "createdAt";

function ThSortable({
  children,
  sorted,
  reversed,
  onSort,
}: {
  children: React.ReactNode;
  sorted: boolean;
  reversed: boolean;
  onSort: () => void;
}) {
  const Icon = sorted ? (reversed ? IconChevronUp : IconChevronDown) : IconSelector;
  return (
    <Table.Th style={{ padding: 0 }}>
      <UnstyledButton onClick={onSort} style={{ width: "100%", padding: "12px 16px" }}>
        <Group justify="space-between" wrap="nowrap" gap={4}>
          <Text fw={600} size="sm">{children}</Text>
          <Icon size={16} style={{ opacity: sorted ? 1 : 0.4 }} />
        </Group>
      </UnstyledButton>
    </Table.Th>
  );
}

function ExpandableDetails({ action, detailsStr }: { action: string; detailsStr: string | null }) {
  const [opened, setOpened] = useState(false);

  if (!detailsStr) return <Text size="sm" c="dimmed" fs="italic">No additional details.</Text>;

  let readableText = detailsStr;
  try {
    const details = JSON.parse(detailsStr);
    if ((action === "EDIT_USERS" || action === "ASSIGN_OIC" || action === "REVOKE_OIC") && details.updated) {
      readableText = `In-update ang user account (ID: ${Array.isArray(details.updated) ? details.updated.join(", ") : details.updated})`;
    } else {
      readableText = JSON.stringify(details);
    }
  } catch (e) {
    readableText = detailsStr;
  }

  return (
    <Stack gap={4} style={{ width: "100%", overflow: "hidden" }}>
      <Text size="sm" fw={500} c="dark.3" lineClamp={opened ? undefined : 2} style={{ wordBreak: "break-word" }}>
        {readableText}
      </Text>

      {opened && (
        <Code color="gray.1" c="gray.7" block style={{ fontSize: "11px", padding: "6px 10px", wordBreak: "break-all", whiteSpace: "pre-wrap" }}>
          {detailsStr}
        </Code>
      )}

      <UnstyledButton onClick={() => setOpened(!opened)} style={{ alignSelf: "flex-start" }}>
        <Group gap={2} c="blue.6">
          <Text size="xs" fw={600}>{opened ? "Show less" : "Read more"}</Text>
          {opened ? <IconChevronUp size={12} /> : <IconChevronDown size={12} />}
        </Group>
      </UnstyledButton>
    </Stack>
  );
}

function getActionBadge(action: string) {
  const normalized = (action || "").toUpperCase();
  switch (normalized) {
    case "LOGIN_SUCCESS":
    case "LOGIN":
      return <Badge color="green" variant="light" radius="sm">Login Success</Badge>;
    case "LOGIN_FAILURE":
      return <Badge color="red" variant="filled" radius="sm">Login Failed</Badge>;
    case "LOGOUT":
      return <Badge color="gray" variant="light" radius="sm">Logout</Badge>;
    case "EDIT_USERS":
    case "USER_UPDATE":
    case "CHANGE_PASSWORD":
      return <Badge color="blue" variant="light" radius="sm">Modify Account</Badge>;
    case "USER_CREATE":
      return <Badge color="teal" variant="light" radius="sm">Create User</Badge>;
    case "ASSIGN_OIC":
      return <Badge color="violet" variant="light" radius="sm">Assign OIC</Badge>;
    case "REVOKE_OIC":
      return <Badge color="orange" variant="light" radius="sm">Revoke OIC</Badge>;
    case "DEPT_UPDATE":
      return <Badge color="indigo" variant="light" radius="sm">Dept Update</Badge>;
    default:
      return <Badge color="dark" variant="light" radius="sm">{action}</Badge>;
  }
}

function formatIP(ip: string | null) {
  if (!ip) return <Text size="xs" c="dimmed" fs="italic">Unknown</Text>;
  if (ip === "::1" || ip === "127.0.0.1") {
    return <Badge color="dark" variant="outline" size="xs">Localhost</Badge>;
  }
  return <Text size="xs" c="dimmed" style={{ wordBreak: "break-all" }}>{ip}</Text>;
}

// 🎯 Helper: I-extract ang unique actions mula sa logs
function getUniqueActions(logs: AuditLog[]): string[] {
  const actions = new Set<string>();
  logs.forEach(log => {
    if (log.action) {
      const normalized = log.action.toUpperCase();
      actions.add(normalized);
    }
  });
  return Array.from(actions).sort();
}

// 🎯 Helper: Get display name for action
function getActionDisplayName(action: string): string {
  const normalized = action.toUpperCase();
  const map: Record<string, string> = {
    "LOGIN_SUCCESS": "Login Success",
    "LOGIN_FAILURE": "Login Failed",
    "LOGOUT": "Logout",
    "EDIT_USERS": "Modify Account",
    "USER_UPDATE": "Modify Account",
    "CHANGE_PASSWORD": "Modify Account",
    "USER_CREATE": "Create User",
    "ASSIGN_OIC": "Assign OIC",
    "REVOKE_OIC": "Revoke OIC",
    "DEPT_UPDATE": "Dept Update",
  };
  return map[normalized] || action;
}

export default function AuditLogsTable() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [search, setSearch] = useState("");

  const [sortField, setSortField] = useState<SortField | null>(null);
  const [reverseSortDirection, setReverseSortDirection] = useState(false);

  const [timeRange, setTimeRange] = useState<
    "day" | "week" | "month" | "custom" | "all"
  >("all");

  const [customDates, setCustomDates] = useState<
    [string | null, string | null]
  >([null, null]);

  // Fetch logs
  useEffect(() => {
    async function fetchLogs() {
      try {
        setLoading(true);
        const query = new URLSearchParams();
        query.set("timeRange", timeRange);
        if (timeRange === "custom" && customDates[0] && customDates[1]) {
          query.set("startDate", customDates[0]);
          query.set("endDate", customDates[1]);
        }
        const res = await fetch(`/api/auditlogs/get?${query.toString()}`);
        const json = await res.json();
        if (json.success) {
          setLogs(json.data);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchLogs();
  }, [timeRange, customDates]);

  const handleSort = (field: SortField) => {
    const reversed = field === sortField ? !reverseSortDirection : false;
    setReverseSortDirection(reversed);
    setSortField(field);
  };

  // 1. Filtering Block (search only, no action filter)
  const filteredLogs = logs.filter((log) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return (
      (log.email || "").toLowerCase().includes(term) ||
      (log.action || "").toLowerCase().includes(term) ||
      (log.details || "").toLowerCase().includes(term) ||
      (log.user?.fname || "").toLowerCase().includes(term) ||
      (log.user?.lname || "").toLowerCase().includes(term)
    );
  });

  // 2. Sorting Block
  const sortedLogs = [...filteredLogs].sort((a, b) => {
    if (!sortField) return 0;

    let left = "";
    let right = "";

    if (sortField === "user") {
      left = a.user ? `${a.user.fname} ${a.user.lname}` : (a.email || "");
      right = b.user ? `${b.user.fname} ${b.user.lname}` : (b.email || "");
    } else if (sortField === "createdAt") {
      const leftTime = new Date(a.createdAt).getTime();
      const rightTime = new Date(b.createdAt).getTime();
      return reverseSortDirection ? leftTime - rightTime : rightTime - leftTime;
    } else {
      left = String(a[sortField] || "");
      right = String(b[sortField] || "");
    }

    return reverseSortDirection
      ? right.localeCompare(left, undefined, { numeric: true, sensitivity: 'base' })
      : left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
  });

  // 🎯 EXPORT PER ACTION TYPE (AUTO-SEGREGATE) – gamit ang LAHAT ng logs (hindi filtered)
  const handleExportXLSX = async () => {
    try {
      setExporting(true);
      const XLSX = await import("xlsx");

      // Kunin ang lahat ng unique actions mula sa LAHAT ng logs
      const allActions = getUniqueActions(logs);
      const exportedFiles: string[] = [];

      for (const action of allActions) {
        const actionLogs = logs.filter(log => log.action.toUpperCase() === action);
        if (actionLogs.length === 0) continue;

        const displayName = getActionDisplayName(action);
        
        const toExport = actionLogs.map((log) => {
          let readableDetails = log.details || "";
          try {
            if (log.details) {
              const parsed = JSON.parse(log.details);
              if ((log.action === "EDIT_USERS" || log.action === "ASSIGN_OIC" || log.action === "REVOKE_OIC") && parsed.updated) {
                readableDetails = `In-update ang user account (ID: ${Array.isArray(parsed.updated) ? parsed.updated.join(", ") : parsed.updated})`;
              }
            }
          } catch {
            readableDetails = log.details || "";
          }

          return {
            "Log ID": log.id,
            "Employee ID": log.user?.employee_id || "N/A",
            "Actor Name": log.user ? `${log.user.fname} ${log.user.lname}` : "System / Guest",
            "Email": log.email || "N/A",
            "Role": log.user?.role || "N/A",
            "Department": log.user?.departmentCode || "N/A",
            "Branch": log.user?.branch || "N/A",
            "Action Triggered": log.action,
            "Activity Details": readableDetails,
            "IP Address": log.ipAddress || "Unknown",
            "Timestamp": new Date(log.createdAt).toLocaleString("en-US"),
          };
        });

        const ws = XLSX.utils.json_to_sheet(toExport);
        ws['!cols'] = [
          { wch: 15 }, { wch: 15 }, { wch: 25 }, { wch: 30 },
          { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 30 },
          { wch: 50 }, { wch: 20 }, { wch: 25 }
        ];

        const wb = XLSX.utils.book_new();
        const sheetName = displayName.slice(0, 31);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);

        const safeFileName = action.replace(/[^a-zA-Z0-9]/g, '_');
        const fileName = `${safeFileName}_${new Date().toISOString().slice(0, 10)}.xlsx`;
        XLSX.writeFile(wb, fileName);
        exportedFiles.push(fileName);
      }

      if (exportedFiles.length === 0) {
        alert("No logs to export.");
      } else {
        alert(`✅ Exported ${exportedFiles.length} file(s):\n${exportedFiles.join('\n')}`);
      }
    } catch (err) {
      console.error(err);
      alert("XLSX export failed. Make sure 'xlsx' package is installed.");
    } finally {
      setExporting(false);
    }
  };

  const rows = sortedLogs.map((log) => (
    <Table.Tr key={log.id}>
      <Table.Td style={{ verticalAlign: "top" }}>
        <Stack gap={2}>
          {log.user ? (
            <>
              <Text size="sm" fw={600} c="blue.7" style={{ lineHeight: 1.2 }}>
                {log.user.fname} {log.user.lname}
              </Text>
              <Text size="xs" c="dimmed" style={{ wordBreak: "break-all" }}>
                {log.email}
              </Text>
              <Group gap={4} mt={4} wrap="wrap">
                <Badge size="12px" radius="xs" color="gray" variant="filled">{log.user.departmentCode}</Badge>
                <Badge size="12px" radius="xs" color="dark" variant="dot">{log.user.role}</Badge>
                <Badge size="12px" radius="xs" color="cyan" variant="light">{log.user.branch}</Badge>
              </Group>
            </>
          ) : (
            <>
              <Text size="sm" fw={600} c="orange.7" style={{ lineHeight: 1.2 }}>
                {log.email}
              </Text>
              <Text size="11px" c="dimmed" fs="italic">
                Invalid / Deleted Account
              </Text>
            </>
          )}
          {log.userId && log.user?.employee_id && (
            <Text size="12px" c="dimmed" style={{ fontFamily: "monospace", marginTop: 4 }}>
              Employee ID: {log.user.employee_id}
            </Text>
          )}
        </Stack>
      </Table.Td>

      <Table.Td style={{ verticalAlign: "top" }}>{getActionBadge(log.action)}</Table.Td>

      <Table.Td style={{ verticalAlign: "top" }}>
        <ExpandableDetails action={log.action} detailsStr={log.details} />
      </Table.Td>

      <Table.Td style={{ verticalAlign: "top" }}>{formatIP(log.ipAddress)}</Table.Td>

      <Table.Td style={{ verticalAlign: "top" }}>
        <Text size="sm" fw={500}>
          {new Date(log.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </Text>
        <Text size="xs" c="dimmed">
          {new Date(log.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </Text>
      </Table.Td>
    </Table.Tr>
  ));

  return (
    <Card withBorder shadow="sm" radius="md" p="md" pos="relative">
      <LoadingOverlay visible={loading} zIndex={100} overlayProps={{ blur: 2 }} loaderProps={{ size: "lg" }} />
      <Stack gap="md">
        <Group justify="space-between" align="flex-start">
          <div>
            <Group gap="xs">
              <IconTerminal2 size={22} style={{ color: "var(--mantine-color-blue-6)" }} />
              <Text size="xl" fw={700}>System Audit Logs</Text>
            </Group>
            <Text size="xs" c="dimmed">
              This is a table of all activity logs throughout NCST D-Forms. For Admin/SuperUser access only.
            </Text>
          </div>

          <Group gap="sm" wrap="wrap">
            <SegmentedControl
              value={timeRange}
              onChange={(value) => setTimeRange(value as typeof timeRange)}
              data={[
                { label: "Today", value: "day" },
                { label: "Week", value: "week" },
                { label: "Month", value: "month" },
                { label: "Custom", value: "custom" },
                { label: "All", value: "all" },
              ]}
            />

            {timeRange === "custom" && (
              <DatePicker
                type="range"
                allowSingleDateInRange
                value={customDates}
                onChange={setCustomDates}
              />
            )}
          </Group>
        </Group>

        {/* 🎯 FILTER CONTROLS (no action filter) */}
        <Group gap="md" align="flex-end" wrap="wrap">
          <TextInput
            placeholder="Search email, name, action, details..."
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            leftSection={<IconSearch size={16} />}
            style={{ flex: 1, minWidth: 200 }}
          />

          <Button 
            variant="light" 
            color="green" 
            leftSection={<IconDownload size={16} />} 
            onClick={handleExportXLSX}
            loading={exporting}
            disabled={loading || sortedLogs.length === 0}
          >
            Export XLSX
          </Button>
        </Group>

        <ScrollArea h="calc(100vh - 350px)">
          <Table 
            highlightOnHover 
            striped 
            withColumnBorders 
            verticalSpacing="md" 
            horizontalSpacing="md" 
            withTableBorder 
            stickyHeader
            style={{ tableLayout: "fixed", width: "100%" }} 
          >
            <Table.Thead>
              <Table.Tr>
                <ThSortable sorted={sortField === "user"} reversed={reverseSortDirection} onSort={() => handleSort("user")}>
                  User / Identity Profile
                </ThSortable>
                <ThSortable sorted={sortField === "action"} reversed={reverseSortDirection} onSort={() => handleSort("action")}>
                  Action
                </ThSortable>
                <Table.Th style={{ width: "37%", padding: "12px 16px" }}>
                  <Text fw={600} size="sm">Activity Details</Text>
                </Table.Th>
                <ThSortable sorted={sortField === "ipAddress"} reversed={reverseSortDirection} onSort={() => handleSort("ipAddress")}>
                  IP Address
                </ThSortable>
                <ThSortable sorted={sortField === "createdAt"} reversed={reverseSortDirection} onSort={() => handleSort("createdAt")}>
                  Timestamp
                </ThSortable>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.length > 0 ? (
                rows
              ) : (
                <Table.Tr>
                  <Table.Td colSpan={5} style={{ textAlign: "center" }}>
                    <Text c="dimmed" size="sm" my="md">
                      No logs found.
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Stack>
    </Card>
  );
}