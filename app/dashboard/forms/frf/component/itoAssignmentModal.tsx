// app/dashboard/forms/frf/components/ITOAssignmentModal.tsx
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Modal,
  Stack,
  Text,
  Button,
  Group,
  Alert,
  Select,
  ActionIcon,
  Paper,
  Grid,
  Box,
  ThemeIcon,
  Divider,
  Badge,
  Textarea,
  Checkbox,
  UnstyledButton,
  Collapse,
} from '@mantine/core';
import { TimeInput } from '@mantine/dates';
import { useMediaQuery } from '@mantine/hooks';
import {
  IconTrash,
  IconPlus,
  IconInfoCircle,
  IconCheck,
  IconX,
  IconAlertCircle,
  IconChevronDown
} from '@tabler/icons-react';
import { FacilityReservation, UserContext, ITOAssignment } from './types';

interface ApiUser {
  id: string;
  fname: string;
  lname: string;
  email: string;
  departmentCode: string;
  role: string;
}

interface ITOAssignmentModalProps {
  opened: boolean;
  onClose: () => void;
  request: FacilityReservation | null;
  currentUser: UserContext | null;
  onConfirm: (assignments: ITOAssignment[]) => void;
  loading?: boolean;
  mode?: 'assign' | 'approve';

}

type AssignmentRow = {
  id: string;
  userId: string;
  dateIndex: number;
  type: 'setup' | 'teardown' | 'operator' | 'assistant';
  startTime: string;
  endTime: string;
  notes: string;
  isOvertime: boolean;
};

// Validation result per date
type DateValidation = {
  dateIndex: number;
  label: string;
  eventStart: Date;
  eventEnd: Date;
  hasSetup: boolean;
  hasTeardown: boolean;
  setupRows: AssignmentRow[];
  teardownRows: AssignmentRow[];
  operatorRows: AssignmentRow[];
  assistantRows: AssignmentRow[];
  errors: string[];
  isValid: boolean;
};

