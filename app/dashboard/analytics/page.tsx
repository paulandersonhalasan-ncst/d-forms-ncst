'use client';

import { useState, useEffect, useMemo } from 'react';
import { useMediaQuery } from '@mantine/hooks';
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
  Timeline,
  ActionIcon,
  Box,
  Divider,
  Menu,
  Modal,
  Radio
} from '@mantine/core';
import { DatePicker, DateInput  } from '@mantine/dates';
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
  IconInfoCircle,
  IconCalendarMonth,
} from '@tabler/icons-react';
import useSWR from 'swr';
import { PieChart, LineChart, BarChart } from '@mantine/charts';
import { UserContext, Memo } from '../../dashboard/forms/iom/component/types';
import dayjs from 'dayjs';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

type XLSXType = typeof import('xlsx');
import type * as XLSXNS from 'xlsx';



const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function AnalyticsPage() {
  const theme = useMantineTheme();
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';

  // 📱 Mobile detection
  const isMobile = useMediaQuery('(max-width: 768px)');

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

  // ---- Export Modal State ----
  const [exportModalOpened, setExportModalOpened] = useState(false);
  const [exportScope, setExportScope] = useState<'current' | 'iom' | 'frf' | 'both'>('both');
  const [exportRangeMode, setExportRangeMode] = useState<'current' | 'all' | 'custom'>('current');
  const [exportCustomDates, setExportCustomDates] = useState<[string | null, string | null]>([null, null]);

  const [analyticsTab, setAnalyticsTab] = useState<'iom' | 'frf' | 'calendar'>('iom');
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());

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

  // ============ CALENDAR DATA ============
  const calendarRange = useMemo(() => {
    const start = dayjs(calendarMonth).startOf('month').startOf('week');
    const end = dayjs(calendarMonth).endOf('month').endOf('week');
    return {
      from: start.format('YYYY-MM-DD'),
      to: end.format('YYYY-MM-DD'),
    };
  }, [calendarMonth]);

  const { data: calendarData, isLoading: calendarLoading } = useSWR(
    analyticsTab === 'calendar'
      ? `/api/frf/calendar?from=${calendarRange.from}&to=${calendarRange.to}`
      : null,
    fetcher,
    { refreshInterval: 30000, revalidateOnFocus: true, keepPreviousData: true }
  );

  type CalendarEvent = {
    reservationId: string;
    referenceId: string;
    eventName: string | null;
    status: string;
    requestorDept: string;
    requestorName: string;
    isReschedule: boolean;
    isVenueOnly: boolean;
    dateId: string;
    date: string;
    setupTime: string;
    eventStart: string;
    eventEnd: string;
    teardownTime: string;
    place: { id: string; name: string; category: string } | null;
    placeOther: string | null;
  };

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    const list: CalendarEvent[] = calendarData?.data || [];
    for (const e of list) {
      const key = dayjs(e.date).format('YYYY-MM-DD');
      if (!map[key]) map[key] = [];
      map[key].push(e);
    }
    return map;
  }, [calendarData]);

  const calendarDays = useMemo(() => {
    const monthStart = dayjs(calendarMonth).startOf('month').startOf('week');
    const monthEnd = dayjs(calendarMonth).endOf('month').endOf('week');
    const days: Date[] = [];
    let cursor = monthStart;
    while (cursor.isBefore(monthEnd) || cursor.isSame(monthEnd, 'day')) {
      days.push(cursor.toDate());
      cursor = cursor.add(1, 'day');
    }
    return days;
  }, [calendarMonth]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING_APPROVAL': return 'yellow';
      case 'APPROVED': return 'green';
      case 'COMPLETED': return 'blue';
      case 'RESCHEDULE_PENDING': return 'orange';
      default: return 'gray';
    }
  };

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

