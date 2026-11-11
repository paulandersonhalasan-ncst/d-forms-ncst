// app/dashboard/forms/frf/manage/component/sequenceBuilder.tsx
'use client';

import { useEffect, useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Card,
  Stack,
  Group,
  Text,
  Button,
  Paper,
  Select,
  ActionIcon,
  Alert,
  Badge,
  Loader,
  Divider,
  Box,
} from '@mantine/core';
import {
  IconGripVertical,
  IconTrash,
  IconPlus,
  IconInfoCircle,
  IconAlertTriangle,
  IconCheck,
  IconRefresh,
} from '@tabler/icons-react';
import {
  TRIGGER_OPTIONS,
  STEP_TYPE_OPTIONS,
  DEFAULT_FRF_SEQUENCE,
} from '../../../../lib/approval_sequence_defaults';

type StepDraft = {
  id: string;
  departmentCode: string;
  stepType: 'APPROVAL' | 'ACKNOWLEDGEMENT';
  triggerKey: string;
};

type Dept = { value: string; label: string };

const newId = () => crypto.randomUUID();

// ── API response shapes ──────────────────────────────────────
interface ApiSequenceStep {
  id: string;
  sequenceId: string;
  sequenceIndex: number;
  departmentCode: string;
  stepType: 'APPROVAL' | 'ACKNOWLEDGEMENT';
  triggerKey: string;
  createdAt: string;
}