export default function ITOAssignmentModal({
  opened,
  onClose,
  request,
  currentUser,
  onConfirm,
  loading = false,
  mode = 'assign',
}: ITOAssignmentModalProps) {
  const [staffList, setStaffList] = useState<{ value: string; label: string }[]>([]);
  const [rows, setRows] = useState<AssignmentRow[]>([]);
  const [error, setError] = useState('');
  const [rulesExpanded, setRulesExpanded] = useState(false); // 📱 for collapsible alert

  const isMobile = useMediaQuery('(max-width: 768px)');
  
  const hasPrefilledRef = useRef(false);

  // Helper: format time as HH:mm
  const formatTimeString = (date: Date): string => {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  // Pre‑fill rows for reschedule approval when modal opens
  useEffect(() => {
    // Reset prefilled flag when request or mode changes (and modal is open)
    if (opened && request) {
      hasPrefilledRef.current = false;
    }
  }, [opened, request?.id, mode]);

  useEffect(() => {
  const shouldPrefill =
    request?.isReschedule && mode === 'approve';

  if (
    opened &&
    request &&
    shouldPrefill &&
    request.assignments &&
    request.assignments.length > 0 &&
    !hasPrefilledRef.current
  ) {
      const newRows: AssignmentRow[] = request.assignments.map(ass => {
        const dutyDate = new Date(ass.dutyStart);
        let dateIndex = 0;
        for (let i = 0; i < request.dates.length; i++) {
          const eventDate = new Date(request.dates[i].eventStart);
          if (
            dutyDate.getFullYear() === eventDate.getFullYear() &&
            dutyDate.getMonth() === eventDate.getMonth() &&
            dutyDate.getDate() === eventDate.getDate()
          ) {
            dateIndex = i;
            break;
          }
        }
        return {
          id: crypto.randomUUID(),
          userId: ass.userId,
          dateIndex: dateIndex,
          type: ass.dutyType.toLowerCase() as 'setup' | 'teardown' | 'operator' | 'assistant',
          startTime: formatTimeString(new Date(ass.dutyStart)),
          endTime: formatTimeString(new Date(ass.dutyEnd)),
          notes: ass.notes || '',
          isOvertime: ass.isOvertime ?? false,
        };
      });
      setRows(newRows);
      hasPrefilledRef.current = true;
    }
  }, [opened, request, mode]);

  // Fetch ITO-MAIN staff
  useEffect(() => {
    const fetchStaff = async () => {
      if (!request || !opened) return;
      try {
        const res = await fetch('/api/user/get');
        const data = await res.json();
        if (data.success) {
          const itoStaff = data.data.filter((u: ApiUser) => u.departmentCode === 'ITO-MAIN');
          const staffOptions = itoStaff.map((u: ApiUser) => ({
            value: u.id,
            label: `${u.fname} ${u.lname}`,
          }));

          if (currentUser) {
            const exists = staffOptions.some(
              (opt: { value: string; label: string }) => opt.value === currentUser.id
            );
            if (!exists) {
              staffOptions.push({
                value: currentUser.id,
                label: `${currentUser.fname} ${currentUser.lname} (You)`,
              });
            }
          }
          setStaffList(staffOptions);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchStaff();
  }, [opened, request, currentUser]);

  // Date options from request.dates
  const dateOptions = useMemo(() => {
    return (
      request?.dates?.map((d, index) => {
        const start = new Date(d.eventStart);
        const end = new Date(d.eventEnd);

        const dateStr = start.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });

        const timeStr = `${start.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        })} – ${end.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        })}`;

        return {
          value: String(index),
          label: `${dateStr} (${timeStr})`,
          eventStart: start,
          eventEnd: end,
        };
      }) || []
    );
  }, [request]);

  // ----- LIVE VALIDATION -----
  const validationResults = useMemo(() => {
    const results: DateValidation[] = [];

    if (!request || !dateOptions.length) return results;

    // Group rows by dateIndex
    const grouped: Record<number, AssignmentRow[]> = {};
    for (const row of rows) {
      if (!row.userId || !row.startTime || !row.endTime) continue; // ignore incomplete rows for validation
      if (!grouped[row.dateIndex]) grouped[row.dateIndex] = [];
      grouped[row.dateIndex].push(row);
    }

    for (let i = 0; i < dateOptions.length; i++) {
      const opt = dateOptions[i];
      const dateRows = grouped[i] || [];
      const setupRows = dateRows.filter((r) => r.type === 'setup');
      const teardownRows = dateRows.filter((r) => r.type === 'teardown');

      const hasSetup = setupRows.length > 0;
      const hasTeardown = teardownRows.length > 0;

      const errors: string[] = [];

      // Rule 1: At least one setup and one teardown
      if (!hasSetup) {
        errors.push('❌ At least one Setup assignment required.');
      }
      if (!hasTeardown) {
        errors.push('❌ At least one Pack-up assignment required.');
      }

      // Rule 2: Validate each setup row (only for SETUP type)
      for (const row of setupRows) {
        if (row.type === 'operator' || row.type === 'assistant') continue;
        const [sH, sM] = row.startTime.split(':').map(Number);
        const [eH, eM] = row.endTime.split(':').map(Number);
        const dutyStart = new Date(opt.eventStart);
        dutyStart.setHours(sH, sM, 0, 0);
        const dutyEnd = new Date(opt.eventStart);
        dutyEnd.setHours(eH, eM, 0, 0);

        const minStart = new Date(opt.eventStart);
        minStart.setHours(opt.eventStart.getHours() - 2);

        if (dutyStart > minStart) {
          errors.push(
            `❌ Setup start time must be at least 2 hours before event start (${opt.eventStart.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}).`
          );
        }
        if (dutyEnd > opt.eventStart) {
          errors.push(
            `❌ Setup end time cannot exceed event start (${opt.eventStart.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}).`
          );
        }
      }

      // Rule 3: Validate each teardown row (only for TEARDOWN type)
      for (const row of teardownRows) {
        if (row.type === 'operator' || row.type === 'assistant') continue;

        const [sH, sM] = row.startTime.split(':').map(Number);
        const [eH, eM] = row.endTime.split(':').map(Number);

        // 🆕 Base on event END day (teardown happens after event)
        const dutyStart = new Date(opt.eventEnd);
        dutyStart.setHours(sH, sM, 0, 0);
        const dutyEnd = new Date(opt.eventEnd);
        dutyEnd.setHours(eH, eM, 0, 0);

        // 🆕 If start time is early morning (AM) but event ends late (PM),
        //    assume teardown is on the NEXT day
        if (sH < 12 && dutyStart < opt.eventEnd) {
          dutyStart.setDate(dutyStart.getDate() + 1);
          dutyEnd.setDate(dutyEnd.getDate() + 1);
        }

        // 🆕 If end time is earlier than start time (e.g., 22:00 → 00:00),
        //    the end crosses midnight → push end to next day
        if (dutyEnd < dutyStart) {
          dutyEnd.setDate(dutyEnd.getDate() + 1);
        }

        const minEnd = new Date(opt.eventEnd);
        minEnd.setHours(opt.eventEnd.getHours() + 2);

        if (dutyStart < opt.eventEnd) {
          errors.push(
            `❌ Teardown start time must be at or after event end (${opt.eventEnd.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}).`
          );
        }
        if (dutyEnd < minEnd) {
          errors.push(
            `❌ Teardown end time must be at least 2 hours after event end (${opt.eventEnd.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}).`
          );
        }
      }

      // Rule 4: Validate OPERATOR and ASSISTANT (within event time)
      const operatorRows = dateRows.filter((r) => r.type === 'operator' || r.type === 'assistant');
      const assistantRows = dateRows.filter((r) => r.type === 'assistant');

      for (const row of operatorRows) {
        const [sH, sM] = row.startTime.split(':').map(Number);
        const [eH, eM] = row.endTime.split(':').map(Number);
        const dutyStart = new Date(opt.eventStart);
        dutyStart.setHours(sH, sM, 0, 0);
        const dutyEnd = new Date(opt.eventStart);
        dutyEnd.setHours(eH, eM, 0, 0);

        if (dutyStart < opt.eventStart) {
          errors.push(
            `❌ ${row.type.toUpperCase()} start time cannot be before event start (${opt.eventStart.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}).`
          );
        }
        if (dutyEnd > opt.eventEnd) {
          errors.push(
            `❌ ${row.type.toUpperCase()} end time cannot exceed event end (${opt.eventEnd.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}).`
          );
        }
      }

      // Remove duplicate errors (simplify)
      const uniqueErrors = [...new Set(errors)];
      
      results.push({
        dateIndex: i,
        label: opt.label,
        eventStart: opt.eventStart,
        eventEnd: opt.eventEnd,
        hasSetup,
        hasTeardown,
        setupRows,
        teardownRows,
        operatorRows,
        assistantRows,
        errors: uniqueErrors,
        isValid: uniqueErrors.length === 0 && hasSetup && hasTeardown,
      });
    }

    return results;
  }, [rows, dateOptions, request]);

  // Overall validity: lahat ng dates valid at may kahit isang row
  const isValid = useMemo(() => {
    if (rows.length === 0) return false;
    return validationResults.every((r) => r.isValid);
  }, [validationResults, rows]);

  // Helper: get count of valid dates
  const validDateCount = useMemo(() => {
    return validationResults.filter((r) => r.isValid).length;
  }, [validationResults]);

  const totalDates = dateOptions.length;

  // ----- UI Handlers -----
  const addRow = () => {
    setRows([
      ...rows,
      {
        id: crypto.randomUUID(),
        userId: '',
        dateIndex: 0,
        type: 'setup',
        startTime: '',
        endTime: '',
        notes: '',
        isOvertime: false,
      },
    ]);
  };

  const removeRow = (id: string) => {
    setRows(rows.filter((r) => r.id !== id));
  };

  const updateRow = <K extends keyof AssignmentRow>(
    id: string,
    field: K,
    value: AssignmentRow[K]
  ) => {
    setRows(rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const handleSubmit = () => {
    setError('');

    const validRows = rows.filter(
      (r) => r.userId && r.startTime && r.endTime
    );

    if (!isValid) {
      setError('Please fix all validation errors before submitting.');
      return;
    }

    // Build final payload
    const payload: ITOAssignment[] = validRows.map((r) => {
      const eventStart = new Date(request!.dates[r.dateIndex].eventStart);
      const eventEnd = new Date(request!.dates[r.dateIndex].eventEnd);

      // 🆕 Base date: teardown is on event END day, others on event START day
      const baseDate = r.type === 'teardown' ? eventEnd : eventStart;

      const [startHours, startMinutes] = r.startTime.split(':').map(Number);
      const [endHours, endMinutes] = r.endTime.split(':').map(Number);

      const dutyStart = new Date(baseDate);
      dutyStart.setHours(startHours, startMinutes, 0, 0);
      const dutyEnd = new Date(baseDate);
      dutyEnd.setHours(endHours, endMinutes, 0, 0);

      // 🆕 Teardown: if start is early morning (AM) but event ends late, next day
      if (r.type === 'teardown' && startHours < 12 && dutyStart < eventEnd) {
        dutyStart.setDate(dutyStart.getDate() + 1);
        dutyEnd.setDate(dutyEnd.getDate() + 1);
      }

      // 🆕 If end is before start (wraps midnight), push end to next day
      if (dutyEnd < dutyStart) {
        dutyEnd.setDate(dutyEnd.getDate() + 1);
      }

      return {
        userId: r.userId,
        dutyStart,
        dutyEnd,
        dutyType: r.type.toUpperCase() as 'SETUP' | 'TEARDOWN' | 'OPERATOR' | 'ASSISTANT',
        notes: r.notes || undefined,
        isOvertime: r.isOvertime,
      };
    });

    onConfirm(payload);
  };

  // Determine button label
  let buttonLabel = 'Assign';
  if (mode === 'approve') {
    buttonLabel = request?.isReschedule ? 'Review & Approve Reschedule' : 'Approve and Assign';
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Assign ITO Staff for Overtime"
      size="100%"
      fullScreen={isMobile}
      zIndex={1000}
      centered
      styles={{
      inner: {
        // 🆕 sidebar offset + 16px breathing room sa lahat ng gilid
        paddingLeft: 'calc(var(--sidebar-offset, 0px) + 16px)',
        paddingRight: 16,
        paddingTop: 16,
        paddingBottom: 16,
        transition: 'padding-left 0.25s ease',
      },
      content: {
        // 🆕 hindi lalampas sa viewport, may scroll kung mahaba
        maxHeight: 'calc(100vh - 32px)',
      },
    }}
    >
      <Stack gap="md">
        <Alert
          icon={<IconInfoCircle size={isMobile ? 14 : 16} />}
          color="blue"
          p={isMobile ? 'xs' : 'md'}
        >
          <Text size={isMobile ? 'xs' : 'sm'} fw={700}>
            *DEPARTMENT HEAD / OIC ONLY*
          </Text>
          <Text size={isMobile ? '11px' : 'xs'} mt={4} lh={1.5}>
            List all ITO staff duties for this event — setup, pack-up, operators, and assistants.
            Mark <b>OT</b> for off-hours duties.
          </Text>

          {isMobile ? (
            /* 📱 Collapsible rules */
            <>
              <UnstyledButton
                onClick={() => setRulesExpanded((o) => !o)}
                mt="xs"
                style={{ width: '100%' }}
              >
                <Group gap={4} justify="space-between" wrap="nowrap">
                  <Text size="11px" fw={700} c="blue.6">
                    {rulesExpanded ? '▼ Hide Rules' : '▶ Show Rules & Guidelines'}
                  </Text>
                  <IconChevronDown
                    size={14}
                    style={{
                      transform: rulesExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 150ms ease',
                    }}
                  />
                </Group>
              </UnstyledButton>
              <Collapse expanded={rulesExpanded}>
                <Box mt="xs" style={{ fontSize: '11px', lineHeight: 1.5 }}>
                  <b>Validation Rules:</b>
                  <ul style={{ marginTop: 2, marginBottom: 6, paddingLeft: 16 }}>
                    <li>Every date needs ≥1 Setup and ≥1 Pack-up.</li>
                    <li>Setup start ≥2h before event; end ≤ event start.</li>
                    <li>Pack-up start ≥ event end; end ≥2h after event end.</li>
                    <li>Operator/Assistant must fall within event times.</li>
                  </ul>
                  <b>Mga Alituntunin:</b>
                  <ul style={{ marginTop: 2, marginBottom: 0, paddingLeft: 16 }}>
                    <li>Bawat petsa: ≥1 Setup, ≥1 Pack-up.</li>
                    <li>Setup: start ≥2h bago ang event; end ≤ event start.</li>
                    <li>Pack-up: start ≥ event end; end ≥2h pagkatapos.</li>
                    <li>Operator/Assistant: sa loob ng event time.</li>
                  </ul>
                </Box>
              </Collapse>
            </>
          ) : (
            /* 💻 Desktop: full rules */
            <>
              <Text fw={600} mt="xs" size="sm">Validation Rules:</Text>
              <ul style={{ marginTop: 4, fontSize: '14px' }}>
                <li>Every date must have at least one Setup and one Pack-up.</li>
                <li>Setup: start time must be at least <b>2 hours before</b> event start; end time must be ≤ event start.</li>
                <li>Pack-up: start time must be ≥ event end; end time must be at least <b>2 hours after</b> event end.</li>
                <li>Operator / Assistant: must fall within the event start and end times.</li>
              </ul>
              <br />
              <Text fw={600} size="sm">Mga Alituntunin:</Text>
              <ul style={{ marginTop: 4, fontSize: '14px' }}>
                <li>Ang kada petsa ay dapat may isang taga-ayos (Setup) at taga-ligpit (Pack-up).</li>
                <li>Setup: Ang start time ay dapat <b>2 oras bago ang event start</b>; Ang end time ay dapat mas mababa o katumbas ng event start.</li>
                <li>Pack-up: Ang start time ay dapat mas mauna o katumbas ng event end; end time ay dapat di bababa sa <b>2 oras pagkatapos</b> ng event end.</li>
                <li>Operator / Assistant: dapat nasa loob ng event start at end time.</li>
              </ul>
            </>
          )}
        </Alert>

        {/* === LIVE VALIDATION STATUS === */}
        <Paper withBorder p="md" radius="md">
          <Group justify="space-between">
            <Group gap="xs">
              <ThemeIcon color={isValid ? 'green' : 'gray'} variant="light" size="lg" radius="xl">
                {isValid ? <IconCheck size={20} /> : <IconAlertCircle size={20} />}
              </ThemeIcon>
              <div>
                <Text fw={600} size="sm">
                  {isValid
                    ? '✅ All assignments are valid!'
                    : `⚠️ ${validDateCount}/${totalDates} dates valid`}
                </Text>
                <Text size="xs" c="dimmed">
                  {rows.length === 0
                    ? 'Add at least one staff assignment.'
                    : isValid
                    ? 'You can now submit.'
                    : 'Please fix the errors below.'}
                </Text>
              </div>
            </Group>
            <Badge color={isValid ? 'green' : 'gray'} size="lg">
              {isValid ? 'READY' : 'INCOMPLETE'}
            </Badge>
          </Group>
        </Paper>

        {/* === PER-DATE VALIDATION DETAILS === */}
        {validationResults.length > 0 && (
          <Stack gap="xs">
            <Divider label="Per-Date Status" labelPosition="left" />
            {validationResults.map((v) => (
              <Paper
                key={v.dateIndex}
                withBorder
                p="xs"
                radius="sm"
                style={{
                  borderLeft: `4px solid ${v.isValid ? 'var(--mantine-color-green-5)' : 'var(--mantine-color-red-5)'}`,
                }}
              >
                <Stack gap={isMobile ? 6 : 0}>
                  <Group justify="space-between" wrap="wrap" gap="xs">
                    <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                      <ThemeIcon
                        color={v.isValid ? 'green' : 'red'}
                        variant="light"
                        size="sm"
                        radius="xl"
                        style={{ flexShrink: 0 }}
                      >
                        {v.isValid ? <IconCheck size={14} /> : <IconX size={14} />}
                      </ThemeIcon>
                      <Text size={isMobile ? 'xs' : 'sm'} fw={500} truncate>
                        {v.label}
                      </Text>
                    </Group>
                    <Group gap={4} wrap="nowrap">
                      <Badge size={isMobile ? 'sm' : 'md'} color={v.hasSetup ? 'green' : 'red'} variant="light">
                        S: {v.setupRows.length}
                      </Badge>
                      <Badge size={isMobile ? 'sm' : 'md'} color={v.hasTeardown ? 'green' : 'red'} variant="light">
                        P: {v.teardownRows.length}
                      </Badge>
                    </Group>
                  </Group>
                </Stack>
                {v.errors.length > 0 && (
                  <Box mt={4}>
                    {v.errors.map((err, idx) => (
                      <Text key={idx} size="xs" c="red" style={{ marginLeft: 28 }}>
                        {err}
                      </Text>
                    ))}
                  </Box>
                )}
              </Paper>
            ))}
          </Stack>
        )}

        {/* === ASSIGNMENT ROWS === */}
        {rows.map((row, rowIndex) => (
          <Paper key={row.id} withBorder p={isMobile ? 'sm' : 'md'} radius="md">
            {/* 📱 Mobile: Row header na may delete button */}
            {isMobile && (
              <Group justify="space-between" mb="xs" wrap="nowrap">
                <Badge color="grape" variant="filled" size="sm">
                  Row #{rowIndex + 1}
                </Badge>
                <ActionIcon
                  color="red"
                  variant="light"
                  onClick={() => removeRow(row.id)}
                  size="sm"
                  aria-label="Remove this row"
                >
                  <IconTrash size={14} />
                </ActionIcon>
              </Group>
            )}

            <Grid>
              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                <Select
                  label="Petsa"
                  placeholder="Pumili ng petsa"
                  data={dateOptions.map((opt) => ({
                    value: opt.value,
                    label: opt.label,
                  }))}
                  value={String(row.dateIndex)}
                  onChange={(val) =>
                    updateRow(row.id, 'dateIndex', val ? parseInt(val, 10) : 0)
                  }
                  required
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                <Select
                  label="Staff"
                  placeholder="Pumili ng staff"
                  data={staffList}
                  value={row.userId}
                  onChange={(val) => updateRow(row.id, 'userId', val ?? '')}
                  searchable
                  required
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                <Select
                  label="OT Duty Type"
                  placeholder="Setup o Pack up"
                  data={[
                    { value: 'setup', label: 'Setup' },
                    { value: 'teardown', label: 'Pack-up' },
                    { value: 'operator', label: 'Operator' },
                    { value: 'assistant', label: 'Assistant' },
                  ]}
                  value={row.type}
                  onChange={(val) =>
                    updateRow(row.id, 'type', (val as 'setup' | 'teardown' | 'operator' | 'assistant') || 'setup')
                  }
                  required
                />
              </Grid.Col>
              <Grid.Col
                span={{ base: 12, sm: 6, md: 3 }}
                style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 4 }}
              >
                <Checkbox
                  label="Overtime (OT)"
                  description={isMobile ? undefined : 'Mark kung OT duty ito'}
                  checked={row.isOvertime}
                  onChange={(e) => updateRow(row.id, 'isOvertime', e.currentTarget.checked)}
                  size="sm"
                  style={{ width: '100%' }}
                />
              </Grid.Col>

              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                <TimeInput
                  label="Start Time"
                  value={row.startTime}
                  onChange={(e) => updateRow(row.id, 'startTime', e.currentTarget.value)}
                  required
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                <TimeInput
                  label="End Time"
                  value={row.endTime}
                  onChange={(e) => updateRow(row.id, 'endTime', e.currentTarget.value)}
                  required
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 12, md: 4 }}>
                <Textarea
                  label="Notes"
                  placeholder="e.g., Setup projector, assist with sound system, etc."
                  value={row.notes}
                  onChange={(e) => updateRow(row.id, 'notes', e.currentTarget.value)}
                  size="xs"
                  autosize
                  minRows={1}
                  maxRows={3}
                />
              </Grid.Col>
              {!isMobile && (
                <Grid.Col span={{ base: 6, sm: 6, md: 2 }} style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <ActionIcon color="red" onClick={() => removeRow(row.id)} size="lg" variant="light">
                    <IconTrash size={18} />
                  </ActionIcon>
                </Grid.Col>
              )}
            </Grid>
          </Paper>
        ))}

        <Button
          variant="dashed"
          fullWidth
          onClick={addRow}
          leftSection={<IconPlus size={16} />}
        >
          Add Staff
        </Button>

        {error && (
          <Alert color="red" title="Submission Error" icon={<IconAlertCircle size={16} />}>
            {error}
          </Alert>
        )}

        {isMobile ? (
          /* 📱 Mobile: stacked, full-width */
          <Stack gap="xs" mt="md">
            <Button
              loading={loading}
              onClick={handleSubmit}
              disabled={!isValid || rows.length === 0}
              color={isValid ? 'blue' : 'gray'}
              size="md"
              fullWidth
            >
              {buttonLabel}
            </Button>
            <Button variant="light" onClick={onClose} size="md" fullWidth>
              Cancel
            </Button>
          </Stack>
        ) : (
          /* 💻 Desktop */
          <Group justify="flex-end">
            <Button variant="light" onClick={onClose}>
              Cancel
            </Button>
            <Button
              loading={loading}
              onClick={handleSubmit}
              disabled={!isValid || rows.length === 0}
              color={isValid ? 'blue' : 'gray'}
            >
              {buttonLabel}
            </Button>
          </Group>
        )}
      </Stack>
    </Modal>
  );
}