// ✅ Reusable — used by BOTH display filter and export
const computeDateRange = (
  mode: 'day' | 'week' | 'month' | 'all' | 'custom',
  base: Date,
  custom: [string | null, string | null]
): { start: Date; end: Date } => {
  let start: Date;
  let end: Date;

  if (mode === 'all') {
    start = new Date(0);
    end = new Date();
  } else if (mode === 'custom') {
    const [s, e] = custom;
    start = s ? new Date(`${s}T00:00:00`) : new Date(0);
    end = e ? new Date(`${e}T23:59:59.999`) : new Date();
  } else {
    const b = new Date(base);
    if (mode === 'day') {
      start = new Date(b);
      start.setHours(0, 0, 0, 0);
      end = new Date(b);
      end.setHours(23, 59, 59, 999);
    } else if (mode === 'week') {
      const day = b.getDay();
      const diff = b.getDate() - day + (day === 0 ? -6 : 1);
      start = new Date(b);
      start.setDate(diff);
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else {
      // month
      start = new Date(b.getFullYear(), b.getMonth(), 1);
      end = new Date(b.getFullYear(), b.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
    }
  }
  return { start, end };
};

const getDateRange = () => computeDateRange(timeRange, baseDate, customDates);

// ---- Helper: build a memo sheet ----
const buildMemoSheet = (XLSX: XLSXType, title: string, rows: Memo[]) => {
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

  const data: (string | number)[][] = [
    [title],
    [`Total: ${rows.length}`],
    [],
    headers,
    ...rows.map((m) => [
      m.referenceId || '',
      m.subject || '',
      m.senderName || '',
      m.senderDept || '',
      m.status || '',
      m.priority || '',
      m.purpose || '',
      dayjs(m.createdAt).format('YYYY-MM-DD HH:mm'),
      m.recipients?.map((r) => r.departmentName).join(', ') || '',
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [
    { wch: 20 },
    { wch: 45 },
    { wch: 22 },
    { wch: 14 },
    { wch: 14 },
    { wch: 12 },
    { wch: 16 },
    { wch: 20 },
    { wch: 40 },
  ];
  return ws;
};

// ---- Helper: build key/value sheet ----
const buildKVSheet = (
  XLSX: XLSXType,
  title: string,
  rows: [string, string | number][]
) => {
  const data: (string | number)[][] = [[title], [], ['Metric', 'Value'], ...rows];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{ wch: 32 }, { wch: 18 }];
  return ws;
};

// ---- Helper: build 2-column distribution sheet ----
const buildDistSheet = (
  XLSX: XLSXType,
  sections: { title: string; rows: [string, number][] }[]
) => {
  const data: (string | number)[][] = [];
  sections.forEach((sec, i) => {
    if (i > 0) data.push([]);
    data.push([sec.title]);
    data.push(['Name', 'Count']);
    sec.rows.forEach((r) => data.push(r));
  });
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{ wch: 32 }, { wch: 12 }];
  return ws;
};

// ---- Main Export ----
type ExportScope = 'current' | 'iom' | 'frf' | 'both';

const handleExportXLSX = async (scope: ExportScope = 'both') => {
  if (!analytics) return;
  setExporting(true);

  try {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();

    // ---------- Resolve export date range from export settings ----------
    let start: Date;
    let end: Date;
    let dateRangeLabel: string;

    if (exportRangeMode === 'current') {
      const r = computeDateRange(timeRange, baseDate, customDates);
      start = r.start;
      end = r.end;
      dateRangeLabel = `Same as Analytics (${getDateLabel() || 'All Time'})`;
    } else if (exportRangeMode === 'all') {
      start = new Date(0);
      end = new Date();
      dateRangeLabel = 'All Time';
    } else {
      const r = computeDateRange('custom', baseDate, exportCustomDates);
      start = r.start;
      end = r.end;
      dateRangeLabel = `${
        exportCustomDates[0] ? dayjs(exportCustomDates[0]).format('MMM D, YYYY') : '—'
      } → ${
        exportCustomDates[1] ? dayjs(exportCustomDates[1]).format('MMM D, YYYY') : '—'
      }`;
    }

    const dept = effectiveDept || 'ALL';
    const fileDate = dayjs().format('YYYY-MM-DD_HHmm');

    // Decide what to include
    const includeIOM =
      (scope === 'iom' || scope === 'both' || scope === 'current') &&
      (analyticsTab === 'iom' || scope === 'iom' || scope === 'both');
    const includeFRF =
      (scope === 'frf' || scope === 'both' || scope === 'current') &&
      (analyticsTab === 'frf' || scope === 'frf' || scope === 'both') &&
      !!analytics.frf;

    // ============================================================
    // 1) METADATA / COVER SHEET  →  Shows ALL filter details
    // ============================================================
    const metaRows: (string | number)[][] = [
      ['ANALYTICS EXPORT'],
      [],
      ['FILTERS APPLIED'],
      ['Generated At', dayjs().format('YYYY-MM-DD HH:mm:ss')],
      ['Department', dept],
      ['Date Range Type', exportRangeMode === 'current' ? `SAME AS ANALYTICS (${timeRange.toUpperCase()})` : exportRangeMode.toUpperCase()],
      ['Date Range', dateRangeLabel],
      ['From', dayjs(start).format('YYYY-MM-DD HH:mm:ss')],
      ['To', dayjs(end).format('YYYY-MM-DD HH:mm:ss')],
      [
        'Exported By',
        [
          currentUser?.fname,
          (currentUser as UserContext & { lname?: string })?.lname,
        ]
          .filter(Boolean)
          .join(' ') ||
          currentUser?.email ||
          'N/A',
      ],
      ['User Role', currentUser?.role || 'N/A'],
      [],
      ['EXPORT CONTENTS'],
      ['Scope', scope.toUpperCase()],
      ['Includes IOM', includeIOM ? 'YES' : 'NO'],
      ['Includes FRF', includeFRF ? 'YES' : 'NO'],
      [],
      ['Sheets Included'],
      ...(includeIOM
        ? [
            ['📊 IOM Summary', 'Overview counts & avg processing time'],
            ['📈 IOM Distribution', 'Status / Priority / Purpose breakdown'],
            ['📉 IOM Trends', 'Time-series activity'],
            ['🏆 IOM Top', 'Top senders & recipients'],
            ['📄 IOM Created', `Memos created by ${dept}`],
            ['📥 IOM Received', `Memos received by ${dept}`],
            ['⚡ IOM Active', 'Currently active memos'],
            ['✅ IOM Resolved', 'Completed / closed / denied memos'],
          ]
        : []),
      ...(includeFRF
        ? [
            ['📊 FRF Summary', 'Overview counts & avg processing time'],
            ['📈 FRF Distribution', 'Status & type breakdown'],
            ['📉 FRF Trends', 'FRF time-series activity'],
            ['🏟️ FRF Venues', 'Most requested venues'],
            ['🛠️ FRF Equipment', 'Most requested equipment'],
          ]
        : []),
    ];

    const wsMeta = XLSX.utils.aoa_to_sheet(metaRows);
    wsMeta['!cols'] = [{ wch: 24 }, { wch: 55 }];
    XLSX.utils.book_append_sheet(wb, wsMeta, '📋 Overview');

    // ============================================================
    // 2) IOM SHEETS
    // ============================================================
    if (includeIOM) {
      // ---- Summary ----
      const overview = analytics.overview || {};
      XLSX.utils.book_append_sheet(
        wb,
        buildKVSheet(XLSX, 'IOM SUMMARY', [
          ['Total Memos Created', overview.total ?? 0],
          ['Sent', overview.sent ?? 0],
          ['Received', overview.received ?? 0],
          ['Active', overview.active ?? 0],
          ['Resolved', overview.resolved ?? 0],
          ['Avg Processing Time (days)', analytics.averageProcessingTime ?? 0],
        ]),
        '📊 IOM Summary'
      );

      // ---- Distribution ----
      XLSX.utils.book_append_sheet(
        wb,
        buildDistSheet(XLSX, [
          {
            title: 'STATUS DISTRIBUTION',
            rows: Object.entries(analytics.statusDistribution || {}).map(
              ([k, v]) => [k, v as number]
            ),
          },
          {
            title: 'PRIORITY DISTRIBUTION',
            rows: Object.entries(analytics.priorityDistribution || {}).map(
              ([k, v]) => [k, v as number]
            ),
          },
          {
            title: 'PURPOSE DISTRIBUTION',
            rows: Object.entries(analytics.purposeDistribution || {}).map(
              ([k, v]) => [k, v as number]
            ),
          },
        ]),
        '📈 IOM Distribution'
      );

      // ---- Trends ----
      if (analytics.trends?.length) {
        const trendsData: (string | number)[][] = [
          ['IOM TRENDS'],
          [],
          ['Date', 'Count'],
          ...analytics.trends.map((t: { date: string; count: number }) => [
            t.date,
            t.count,
          ]),
        ];
        const wsTrends = XLSX.utils.aoa_to_sheet(trendsData);
        wsTrends['!cols'] = [{ wch: 26 }, { wch: 12 }];
        XLSX.utils.book_append_sheet(wb, wsTrends, '📉 IOM Trends');
      }

      // ---- Top Senders / Recipients ----
      if (analytics.topSenders?.length || analytics.topRecipients?.length) {
        const topData: (string | number)[][] = [];
        topData.push(['TOP SENDERS (Incoming)']);
        topData.push(['Department', 'Count']);
        (analytics.topSenders || []).forEach((s: { department: string; count: number }) =>
          topData.push([s.department, s.count])
        );
        topData.push([]);
        topData.push(['TOP RECIPIENTS (Outgoing)']);
        topData.push(['Department', 'Count']);
        (analytics.topRecipients || []).forEach((r: { department: string; count: number }) =>
          topData.push([r.department, r.count])
        );
        const wsTop = XLSX.utils.aoa_to_sheet(topData);
        wsTop['!cols'] = [{ wch: 32 }, { wch: 12 }];
        XLSX.utils.book_append_sheet(wb, wsTop, '🏆 IOM Top');
      }

      // ---- Raw Memos (from client-side memosData) ----
      const allMemos = Array.isArray(memosData) ? memosData : [];
      const filtered = allMemos.filter((m) => {
        const c = new Date(m.createdAt);
        return c >= start && c <= end;
      });

      const created = filtered.filter((m) => m.senderDept === dept);
      const received = filtered.filter((m) =>
        m.recipients?.some((r) => r.departmentName === dept)
      );
      const active = filtered.filter((m) =>
        m.recipients?.some(
          (r) =>
            r.departmentName === dept &&
            ['ACKNOWLEDGED', 'PROCESSING'].includes(r.status)
        )
      );
      const resolved = filtered.filter((m) =>
        m.recipients?.some(
          (r) =>
            r.departmentName === dept &&
            ['COMPLETED', 'CLOSED', 'DENIED'].includes(r.status)
        )
      );

      XLSX.utils.book_append_sheet(
        wb,
        buildMemoSheet(XLSX, `IOM MEMOS CREATED BY ${dept}`, created),
        '📄 IOM Created'
      );
      XLSX.utils.book_append_sheet(
        wb,
        buildMemoSheet(XLSX, `IOM MEMOS RECEIVED BY ${dept}`, received),
        '📥 IOM Received'
      );
      XLSX.utils.book_append_sheet(
        wb,
        buildMemoSheet(XLSX, `IOM ACTIVE MEMOS — ${dept}`, active),
        '⚡ IOM Active'
      );
      XLSX.utils.book_append_sheet(
        wb,
        buildMemoSheet(XLSX, `IOM RESOLVED MEMOS — ${dept}`, resolved),
        '✅ IOM Resolved'
      );
    }

    // ============================================================
    // 3) FRF SHEETS
    // ============================================================
    if (includeFRF && analytics.frf) {
      const frf = analytics.frf;

      // ---- Summary ----
      XLSX.utils.book_append_sheet(
        wb,
        buildKVSheet(XLSX, 'FRF SUMMARY', [
          ['Total Requests', frf.overview?.total ?? 0],
          ['For Approval', frf.overview?.forApproval ?? 0],
          ['Incoming', frf.overview?.incoming ?? 0],
          ['Outgoing', frf.overview?.outgoing ?? 0],
          ['Approved', frf.overview?.approved ?? 0],
          ['Completed', frf.overview?.completed ?? 0],
          ['Rejected', frf.overview?.rejected ?? 0],
          ['Revision', frf.overview?.revision ?? 0],
          ['Avg Processing Time (days)', frf.averageProcessingTime ?? 0],
        ]),
        '📊 FRF Summary'
      );

      // ---- Distribution ----
      XLSX.utils.book_append_sheet(
        wb,
        buildDistSheet(XLSX, [
          {
            title: 'STATUS DISTRIBUTION',
            rows: Object.entries(frf.statusDistribution || {}).map(
              ([k, v]) => [k, v as number]
            ),
          },
          {
            title: 'TYPE DISTRIBUTION',
            rows: Object.entries(frf.typeDistribution || {}).map(
              ([k, v]) => [k, v as number]
            ),
          },
        ]),
        '📈 FRF Distribution'
      );

      // ---- Trends ----
      if (frf.trends?.length) {
        const trendsData: (string | number)[][] = [
          ['FRF TRENDS'],
          [],
          ['Date', 'Count'],
          ...frf.trends.map((t: { date: string; count: number }) => [
            t.date,
            t.count,
          ]),
        ];
        const wsTrends = XLSX.utils.aoa_to_sheet(trendsData);
        wsTrends['!cols'] = [{ wch: 26 }, { wch: 12 }];
        XLSX.utils.book_append_sheet(wb, wsTrends, '📉 FRF Trends');
      }

      // ---- Venues ----
      if (frf.topVenues?.length) {
        const data: (string | number)[][] = [
          ['TOP VENUES'],
          [],
          ['Venue', 'Count'],
          ...frf.topVenues.map((v: { venue: string; count: number }) => [
            v.venue,
            v.count,
          ]),
        ];
        const ws = XLSX.utils.aoa_to_sheet(data);
        ws['!cols'] = [{ wch: 42 }, { wch: 12 }];
        XLSX.utils.book_append_sheet(wb, ws, '🏟️ FRF Venues');
      }

      // ---- Equipment ----
      if (frf.topEquipment?.length) {
        const data: (string | number)[][] = [
          ['TOP EQUIPMENT'],
          [],
          ['Equipment', 'Count'],
          ...frf.topEquipment.map((e: { equipment: string; count: number }) => [
            e.equipment,
            e.count,
          ]),
        ];
        const ws = XLSX.utils.aoa_to_sheet(data);
        ws['!cols'] = [{ wch: 42 }, { wch: 12 }];
        XLSX.utils.book_append_sheet(wb, ws, '🛠️ FRF Equipment');
      }
    }

    // ============================================================
    // 4) SAVE
    // ============================================================
    const scopeTag =
      scope === 'both' ? 'FULL' : scope === 'iom' ? 'IOM' : scope === 'frf' ? 'FRF' : 'CURRENT';
    const filterTag =
      exportRangeMode === 'all'
        ? 'AllTime'
        : exportRangeMode === 'custom'
        ? `${exportCustomDates[0] ?? 'from'}_${exportCustomDates[1] ?? 'to'}`
        : timeRange === 'day'
        ? dayjs(baseDate).format('YYYY-MM-DD')
        : timeRange === 'week'
        ? dayjs(baseDate).startOf('week').format('[W]YYYY-MM-DD')
        : timeRange === 'month'
        ? dayjs(baseDate).format('YYYY-MM')
        : 'AllTime';

    const fileName = `Analytics_${scopeTag}_${dept}_${filterTag}.xlsx`;
    XLSX.writeFile(wb, fileName);

    alert(
      `✅ Export successful!\n\nScope: ${scopeTag}\nDepartment: ${dept}\nDate Range: ${dateRangeLabel}\nFile: ${fileName}`
    );
  } catch (err) {
    console.error(err);
    alert(
      `Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`
    );
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
        <Group justify="space-between" align="center" mb="xl" wrap="wrap">
          <Title order={2} fw={800} style={{ color: textColor, fontSize: 'clamp(1.25rem, 4vw, 2rem)' }}>
            Department Analytics Dashboard
          </Title>
          <Badge size="lg" color="regalNavy" variant="filled">
            {effectiveDept || 'N/A'}
          </Badge>
        </Group>

        {/* Filters */}
        {analyticsTab !== 'calendar' && (
          <Paper
            withBorder
            radius="xl"
            p={isMobile ? 'sm' : 'lg'}
            mb="lg"
            style={{
              background: cardBgNested,
              borderColor: cardBorderNested,
            }}
          >
            {isMobile ? (
              /* 📱 MOBILE LAYOUT */
              <Stack gap="sm">
                {isAdminOrSuper && (
                  <Select
                    label="Department"
                    data={departments}
                    value={selectedDept}
                    onChange={(val) => setSelectedDept(val || '')}
                    size="sm"
                  />
                )}

                <Stack gap={4}>
                  <Text size="xs" fw={600}>Date Range</Text>
                  <SegmentedControl
                    fullWidth
                    value={timeRange}
                    onChange={(value) => setTimeRange(value as typeof timeRange)}
                    data={[
                      { label: 'D', value: 'day' },
                      { label: 'W', value: 'week' },
                      { label: 'M', value: 'month' },
                      { label: 'C', value: 'custom' },
                      { label: 'All', value: 'all' },
                    ]}
                    size="xs"
                    styles={{ label: { fontSize: 11, padding: '2px 4px' } }}
                  />
                </Stack>

                {!['all', 'custom'].includes(timeRange) && (
                  <Stack gap={4}>
                    <Text size="xs" fw={600}>Navigate</Text>
                    <Group gap={6} wrap="nowrap">
                      <Button variant="light" size="compact-sm" onClick={() => navigateDate('prev')}>
                        <IconChevronLeft size={14} />
                      </Button>
                      <Paper withBorder p="xs" radius="md" style={{ flex: 1, textAlign: 'center' }}>
                        <Text size="xs" fw={600}>{getDateLabel()}</Text>
                      </Paper>
                      <Button variant="light" size="compact-sm" onClick={() => navigateDate('next')}>
                        <IconChevronRight size={14} />
                      </Button>
                    </Group>
                  </Stack>
                )}

                {timeRange === 'custom' && (
                  <Group gap="xs" align="flex-end" mt={4}>
                    <DateInput
                      label="From"
                      placeholder="Start"
                      value={customDates[0]}
                      onChange={(v) => setCustomDates(([, to]) => [v, to])}
                      valueFormat="MMM D, YYYY"
                      maxDate={
                        customDates[1] ? new Date(customDates[1]) : new Date()
                      }
                      clearable
                      size="sm"
                      style={{ width: 150 }}
                    />
                    <DateInput
                      label="To"
                      placeholder="End"
                      value={customDates[1]}
                      onChange={(v) => setCustomDates(([from]) => [from, v])}
                      valueFormat="MMM D, YYYY"
                      minDate={
                        customDates[0] ? new Date(customDates[0]) : undefined
                      }
                      maxDate={new Date()}
                      clearable
                      size="sm"
                      style={{ width: 150 }}
                    />
                  </Group>
                )}

                <Button
                  variant="light"
                  color="green"
                  leftSection={<IconFileExport size={14} />}
                  onClick={() => handleExportXLSX('current')}
                  loading={exporting}
                  disabled={!analytics || exporting}
                  size="sm"
                  fullWidth
                >
                  Export to Excel
                </Button>
              </Stack>
            ) : (
              /* 💻 DESKTOP LAYOUT (dating layout) */
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

                {!['all', 'custom'].includes(timeRange) && (
                  <Stack gap={5}>
                    <Text size="sm" fw={500}>Navigate</Text>
                    <Group gap="xs">
                      <Button variant="light" onClick={() => navigateDate('prev')}>
                        <IconChevronLeft size={16} />
                      </Button>
                      <Paper withBorder p="sm" radius="md" style={{ minWidth: 150 }}>
                        <Text ta="center" fw={600}>{getDateLabel()}</Text>
                      </Paper>
                      <Button variant="light" onClick={() => navigateDate('next')}>
                        <IconChevronRight size={16} />
                      </Button>
                    </Group>
                  </Stack>
                )}

                <Stack gap={5}>
                  <Text fw={500} size="sm">Date Range</Text>
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
                    <Stack gap="xs">
                      <DateInput
                        label="From"
                        placeholder="Start date"
                        value={customDates[0]}
                        onChange={(v) => setCustomDates(([, to]) => [v, to])}
                        valueFormat="MMM D, YYYY"
                        maxDate={
                          customDates[1] ? new Date(customDates[1]) : new Date()
                        }
                        clearable
                        size="sm"
                      />
                      <DateInput
                        label="To"
                        placeholder="End date"
                        value={customDates[1]}
                        onChange={(v) => setCustomDates(([from]) => [from, v])}
                        valueFormat="MMM D, YYYY"
                        minDate={
                          customDates[0] ? new Date(customDates[0]) : undefined
                        }
                        maxDate={new Date()}
                        clearable
                        size="sm"
                      />
                    </Stack>
                  )}
                </Stack>

                <Button
                  variant="light"
                  color="green"
                  leftSection={<IconFileExport size={14} />}
                  onClick={() => setExportModalOpened(true)}
                  disabled={!analytics || exporting}
                  size="sm"
                >
                  Export Analytics
                </Button>
              </Group>
            )}
          </Paper>
        )}
        {/* ----- Main Content ----- */}
        {!analytics ? (
            <Loader />
          ) : (
            <Stack gap="lg">
              {/* === ANALYTICS TYPE TABS === */}
              <Tabs
                value={analyticsTab}
                onChange={(val) => setAnalyticsTab((val as 'iom' | 'frf' | 'calendar') || 'iom')}
                variant="outline"
                radius="xl"
              >
                {isMobile ? (
                  <Select
                    value={analyticsTab}
                    onChange={(val) => setAnalyticsTab((val as 'iom' | 'frf' | 'calendar') || 'iom')}
                    data={[
                      { value: 'iom', label: '📄 IOM Analytics' },
                      { value: 'frf', label: '📋 FRF Analytics' },
                      { value: 'calendar', label: '📅 Live Calendar' },
                    ]}
                    mb="md"
                    size="sm"
                    allowDeselect={false}
                  />
                ) : (
                <Tabs.List>
                  <Tabs.Tab value="iom" leftSection={<IconFileText size={16} />}>
                    IOM Analytics
                  </Tabs.Tab>
                  <Tabs.Tab value="frf" leftSection={<IconClipboardList size={16} />}>
                    FRF Analytics
                  </Tabs.Tab>
                  <Tabs.Tab value="calendar" leftSection={<IconCalendarStats size={16} />}>
                    Live Calendar
                  </Tabs.Tab>
                </Tabs.List>
                )}

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
                      <SimpleGrid cols={{ base: 2, sm: 3, md: 5 }} spacing="md">
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

                      {isMobile ? (
                        /* 📱 Mobile: 2-column card grid */
                        <SimpleGrid cols={2} spacing="xs">
                          {tabConfigs.map((config) => {
                            const Icon = config.icon;
                            return (
                              <UnstyledButton
                                key={config.value}
                                onClick={() => router.push(`/dashboard/forms/iom?tab=${config.value}`)}
                                style={{ cursor: 'pointer', width: '100%', transition: 'transform 0.15s ease' }}
                                onTouchStart={(e) => { e.currentTarget.style.transform = 'scale(0.96)'; }}
                                onTouchEnd={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                              >
                                <Paper
                                  withBorder
                                  radius="md"
                                  p="sm"
                                  style={{
                                    background: cardBgNested,
                                    borderColor: cardBorderNested,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 4,
                                    minHeight: 96,
                                    textAlign: 'center',
                                  }}
                                >
                                  <ThemeIcon size={30} radius="xl" color={config.color} variant="filled">
                                    <Icon size={15} />
                                  </ThemeIcon>
                                  <Text size="10px" fw={700} lh={1.15} lineClamp={2}>
                                    {config.label}
                                  </Text>
                                  <RollingNumber value={config.count} fw={700} fz={22} />
                                </Paper>
                              </UnstyledButton>
                            );
                          })}
                        </SimpleGrid>
                      ) : (
                        /* 💻 Desktop: dating row layout */
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
                      )}
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
                    <Paper withBorder radius="xl" p={isMobile ? 'md' : 'xl'} style={{ background: cardBgNested, borderColor: cardBorderNested }}>
                      <Group justify="space-between" wrap={isMobile ? 'wrap' : 'nowrap'} gap="md">
                        <Stack gap={0}>
                          <Text fw={700}>IOM Average Processing Time</Text>
                          <Text c="dimmed" size="sm">Closed memos only</Text>
                          <Text fz={isMobile ? 32 : 42} fw={900}>{analytics.averageProcessingTime}</Text>
                          <Text c="dimmed">days</Text>
                        </Stack>
                        <RingProgress
                          size={isMobile ? 110 : 150}
                          thickness={isMobile ? 12 : 14}
                          sections={[{ value: Math.min(analytics.averageProcessingTime * 5, 100), color: 'blue' }]}
                          label={<Text ta="center" fw={800}>{analytics.averageProcessingTime}</Text>}
                        />
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

                        {isMobile ? (
                          /* 📱 Mobile: 2-column card grid */
                          <SimpleGrid cols={2} spacing="xs">
                            {[
                              { label: 'Pending Approval', value: 'pending_approval', icon: IconClock, color: 'orange', count: analytics.frf.overview.forApproval },
                              { label: 'Action Board', value: 'action_board', icon: IconInfoCircle, color: 'indigo', count: analytics.frf.overview.incoming + analytics.frf.overview.forApproval },
                              { label: 'My Requests', value: 'my_requests', icon: IconSend, color: 'cyan', count: analytics.frf.overview.outgoing },
                              { label: 'Completed', value: 'completed', icon: IconCircleCheck, color: 'green', count: analytics.frf.overview.completed },
                            ].map((config) => {
                              const Icon = config.icon;
                              return (
                                <UnstyledButton
                                  key={config.value}
                                  onClick={() => router.push(`/dashboard/forms/frf?tab=${config.value}`)}
                                  style={{ cursor: 'pointer', width: '100%', transition: 'transform 0.15s ease' }}
                                  onTouchStart={(e) => { e.currentTarget.style.transform = 'scale(0.96)'; }}
                                  onTouchEnd={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                                >
                                  <Paper
                                    withBorder
                                    radius="md"
                                    p="sm"
                                    style={{
                                      background: cardBgNested,
                                      borderColor: cardBorderNested,
                                      display: 'flex',
                                      flexDirection: 'column',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      gap: 4,
                                      minHeight: 96,
                                      textAlign: 'center',
                                    }}
                                  >
                                    <ThemeIcon size={30} radius="xl" color={config.color} variant="filled">
                                      <Icon size={15} />
                                    </ThemeIcon>
                                    <Text size="10px" fw={700} lh={1.15} lineClamp={2}>
                                      {config.label}
                                    </Text>
                                    <RollingNumber value={config.count} fw={700} fz={22} />
                                  </Paper>
                                </UnstyledButton>
                              );
                            })}
                          </SimpleGrid>
                        ) : (
                          /* 💻 Desktop: dating row layout */
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
                        )}
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
                {/* ============================================ */}
                {/* ============ LIVE CALENDAR TAB ============ */}
                {/* ============================================ */}
                <Tabs.Panel value="calendar" pt="lg">
                  <Stack gap="lg">
                    {/* Legend */}
                    <Stack gap="xs">
                      <Group gap={6} wrap="wrap">
                        <Text size="xs" c="dimmed">Legend:</Text>
                        <Badge color="yellow" variant="filled" size="xs">Pending</Badge>
                        <Badge color="green" variant="filled" size="xs">Approved</Badge>
                        <Badge color="blue" variant="filled" size="xs">Fully Approved</Badge>
                        <Badge color="orange" variant="filled" size="xs">Reschedule</Badge>
                      </Group>
                      <Text size="10px" c="dimmed" fs="italic">
                        {isMobile ? '👆 Tap a date to see event details' : 'Hover a date to see event details'}
                      </Text>
                    </Stack>

                    {/* Month navigation */}
                    <Group justify="center" gap={isMobile ? 'xs' : 'md'}>
                      <ActionIcon
                        variant="light"
                        size={isMobile ? 'md' : 'lg'}
                        onClick={() =>
                          setCalendarMonth(dayjs(calendarMonth).subtract(1, 'month').toDate())
                        }
                      >
                        <IconChevronLeft size={isMobile ? 16 : 18} />
                      </ActionIcon>
                      <Text
                        fw={800}
                        size={isMobile ? 'md' : 'xl'}
                        style={{ minWidth: isMobile ? 130 : 220, textAlign: 'center' }}
                      >
                        {dayjs(calendarMonth).format(isMobile ? 'MMM YYYY' : 'MMMM YYYY')}
                      </Text>
                      <ActionIcon
                        variant="light"
                        size={isMobile ? 'md' : 'lg'}
                        onClick={() =>
                          setCalendarMonth(dayjs(calendarMonth).add(1, 'month').toDate())
                        }
                      >
                        <IconChevronRight size={isMobile ? 16 : 18} />
                      </ActionIcon>
                      <Button
                        variant="subtle"
                        size="compact-xs"
                        onClick={() => setCalendarMonth(new Date())}
                      >
                        Today
                      </Button>
                    </Group>

                    {/* Weekday headers */}
                    <SimpleGrid cols={7} spacing={isMobile ? 2 : 4}>
                      {(isMobile
                        ? ['S', 'M', 'T', 'W', 'T', 'F', 'S']
                        : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
                      ).map((d, i) => (
                        <Text
                          key={`${d}-${i}`}
                          size="xs"
                          fw={700}
                          ta="center"
                          c="dimmed"
                          py={4}
                        >
                          {d}
                        </Text>
                      ))}
                    </SimpleGrid>

                    {/* Days grid */}
                    {calendarLoading && !calendarData ? (
                      <Box ta="center" py="xl"><Loader /></Box>
                    ) : (
                      <SimpleGrid cols={7} spacing={4}>
                        {calendarDays.map((d) => {
                          const key = dayjs(d).format('YYYY-MM-DD');
                          const dayEvents = eventsByDate[key] || [];
                          const isOutsideMonth = dayjs(d).month() !== dayjs(calendarMonth).month();
                          const isToday = dayjs(d).isSame(dayjs(), 'day');
                          const hasEvents = dayEvents.length > 0;

                          return (
                            <HoverCard
                              key={key}
                              width={380}
                              shadow="lg"
                              position="top"
                              withArrow
                              openDelay={150}
                              closeDelay={100}
                              withinPortal
                              disabled={!hasEvents}
                            >
                              <HoverCard.Target>
                                <Paper
                                  withBorder
                                  radius="sm"
                                  p={6}
                                  style={{
                                    minHeight: isMobile ? 70 : 110,
                                    padding: isMobile ? 4 : 6,
                                    opacity: isOutsideMonth ? 0.35 : 1,
                                    backgroundColor: isToday
                                      ? (isDark
                                          ? 'var(--mantine-color-blue-9)'
                                          : 'var(--mantine-color-blue-0)')
                                      : cardBgNested,
                                    borderColor: isToday
                                      ? 'var(--mantine-color-blue-5)'
                                      : cardBorderNested,
                                    cursor: hasEvents ? 'help' : 'default',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 4,
                                    transition: 'transform 120ms ease, box-shadow 120ms ease',
                                  }}
                                  onMouseEnter={(ev) => {
                                    if (hasEvents) {
                                      ev.currentTarget.style.transform = 'translateY(-2px)';
                                      ev.currentTarget.style.boxShadow = 'var(--mantine-shadow-sm)';
                                    }
                                  }}
                                  onMouseLeave={(ev) => {
                                    ev.currentTarget.style.transform = 'translateY(0)';
                                    ev.currentTarget.style.boxShadow = 'none';
                                  }}
                                >
                                  <Text
                                    size="xs"
                                    fw={700}
                                    c={isToday ? 'blue' : undefined}
                                  >
                                    {dayjs(d).date()}
                                  </Text>

                                  <Stack gap={2} style={{ overflow: 'hidden' }}>
                                    {dayEvents.slice(0, 2).map((e, i) => {
                                      const color = getStatusColor(e.status);
                                      return (
                                        <Box
                                          key={i}
                                          style={{
                                            fontSize: 10,
                                            padding: '2px 4px',
                                            borderRadius: 3,
                                            backgroundColor: `var(--mantine-color-${color}-${
                                              isDark ? 9 : 1
                                            })`,
                                            color: `var(--mantine-color-${color}-${
                                              isDark ? 2 : 9
                                            })`,
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                            fontWeight: 600,
                                          }}
                                        >
                                          {e.place?.name || e.placeOther || 'TBA'}
                                        </Box>
                                      );
                                    })}
                                    {dayEvents.length > 2 && (
                                      <Text size="10px" c="dimmed" fw={600}>
                                        +{dayEvents.length - 2} more
                                      </Text>
                                    )}
                                  </Stack>
                                </Paper>
                              </HoverCard.Target>

                              <HoverCard.Dropdown>
                                <Stack gap="sm">
                                  <Group justify="space-between">
                                    <Text fw={800} size="sm">
                                      {dayjs(d).format('dddd, MMMM D, YYYY')}
                                    </Text>
                                    <Badge size="sm" variant="light">
                                      {dayEvents.length} event{dayEvents.length > 1 ? 's' : ''}
                                    </Badge>
                                  </Group>
                                  <Divider />
                                  {dayEvents.map((e, i) => {
                                    const color = getStatusColor(e.status);
                                    return (
                                      <Paper key={i} withBorder p="xs" radius="sm">
                                        <Group justify="space-between" mb={4} wrap="nowrap">
                                          <Text size="xs" fw={700}>
                                            {e.referenceId}
                                          </Text>
                                          <Badge size="xs" color={color} variant="filled" mt={2} styles={{ label: { fontSize: 10 } }}>
                                            {e.status.replace('_', ' ')}
                                          </Badge>
                                        </Group>
                                        <Text size="sm" fw={600} mb={4}>
                                          {e.eventName || '—'}
                                        </Text>
                                        <Stack gap={2}>
                                          <Text size="xs" c="dimmed">
                                            <b>Venue:</b>{' '}
                                            {e.place?.name || e.placeOther || 'TBA'}
                                            {e.place?.category && e.place.category !== 'REGULAR' && (
                                              <Badge
                                                component="span"
                                                size="xs"
                                                ml={6}
                                                variant="light"
                                                color={
                                                  e.place.category === 'CATEGORY_1'
                                                    ? 'orange'
                                                    : 'red'
                                                }
                                              >
                                                {e.place.category === 'CATEGORY_1'
                                                  ? 'Cat 1'
                                                  : 'Cat 2'}
                                              </Badge>
                                            )}
                                          </Text>
                                          <Text size="xs" c="dimmed">
                                            <b>Requestor (Focal Person):</b> {e.requestorName} ({e.requestorDept})
                                          </Text>
                                          <Text size="xs" c="dimmed">
                                            <b>Setup:</b>{' '}
                                            {dayjs(e.setupTime).format('h:mm A')} ·{' '}
                                            <b>Event:</b>{' '}
                                            {dayjs(e.eventStart).format('h:mm A')} –{' '}
                                            {dayjs(e.eventEnd).format('h:mm A')}
                                          </Text>
                                          <Text size="xs" c="dimmed">
                                            <b>Pack-up:</b>{' '}
                                            {dayjs(e.teardownTime).format('h:mm A')}
                                          </Text>
                                          {(e.isReschedule || e.isVenueOnly) && (
                                            <Group gap={4} mt={4}>
                                              {e.isReschedule && (
                                                <Badge size="xs" color="orange" variant="light" mt={2} styles={{ label: { fontSize: 10 } }}>
                                                  Reschedule
                                                </Badge>
                                              )}
                                              {e.isVenueOnly && (
                                                <Badge size="xs" color="gray" variant="light" mt={2} styles={{ label: { fontSize: 10 } }}>
                                                  Venue Only
                                                </Badge>
                                              )}
                                            </Group>
                                          )}
                                        </Stack>
                                      </Paper>
                                    );
                                  })}
                                </Stack>
                              </HoverCard.Dropdown>
                            </HoverCard>
                          );
                        })}
                      </SimpleGrid>
                    )}
                  </Stack>
                </Tabs.Panel>
              </Tabs> 
            </Stack>
          )}

          <Modal
            opened={exportModalOpened}
            onClose={() => setExportModalOpened(false)}
            title={<Text fw={700}>Export Analytics</Text>}
            centered
            size="md"
            radius="lg"
            overlayProps={{ backgroundOpacity: 0.5, blur: 2 }}
          >
            <Stack gap="lg">
              {/* ---- Step 1: Scope ---- */}
              <Stack gap="xs">
                <Text size="sm" fw={600}>
                  1. What to export?
                </Text>
                <SegmentedControl
                  fullWidth
                  size="xs"
                  value={exportScope}
                  onChange={(v) => setExportScope(v as typeof exportScope)}
                  data={[
                    { label: '📌 Current', value: 'current' },
                    { label: '📄 IOM', value: 'iom' },
                    { label: '📋 FRF', value: 'frf' },
                    { label: '📦 Both', value: 'both' },
                  ]}
                  disabled={exporting}
                />
                <Text size="xs" c="dimmed">
                  Current tab:{' '}
                  <b>{analyticsTab === 'calendar' ? 'Live Calendar' : analyticsTab.toUpperCase()}</b>
                  {exportScope === 'frf' && !analytics?.frf && (
                    <Text component="span" c="red" ml={6}>
                      (no FRF data available)
                    </Text>
                  )}
                </Text>
              </Stack>

              {/* ---- Step 2: Date Range ---- */}
              <Stack gap="xs">
                <Text size="sm" fw={600}>
                  2. Date range for export
                </Text>
                <SegmentedControl
                  fullWidth
                  size="xs"
                  value={exportRangeMode}
                  onChange={(v) => setExportRangeMode(v as typeof exportRangeMode)}
                  data={[
                    { label: 'Same as Analytics', value: 'current' },
                    { label: 'All Time', value: 'all' },
                    { label: 'Custom', value: 'custom' },
                  ]}
                  disabled={exporting}
                />

                {exportRangeMode === 'current' && (
                  <Alert
                    color="blue"
                    variant="light"
                    p="xs"
                    icon={<IconInfoCircle size={14} />}
                  >
                    <Text size="xs">
                      Using current analytics filter:{' '}
                      <b>{getDateLabel() || 'All Time'}</b>
                    </Text>
                  </Alert>
                )}

                {exportRangeMode === 'custom' && (
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
                    <DateInput
                      label="From"
                      placeholder="Pick start date"
                      value={exportCustomDates[0]}
                      onChange={(v) => setExportCustomDates(([, to]) => [v, to])}
                      valueFormat="MMM D, YYYY"
                      maxDate={
                        exportCustomDates[1]
                          ? new Date(exportCustomDates[1])
                          : new Date()
                      }
                      clearable
                      size="sm"
                    />
                    <DateInput
                      label="To"
                      placeholder="Pick end date"
                      value={exportCustomDates[1]}
                      onChange={(v) => setExportCustomDates(([from]) => [from, v])}
                      valueFormat="MMM D, YYYY"
                      minDate={
                        exportCustomDates[0]
                          ? new Date(exportCustomDates[0])
                          : undefined
                      }
                      maxDate={new Date()}
                      clearable
                      size="sm"
                    />
                  </SimpleGrid>
                )}
              </Stack>

              {/* ---- Preview ---- */}
              <Alert variant="light" color="gray" p="xs">
                <Text size="xs" lh={1.5}>
                  <b>Preview:</b>{' '}
                  {exportScope === 'current'
                    ? analyticsTab.toUpperCase()
                    : exportScope === 'both'
                    ? 'IOM + FRF'
                    : exportScope.toUpperCase()}{' '}
                  ·{' '}
                  {exportRangeMode === 'current'
                    ? getDateLabel() || 'All Time'
                    : exportRangeMode === 'all'
                    ? 'All Time'
                    : exportCustomDates[0] && exportCustomDates[1]
                    ? `${dayjs(exportCustomDates[0]).format('MMM D')} → ${dayjs(exportCustomDates[1]).format('MMM D, YYYY')}`
                    : 'Custom (incomplete)'}
                </Text>
              </Alert>

              {/* ---- Actions ---- */}
              <Group justify="flex-end" gap="xs">
                <Button
                  variant="default"
                  onClick={() => setExportModalOpened(false)}
                  disabled={exporting}
                  size="sm"
                >
                  Cancel
                </Button>
                <Button
                  color="green"
                  leftSection={<IconFileExport size={16} />}
                  loading={exporting}
                  size="sm"
                  onClick={async () => {
                    await handleExportXLSX(exportScope);
                    setExportModalOpened(false);
                  }}
                  disabled={
                    (exportScope === 'frf' && !analytics?.frf) ||
                    (exportRangeMode === 'custom' &&
                      (!exportCustomDates[0] || !exportCustomDates[1]))
                  }
                >
                  Export
                </Button>
              </Group>
            </Stack>
          </Modal>
      </Card>
    </Container>
  );
}