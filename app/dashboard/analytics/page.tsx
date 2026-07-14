'use client';

import { useState, useEffect } from 'react';
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
} from '@tabler/icons-react';
import useSWR from 'swr';
import { PieChart, LineChart, BarChart } from '@mantine/charts';
import { UserContext } from '../../dashboard/forms/iom/component/types';
import dayjs from 'dayjs';

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
  const [customDates, setCustomDates] =
  useState<[string | null, string | null]>([
    null,
    null,
  ]);
  const [datePickerOpened, setDatePickerOpened] = useState(false);

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

  const isAdminOrSuper = currentUser && ['Admin', 'SuperUser'].includes(currentUser.role);
  const effectiveDept = isAdminOrSuper ? selectedDept : currentUser?.departmentCode;

  // --- Build API URL with query params ---
  const queryParams = new URLSearchParams({
    departmentCode: effectiveDept || '',
    timeRange,
    ...(timeRange !== 'all' && timeRange !== 'custom' && { date: baseDate.toISOString() }),
  });

  if (timeRange === 'custom') {
    const [start, end] = customDates;
    if (start) {
      // Convert to ISO with start of day (00:00:00)
      const startDate = dayjs(start).format('YYYY-MM-DD');
      queryParams.append('startDate', startDate);
    }
    if (end) {
      // Convert to ISO with end of day (23:59:59.999)
      const endDate = dayjs(end).format('YYYY-MM-DD');
      queryParams.append('endDate', endDate);
    }
  }

  const url = `/api/analytics?${queryParams.toString()}`;

  const { data, error } = useSWR(url, fetcher, {
    refreshInterval: 30000,
    revalidateOnFocus: true,
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
                onChange={(value) =>
                  setTimeRange(value as typeof timeRange)
                }
                data={[
                  {
                    label: 'Day',
                    value: 'day',
                  },
                  {
                    label: 'Week',
                    value: 'week',
                  },
                  {
                    label: 'Month',
                    value: 'month',
                  },
                  {
                    label: 'Custom',
                    value: 'custom',
                  },
                  {
                    label: 'All',
                    value: 'all',
                  },
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

        {/* Main content – charts and stats (unchanged) */}
        {!analytics ? (
          <Loader />
        ) : (
          <Stack gap="lg">
            {/* Overview Cards */}
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
                  <Paper key={stat.label} withBorder radius="xl" p="lg">
                    <Group justify="space-between">
                      <Stack gap={0}>
                        <Text size="sm" c="dimmed">
                          {stat.label}
                        </Text>
                        <Text fw={900} fz={34}>
                          {stat.value}
                        </Text>
                      </Stack>
                      <ThemeIcon size={60} radius="xl" color={stat.color} variant="light">
                        <Icon size={30} />
                      </ThemeIcon>
                    </Group>
                  </Paper>
                );
              })}
            </SimpleGrid>

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
                {timeRange === 'day'
                  ? 'Hourly Memo Activity'
                  : 'Memo Trends'}
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
        )}
      </Card>
    </Container>
  );
}