interface ApiSequenceMeta {
  id: string;
  formType: string;
  label: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ApiSequencesResponse {
  success: boolean;
  message?: string;
  data: {
    sequence: ApiSequenceMeta | null;
    steps: ApiSequenceStep[];
    departments: Dept[];
    inFlightCount: number;
  };
}

// Pure fetcher — no setState. Safe to call from useEffect without
// triggering the React 19 "setState synchronously in effect" rule.
async function fetchSequence(): Promise<{
  departments: Dept[];
  inFlightCount: number;
  isConfigured: boolean;
  steps: StepDraft[];
}> {
  const res = await fetch('/api/frf/approval_sequence?formType=FRF');
  const data: ApiSequencesResponse = await res.json();
  if (!data.success) throw new Error(data.message || 'Failed to load');
  return {
    departments: data.data.departments,
    inFlightCount: data.data.inFlightCount,
    isConfigured: !!data.data.sequence,
    steps: data.data.steps.map((s) => ({
      id: newId(),
      departmentCode: s.departmentCode,
      stepType: s.stepType,
      triggerKey: s.triggerKey,
    })),
  };
}

function SortableStepRow({
  step,
  index,
  departments,
  onChange,
  onRemove,
}: {
  step: StepDraft;
  index: number;
  departments: Dept[];
  onChange: (id: string, patch: Partial<StepDraft>) => void;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: step.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 'auto' as const,
  };

  return (
    <Paper
      ref={setNodeRef}
      style={style}
      withBorder
      p="sm"
      radius="md"
      bg="light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-7))"
    >
      <Group gap="xs" wrap="nowrap" align="center">
        <ActionIcon
          {...attributes}
          {...listeners}
          variant="subtle"
          color="gray"
          style={{ cursor: 'grab', touchAction: 'none' }}
          aria-label="Drag to reorder"
        >
          <IconGripVertical size={18} />
        </ActionIcon>

        <Badge color="blue" variant="filled" size="sm" style={{ flexShrink: 0 }}>
          #{index + 1}
        </Badge>

        <Select
          data={departments}
          value={step.departmentCode}
          onChange={(val) => val && onChange(step.id, { departmentCode: val })}
          placeholder="Department"
          searchable
          allowDeselect={false}
          style={{ flex: 1, minWidth: 140 }}
          comboboxProps={{ zIndex: 5000 }}
        />

        <Select
          data={STEP_TYPE_OPTIONS}
          value={step.stepType}
          onChange={(val) => val && onChange(step.id, { stepType: val as StepDraft['stepType'] })}
          allowDeselect={false}
          style={{ flex: 1, minWidth: 180 }}
          comboboxProps={{ zIndex: 5000 }}
        />

        <Select
          data={TRIGGER_OPTIONS}
          value={step.triggerKey}
          onChange={(val) => val && onChange(step.id, { triggerKey: val })}
          allowDeselect={false}
          style={{ flex: 1.2, minWidth: 220 }}
          comboboxProps={{ zIndex: 5000 }}
        />

        <ActionIcon color="red" variant="light" onClick={() => onRemove(step.id)} aria-label="Remove step">
          <IconTrash size={16} />
        </ActionIcon>
      </Group>
    </Paper>
  );
}

export default function SequenceBuilder() {
  const [steps, setSteps] = useState<StepDraft[]>([]);
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [inFlightCount, setInFlightCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isConfigured, setIsConfigured] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Manual refresh (retry button, future "reload" action). Safe to call
  // setLoading synchronously here — this runs from an event handler, not
  // from an effect body.
  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await fetchSequence();
      setDepartments(result.departments);
      setInFlightCount(result.inFlightCount);
      setIsConfigured(result.isConfigured);
      setSteps(result.steps);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Async IIFE: the first statement is `await fetchSequence()`, so no
    // setState runs synchronously in the effect body. React 19 lint rule
    // satisfied; `cancelled` guard handles strict-mode double-invoke.
    let cancelled = false;
    (async () => {
      try {
        const result = await fetchSequence();
        if (cancelled) return;
        setDepartments(result.departments);
        setInFlightCount(result.inFlightCount);
        setIsConfigured(result.isConfigured);
        setSteps(result.steps);
      } catch (err: unknown) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Load failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = steps.findIndex((s) => s.id === active.id);
    const newIndex = steps.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    setSteps(arrayMove(steps, oldIndex, newIndex));
  };

  const updateStep = (id: string, patch: Partial<StepDraft>) => {
    setSteps(prev => prev.map(s => (s.id === id ? { ...s, ...patch } : s)));
  };

  const removeStep = (id: string) => {
    setSteps(prev => prev.filter(s => s.id !== id));
  };

  const addStep = () => {
    const unused = departments.find(d => !steps.some(s => s.departmentCode === d.value));
    setSteps(prev => [
      ...prev,
      {
        id: newId(),
        departmentCode: unused?.value ?? departments[0]?.value ?? '',
        stepType: 'APPROVAL',
        triggerKey: 'always',
      },
    ]);
  };

  const loadDefault = () => {
    const deptSet = new Set(departments.map(d => d.value));
    const filtered = DEFAULT_FRF_SEQUENCE.filter(s => deptSet.has(s.departmentCode));
    const missing = DEFAULT_FRF_SEQUENCE.filter(s => !deptSet.has(s.departmentCode)).map(s => s.departmentCode);
    setSteps(
      filtered.map(s => ({
        id: newId(),
        departmentCode: s.departmentCode,
        stepType: s.stepType as 'APPROVAL' | 'ACKNOWLEDGEMENT',
        triggerKey: s.triggerKey,
      })),
    );
    if (missing.length > 0) {
      setError(`Default template excluded (department not in DB): ${missing.join(', ')}. Create them under Management → Users first.`);
    }
  };

  const save = async () => {
    setError('');
    setSuccessMsg('');
    if (steps.length === 0) {
      setError('At least one step is required.');
      return;
    }
    if (!steps.some(s => s.stepType === 'APPROVAL')) {
      setError('At least one APPROVAL step is required.');
      return;
    }

    if (inFlightCount > 0) {
      const confirmed = confirm(
        `⚠️ ${inFlightCount} reservation(s) are currently in-flight.\n\nChanges apply only to NEW reservations — existing ones keep their current chain.\n\nProceed?`,
      );
      if (!confirmed) return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/frf/approval_sequence', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formType: 'FRF',
          label: 'FRF Default',
          isActive: true,
          steps: steps.map(({ departmentCode, stepType, triggerKey }) => ({
            departmentCode,
            stepType,
            triggerKey,
          })),
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Save failed');
      setSuccessMsg('Approval flow saved successfully.');
      setIsConfigured(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Group justify="center" py="xl">
        <Loader />
      </Group>
    );
  }

  return (
    <Stack gap="md">
      <Alert
        icon={isConfigured ? <IconCheck size={16} /> : <IconAlertTriangle size={16} />}
        color={isConfigured ? 'green' : 'orange'}
        title={isConfigured ? 'FRF sequence is configured' : 'No FRF sequence configured yet'}
      >
        {isConfigured
          ? 'Drag to reorder, change step type or trigger condition, then Save. Changes apply to new reservations only.'
          : 'Load the default template below to get started, or build from scratch. Without a configured sequence, new FRF submissions are rejected.'}
        <br /><br />
        <Text size="xs" c="dimmed">
          <b>Step 1 is always the requestor&apos;s own department</b> (auto-added by the system, not shown here).
          Steps below start from step 2 in the actual approval chain.
        </Text>
      </Alert>

      {inFlightCount > 0 && (
        <Alert icon={<IconAlertTriangle size={16} />} color="yellow">
          <b>{inFlightCount} reservation{inFlightCount === 1 ? '' : 's'} in-flight.</b> Changes below apply to
          new reservations only — existing ones keep their current approval chain.
        </Alert>
      )}

      {error && (
        <Alert color="red" icon={<IconAlertTriangle size={16} />}>{error}</Alert>
      )}
      {successMsg && (
        <Alert color="green" icon={<IconCheck size={16} />}>{successMsg}</Alert>
      )}

      {steps.length === 0 ? (
        <Card withBorder p="xl" radius="md">
          <Stack align="center" gap="sm">
            <Text c="dimmed">No steps yet.</Text>
            <Group>
              <Button leftSection={<IconRefresh size={16} />} variant="light" onClick={loadDefault}>
                Load Default Template
              </Button>
              <Button leftSection={<IconPlus size={16} />} onClick={addStep}>
                Add Step
              </Button>
            </Group>
          </Stack>
        </Card>
      ) : (
        <>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={steps.map(s => s.id)} strategy={verticalListSortingStrategy}>
              <Stack gap="xs">
                {steps.map((step, i) => (
                  <SortableStepRow
                    key={step.id}
                    step={step}
                    index={i}
                    departments={departments}
                    onChange={updateStep}
                    onRemove={removeStep}
                  />
                ))}
              </Stack>
            </SortableContext>
          </DndContext>

          <Group justify="space-between">
            <Group>
              <Button leftSection={<IconPlus size={16} />} variant="light" onClick={addStep}>
                Add Step
              </Button>
              <Button leftSection={<IconRefresh size={16} />} variant="subtle" color="gray" onClick={loadDefault}>
                Reset to Default
              </Button>
            </Group>
            <Button onClick={save} loading={saving}>
              Save Approval Flow
            </Button>
          </Group>
        </>
      )}

      <Divider label="Legend" labelPosition="left" />
      <Card withBorder p="sm" radius="sm">
        <Stack gap={4}>
          <Text size="xs">
            <b>APPROVAL</b> — gates completion. FRF is only COMPLETED when all APPROVAL steps are APPROVED.
          </Text>
          <Text size="xs">
            <b>ACKNOWLEDGEMENT</b> — informational only. FRF can be COMPLETED while ACK steps are still
            pending. Recipients see it in Pending Approval and can click Acknowledge with remarks.
          </Text>
          <Text size="xs">
            <b>Trigger keys</b> — determine when a step is included in the chain. Each FRF is materialized
            from the template at submission time based on its context (type, equipment, physical activity).
          </Text>
        </Stack>
      </Card>
    </Stack>
  );
}