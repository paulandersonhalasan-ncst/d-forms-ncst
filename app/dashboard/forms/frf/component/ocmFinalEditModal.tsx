// app/dashboard/forms/frf/components/OCMFinalEditModal.tsx
'use client';

import { useState, useMemo } from 'react';
import { useMediaQuery } from '@mantine/hooks';
import {
  Modal,
  Stack,
  Text,
  TextInput,
  Textarea,
  NumberInput,
  Checkbox,
  Select,
  Button,
  Group,
  Paper,
  Grid,
} from '@mantine/core';
import { FacilityReservation, EventPlace, UserContext, OCMFinalEditData } from './types';

interface OCMFinalEditModalProps {
  opened: boolean;
  onClose: () => void;
  request: FacilityReservation | null;
  currentUser: UserContext | null;
  places?: EventPlace[];
  onConfirm: (data: OCMFinalEditData) => void;
  loading?: boolean;
}

// Helper to format date for input
const formatDateForInput = (dateVal: string | Date): string => {
  if (!dateVal) return '';
  const d = typeof dateVal === 'string' ? new Date(dateVal) : dateVal;
  return d.toISOString().slice(0, 16);
};

// Helper to convert Date to ISO string
const toISOString = (val: string | Date): string => {
  if (!val) return '';
  const d = typeof val === 'string' ? new Date(val) : val;
  return d.toISOString();
};

const toDate = (val: string | Date | undefined): Date => {
  if (!val) return new Date(); // fallback
  return typeof val === 'string' ? new Date(val) : val;
};


export default function OCMFinalEditModal({
  opened,
  onClose,
  request,
  currentUser,
  places = [],
  onConfirm,
  loading = false,
}: OCMFinalEditModalProps) {
  const isMobile = useMediaQuery('(max-width: 768px)');
  // In useMemo:
  const initialValues = useMemo<OCMFinalEditData>(() => {
    if (!request) {
      return {
        eventName: '',
        attendeesCount: 0,
        usageHours: 0,
        withCharge: false,
        requestorNotes: '',
        dates: [],
      };
    }
    return {
      eventName: request.eventName || '',
      attendeesCount: request.attendeesCount || 0,
      usageHours: request.usageHours || 0,
      withCharge: request.withCharge || false,
      requestorNotes: request.requestorNotes || '',
      dates: request.dates?.map((d) => ({
        id: d.id,
        date: toDate(d.date).toISOString(),
        setupTime: toDate(d.setupTime).toISOString(),
        eventStart: toDate(d.eventStart).toISOString(),
        eventEnd: toDate(d.eventEnd).toISOString(),
        teardownTime: toDate(d.teardownTime).toISOString(),
        placeId: d.placeId || '',
        placeOther: d.placeOther || '',
      })) || [],
    };
  }, [request]);

  // Use initialValues directly as state – the component will re-mount when `key` changes in parent
  const [formValues, setFormValues] = useState<OCMFinalEditData>(initialValues);

  // No useEffect needed – state is already set with initial values on mount

  const handleChange = <K extends keyof OCMFinalEditData>(field: K, value: OCMFinalEditData[K]) => {
    setFormValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleDateChange = (index: number, field: string, value: string) => {
    const updatedDates = [...(formValues.dates || [])];
    if (updatedDates[index]) {
      updatedDates[index] = { ...updatedDates[index], [field]: value };
      setFormValues((prev) => ({ ...prev, dates: updatedDates }));
    }
  };

  const handleSubmit = () => {
    onConfirm(formValues);
  };

  return (
    <Modal opened={opened} onClose={onClose} title="OCM Final Edit (Archiving)" size="xl" fullScreen={isMobile} styles={{
      inner: {
        paddingLeft: 'var(--sidebar-offset, 0)',
        transition: 'padding-left 0.25s ease',
      },
    }}>
      <Stack gap="md">
        <Text size="sm" c="dimmed">Edit the details for archiving. No further approval needed.</Text>

        {/* Main fields */}
        <TextInput
          label="Event / Activity Name"
          value={formValues.eventName}
          onChange={(e) => handleChange('eventName', e.currentTarget.value)}
          required
        />
        <NumberInput
          label="Attendees"
          value={formValues.attendeesCount}
          onChange={(val) => handleChange('attendeesCount', typeof val === 'number' ? val : 0)}
        />
        <NumberInput
          label="Usage Hours"
          value={formValues.usageHours}
          onChange={(val) => handleChange('usageHours', typeof val === 'number' ? val : 0)}
        />
        <Checkbox
          label="With Charge"
          checked={formValues.withCharge}
          onChange={(e) => handleChange('withCharge', e.target.checked)}
        />
        <Textarea
          label="Notes"
          value={formValues.requestorNotes}
          onChange={(e) => handleChange('requestorNotes', e.currentTarget.value)}
          minRows={3}
        />

        {/* Date entries */}
        <Paper withBorder p="md" radius="md">
          <Text fw={600} size="sm" mb="sm">Event Dates</Text>
          <Stack gap="sm">
            {(formValues.dates || []).map((dateEntry, index) => (
              <Paper key={dateEntry.id || index} withBorder p="xs" radius="sm" style={{ borderLeft: '3px solid var(--mantine-color-blue-3)' }}>
                <Grid>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label={`Date ${index + 1} (Date)`}
                      type="datetime-local"
                      value={formatDateForInput(dateEntry.date)}
                      onChange={(e) => handleDateChange(index, 'date', e.currentTarget.value)}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Select
                      label="Place"
                      placeholder="Select a place"
                      data={places.map(p => ({ value: p.id, label: p.name }))}
                      value={dateEntry.placeId}
                      onChange={(val) => handleDateChange(index, 'placeId', val || '')}
                      clearable
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label="Other Place"
                      placeholder="Custom place"
                      value={dateEntry.placeOther}
                      onChange={(e) => handleDateChange(index, 'placeOther', e.currentTarget.value)}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label="Starting Time"
                      type="datetime-local"
                      value={formatDateForInput(dateEntry.setupTime)}
                      onChange={(e) => handleDateChange(index, 'setupTime', e.currentTarget.value)}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label="Event Start"
                      type="datetime-local"
                      value={formatDateForInput(dateEntry.eventStart)}
                      onChange={(e) => handleDateChange(index, 'eventStart', e.currentTarget.value)}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label="Event End"
                      type="datetime-local"
                      value={formatDateForInput(dateEntry.eventEnd)}
                      onChange={(e) => handleDateChange(index, 'eventEnd', e.currentTarget.value)}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label="Actual Time End"
                      type="datetime-local"
                      value={formatDateForInput(dateEntry.teardownTime)}
                      onChange={(e) => handleDateChange(index, 'teardownTime', e.currentTarget.value)}
                    />
                  </Grid.Col>
                </Grid>
              </Paper>
            ))}
          </Stack>
        </Paper>

        <Group justify="flex-end">
          <Button variant="light" onClick={onClose}>Cancel</Button>
          <Button color="blue" loading={loading} onClick={handleSubmit}>Save Final Version</Button>
        </Group>
      </Stack>
    </Modal>
  );
}