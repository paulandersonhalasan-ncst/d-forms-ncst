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
} from '@tabler/icons-react';
import useSWR from 'swr';
import { PieChart, LineChart, BarChart } from '@mantine/charts';
import { UserContext, Memo } from '../../dashboard/forms/iom/component/types';
import dayjs from 'dayjs';
import { useRouter } from 'next/navigation';

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
  const cardBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const textColor = isDark ? theme.white : theme.black;

  return (
    <Container size="xl" py="lg">
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
            background: cardBg,
            borderColor: cardBorder,
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
          </Group>
        </Paper>

        {/* ----- Main Content ----- */}
        {!analytics ? (
          <Loader />
        ) : (
          <Stack gap="lg">
            {/* ========== 1. ANALYTICS OVERVIEW (Date-Filtered) ========== */}
            <Stack gap="xs">
              <Text size="sm" fw={700} c="dimmed">
                Analytics Overview
              </Text>
              {/* Analytics Overview (simple tiles) */}
              <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
                {[
                  {
                    label: 'Total Memos',
                    value: analytics.overview.total,
                    icon: IconFileText,
                    color: 'blue',
                  },
                  {
                    label: 'Sent',
                    value: analytics.overview.sent,
                    icon: IconSend,
                    color: 'cyan',
                  },
                  {
                    label: 'Received',
                    value: analytics.overview.received,
                    icon: IconInbox,
                    color: 'grape',
                  },
                  {
                    label: 'Active',
                    value: analytics.overview.active,
                    icon: IconTrendingUp,
                    color: 'green',
                  },
                ].map((stat) => {
                  const Icon = stat.icon;
                  return (
                    <Paper
                      key={stat.label}
                      withBorder
                      p="md"
                      radius="lg"
                      style={{ borderRadius: theme.radius.md }}
                    >
                      <Group justify="space-between">
                        <Stack gap={0}>
                          <Text size="xs" c="dimmed" fw={700}>
                            {stat.label}
                          </Text>
                          <RollingNumber value={stat.value} fw={500} fz={32}/>
                        </Stack>
                        <ThemeIcon size={28} radius="md" color={stat.color} variant="light">
                          <Icon size={16} />
                        </ThemeIcon>
                      </Group>
                    </Paper>
                  );
                })}
              </SimpleGrid>
            </Stack>

            {/* ========== 2. QUICK NAVIGATION SHORTCUTS (Real-time counts) ========== */}
            <Stack gap="xs">
              <Text size="sm" fw={700} c="dimmed">
                E-IOM Shortcuts
              </Text>

              {/* ✅ Isang row lang, pantay-pantay ang laki */}
              <Group grow wrap="nowrap" gap="md" align="stretch">
                {tabConfigs.map((config) => {
                  const Icon = config.icon;
                  return (
                    <UnstyledButton
                      key={config.value}
                      onClick={() => router.push(`/dashboard/forms/iom?tab=${config.value}`)}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        textDecoration: 'none',
                        cursor: 'pointer',
                        transition: 'transform 0.2s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-4px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      <Paper
                        withBorder
                        radius="xl"
                        p="lg"
                        style={{
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <Group justify="space-between" style={{ width: '100%' }}>
                          <Stack gap={0}>
                            <Text size="xs" fw={700}>
                              {config.label}
                            </Text>
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

            {/* ========== 3. ANALYTICS CHARTS (Date-Filtered) ========== */}
            <Stack gap="lg">
              <Text size="sm" fw={700} c="dimmed">
                Charts & Trends (filtered by selected date range)
              </Text>

              {/* Charts Row */}
              <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
                <Paper
                  withBorder
                  p="md"
                  radius="md"
                  style={{ backgroundColor: cardBg, borderColor: cardBorder }}
                >
                  <Text fw={600} mb="md" style={{ color: textColor }}>
                    Status Distribution
                  </Text>
                  <>
                    <PieChart
                      data={statusData}
                      withLabels={false}
                      withTooltip
                      size={220}
                      mx="auto"
                    />
                    <Stack gap={8} mt="lg">
                      {statusData.map((item) => (
                        <Group key={item.name} justify="space-between">
                          <Group gap={8}>
                            <div
                              style={{
                                width: 12,
                                height: 12,
                                borderRadius: 999,
                                background: item.color,
                              }}
                            />
                            <Text size="sm">{item.name}</Text>
                          </Group>
                          <Badge variant="light">{item.value}</Badge>
                        </Group>
                      ))}
                    </Stack>
                  </>
                </Paper>

                <Paper
                  withBorder
                  p="md"
                  radius="md"
                  style={{ backgroundColor: cardBg, borderColor: cardBorder }}
                >
                  <Text fw={600} mb="md" style={{ color: textColor }}>
                    Priority Distribution
                  </Text>
                  <>
                    <PieChart
                      data={priorityData}
                      withLabels={false}
                      withTooltip
                      size={220}
                      mx="auto"
                    />
                    <Stack gap={8} mt="lg">
                      {priorityData.map((item) => (
                        <Group key={item.name} justify="space-between">
                          <Group gap={8}>
                            <div
                              style={{
                                width: 12,
                                height: 12,
                                borderRadius: 999,
                                background: item.color,
                              }}
                            />
                            <Text size="sm">{item.name}</Text>
                          </Group>
                          <Badge variant="light">{item.value}</Badge>
                        </Group>
                      ))}
                    </Stack>
                  </>
                </Paper>

                <Paper
                  withBorder
                  p="md"
                  radius="md"
                  style={{ backgroundColor: cardBg, borderColor: cardBorder }}
                >
                  <Text fw={600} mb="md" style={{ color: textColor }}>
                    Purpose Distribution
                  </Text>
                  <>
                    <PieChart
                      data={purposeData}
                      withLabels={false}
                      withTooltip
                      size={220}
                      mx="auto"
                    />
                    <Stack gap={8} mt="lg">
                      {purposeData.map((item) => (
                        <Group key={item.name} justify="space-between">
                          <Group gap={8}>
                            <div
                              style={{
                                width: 12,
                                height: 12,
                                borderRadius: 999,
                                background: item.color,
                              }}
                            />
                            <Text size="sm">{item.name}</Text>
                          </Group>
                          <Badge variant="light">{item.value}</Badge>
                        </Group>
                      ))}
                    </Stack>
                  </>
                </Paper>
              </SimpleGrid>

              {/* Trend Chart */}
              <Paper
                withBorder
                p="md"
                radius="md"
                style={{ backgroundColor: cardBg, borderColor: cardBorder }}
              >
                <Text fw={600} mb="md" style={{ color: textColor }}>
                  {timeRange === 'day' ? 'Hourly Memo Activity' : 'Memo Trends'}
                </Text>
                {analytics.trends && analytics.trends.length > 0 ? (
                  <LineChart
                    h={350}
                    data={analytics.trends}
                    dataKey="date"
                    series={[{ name: 'count', color: theme.colors.regalNavy?.[6] || '#377ff5' }]}
                    curveType="monotone"
                    withDots
                    withLegend
                    withTooltip
                    dotProps={{ r: 4 }}
                    activeDotProps={{ r: 7, stroke: isDark ? '#fff' : '#000', strokeWidth: 2 }}
                    strokeWidth={3}
                    tooltipAnimationDuration={200}
                    legendProps={{
                      verticalAlign: 'bottom',
                      height: 40,
                      wrapperStyle: { paddingTop: 10 },
                    }}
                    tooltipProps={{
                      cursor: { fill: 'rgba(0, 0, 0, 0.05)' },
                      content: ({ payload, label }) => {
                        if (!payload || payload.length === 0) return null;
                        const value = payload[0]?.value;
                        return (
                          <Paper
                            p="sm"
                            radius="md"
                            style={{
                              backgroundColor: isDark ? theme.colors.dark[6] : theme.white,
                              border: `1px solid ${
                                isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
                              }`,
                              boxShadow: theme.shadows.sm,
                            }}
                          >
                            <Text size="xs" c="dimmed" mb={4}>
                              {label}
                            </Text>
                            <Group gap="xs">
                              <div
                                style={{
                                  width: 12,
                                  height: 12,
                                  borderRadius: '50%',
                                  backgroundColor: theme.colors.regalNavy?.[6] || '#377ff5',
                                }}
                              />
                              <Text fw={700} size="sm">
                                {value}
                              </Text>
                              <Text size="xs" c="dimmed">
                                memos
                              </Text>
                            </Group>
                          </Paper>
                        );
                      },
                    }}
                    valueFormatter={(value) => `${value} memos`}
                    gridAxis="xy"
                    gridColor={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}
                  />
                ) : (
                  <Text c="dimmed" ta="center">
                    No data
                  </Text>
                )}
              </Paper>

              {/* Top Senders & Recipients */}
              <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
                <Paper
                  withBorder
                  p="md"
                  radius="md"
                  style={{ backgroundColor: cardBg, borderColor: cardBorder }}
                >
                  <Text fw={600} mb="md" style={{ color: textColor }}>
                    Top Senders (Incoming)
                  </Text>
                  {analytics.topSenders && analytics.topSenders.length > 0 ? (
                    <BarChart
                      h={250}
                      data={analytics.topSenders}
                      dataKey="department"
                      series={[{ name: 'count', color: theme.colors.regalNavy?.[6] || '#377ff5' }]}
                      withTooltip
                      tooltipAnimationDuration={200}
                      withLegend={false}
                      withBarValueLabel
                      valueFormatter={(value) => `${value}`}
                      gridAxis="xy"
                      gridColor={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}
                      barProps={{
                        radius: [4, 4, 0, 0],
                        maxBarSize: 60,
                        fill: theme.colors.regalNavy?.[6] || '#377ff5',
                        fillOpacity: 0.85,
                      }}
                      tooltipProps={{
                        cursor: { fill: 'rgba(0, 0, 0, 0.05)' },
                        content: ({ payload, label }) => {
                          if (!payload || payload.length === 0) return null;
                          const value = payload[0]?.value;
                          return (
                            <Paper
                              p="sm"
                              radius="md"
                              style={{
                                backgroundColor: isDark ? theme.colors.dark[6] : theme.white,
                                border: `1px solid ${
                                  isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
                                }`,
                                boxShadow: theme.shadows.sm,
                              }}
                            >
                              <Text size="xs" c="dimmed" mb={4}>
                                {label}
                              </Text>
                              <Group gap="xs">
                                <div
                                  style={{
                                    width: 12,
                                    height: 12,
                                    borderRadius: '50%',
                                    backgroundColor: theme.colors.regalNavy?.[6] || '#377ff5',
                                  }}
                                />
                                <Text fw={700} size="sm">
                                  {value}
                                </Text>
                                <Text size="xs" c="dimmed">
                                  memos
                                </Text>
                              </Group>
                            </Paper>
                          );
                        },
                      }}
                    />
                  ) : (
                    <Text c="dimmed" ta="center">
                      No data
                    </Text>
                  )}
                </Paper>

                <Paper
                  withBorder
                  p="md"
                  radius="md"
                  style={{ backgroundColor: cardBg, borderColor: cardBorder }}
                >
                  <Text fw={600} mb="md" style={{ color: textColor }}>
                    Top Recipients (Outgoing)
                  </Text>
                  {analytics.topRecipients && analytics.topRecipients.length > 0 ? (
                    <BarChart
                      h={250}
                      data={analytics.topRecipients}
                      dataKey="department"
                      series={[
                        { name: 'count', color: theme.colors.customCreamYellow?.[5] || '#feb625' },
                      ]}
                      withTooltip
                      tooltipAnimationDuration={200}
                      withLegend={false}
                      withBarValueLabel
                      valueFormatter={(value) => `${value}`}
                      gridAxis="xy"
                      gridColor={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}
                      barProps={{
                        radius: [4, 4, 0, 0],
                        maxBarSize: 60,
                        fill: theme.colors.customCreamYellow?.[5] || '#feb625',
                        fillOpacity: 0.85,
                      }}
                      tooltipProps={{
                        cursor: { fill: 'rgba(0, 0, 0, 0.05)' },
                        content: ({ payload, label }) => {
                          if (!payload || payload.length === 0) return null;
                          const value = payload[0]?.value;
                          return (
                            <Paper
                              p="sm"
                              radius="md"
                              style={{
                                backgroundColor: isDark ? theme.colors.dark[6] : theme.white,
                                border: `1px solid ${
                                  isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
                                }`,
                                boxShadow: theme.shadows.sm,
                              }}
                            >
                              <Text size="xs" c="dimmed" mb={4}>
                                {label}
                              </Text>
                              <Group gap="xs">
                                <div
                                  style={{
                                    width: 12,
                                    height: 12,
                                    borderRadius: '50%',
                                    backgroundColor:
                                      theme.colors.customCreamYellow?.[5] || '#feb625',
                                  }}
                                />
                                <Text fw={700} size="sm">
                                  {value}
                                </Text>
                                <Text size="xs" c="dimmed">
                                  memos
                                </Text>
                              </Group>
                            </Paper>
                          );
                        },
                      }}
                    />
                  ) : (
                    <Text c="dimmed" ta="center">
                      No data
                    </Text>
                  )}
                </Paper>
              </SimpleGrid>

              {/* Average Processing Time */}
              <Paper withBorder radius="xl" p="xl">
                <Group justify="space-between">
                  <Stack gap={0}>
                    <Text fw={700}>Average Processing Time</Text>
                    <Text c="dimmed" size="sm">
                      Closed memos only
                    </Text>
                    <Text fz={42} fw={900}>
                      {analytics.averageProcessingTime}
                    </Text>
                    <Text c="dimmed">days</Text>
                  </Stack>
                  <RingProgress
                    size={150}
                    thickness={14}
                    sections={[
                      {
                        value: Math.min(analytics.averageProcessingTime * 5, 100),
                        color: 'blue',
                      },
                    ]}
                    label={<Text ta="center" fw={800}>{analytics.averageProcessingTime}</Text>}
                  />
                </Group>
              </Paper>
            </Stack>
          </Stack>
        )}
      </Card>
    </Container>
  );
}