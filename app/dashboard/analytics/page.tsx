'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Container,
  Card,
  Title,
  Group,
  Text,
  Button,
  Badge,
  Stack,
  Alert,
  SimpleGrid,
  Select,
  Paper,
  Loader,
  ThemeIcon,
  SegmentedControl,
  RingProgress,
  useMantineTheme,
  useMantineColorScheme,
  Popover,
  UnstyledButton,
  Grid,
  RollingNumber,
  HoverCard,
  Tabs,
  Timeline 
} from '@mantine/core';
import { DatePicker } from '@mantine/dates';
import {
  IconChevronLeft,
  IconChevronRight,
  IconFileText,
  IconSend,
  IconInbox,
  IconTrendingUp,
  IconChartPie,
  IconThumbUp,
  IconPlayerPlay,
  IconUserCheck,
  IconCircleCheck,
  IconLayersIntersect,
  IconFileExport,
  IconClipboardList,
  IconCalendarStats,
  IconMapPin,
  IconTool,
  IconX,
  IconClock,
  IconInfoCircle
} from '@tabler/icons-react';
import useSWR from 'swr';
import { PieChart, LineChart, BarChart } from '@mantine/charts';
import { UserContext, Memo } from '../../dashboard/forms/iom/component/types';
import dayjs from 'dayjs';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function AnalyticsPage() {
  const theme = useMantineTheme();
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';

  // --- User & Department ---
  const [currentUser, setCurrentUser] = useState<UserContext | null>(null);
  const [selectedDept, setSelectedDept] = useState<string>('');
  const [departments, setDepartments] = useState<{ value: string; label: string }[]>([]);
  const [pageLoading, setPageLoading] = useState(true);

  // --- Date Filter States ---
  const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month' | 'all' | 'custom'>('day');
  const [baseDate, setBaseDate] = useState(new Date());

  // Custom date range as [start, end] in 'YYYY-MM-DD' format
  const [customDates, setCustomDates] = useState<[string | null, string | null]>([null, null]);
  const [datePickerOpened, setDatePickerOpened] = useState(false);

  const [exporting, setExporting] = useState(false);

  const [analyticsTab, setAnalyticsTab] = useState<'iom' | 'frf'>('iom');

  const router = useRouter();

  // --- Fetch user ---
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch('/api/auth/me');
        const json = await res.json();
        if (json.success) {
          setCurrentUser(json.data);
          setSelectedDept(json.data.departmentCode);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setPageLoading(false);
      }
    };
    fetchUser();
  }, []);

  // --- Fetch departments for admin/superuser ---
  useEffect(() => {
    if (currentUser && ['Admin', 'SuperUser'].includes(currentUser.role)) {
      const fetchDepts = async () => {
        try {
          const res = await fetch('/api/department/get');
          const json = await res.json();
          if (json.success) {
            const deptOptions = json.data.map((d: { code: string }) => ({
              value: d.code,
              label: d.code,
            }));
            setDepartments(deptOptions);
          }
        } catch (err) {
          console.error(err);
        }
      };
      fetchDepts();
    }
  }, [currentUser]);

  // --- SWR for memos (to get counts per tab for shortcuts) ---
  const { data: memosData } = useSWR<Memo[]>('/api/memos', fetcher, {
    refreshInterval: 30000,
    revalidateOnFocus: true,
  });
  const memos: Memo[] = Array.isArray(memosData) ? memosData : [];

  // --- Compute memo lists (sync with IOM page) ---
  const activeDepartment = currentUser?.departmentCode || '';
  const isCurrentlyOIC = () => {
    if (!currentUser?.oic_start || !currentUser?.oic_end) return false;
    const now = new Date().getTime();
    const start = new Date(currentUser.oic_start).getTime();
    const end = new Date(currentUser.oic_end).getTime();
    return now >= start && now <= end;
  };

  const isAdminOrSuper = currentUser && ['Admin', 'SuperUser'].includes(currentUser.role);
  const isDepartmentHead = currentUser && ['DepartmentHead'].includes(currentUser.role);
  const isHeadOrOIC = isDepartmentHead || isCurrentlyOIC();
  const effectiveDept = isAdminOrSuper ? selectedDept : currentUser?.departmentCode;

  // ✅ Memo lists - walang OIC allowance, same sa IOM page
  const forApprovalMemos = useMemo(
    () => memos.filter((m) => m.senderDept === activeDepartment && m.status === 'FOR_APPROVAL'),
    [memos, activeDepartment]
  );

  const inboundMemos = useMemo(
    () =>
      memos.filter((m) => {
        if (m.status === 'FOR_APPROVAL' || m.status === 'CLOSED' || m.status === 'DENIED')
          return false;
        return m.recipients?.some(
          (r) => r.departmentName === activeDepartment && r.status === 'PENDING'
        );
      }),
    [memos, activeDepartment]
  );

  const outboundMemos = useMemo(
    () =>
      memos.filter((m) => {
        if (m.senderDept !== activeDepartment) return false;
        if (m.status !== 'APPROVED') return false;
        if (!m.recipients || m.recipients.length === 0) return false;
        const allResolved = m.recipients.every((r) =>
          ['CLOSED', 'DENIED', 'COMPLETED'].includes(r.status)
        );
        return !allResolved;
      }),
    [memos, activeDepartment]
  );

  const actionBoardMemos = useMemo(
    () =>
      memos.filter((m) => {
        if (m.status === 'FOR_APPROVAL' || m.status === 'CLOSED' || m.status === 'DENIED')
          return false;
        return m.recipients?.some(
          (r) =>
            r.departmentName === activeDepartment &&
            ['ACKNOWLEDGED', 'PROCESSING'].includes(r.status)
        );
      }),
    [memos, activeDepartment]
  );

  const assignedToMeMemos = useMemo(
    () =>
      memos.filter((m) => {
        if (m.status === 'FOR_APPROVAL' || m.status === 'CLOSED' || m.status === 'DENIED')
          return false;
        return m.recipients?.some(
          (r) =>
            r.departmentName === activeDepartment &&
            r.assignedToIds?.includes(currentUser?.id ?? '') &&
            !['COMPLETED', 'CLOSED', 'DENIED'].includes(r.status)
        );
      }),
    [memos, activeDepartment, currentUser?.id]
  );

  const resolvedMemos = useMemo(
    () =>
      memos.filter((m) => {
        if (!m.recipients || m.recipients.length === 0) return false;

        if (isAdminOrSuper) {
          return m.recipients.some((r) =>
            ['COMPLETED', 'RESPONDED', 'DENIED', 'CLOSED'].includes(r.status)
          );
        }

        const isRecipientResolved = m.recipients.some(
          (r) =>
            r.departmentName === activeDepartment &&
            ['COMPLETED', 'RESPONDED', 'DENIED', 'CLOSED'].includes(r.status)
        );

        const isSenderResolved =
          m.senderDept === activeDepartment &&
          m.recipients.every((r) =>
            ['COMPLETED', 'RESPONDED', 'DENIED', 'CLOSED'].includes(r.status)
          );

        return isRecipientResolved || isSenderResolved;
      }),
    [memos, activeDepartment, isAdminOrSuper]
  );

  const allMemosLedgerList = useMemo(
    () => (isAdminOrSuper ? memos : []),
    [memos, isAdminOrSuper]
  );

  // --- Build tab configurations for shortcut cards (sync with IOM tabs) ---
  const tabConfigs = [];

  // 1. For Approval - Head/OIC only
  if (isHeadOrOIC) {
    tabConfigs.push({
      label: 'For Approval',
      value: 'approval',
      icon: IconThumbUp,
      color: 'orange',
      count: forApprovalMemos.length,
    });
  }

  // 2. Inbound - Head/OIC only
  if (isHeadOrOIC) {
    tabConfigs.push({
      label: 'Inbound',
      value: 'inbound',
      icon: IconInbox,
      color: 'teal',
      count: inboundMemos.length,
    });
  }

  // 3. Outbound - Everyone
  tabConfigs.push({
    label: 'Outbound',
    value: 'outbound',
    icon: IconSend,
    color: 'cyan',
    count: outboundMemos.length,
  });

  // 4. Action Board - Everyone
  tabConfigs.push({
    label: 'Action Board',
    value: 'action_board',
    icon: IconPlayerPlay,
    color: 'indigo',
    count: actionBoardMemos.length,
  });

  // 5. Assigned to Me - Everyone
  tabConfigs.push({
    label: 'Assigned to Me',
    value: 'assigned_to_me',
    icon: IconUserCheck,
    color: 'grape',
    count: assignedToMeMemos.length,
  });

  // 6. Archived - Everyone
  tabConfigs.push({
    label: 'Archived',
    value: 'archived',
    icon: IconCircleCheck,
    color: 'green',
    count: resolvedMemos.length,
  });

  // 7. Global View - Admin/Super only
  if (isAdminOrSuper) {
    tabConfigs.push({
      label: 'Global View',
      value: 'all_memos_global',
      icon: IconLayersIntersect,
      color: 'blue',
      count: memos.length, // ✅ Lahat ng memos
    });
  }

  // --- Build API URL for analytics charts (with date filter) ---
  const queryParams = new URLSearchParams({
    departmentCode: effectiveDept || '',
    timeRange,
    ...(timeRange !== 'all' && timeRange !== 'custom' && { date: baseDate.toISOString() }),
  });

  if (timeRange === 'custom') {
    const [start, end] = customDates;
    if (start) {
      queryParams.append('startDate', dayjs(start).format('YYYY-MM-DD'));
    }
    if (end) {
      queryParams.append('endDate', dayjs(end).format('YYYY-MM-DD'));
    }
  }
  
  const url = useMemo(() => {
      const query = new URLSearchParams({
          departmentCode: effectiveDept || "",
          timeRange,
          ...(timeRange !== "all" &&
          timeRange !== "custom" && {
              date: baseDate.toISOString(),
          }),
      });

      if (timeRange === "custom") {
          const [start, end] = customDates;

          if (start) query.append("startDate", dayjs(start).format("YYYY-MM-DD"));
          if (end) query.append("endDate", dayjs(end).format("YYYY-MM-DD"));
      }

      return `/api/analytics?${query.toString()}`;
  }, [effectiveDept, timeRange, baseDate, customDates]);

  const { data, error } = useSWR(url, fetcher, {
    refreshInterval: 30000,
    revalidateOnFocus: true,
    keepPreviousData: true,
  });

  // --- Navigation for day/week/month ---
  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(baseDate);
    if (timeRange === 'day') newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
    else if (timeRange === 'week') newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    else if (timeRange === 'month') newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
    setBaseDate(newDate);
  };

  const getDateLabel = () => {
    if (timeRange === 'day') return dayjs(baseDate).format('MMMM D, YYYY');
    if (timeRange === 'week') {
      const start = dayjs(baseDate).startOf('week');
      const end = start.add(6, 'day');
      return `${start.format('MMM D')} - ${end.format('MMM D, YYYY')}`;
    }
    if (timeRange === 'month') return dayjs(baseDate).format('MMMM YYYY');
    if (timeRange === 'all') return 'All Time';
    return '';
  };

  // --- Dynamic label for 'custom' segment ---
  const customLabel =
    customDates[0] && customDates[1]
      ? `${dayjs(customDates[0]).format('MMM D')} - ${dayjs(customDates[1]).format('MMM D')}`
      : customDates[0]
      ? `Custom: ${dayjs(customDates[0]).format('MMM D')}`
      : 'Custom';

  const segmentData = [
    { label: 'Day', value: 'day' },
    { label: 'Week', value: 'week' },
    { label: 'Month', value: 'month' },
    { label: 'All Time', value: 'all' },
    { label: customLabel, value: 'custom' },
  ];

  // --- Loading & Error states ---
  if (pageLoading) {
    return (
      <Container size="xl" py="lg">
        <Loader />
      </Container>
    );
  }

  if (!currentUser) {
    return (
      <Container size="xl" py="lg">
        <Alert color="red">Please login to view analytics.</Alert>
      </Container>
    );
  }

  if (error) {
    return (
      <Container size="xl" py="lg">
        <Alert color="red">Failed to load analytics. Please try again later.</Alert>
      </Container>
    );
  }

  const analytics = data?.data;

  // --- Chart Colors ---
  const chartColors = [
    theme.colors.regalNavy?.[6] || '#377ff5',
    theme.colors.regalNavy?.[4] || '#4a8ff5',
    theme.colors.customCreamYellow?.[4] || '#febf3e',
    theme.colors.customCreamYellow?.[6] || '#feb118',
    theme.colors.regalNavy?.[9] || '#003980',
    theme.colors.customCreamYellow?.[2] || '#fedf9e',
  ];

  const statusData = analytics?.statusDistribution
    ? Object.entries(analytics.statusDistribution).map(([name, value], index) => ({
        name,
        value: value as number,
        color: chartColors[index % chartColors.length],
      }))
    : [];

  const priorityData = analytics?.priorityDistribution
    ? Object.entries(analytics.priorityDistribution).map(([name, value], index) => ({
        name,
        value: value as number,
        color: chartColors[(index + 2) % chartColors.length],
      }))
    : [];

  const purposeData = analytics?.purposeDistribution
    ? Object.entries(analytics.purposeDistribution).map(([name, value], index) => ({
        name,
        value: value as number,
        color: chartColors[(index + 4) % chartColors.length],
      }))
    : [];

  // --- Theme variables ---
  const cardBg = isDark ? theme.colors.dark[7] : theme.white;
  const cardBgNested = isDark ? theme.colors.dark[6] : theme.colors.gray[0];
  const cardBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const cardBorderNested = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';
  const textColor = isDark ? theme.white : theme.black;

  const getDateRange = (): { start: Date; end: Date } => {
    const now = new Date();
    let start: Date, end: Date;

    if (timeRange === 'all') {
      start = new Date(0);
      end = new Date();
    } else if (timeRange === 'custom') {
      const [s, e] = customDates;
      start = s ? new Date(`${s}T00:00:00`) : new Date(0);
      end = e ? new Date(`${e}T23:59:59.999`) : new Date();
    } else {
      const base = new Date(baseDate);
      if (timeRange === 'day') {
        start = new Date(base);
        start.setHours(0, 0, 0, 0);
        end = new Date(base);
        end.setHours(23, 59, 59, 999);
      } else if (timeRange === 'week') {
        const day = base.getDay();
        const diff = base.getDate() - day + (day === 0 ? -6 : 1);
        start = new Date(base);
        start.setDate(diff);
        start.setHours(0, 0, 0, 0);
        end = new Date(start);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
      } else if (timeRange === 'month') {
        start = new Date(base.getFullYear(), base.getMonth(), 1);
        end = new Date(base.getFullYear(), base.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999);
      } else {
        // 🔒 Fallback – should never happen, but satisfies TypeScript
        start = new Date(base);
        start.setHours(0, 0, 0, 0);
        end = new Date(base);
        end.setHours(23, 59, 59, 999);
      }
    }
    return { start, end };
  };

  const handleExportXLSX = async () => {
    if (!analytics) return;
    setExporting(true);
    try {
      const XLSX = await import('xlsx');

      const { start, end } = getDateRange();
      const dept = effectiveDept || '';

      // --- I-filter ang lahat ng memo na nasa date range ---
      const allMemos = memosData || [];
      const filteredMemos = allMemos.filter((memo) => {
        const createdAt = new Date(memo.createdAt);
        return createdAt >= start && createdAt <= end;
      });

      // --- Tukuyin ang mga kategorya ---
      // 1. Created: lahat ng memo na ginawa ng departamento (senderDept === dept)
      const createdMemos = filteredMemos.filter((m) => m.senderDept === dept);

      // 2. Sent: pareho lang sa Created, pero para maging malinaw sa Excel, tawagin nating "Sent" (ito ay lumalabas sa overview)
      const sentMemos = createdMemos; // Pareho lang

      // 3. Received: mga memo na natanggap ng departamento (may recipient na departmentName === dept)
      const receivedMemos = filteredMemos.filter((m) =>
        m.recipients?.some((r) => r.departmentName === dept)
      );

      // 4. Active: mga memo na may recipient status na ACKNOWLEDGED o PROCESSING
      const activeMemos = filteredMemos.filter((m) =>
        m.recipients?.some(
          (r) =>
            r.departmentName === dept &&
            ['ACKNOWLEDGED', 'PROCESSING'].includes(r.status)
        )
      );

      // 5. Resolved: mga memo na may recipient status na COMPLETED, CLOSED, o DENIED
      const resolvedMemos = filteredMemos.filter((m) =>
        m.recipients?.some(
          (r) =>
            r.departmentName === dept &&
            ['COMPLETED', 'CLOSED', 'DENIED'].includes(r.status)
        )
      );

      // --- Helper: gawing array ng rows para sa Excel ---
      const headers = [
        'Reference ID',
        'Subject',
        'Sender Name',
        'Sender Dept',
        'Status',
        'Priority',
        'Purpose',
        'Created At',
        'Recipients',
      ];

      const memoToRow = (memo: Memo) => [
        memo.referenceId || '',
        memo.subject || '',
        memo.senderName || '',
        memo.senderDept || '',
        memo.status || '',
        memo.priority || '',
        memo.purpose || '',
        dayjs(memo.createdAt).format('YYYY-MM-DD HH:mm'),
        memo.recipients?.map((r) => r.departmentName).join(', ') || '',
      ];

      // --- Buuin ang worksheet data ---
      const wsData: (string | number)[][] = [];

      // 1. Overview
      const overview = analytics.overview;
      wsData.push(['ANALYTICS OVERVIEW']);
      wsData.push(['Memos Created', overview.total]);
      wsData.push(['Sent', overview.sent]);
      wsData.push(['Received', overview.received]);
      wsData.push(['Active', overview.active]);
      wsData.push(['Resolved', overview.resolved]);
      wsData.push([]);

      // 2. Memo List - Created (Sent)
      wsData.push(['MEMO LIST - CREATED (SENT)']);
      wsData.push(headers);
      createdMemos.forEach((memo) => wsData.push(memoToRow(memo)));
      wsData.push([]);

      // 3. Memo List - Received
      wsData.push(['MEMO LIST - RECEIVED']);
      wsData.push(headers);
      receivedMemos.forEach((memo) => wsData.push(memoToRow(memo)));
      wsData.push([]);

      // 4. Memo List - Active
      wsData.push(['MEMO LIST - ACTIVE']);
      wsData.push(headers);
      activeMemos.forEach((memo) => wsData.push(memoToRow(memo)));
      wsData.push([]);

      // 5. Memo List - Resolved
      wsData.push(['MEMO LIST - RESOLVED']);
      wsData.push(headers);
      resolvedMemos.forEach((memo) => wsData.push(memoToRow(memo)));
      wsData.push([]);

      // --- Gumawa ng worksheet ---
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws['!cols'] = [
        { wch: 20 },
        { wch: 30 },
        { wch: 25 },
        { wch: 15 },
        { wch: 12 },
        { wch: 12 },
        { wch: 15 },
        { wch: 20 },
        { wch: 40 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Analytics');

      const dateStr = dayjs().format('YYYY-MM-DD');
      const fileName = `analytics_${dept || 'all'}_${dateStr}.xlsx`;

      // ---- FRF Sheet ----
      if (analytics.frf) {
        const frfHeaders = ['Reference ID', 'Event Name', 'Requestor Dept', 'Type', 'Status', 'Attendees', 'Created At'];
        const frfData: (string | number)[][] = [];
        frfData.push(['FRF ANALYTICS']);
        frfData.push([]);
        frfData.push(['Total Requests', analytics.frf.overview.total]);
        frfData.push(['For Approval', analytics.frf.overview.forApproval]);
        frfData.push(['Incoming', analytics.frf.overview.incoming]);
        frfData.push(['Outgoing', analytics.frf.overview.outgoing]);
        frfData.push(['Approved', analytics.frf.overview.approved]);
        frfData.push(['Completed', analytics.frf.overview.completed]);
        frfData.push(['Rejected', analytics.frf.overview.rejected]);
        frfData.push([]);
        frfData.push(['Top Venues']);
        frfData.push(['Venue', 'Count']);
        analytics.frf.topVenues.forEach((v: { venue: string; count: number }) => frfData.push([v.venue, v.count]));
        frfData.push([]);
        frfData.push(['Top Equipment']);
        frfData.push(['Equipment', 'Count']);
        analytics.frf.topEquipment.forEach((e: { equipment: string; count: number }) => frfData.push([e.equipment, e.count]));

        const wsFrf = XLSX.utils.aoa_to_sheet(frfData);
        wsFrf['!cols'] = [{ wch: 30 }, { wch: 20 }];
        XLSX.utils.book_append_sheet(wb, wsFrf, 'FRF Analytics');
      }

      XLSX.writeFile(wb, fileName);

      alert(`✅ Exported ${createdMemos.length} created, ${receivedMemos.length} received, ${activeMemos.length} active, ${resolvedMemos.length} resolved memos to ${fileName}`);
    } catch (err) {
      console.error(err);
      alert('Export failed. Make sure xlsx package is installed.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Container fluid py="md" pos="relative">
      <Card
        withBorder
        radius="lg"
        p="xl"
        shadow="sm"
        style={{
          backgroundColor: cardBg,
          borderColor: cardBorder,
        }}
      >
        <Group justify="space-between" align="center" mb="xl">
          <Title order={2} fw={800} style={{ color: textColor }}>
            Department Analytics Dashboard
          </Title>
          <Badge size="lg" color="regalNavy" variant="filled">
            {effectiveDept || 'N/A'}
          </Badge>
        </Group>

        {/* Filters */}
        <Paper
          withBorder
          radius="xl"
          p="lg"
          mb="lg"
          style={{
            background: cardBgNested,
            borderColor: cardBorderNested,
          }}
        >
          <Group align="flex-end" wrap="wrap" gap="md">
            {isAdminOrSuper && (
              <Select
                label="Department"
                data={departments}
                value={selectedDept}
                onChange={(val) => setSelectedDept(val || '')}
                style={{ width: 220 }}
              />
            )}

            {/* Navigation for day/week/month (hidden when custom or all) */}
            {!['all', 'custom'].includes(timeRange) && (
              <Stack gap={5}>
                <Text size="sm" fw={500}>
                  Navigate
                </Text>
                <Group gap="xs">
                  <Button variant="light" onClick={() => navigateDate('prev')}>
                    <IconChevronLeft size={16} />
                  </Button>
                  <Paper withBorder p="sm" radius="md" style={{ minWidth: 150 }}>
                    <Text ta="center" fw={600}>
                      {getDateLabel()}
                    </Text>
                  </Paper>
                  <Button variant="light" onClick={() => navigateDate('next')}>
                    <IconChevronRight size={16} />
                  </Button>
                </Group>
              </Stack>
            )}

            {/* Date Range Segmented Control with Popover */}
            <Stack gap={5}>
              <Text fw={500} size="sm">
                Date Range
              </Text>

              <SegmentedControl
                value={timeRange}
                onChange={(value) => setTimeRange(value as typeof timeRange)}
                data={[
                  { label: 'Day', value: 'day' },
                  { label: 'Week', value: 'week' },
                  { label: 'Month', value: 'month' },
                  { label: 'Custom', value: 'custom' },
                  { label: 'All', value: 'all' },
                ]}
              />

              {timeRange === 'custom' && (
                <DatePicker
                  type="range"
                  allowSingleDateInRange
                  maxDate={new Date()}
                  value={customDates}
                  onChange={setCustomDates}
                />
              )}

            </Stack>

            <Button
                variant="light"
                color="green"
                leftSection={<IconFileExport size={16} />}
                onClick={handleExportXLSX}
                loading={exporting}
                disabled={!analytics || exporting}
              >
                Export to Excel
            </Button>
          </Group>
        </Paper>

        {/* ----- Main Content ----- */}
        {!analytics ? (
            <Loader />
          ) : (
            <Stack gap="lg">
              {/* === ANALYTICS TYPE TABS === */}
              <Tabs
                value={analyticsTab}
                onChange={(val) => setAnalyticsTab((val as 'iom' | 'frf') || 'iom')}
                variant="outline"
                radius="xl"
              >
                <Tabs.List>
                  <Tabs.Tab value="iom" leftSection={<IconFileText size={16} />}>
                    IOM Analytics
                  </Tabs.Tab>
                  <Tabs.Tab value="frf" leftSection={<IconClipboardList size={16} />}>
                    FRF Analytics
                  </Tabs.Tab>
                </Tabs.List>

                {/* ============================================ */}
                {/* ============ IOM ANALYTICS TAB ============ */}
                {/* ============================================ */}
                <Tabs.Panel value="iom" pt="lg">
                  <Stack gap="lg">
                    {/* ---- IOM OVERVIEW ---- */}
                    <Stack gap="xs">
                      <Text size="sm" fw={700} c="dimmed">
                        Inter-Office Memorandum Overview
                      </Text>
                      <SimpleGrid cols={5} spacing="md">
                        {[
                          { label: 'Memos Created', value: analytics.overview.total, icon: IconFileText, color: 'blue', description: 'Kabuuang bilang ng mga memorandum na nilikha sa loob ng napiling date.' },
                          { label: 'Sent', value: analytics.overview.sent, icon: IconSend, color: 'cyan', description: `Mga memorandum na ipinadala ng ${activeDepartment}.` },
                          { label: 'Received', value: analytics.overview.received, icon: IconInbox, color: 'grape', description: `Mga memorandum na natanggap ng ${activeDepartment}.` },
                          { label: 'Active', value: analytics.overview.active, icon: IconTrendingUp, color: 'green', description: 'Mga kasalukuyang aktibong memorandum.' },
                          { label: 'Resolved', value: analytics.overview.resolved, icon: IconCircleCheck, color: 'teal', description: 'Mga na-resolve na memorandum.' },
                        ].map((stat) => {
                          const Icon = stat.icon;
                          return (
                            <HoverCard key={stat.label} width={320} shadow="md" position="top" withArrow>
                              <HoverCard.Target>
                                <Paper withBorder p="md" radius="lg" style={{ cursor: 'help', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', background: cardBgNested, borderColor: cardBorderNested }}>
                                  <Group justify="space-between" wrap="nowrap">
                                    <Stack gap={0}>
                                      <Text size="xs" c="dimmed" fw={700}>{stat.label}</Text>
                                      <RollingNumber value={stat.value} fw={500} fz={32} />
                                    </Stack>
                                    <ThemeIcon size={28} radius="md" color={stat.color} variant="light">
                                      <Icon size={16} />
                                    </ThemeIcon>
                                  </Group>
                                </Paper>
                              </HoverCard.Target>
                              <HoverCard.Dropdown>
                                <Text size="sm" fw={600} mb={4}>{stat.label}</Text>
                                <Text size="xs" c="dimmed" lh={1.5}>{stat.description}</Text>
                              </HoverCard.Dropdown>
                            </HoverCard>
                          );
                        })}
                      </SimpleGrid>
                    </Stack>

                    {/* ---- IOM SHORTCUTS ---- */}
                    <Stack gap="xs">
                      <Text size="sm" fw={700} c="dimmed">E-IOM Shortcuts</Text>
                      <Group grow wrap="nowrap" gap="md" align="stretch">
                        {tabConfigs.map((config) => {
                          const Icon = config.icon;
                          return (
                            <UnstyledButton key={config.value} onClick={() => router.push(`/dashboard/forms/iom?tab=${config.value}`)} style={{ flex: 1, minWidth: 0, cursor: 'pointer', transition: 'transform 0.2s ease' }} onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; }} onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}>
                              <Paper withBorder radius="xl" p="lg" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: cardBgNested, borderColor: cardBorderNested }}>
                                <Group justify="space-between" style={{ width: '100%' }}>
                                  <Stack gap={0}>
                                    <Text size="xs" fw={700}>{config.label}</Text>
                                    <RollingNumber value={config.count} fw={500} fz={32} />
                                  </Stack>
                                  <ThemeIcon size={30} radius="xl" color={config.color} variant="filled">
                                    <Icon size={15} />
                                  </ThemeIcon>
                                </Group>
                              </Paper>
                            </UnstyledButton>
                          );
                        })}
                      </Group>
                    </Stack>

                    {/* ---- IOM CHARTS (existing 3 pies) ---- */}
                    <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
                      {/* Status */}
                      <Paper withBorder p="md" radius="md" style={{ backgroundColor: cardBgNested, borderColor: cardBorderNested }}>
                        <Text fw={600} mb="md">IOM Status Distribution</Text>
                        <PieChart data={statusData} withLabels={false} withTooltip size={220} mx="auto" />
                        <Stack gap={8} mt="lg">
                          {statusData.map((item) => (
                            <Group key={item.name} justify="space-between">
                              <Group gap={8}><div style={{ width: 12, height: 12, borderRadius: 999, background: item.color }} /><Text size="sm">{item.name}</Text></Group>
                              <Badge variant="light">{item.value}</Badge>
                            </Group>
                          ))}
                        </Stack>
                      </Paper>
                      {/* Priority */}
                      <Paper withBorder p="md" radius="md" style={{ backgroundColor: cardBgNested, borderColor: cardBorderNested }}>
                        <Text fw={600} mb="md">IOM Priority Distribution</Text>
                        <PieChart data={priorityData} withLabels={false} withTooltip size={220} mx="auto" />
                        <Stack gap={8} mt="lg">
                          {priorityData.map((item) => (
                            <Group key={item.name} justify="space-between">
                              <Group gap={8}><div style={{ width: 12, height: 12, borderRadius: 999, background: item.color }} /><Text size="sm">{item.name}</Text></Group>
                              <Badge variant="light">{item.value}</Badge>
                            </Group>
                          ))}
                        </Stack>
                      </Paper>
                      {/* Purpose */}
                      <Paper withBorder p="md" radius="md" style={{ backgroundColor: cardBgNested, borderColor: cardBorderNested }}>
                        <Text fw={600} mb="md">IOM Purpose Distribution</Text>
                        <PieChart data={purposeData} withLabels={false} withTooltip size={220} mx="auto" />
                        <Stack gap={8} mt="lg">
                          {purposeData.map((item) => (
                            <Group key={item.name} justify="space-between">
                              <Group gap={8}><div style={{ width: 12, height: 12, borderRadius: 999, background: item.color }} /><Text size="sm">{item.name}</Text></Group>
                              <Badge variant="light">{item.value}</Badge>
                            </Group>
                          ))}
                        </Stack>
                      </Paper>
                    </SimpleGrid>

                    {/* IOM Trend */}
                    <Paper withBorder p="md" radius="md" style={{ backgroundColor: cardBgNested, borderColor: cardBorderNested }}>
                      <Text fw={600} mb="md">{timeRange === 'day' ? 'IOM Hourly Activity' : 'IOM Trends'}</Text>
                      {analytics.trends?.length > 0 ? (
                        <LineChart h={350} data={analytics.trends} dataKey="date" series={[{ name: 'count', color: theme.colors.regalNavy?.[6] || '#377ff5' }]} curveType="monotone" withDots withLegend withTooltip strokeWidth={3} />
                      ) : (<Text c="dimmed" ta="center">No data</Text>)}
                    </Paper>

                    {/* IOM Top Senders/Recipients */}
                    <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
                      <Paper withBorder p="md" radius="md" style={{ backgroundColor: cardBgNested, borderColor: cardBorderNested }}>
                        <Text fw={600} mb="md">IOM Top Senders (Incoming)</Text>
                        {analytics.topSenders?.length > 0 ? (
                          <BarChart h={250} data={analytics.topSenders} dataKey="department" series={[{ name: 'count', color: theme.colors.regalNavy?.[6] || '#377ff5' }]} withTooltip withBarValueLabel />
                        ) : (<Text c="dimmed" ta="center">No data</Text>)}
                      </Paper>
                      <Paper withBorder p="md" radius="md" style={{ backgroundColor: cardBgNested, borderColor: cardBorderNested }}>
                        <Text fw={600} mb="md">IOM Top Recipients (Outgoing)</Text>
                        {analytics.topRecipients?.length > 0 ? (
                          <BarChart h={250} data={analytics.topRecipients} dataKey="department" series={[{ name: 'count', color: theme.colors.customCreamYellow?.[5] || '#feb625' }]} withTooltip withBarValueLabel />
                        ) : (<Text c="dimmed" ta="center">No data</Text>)}
                      </Paper>
                    </SimpleGrid>

                    {/* IOM Avg Processing */}
                    <Paper withBorder radius="xl" p="xl" style={{ background: cardBgNested, borderColor: cardBorderNested }}>
                      <Group justify="space-between">
                        <Stack gap={0}>
                          <Text fw={700}>IOM Average Processing Time</Text>
                          <Text c="dimmed" size="sm">Closed memos only</Text>
                          <Text fz={42} fw={900}>{analytics.averageProcessingTime}</Text>
                          <Text c="dimmed">days</Text>
                        </Stack>
                        <RingProgress size={150} thickness={14} sections={[{ value: Math.min(analytics.averageProcessingTime * 5, 100), color: 'blue' }]} label={<Text ta="center" fw={800}>{analytics.averageProcessingTime}</Text>} />
                      </Group>
                    </Paper>
                  </Stack>
                </Tabs.Panel>

                {/* ============================================ */}
                {/* ============ FRF ANALYTICS TAB ============ */}
                {/* ============================================ */}
                <Tabs.Panel value="frf" pt="lg">
                  {analytics.frf ? (
                    <Stack gap="lg">
                      {/* ---- FRF OVERVIEW ---- */}
                      <Stack gap="xs">
                        <Text size="sm" fw={700} c="dimmed">Facility Reservation Form Overview</Text>
                        <SimpleGrid cols={{ base: 2, sm: 4, lg: 4 }} spacing="md">
                          {[
                            { label: 'Total Requests', value: analytics.frf.overview.total, icon: IconClipboardList, color: 'blue', description: 'Kabuuang FRF na may kinalaman sa iyong departamento.' },
                            { label: 'For Approval', value: analytics.frf.overview.forApproval, icon: IconClock, color: 'orange', description: 'Mga FRF na naghihintay ng approval mula sa iyong departamento.' },
                            { label: 'Incoming', value: analytics.frf.overview.incoming, icon: IconInbox, color: 'grape', description: 'Mga FRF na galing sa ibang departamento.' },
                            { label: 'Outgoing', value: analytics.frf.overview.outgoing, icon: IconSend, color: 'cyan', description: 'Mga FRF na ginawa ng iyong departamento.' },
                            { label: 'Approved', value: analytics.frf.overview.approved, icon: IconThumbUp, color: 'green', description: 'Mga FRF na na-approve ng iyong departamento.' },
                            { label: 'Completed', value: analytics.frf.overview.completed, icon: IconCircleCheck, color: 'teal', description: 'Mga kumpletong FRF.' },
                            { label: 'Rejected', value: analytics.frf.overview.rejected, icon: IconX, color: 'red', description: 'Mga tinanggihang FRF.' },
                            { label: 'Revision', value: analytics.frf.overview.revision, icon: IconPlayerPlay, color: 'yellow', description: 'Mga FRF na ibinalik para sa rebisyon.' },
                          ].map((stat) => {
                            const Icon = stat.icon;
                            return (
                              <HoverCard key={stat.label} width={280} shadow="md" position="top" withArrow>
                                <HoverCard.Target>
                                  <Paper withBorder p="md" radius="lg" style={{ cursor: 'help', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', background: cardBgNested, borderColor: cardBorderNested }}>
                                    <Group justify="space-between" wrap="nowrap">
                                      <Stack gap={0}>
                                        <Text size="xs" c="dimmed" fw={700}>{stat.label}</Text>
                                        <RollingNumber value={stat.value} fw={500} fz={28} />
                                      </Stack>
                                      <ThemeIcon size={28} radius="md" color={stat.color} variant="light">
                                        <Icon size={16} />
                                      </ThemeIcon>
                                    </Group>
                                  </Paper>
                                </HoverCard.Target>
                                <HoverCard.Dropdown>
                                  <Text size="sm" fw={600} mb={4}>{stat.label}</Text>
                                  <Text size="xs" c="dimmed" lh={1.5}>{stat.description}</Text>
                                </HoverCard.Dropdown>
                              </HoverCard>
                            );
                          })}
                        </SimpleGrid>
                      </Stack>

                      {/* ---- FRF SHORTCUTS ---- */}
                      <Stack gap="xs">
                        <Text size="sm" fw={700} c="dimmed">FRF Shortcuts</Text>
                        <Group grow wrap="nowrap" gap="md" align="stretch">
                          {[
                            { label: 'Pending Approval', value: 'pending_approval', icon: IconClock, color: 'orange', count: analytics.frf.overview.forApproval },
                            { label: 'Action Board', value: 'action_board', icon: IconInfoCircle, color: 'indigo', count: analytics.frf.overview.incoming + analytics.frf.overview.forApproval },
                            { label: 'My Requests', value: 'my_requests', icon: IconSend, color: 'cyan', count: analytics.frf.overview.outgoing },
                            { label: 'Completed', value: 'completed', icon: IconCircleCheck, color: 'green', count: analytics.frf.overview.completed },
                          ].map((config) => {
                            const Icon = config.icon;
                            return (
                              <UnstyledButton key={config.value} onClick={() => router.push(`/dashboard/forms/frf?tab=${config.value}`)} style={{ flex: 1, minWidth: 0, cursor: 'pointer', transition: 'transform 0.2s ease' }} onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; }} onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}>
                                <Paper withBorder radius="xl" p="lg" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: cardBgNested, borderColor: cardBorderNested }}>
                                  <Group justify="space-between" style={{ width: '100%' }}>
                                    <Stack gap={0}>
                                      <Text size="xs" fw={700}>{config.label}</Text>
                                      <RollingNumber value={config.count} fw={500} fz={32} />
                                    </Stack>
                                    <ThemeIcon size={30} radius="xl" color={config.color} variant="filled">
                                      <Icon size={15} />
                                    </ThemeIcon>
                                  </Group>
                                </Paper>
                              </UnstyledButton>
                            );
                          })}
                        </Group>
                      </Stack>

                      {/* ---- FRF PIE CHARTS ---- */}
                      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
                        <Paper withBorder p="md" radius="md" style={{ backgroundColor: cardBgNested, borderColor: cardBorderNested }}>
                          <Text fw={600} mb="md">FRF Status Distribution</Text>
                          {(() => {
                            const frfStatusData = Object.entries(analytics.frf.statusDistribution || {}).map(([name, value], i) => ({
                              name,
                              value: value as number,
                              color: chartColors[i % chartColors.length],
                            }));
                            return frfStatusData.length > 0 ? (
                              <>
                                <PieChart data={frfStatusData} withLabels={false} withTooltip size={220} mx="auto" />
                                <Stack gap={8} mt="lg">
                                  {frfStatusData.map((item) => (
                                    <Group key={item.name} justify="space-between">
                                      <Group gap={8}><div style={{ width: 12, height: 12, borderRadius: 999, background: item.color }} /><Text size="sm">{item.name}</Text></Group>
                                      <Badge variant="light">{item.value}</Badge>
                                    </Group>
                                  ))}
                                </Stack>
                              </>
                            ) : (<Text c="dimmed" ta="center">No data</Text>);
                          })()}
                        </Paper>

                        <Paper withBorder p="md" radius="md" style={{ backgroundColor: cardBgNested, borderColor: cardBorderNested }}>
                          <Text fw={600} mb="md">FRF Type Distribution (Outgoing)</Text>
                          {(() => {
                            const frfTypeData = Object.entries(analytics.frf.typeDistribution || {}).map(([name, value], i) => ({
                              name,
                              value: value as number,
                              color: chartColors[(i + 2) % chartColors.length],
                            }));
                            return frfTypeData.length > 0 ? (
                              <>
                                <PieChart data={frfTypeData} withLabels={false} withTooltip size={220} mx="auto" />
                                <Stack gap={8} mt="lg">
                                  {frfTypeData.map((item) => (
                                    <Group key={item.name} justify="space-between">
                                      <Group gap={8}><div style={{ width: 12, height: 12, borderRadius: 999, background: item.color }} /><Text size="sm">{item.name}</Text></Group>
                                      <Badge variant="light">{item.value}</Badge>
                                    </Group>
                                  ))}
                                </Stack>
                              </>
                            ) : (<Text c="dimmed" ta="center">No data</Text>);
                          })()}
                        </Paper>
                      </SimpleGrid>

                      {/* ---- FRF TRENDS ---- */}
                      <Paper withBorder p="md" radius="md" style={{ backgroundColor: cardBgNested, borderColor: cardBorderNested }}>
                        <Text fw={600} mb="md">{timeRange === 'day' ? 'FRF Hourly Activity' : 'FRF Trends'}</Text>
                        {analytics.frf.trends?.length > 0 ? (
                          <LineChart h={350} data={analytics.frf.trends} dataKey="date" series={[{ name: 'count', color: theme.colors.regalNavy?.[5] || '#4a8ff5' }]} curveType="monotone" withDots withLegend withTooltip strokeWidth={3} />
                        ) : (<Text c="dimmed" ta="center">No data</Text>)}
                      </Paper>

                      {/* ---- FRF TOP VENUES & EQUIPMENT ---- */}
                      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
                        <Paper withBorder p="md" radius="md" style={{ backgroundColor: cardBgNested, borderColor: cardBorderNested }}>
                          <Text fw={600} mb="md">Top Venues</Text>
                          {analytics.frf.topVenues?.length > 0 ? (
                            <BarChart h={250} data={analytics.frf.topVenues} dataKey="venue" series={[{ name: 'count', color: theme.colors.regalNavy?.[6] || '#377ff5' }]} withTooltip withBarValueLabel />
                          ) : (<Text c="dimmed" ta="center">No data</Text>)}
                        </Paper>
                        <Paper withBorder p="md" radius="md" style={{ backgroundColor: cardBgNested, borderColor: cardBorderNested }}>
                          <Text fw={600} mb="md">Top Equipment Requested</Text>
                          {analytics.frf.topEquipment?.length > 0 ? (
                            <BarChart h={250} data={analytics.frf.topEquipment} dataKey="equipment" series={[{ name: 'count', color: theme.colors.customCreamYellow?.[5] || '#feb625' }]} withTooltip withBarValueLabel />
                          ) : (<Text c="dimmed" ta="center">No data</Text>)}
                        </Paper>
                      </SimpleGrid>

                      {/* ---- FRF AVG PROCESSING ---- */}
                      <Paper withBorder radius="xl" p="xl" style={{ background: cardBgNested, borderColor: cardBorderNested }}>
                        <Group justify="space-between">
                          <Stack gap={0}>
                            <Text fw={700}>FRF Average Processing Time</Text>
                            <Text c="dimmed" size="sm">Completed reservations only</Text>
                            <Text fz={42} fw={900}>{analytics.frf.averageProcessingTime}</Text>
                            <Text c="dimmed">days</Text>
                          </Stack>
                          <RingProgress size={150} thickness={14} sections={[{ value: Math.min(analytics.frf.averageProcessingTime * 5, 100), color: 'teal' }]} label={<Text ta="center" fw={800}>{analytics.frf.averageProcessingTime}</Text>} />
                        </Group>
                      </Paper>
                    </Stack>
                  ) : (
                    <Text c="dimmed" ta="center" py="xl">No FRF analytics data available.</Text>
                  )}
                </Tabs.Panel>
              </Tabs>
            </Stack>
          )}
      </Card>
    </Container>
  );
}