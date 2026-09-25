// app/dashboard/forms/frf/components/RequestStepper.tsx
'use client';

import { useState, useEffect, useRef, JSX, useMemo, useCallback } from 'react';
import {
  Modal,
  Stepper,
  Button,
  Group,
  Stack,
  Radio,
  TextInput,
  NumberInput,
  Checkbox,
  Select,
  Textarea,
  FileInput,
  Alert,
  Text,
  Grid,
  Paper,
  SimpleGrid,
  Divider,
  Badge,
  Box,
  Card,
  ActionIcon,
  ScrollArea,
  PasswordInput,
  ThemeIcon
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { FRFFormValues, Equipment, EventPlace, ReservationType, UserContext, DateEntry, FacilityReservation, isActiveHeadOrOIC } from './types';
import {
  IconInfoCircle,
  IconCheck,
  IconCalendarEvent,
  IconDeviceFloppy,
  IconClock,
  IconPlus,
  IconTrash,
  IconLock,
  IconPhoto,
  IconFileTypePdf,
  IconFile,
  IconAlertCircle
} from '@tabler/icons-react';
import { DatePicker, TimeInput } from '@mantine/dates';

// Helper to generate temporary ID
const generateId = (): string => Math.random().toString(36).substring(2, 9);

// Helpers for date formatting
const formatDateStr = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatTimeString = (date: Date): string => {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

const formatDateOnly = (dateVal: string | Date): string => {
  if (!dateVal) return 'N/A';
  const d = typeof dateVal === 'string' ? new Date(dateVal) : dateVal;
  return d.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

// Create a default date entry (with optional minDate)
const createDateEntry = (minDate?: Date): DateEntry => {
  const now = new Date();
  const today = minDate ? new Date(minDate) : new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const setup = new Date(today);
  setup.setHours(6, 0, 0, 0);
  const start = new Date(today);
  start.setHours(8, 0, 0, 0);
  const end = new Date(today);
  end.setHours(17, 0, 0, 0);
  const teardown = new Date(today);
  teardown.setHours(19, 0, 0, 0);

  return {
    id: generateId(),
    date: today,
    dateStr: formatDateStr(today),
    setupTime: setup,
    eventStart: start,
    eventEnd: end,
    teardownTime: teardown,
    setupTimeStr: '06:00',
    eventStartStr: '08:00',
    eventEndStr: '17:00',
    teardownTimeStr: '19:00',
    placeId: undefined,
    placeOther: '',
  };
};

interface RequestStepperProps {
  opened: boolean;
  onClose: () => void;
  places: EventPlace[];
  equipment: Equipment[];
  currentUser: UserContext | null;
  onSuccess: () => void;
  editData?: FacilityReservation | null;
  isEditing?: boolean;
  onResubmit?: (
    id: string,
    values: FRFFormValues,
    password: string,
    attachmentsToKeep: string[]
  ) => void;
  isRescheduleMode?: boolean;
  onReschedule?: (
    id: string,
    data: {
      dates: DateEntry[];
      reason: string;
      type?: ReservationType;
      eventName?: string;
      attendeesCount?: number;
      equipmentRequests?: { equipmentId: string; quantity: number }[];
      withCharge?: boolean;
      requestorNotes?: string;
    },
    password: string
  ) => void;
}

export default function RequestStepper({
  opened,
  onClose,
  places,
  equipment,
  currentUser,
  onSuccess,
  editData,
  isEditing = false,
  onResubmit,
  isRescheduleMode = false,
  onReschedule
}: RequestStepperProps) {
  const isHeadOrOIC = isActiveHeadOrOIC(currentUser);

  const [activeStep, setActiveStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [schedulingError, setSchedulingError] = useState<string | null>(null);
  const [settings, setSettings] = useState<{
    minAdvanceDaysRegular: number;
    minAdvanceDaysVIP: number;
    minRescheduleDays: number;
  }>({
    minAdvanceDaysRegular: 7,
    minAdvanceDaysVIP: 1,
    minRescheduleDays: 3,
  });
  const [minDatePreset, setMinDatePreset] = useState<'tomorrow' | 'sevenDays'>('sevenDays');

  const [hoveredAttachment, setHoveredAttachment] = useState<number | null>(null);
  const autoCheckedPlacesRef = useRef<Set<string>>(new Set());

  // --- Min date logic (moved up before useMemo) ---
  const getMinDate = useCallback((): Date => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // 🆕 Reschedule mode: earliest allowed = today + minRescheduleDays
    if (isRescheduleMode) {
      const minDate = new Date(today);
      minDate.setDate(today.getDate() + settings.minRescheduleDays);
      return minDate;
    }

    const daysToAdd = minDatePreset === 'tomorrow'
      ? settings.minAdvanceDaysVIP
      : settings.minAdvanceDaysRegular;

    const minDate = new Date(today);
    minDate.setDate(today.getDate() + daysToAdd);
    return minDate;
  }, [settings, minDatePreset, isRescheduleMode]);

  // --- Compute initial values based on props ---
  const getInitialFormValues = useMemo((): FRFFormValues => {
    if ((isEditing || isRescheduleMode) && editData) {
      const dateEntries: DateEntry[] = editData.dates.map((d) => {
        const dateObj = new Date(d.date);
        const setupTime = new Date(d.setupTime);
        const eventStart = new Date(d.eventStart);
        const eventEnd = new Date(d.eventEnd);
        const teardownTime = new Date(d.teardownTime);

        return {
          id: generateId(),
          date: dateObj,
          dateStr: formatDateStr(dateObj),
          setupTime,
          eventStart,
          eventEnd,
          teardownTime,
          setupTimeStr: formatTimeString(setupTime),
          eventStartStr: formatTimeString(eventStart),
          eventEndStr: formatTimeString(eventEnd),
          teardownTimeStr: formatTimeString(teardownTime),
          placeId: d.placeId || undefined,
          placeOther: d.placeOther || '',
        };
      });

      return {
        type: editData.type,
        eventName: editData.eventName || '',
        dates: dateEntries,
        attendeesCount: editData.attendeesCount,
        usageHours: editData.usageHours || undefined,
        withCharge: editData.withCharge || false,
        equipmentRequests: editData.equipmentRequests.map((eq) => ({
          equipmentId: eq.equipmentId,
          quantity: eq.quantityRequested,
        })),
        requestorNotes: editData.requestorNotes || '',
        attachments: [],
        isVenueOnly: editData.isVenueOnly || false
      };
    }

    // New reservation: use min date for the first entry
    const minDate = getMinDate();
    const initialEntry = createDateEntry(minDate);

    return {
      eventName: '',
      type: 'EMPLOYEE_ONLY' as ReservationType,
      dates: [initialEntry],
      attendeesCount: 1,
      usageHours: undefined,
      withCharge: false,
      equipmentRequests: [],
      attachments: [],
      requestorNotes: '',
      isVenueOnly: false
    };
  }, [isEditing, isRescheduleMode, editData, getMinDate]);

  // --- Initial attachments to keep ---
  const initialAttachmentsToKeep = useMemo(() => {
    return (isEditing || isRescheduleMode) && editData ? editData.attachments || [] : [];
  }, [isEditing, isRescheduleMode, editData]);

  // --- State for attachments to keep (user can modify) ---
  const [attachmentsToKeep, setAttachmentsToKeep] = useState<string[]>(initialAttachmentsToKeep);

  // Store original values for change detection (reschedule)
  const originalValuesRef = useRef<FRFFormValues | null>(null);

  // Use useEffect for side effects like fetching settings
  useEffect(() => {
    if (opened) {
      fetch('/api/frf/settings')
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setSettings(data.data);
          }
        })
        .catch(console.error);

      // 🆕 Reset auto-check tracking on modal open
      autoCheckedPlacesRef.current = new Set();
    }
  }, [opened]);

  // --- Form hook ---
  const form = useForm<FRFFormValues>({
    initialValues: getInitialFormValues,
    validate: {
      dates: (value) => {
        if (!value || value.length === 0) {
          return 'At least one date is required';
        }
        for (const entry of value) {
          if (!entry.date || !entry.setupTime || !entry.eventStart || !entry.eventEnd || !entry.teardownTime) {
            return 'All date fields are required';
          }
          const setupMs = entry.setupTime.getTime();
          const startMs = entry.eventStart.getTime();
          if (setupMs + 3600000 > startMs) {
            return 'Starting time must be at least 1 hour before Actual Time Start';
          }
          if (entry.eventEnd.getTime() > entry.teardownTime.getTime()) {
            return 'Time End must be before or equal to Actual Time End';
          }
          const hasVenue = !!entry.placeId || (!!entry.placeOther && entry.placeOther.trim() !== '');
          if (!hasVenue) {
            return 'Please select or specify a venue for every date';
          }
        }
        return null;
      },
      eventName: (value) => (!value || value.trim() === '' ? 'Event name is required' : null),
      attendeesCount: (value, values) => {
        if (value < 0) return 'Number of attendees cannot be negative';
        // Check if any date uses "Multi-Purpose Hall 2/F"
        const hasMpHall = values.dates.some(d => {
          const place = places.find(p => p.id === d.placeId);
          const name = place?.name || d.placeOther || '';
          return name.trim() === 'Multi-Purpose Hall 2/F';
        });
        if (hasMpHall && value > 200) {
          return 'Multi-Purpose Hall 2/F has a maximum capacity of 200 attendees.';
        }
        return null;
      },
      requestorNotes: (value) =>
        !value || value.trim() === '' ? 'Requestor Notes are required' : null,
      attachments: (value) => {
        if (isRescheduleMode) {
          return null;
        }
        const totalAttachments = attachmentsToKeep.length + (value?.length || 0);
        if (totalAttachments === 0) {
          return 'Please upload at least one attachment or keep an existing file.';
        }
        return null;
      },
    }
  });

  // --- Helper to detect changes ---
  const hasChanges = useCallback((): boolean => {
    if (!originalValuesRef.current) return false;
    const current = form.values;
    const original = originalValuesRef.current;

    // Compare simple fields
    if (current.type !== original.type) return true;
    if (current.eventName !== original.eventName) return true;
    if (current.attendeesCount !== original.attendeesCount) return true;
    if (current.usageHours !== original.usageHours) return true;
    if (current.withCharge !== original.withCharge) return true;
    if (current.requestorNotes !== original.requestorNotes) return true;
    if (current.isVenueOnly !== original.isVenueOnly) return true;

    // Compare equipment requests
    if (current.equipmentRequests.length !== original.equipmentRequests.length) return true;
    for (let i = 0; i < current.equipmentRequests.length; i++) {
      const a = current.equipmentRequests[i];
      const b = original.equipmentRequests[i];
      if (a.equipmentId !== b.equipmentId || a.quantity !== b.quantity) return true;
    }

    // Helper to safely convert to ISO string
    const toISO = (val: Date | string | null | undefined): string => {
      if (!val) return '';
      if (val instanceof Date) return val.toISOString();
      if (typeof val === 'string') {
        const d = new Date(val);
        return isNaN(d.getTime()) ? '' : d.toISOString();
      }
      return '';
    };

    // Compare dates
    if (current.dates.length !== original.dates.length) return true;
    for (let i = 0; i < current.dates.length; i++) {
      const a = current.dates[i];
      const b = original.dates[i];

      if (toISO(a.date) !== toISO(b.date)) return true;
      if (toISO(a.setupTime) !== toISO(b.setupTime)) return true;
      if (toISO(a.eventStart) !== toISO(b.eventStart)) return true;
      if (toISO(a.eventEnd) !== toISO(b.eventEnd)) return true;
      if (toISO(a.teardownTime) !== toISO(b.teardownTime)) return true;
      if ((a.placeId || '') !== (b.placeId || '')) return true;
      if ((a.placeOther || '') !== (b.placeOther || '')) return true;
    }

    return false;
  }, [form.values]);

  // --- Handlers ---
  const addDateEntry = () => {
    const minDate = getMinDate();
    form.setFieldValue('dates', [...form.values.dates, createDateEntry(minDate)]);
  };

  const removeDateEntry = (id: string) => {
    if (form.values.dates.length <= 1) return;
    form.setFieldValue(
      'dates',
      form.values.dates.filter((d) => d.id !== id)
    );
  };

  const updateDateEntry = (id: string, field: keyof DateEntry, value: Date) => {
    const updated = form.values.dates.map((entry) => {
      if (entry.id !== id) return entry;

      const setupTime = entry.setupTime || new Date();
      const eventStart = entry.eventStart || new Date();
      const eventEnd = entry.eventEnd || new Date();
      const teardownTime = entry.teardownTime || new Date();

      const setupHours = setupTime.getHours();
      const setupMinutes = setupTime.getMinutes();
      const startHours = eventStart.getHours();
      const startMinutes = eventStart.getMinutes();
      const endHours = eventEnd.getHours();
      const endMinutes = eventEnd.getMinutes();
      const teardownHours = teardownTime.getHours();
      const teardownMinutes = teardownTime.getMinutes();

      const newSetupTime = new Date(value);
      newSetupTime.setHours(setupHours, setupMinutes, 0, 0);
      const newEventStart = new Date(value);
      newEventStart.setHours(startHours, startMinutes, 0, 0);
      const newEventEnd = new Date(value);
      newEventEnd.setHours(endHours, endMinutes, 0, 0);
      const newTeardownTime = new Date(value);
      newTeardownTime.setHours(teardownHours, teardownMinutes, 0, 0);

      return {
        ...entry,
        date: value,
        dateStr: formatDateStr(value),
        setupTime: newSetupTime,
        eventStart: newEventStart,
        eventEnd: newEventEnd,
        teardownTime: newTeardownTime,
        setupTimeStr: formatTimeString(newSetupTime),
        eventStartStr: formatTimeString(newEventStart),
        eventEndStr: formatTimeString(newEventEnd),
        teardownTimeStr: formatTimeString(newTeardownTime),
      };
    });

    form.setFieldValue('dates', updated);
  };

  const updateDateEntryTime = (id: string, field: keyof DateEntry, timeStr: string) => {
    const updated = form.values.dates.map((entry) => {
      if (entry.id !== id) return entry;

      const currentDate = entry.date || new Date();
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const day = currentDate.getDate();

      const [hours, minutes] = timeStr.split(':').map(Number);
      const newDate = new Date(year, month, day, hours || 0, minutes || 0);

      const fieldMap: Record<string, keyof DateEntry> = {
        'setupTime': 'setupTime',
        'eventStart': 'eventStart',
        'eventEnd': 'eventEnd',
        'teardownTime': 'teardownTime',
      };

      const dateField = fieldMap[field as string];
      if (!dateField) return entry;

      return {
        ...entry,
        [dateField]: newDate,
        [`${field}Str` as keyof DateEntry]: timeStr,
      };
    });

    form.setFieldValue('dates', updated);
  };

  const handleQuantityChange = (equipmentId: string, value: number | string) => {
    const numValue = typeof value === 'string' ? parseInt(value, 10) : value;
    if (isNaN(numValue) || numValue < 1) return;
    const updated = form.values.equipmentRequests.map((req) =>
      req.equipmentId === equipmentId ? { ...req, quantity: numValue } : req
    );
    form.setFieldValue('equipmentRequests', updated);
  };

  const checkSchedulingConflicts = async (dates: DateEntry[]): Promise<string | null> => {
    try {
      const res = await fetch('/api/frf/check_schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dates: dates.map(d => d.date.toISOString()),
          venueIds: dates.map(d => d.placeId).filter(Boolean),
          excludeId: editData?.id,
        }),
      });

      const result = await res.json();
      if (!result.success) {
        return result.message || 'Scheduling conflict detected.';
      }
      return null;
    } catch (err) {
      console.error('Error checking schedule:', err);
      return 'Unable to check schedule availability. Please try again.';
    }
  };

  const nextStep = async () => {
    let hasError = false;

    if (activeStep === 0) {
      const eventNameResult = form.validateField('eventName');
      if (eventNameResult.hasError) hasError = true;
      const datesResult = form.validateField('dates');
      if (datesResult.hasError) hasError = true;
      const attendeesResult = form.validateField('attendeesCount');
      if (attendeesResult.hasError) hasError = true;

      const conflictError = await checkSchedulingConflicts(form.values.dates);
      if (conflictError) {
        setSchedulingError(conflictError);
        return;
      }

      if (hasError) return;
      setActiveStep((prev) => prev + 1);

    } else if (activeStep === 1) {
      if (form.values.equipmentRequests.length === 0) {
        const confirm = window.confirm(
          'No equipment has been selected for this reservation.\n\nAre you sure you want to proceed without any equipment?'
        );
        if (!confirm) return;
      }
      setActiveStep((prev) => prev + 1);
    } else if (activeStep === 2) {
      const notesResult = form.validateField('requestorNotes');
      if (notesResult.hasError) hasError = true;
      const attachmentsResult = form.validateField('attachments');
      if (attachmentsResult.hasError) hasError = true;

      if (hasError) return;

      if (isEditing && attachmentsToKeep.length > 0 && form.values.attachments.length === 0) {
        const confirm = window.confirm(
          'You have existing attachments and did not upload any new files.\n\nAre you sure you want to proceed without adding new documents?'
        );
        if (!confirm) return;
      }

      setActiveStep((prev) => prev + 1);
    } else {
      setActiveStep((prev) => prev + 1);
    }
  };

  const prevStep = () => setActiveStep((prev) => prev - 1);

  // ---- Attachment helpers ----
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileMeta = (file: File): { icon: JSX.Element; color: string } => {
    if (file.type.startsWith('image/')) return { icon: <IconPhoto size={18} />, color: 'grape' };
    if (file.type === 'application/pdf') return { icon: <IconFileTypePdf size={18} />, color: 'red' };
    return { icon: <IconFile size={18} />, color: 'gray' };
  };

  const removeAttachment = (index: number) => {
    form.setFieldValue(
      'attachments',
      form.values.attachments.filter((_, i) => i !== index)
    );
  };

  const handleSubmit = useCallback(async (values: FRFFormValues) => {
    // ----- RESCHEDULE MODE -----
    if (isRescheduleMode && editData && onReschedule) {
      if (!password) {
        setPasswordError('Password is required to request reschedule.');
        alert('❌ Please enter your password to confirm the reschedule.');
        return;
      }
      if (!rescheduleReason.trim()) {
        setPasswordError('Please provide a reason for reschedule.');
        alert('❌ Please provide a reason for the reschedule.');
        return;
      }
      if (!hasChanges()) {
        setPasswordError('No changes detected. Please modify at least one field before rescheduling.');
        alert('❌ No changes detected. Please modify at least one field before rescheduling.');
        return;
      }
      if (values.dates.length === 0) {
        alert('❌ At least one new date is required.');
        return;
      }

      // 🆕 Enforce minimum reschedule days
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const minAllowedDate = new Date(today);
      minAllowedDate.setDate(today.getDate() + settings.minRescheduleDays);

      const earliestNewDate = values.dates.reduce((earliest, entry) => {
        const d = new Date(entry.date);
        d.setHours(0, 0, 0, 0);
        return d < earliest ? d : earliest;
      }, new Date(8640000000000000));

      if (earliestNewDate < minAllowedDate) {
        setPasswordError(
          `Reschedule date must be at least ${settings.minRescheduleDays} day(s) from today.`
        );
        alert(
          `❌ Reschedule date must be at least ${settings.minRescheduleDays} day(s) from today (earliest allowed: ${minAllowedDate.toLocaleDateString()}).`
        );
        return;
      }

      setSubmitting(true);
      try {
        await onReschedule(editData.id, {
          dates: values.dates,
          reason: rescheduleReason,
          type: values.type,
          eventName: values.eventName,
          attendeesCount: values.attendeesCount,
          equipmentRequests: values.equipmentRequests,
          withCharge: values.withCharge,
          requestorNotes: values.requestorNotes
        }, password);
        onClose();
      } catch (err) {
        console.error('Reschedule error:', err);
        alert('❌ An error occurred while submitting the reschedule. Please try again.');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // ----- RESUBMIT (EDIT) MODE -----
    if (isEditing && editData && onResubmit) {
      if (!password) {
        setPasswordError('Password is required to resubmit revision.');
        alert('❌ Please enter your password to confirm the resubmission.');
        return;
      }
      setSubmitting(true);
      try {
        await onResubmit(editData.id, values, password, attachmentsToKeep);
        onClose();
      } catch (err) {
        console.error('Resubmit error:', err);
        alert('❌ An error occurred while resubmitting. Please try again.');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // ----- NORMAL SUBMIT (NEW RESERVATION) -----
    if (!password) {
      setPasswordError('Password is required to create a reservation.');
      return;
    }

    setSubmitting(true);
    setPasswordError('');
    try {
      const formData = new FormData();

      const datesForSubmission = values.dates.map((entry) => ({
        date: entry.date.toISOString(),
        setupTime: entry.setupTime.toISOString(),
        eventStart: entry.eventStart.toISOString(),
        eventEnd: entry.eventEnd.toISOString(),
        teardownTime: entry.teardownTime.toISOString(),
        placeId: entry.placeId,
        placeOther: entry.placeOther,
      }));

      // Basic fields
      formData.append('type', values.type);
      formData.append('isVenueOnly', String(values.isVenueOnly || false));
      if (values.eventName) formData.append('eventName', values.eventName);
      formData.append('attendeesCount', String(values.attendeesCount));
      if (values.usageHours) formData.append('usageHours', String(values.usageHours));
      formData.append('withCharge', String(values.withCharge));
      if (values.requestorNotes) formData.append('requestorNotes', values.requestorNotes);
      formData.append('password', password);

      // Equipment
      formData.append('equipmentItems', JSON.stringify(values.equipmentRequests));

      // Attachments
      for (const file of values.attachments) {
        if (file) formData.append('attachments', file);
      }

      if (values.dates.length === 0) {
        alert('At least one date is required.');
        setSubmitting(false);
        return;
      }
      formData.append('dates', JSON.stringify(datesForSubmission));

      const res = await fetch('/api/frf/reservation', {
        method: 'POST',
        body: formData,
      });

      const result = await res.json();
      if (res.ok) {
        alert('Reservation created successfully!');
        onSuccess();
        onClose();
      } else {
        if (result.message && result.message.toLowerCase().includes('password')) {
          setPasswordError(result.message);
        } else {
          alert(result.message || 'Failed to create reservation');
        }
      }
    } catch (err) {
      console.error(err);
      alert('An error occurred');
    } finally {
      setSubmitting(false);
    }
    }, [isRescheduleMode, editData, onReschedule, isEditing, onResubmit, password, rescheduleReason, hasChanges, attachmentsToKeep, onSuccess, onClose, settings.minRescheduleDays]);


    const selectedPlaceIds = useMemo(
      () => form.values.dates.map(d => d.placeId).filter(Boolean) as string[],
      [form.values.dates]
    );

    const relevantEquipment = useMemo(() => {
      if (selectedPlaceIds.length === 0) return equipment;

      const selectedBranches = [
        ...new Set(
          selectedPlaceIds
            .map(id => places.find(p => p.id === id)?.branch)
            .filter(Boolean) as string[]
        ),
      ];

      return equipment.filter(e => {
        if (!e.branch) return true;
        if (!selectedBranches.includes(e.branch)) return false;
        if (!e.places || e.places.length === 0) return true;
        return e.places.some(ep => selectedPlaceIds.includes(ep.placeId));
      });
    }, [equipment, selectedPlaceIds, places]);

    const isEquipmentBundled = useCallback((e: Equipment): boolean => {
      if (!e.places) return false;
      return e.places.some(
        ep => ep.isBundled && selectedPlaceIds.includes(ep.placeId)
      );
    }, [selectedPlaceIds]);

    // 🆕 List of bundled items currently in scope
    const bundledInScope = useMemo(
      () => relevantEquipment.filter(e => isEquipmentBundled(e)),
      [relevantEquipment, isEquipmentBundled]
    );

    useEffect(() => {
      if (!opened) return;
      if (selectedPlaceIds.length === 0) return;
      if (equipment.length === 0) return;

      const idsToAdd: string[] = [];

      selectedPlaceIds.forEach(placeId => {
        // Skip if we already auto-checked for this venue in this session
        if (autoCheckedPlacesRef.current.has(placeId)) return;

        // Find bundled equipment for this venue
        const bundled = equipment.filter(e =>
          e.places?.some(ep => ep.placeId === placeId && ep.isBundled)
        );

        bundled.forEach(e => {
          const alreadySelected = form.values.equipmentRequests.some(
            r => r.equipmentId === e.id
          );
          if (!alreadySelected) {
            idsToAdd.push(e.id);
          }
        });

        autoCheckedPlacesRef.current.add(placeId);
      });

      if (idsToAdd.length > 0) {
        form.setFieldValue('equipmentRequests', [
          ...form.values.equipmentRequests,
          ...idsToAdd.map(id => ({ equipmentId: id, quantity: 1 })),
        ]);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [opened, selectedPlaceIds, equipment]);
  // Determine modal title
  const modalTitle = isRescheduleMode
    ? 'Request Reschedule'
    : isEditing
    ? 'Edit Reservation'
    : 'New Facility Reservation';

  // --- Local close handler to reset internal state ---
  const handleLocalClose = () => {
    setPassword('');
    setPasswordError('');
    setRescheduleReason('');
    setSchedulingError(null);
    setActiveStep(0);
    // Reset original values ref but let the form keep its values until reopened
    originalValuesRef.current = null;
    onClose();
  };

  // Store original values for reschedule change detection (no state setters)
  useEffect(() => {
    if (opened && isRescheduleMode && editData) {
      const initial = getInitialFormValues;
      originalValuesRef.current = JSON.parse(JSON.stringify(initial));
    }
  }, [opened, isRescheduleMode, editData, getInitialFormValues]);

  return (
    <Modal
      opened={opened}
      onClose={handleLocalClose}
      size="90%"
      title={
        <Group gap="xs">
          <IconCalendarEvent size={20} />
          <Text fw={700} size="xl">
            {modalTitle}
          </Text>
        </Group>
      }
      zIndex={200}
      padding="lg"
      radius="md"
      closeOnClickOutside={false}
    >
      <form onSubmit={(e) => {
        e.preventDefault();

        const validationResult = form.validate();
        //console.log('Validation result:', validationResult);

        if (validationResult.hasErrors) {
          const firstErrorKey = Object.keys(validationResult.errors)[0];
          const firstError = validationResult.errors[firstErrorKey];
          alert(`❌ ${firstError}`);
          return;
        }

        handleSubmit(form.values);
      }}>
        <Stepper
          active={activeStep}
          onStepClick={setActiveStep}
          allowNextStepsSelect={false}
          color="blue"
          size="md"
          mb="xl"
        >
          <Stepper.Step
            label="Basic Info"
            description="Type, dates, place"
            icon={<IconInfoCircle size={18} />}
          />
          <Stepper.Step
            label="Equipment"
            description="Select needed equipment"
            icon={<IconDeviceFloppy size={18} />}
          />
          <Stepper.Step
            label="Attachments & Notes"
            description="Upload documents"
            icon={<IconClock size={18} />}
          />
          <Stepper.Step
            label="Review"
            description="Confirm details"
            icon={<IconCheck size={18} />}
          />
        </Stepper>

        {/* Step 1: Basic Info */}
        {activeStep === 0 && (
          <Box p="md">
            <Alert icon={<IconInfoCircle size={16} />} color="blue" radius="md" mb="lg">
              Fill up the event type, dates, place, and other basic information. Ensure that the starting time is at least one (1) hour before the actual event start time.
              <br></br><br></br>
              <i>Sagutan kung anong uri ng reservation ang magaganap. Isama ang mga detalye ng petsa, lugar, at iba pang impormasyon. Siguraduhing ang starting time ay hindi bababa sa isang (1) oras bago ang actual event start.</i>
            </Alert>
            <Grid gap="md">
              <Grid.Col span={12}>
                <Checkbox
                  label="Venue Only (No ITO Staff Needed)"
                  description="Check this if the event only requires the venue and no ITO technical support."
                  {...form.getInputProps('isVenueOnly')}
                  size="sm"
                />
              </Grid.Col>
              <Grid.Col span={12}>
                <Radio.Group
                  label="Reservation Type"
                  value={form.values.type}
                  onChange={(val) => {
                    form.setFieldValue('type', val as ReservationType);
                  }}
                  required
                  size="sm"
                >
                  <Group mt="xs">
                    <Radio value="EMPLOYEE_ONLY" label="Employee Only" />
                    <Radio value="WITH_STUDENTS" label="With Students" />
                  </Group>
                </Radio.Group>
              </Grid.Col>
              <Grid.Col span={12}>
                <TextInput
                  label="Event / Activity Name"
                  placeholder="e.g., Christmas Party, Seminar, etc."
                  {...form.getInputProps('eventName')}
                  required
                  size="sm"
                />
              </Grid.Col>
              {isHeadOrOIC && (currentUser?.departmentCode === 'ITO-MAIN' || currentUser?.departmentCode === 'PSMO/FMO') && (
                <Grid.Col span={12}>
                  <Radio.Group
                    label="Event Priority Level"
                    value={minDatePreset}
                    onChange={(val) => setMinDatePreset(val as typeof minDatePreset)}
                    size="sm"
                  >
                    <Group mt="xs" gap="sm">
                      <Radio value="tomorrow" label="(VIP - ITO/PSMO/FMO ONLY) Tomorrow (1 day)"/>
                      <Radio value="sevenDays" label="REGULAR" />
                    </Group>
                  </Radio.Group>
                </Grid.Col>
              )}
              <Grid.Col span={12}>
                <Text fw={600} size="sm" mb="xs">
                  Event Dates & Times
                </Text>
                {isRescheduleMode && (
                  <>
                    <Divider label="Original Dates" labelPosition="center" />
                    <Stack gap="xs" mb="md">
                      {editData?.dates?.map((d, i) => (
                        <Paper key={i} withBorder p="xs" radius="sm" bg="var(--mantine-color-gray-0)">
                          <Text size="sm">
                            {new Date(d.eventStart).toLocaleString()} – {new Date(d.eventEnd).toLocaleString()}
                          </Text>
                          <Text size="xs" c="dimmed">Place: {d.place?.name || d.placeOther || 'TBA'}</Text>
                        </Paper>
                      ))}
                    </Stack>
                    <Divider label="New Dates" labelPosition="center" />
                    {isRescheduleMode && (
                      <Alert icon={<IconInfoCircle size={16} />} color="yellow" mb="md">
                        New dates must be at least <b>{settings.minRescheduleDays} day(s)</b> from today. The
                        earliest date you can pick is{' '}
                        <b>{getMinDate().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</b>.
                      </Alert>
                    )}
                  </>
                )}
                <ScrollArea h={400} type="auto" offsetScrollbars>
                  <Stack gap="sm">
                    {form.values.dates.map((entry, index) => (
                      <Paper
                        key={entry.id}
                        withBorder
                        p="xl"
                        radius="md"
                        bg="light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-7))"
                        style={{ position: 'relative', overflow: 'hidden' }}
                      >
                        {/* Header */}
                        <Group justify="space-between" mb="xs">
                          <Group gap="xs">
                            <Badge color="blue" variant="filled" size="sm">
                              Date #{index + 1}
                            </Badge>
                            {entry.date && (
                              <Text size="11px" c="dimmed" fw={700}>
                                {entry.date.toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })}
                              </Text>
                            )}
                          </Group>
                          {form.values.dates.length > 1 && (
                            <ActionIcon color="red" size="sm" onClick={() => removeDateEntry(entry.id)}>
                              <IconTrash size={14} />
                            </ActionIcon>
                          )}
                          {schedulingError && (
                            <Alert color="red" icon={<IconAlertCircle size={16} />} mt="xs">
                              {schedulingError}
                            </Alert>
                          )}
                        </Group>
                        <Grid gap="md" align="flex-start">
                          {/* === COLUMN 1: Date Picker (centered) === */}
                          <Grid.Col
                            span={{ base: 12, sm: 3 }}
                            display="flex"
                            align-items="center"
                            style={{ minHeight: '40px' }}
                          >
                            <DatePicker
                              value={entry.dateStr}
                              onChange={(val: string | null) => {
                                if (val) {
                                  const date = new Date(val);
                                  if (!isNaN(date.getTime())) {
                                    updateDateEntry(entry.id, 'date', date);
                                  }
                                }
                              }}
                              minDate={getMinDate()}
                              size="xs"
                              style={{ width: '100%' }}
                            />
                          </Grid.Col>

                          {/* === COLUMN 2: Time Inputs + Venue === */}
                          <Grid.Col span={{ base: 12, sm: 9 }}>
                            <Stack gap="xs">
                              {/* Row 1: Setup + Event Start */}
                              <SimpleGrid cols={{ base: 2, sm: 2 }} spacing="sm">
                                <div>
                                  <Text size="sm" fw={600} c="dimmed" mb={2}>
                                    Setup
                                  </Text>
                                  <TimeInput
                                    value={entry.setupTimeStr}
                                    onChange={(e) => {
                                      const time = e.currentTarget.value;
                                      updateDateEntryTime(entry.id, 'setupTime', time);
                                    }}
                                    size="sm"
                                    required
                                    styles={(theme) => ({
                                      input: {
                                        fontSize: '14px',
                                        padding: '4px 8px',
                                        height: '32px',
                                      },
                                    })}
                                  />
                                </div>
                                <div>
                                  <Text size="sm" fw={600} c="dimmed" mb={2}>
                                    Start
                                  </Text>
                                  <TimeInput
                                    value={entry.eventStartStr}
                                    onChange={(e) => {
                                      const time = e.currentTarget.value;
                                      updateDateEntryTime(entry.id, 'eventStart', time);
                                    }}
                                    size="sm"
                                    required
                                    styles={(theme) => ({
                                      input: {
                                        fontSize: '14px',
                                        padding: '4px 8px',
                                        height: '32px',
                                      },
                                    })}
                                  />
                                </div>
                              </SimpleGrid>

                              {/* Row 2: Event End + Teardown */}
                              <SimpleGrid cols={{ base: 2, sm: 2 }} spacing="sm">
                                <div>
                                  <Text size="sm" fw={600} c="dimmed" mb={2}>
                                    End
                                  </Text>
                                  <TimeInput
                                    value={entry.eventEndStr}
                                    onChange={(e) => {
                                      const time = e.currentTarget.value;
                                      updateDateEntryTime(entry.id, 'eventEnd', time);
                                    }}
                                    size="sm"
                                    required
                                    styles={(theme) => ({
                                      input: {
                                        fontSize: '14px',
                                        padding: '4px 8px',
                                        height: '32px',
                                      },
                                    })}
                                  />
                                </div>
                                <div>
                                  <Text size="sm" fw={600} c="dimmed" mb={2}>
                                    Teardown
                                  </Text>
                                  <TimeInput
                                    value={entry.teardownTimeStr}
                                    onChange={(e) => {
                                      const time = e.currentTarget.value;
                                      updateDateEntryTime(entry.id, 'teardownTime', time);
                                    }}
                                    size="sm"
                                    required
                                    styles={(theme) => ({
                                      input: {
                                        fontSize: '14px',
                                        padding: '4px 8px',
                                        height: '32px',
                                      },
                                    })}
                                  />
                                </div>
                              </SimpleGrid>

                              {/* Row 3: Venue + Other Venue */}
                              <SimpleGrid cols={{ base: 2, sm: 2 }} spacing="sm">
                                <div>
                                  <Text size="sm" fw={600} c="dimmed" mb={2}>
                                    Venue
                                  </Text>
                                  <Select
                                    placeholder="Select venue"
                                    data={places.map((p) => ({ value: p.id, label: p.name }))}
                                    value={entry.placeId}
                                    onChange={(val) => {
                                      const updated = form.values.dates.map((e) =>
                                        e.id === entry.id ? { ...e, placeId: val ?? undefined, placeOther: '' } : e
                                      );
                                      form.setFieldValue('dates', updated);
                                    }}
                                    clearable
                                    size="sm"
                                    searchable
                                    nothingFoundMessage="No venue found"
                                    styles={(theme) => ({
                                      input: { fontSize: '14px', padding: '4px 8px', height: '32px' },
                                    })}
                                  />
                                </div>
                                <div>
                                  <Text size="sm" fw={600} c="dimmed" mb={2}>
                                    Other Venue
                                  </Text>
                                  <TextInput
                                    placeholder="Custom venue"
                                    value={entry.placeOther}
                                    onChange={(e) => {
                                      const updated = form.values.dates.map((dateEntry) =>
                                        dateEntry.id === entry.id
                                          ? { ...dateEntry, placeOther: e.currentTarget.value, placeId: undefined }
                                          : dateEntry
                                      );
                                      form.setFieldValue('dates', updated);
                                    }}
                                    size="sm"
                                    styles={(theme) => ({
                                      input: { fontSize: '14px', padding: '4px 8px', height: '32px' },
                                    })}
                                  />
                                </div>
                              </SimpleGrid>
                            </Stack>
                          </Grid.Col>
                        </Grid>
                      </Paper>
                    ))}
                  </Stack>
                </ScrollArea>

                <Button
                  variant="dashed"
                  color="blue"
                  fullWidth
                  mt="sm"
                  onClick={addDateEntry}
                  leftSection={<IconPlus size={14} />}
                  size="xs"
                  style={{ borderStyle: 'dashed', borderWidth: '2px' }}
                >
                  Add Another Date
                </Button>

                {form.errors.dates && (
                  <Text c="red" size="xs" mt="xs">
                    {form.errors.dates}
                  </Text>
                )}
              </Grid.Col>

              <Grid.Col span={6}>
                <NumberInput
                  label="Attendees Count"
                  min={1}
                  {...form.getInputProps('attendeesCount')}
                  required
                  size="sm"
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <NumberInput
                  label="Usage Hours (electricity/lighting)"
                  min={0}
                  step={0.5}
                  {...form.getInputProps('usageHours')}
                  size="sm"
                />
              </Grid.Col>
              <Grid.Col span={12}>
                <Checkbox
                  label="With Charge (Lighting & Electricity)"
                  {...form.getInputProps('withCharge')}
                  size="sm"
                />
              </Grid.Col>
            </Grid>
          </Box>
        )}

        {/* Step 2: Equipment */}
        {activeStep === 1 && (
          <Box p="md">
            <Alert icon={<IconInfoCircle size={16} />} color="blue" radius="md" mb="lg">
              Choose equipment from ITO, PSMO/FMO, and OP departments. Indicate quantity for each item (if applicable).
              <br></br><br></br>
              <i>Pumili ng kagamitan mula sa ITO, PSMO/FMO, at OP departments. Tukuyin ang dami para sa bawat item (kung naaangkop).</i>
            </Alert>

            {selectedPlaceIds.length > 0 && (
              <Alert icon={<IconInfoCircle size={16} />} color="grape" radius="md" mb="lg">
                Showing usable equipment for: <b>
                  {selectedPlaceIds
                    .map(id => {
                      const p = places.find(pp => pp.id === id);
                      return p ? `${p.name} (${p.branch})` : id;
                    })
                    .filter((v, i, arr) => arr.indexOf(v) === i)
                    .join(', ')}
                </b>
                {' '}+ global equipment.
              </Alert>
            )}

            {bundledInScope.length > 0 && (
              <Alert
                icon={<span style={{ fontSize: 16 }}>⭐</span>}
                color="orange"
                radius="md"
                mb="lg"
                title="This venue has its own set of Equipment"
              >
                The following items are <b>automatically included</b> (you can uncheck them if
                not needed):
                <ul style={{ marginTop: 4, marginBottom: 0, paddingLeft: 20, fontSize: 13 }}>
                  {bundledInScope.map(e => (
                    <li key={e.id}>
                      <b>{e.name}</b> ({e.departmentCode})
                    </li>
                  ))}
                </ul>
                <Text size="xs" c="dimmed" mt={4}>
                  Anything else you add below is considered an <b>add-on</b>.
                </Text>
              </Alert>
            )}

            <SimpleGrid cols={3} spacing="lg">
              {/* PSMO/FMO Equipment */}
              <Card withBorder p="md" radius="md">
                <Text fw={700} size="sm" mb="md" color="blue">
                  PSMO/FMO Equipment
                </Text>
                <Stack gap="sm">
                  {relevantEquipment
                    .filter((e) => e.departmentCode === 'PSMO/FMO')
                    .map((e) => (
                      <Paper key={e.id} withBorder p="xs" radius="sm">
                        <Group grow align="center">
                          <Checkbox
                            label={
                              <Text size="sm">
                                {isEquipmentBundled(e) && (
                                  <Badge
                                    component="span"
                                    size="xs"
                                    color="orange"
                                    variant="filled"
                                    mr={4}
                                    style={{ verticalAlign: 'middle' }}
                                  >
                                    ⭐SET
                                  </Badge>
                                )}
                                {e.name}{' '}
                                {e.isSingleItem ? (
                                  <Text component="span" size="xs" c="dimmed">
                                    (Single Item)
                                  </Text>
                                ) : (
                                  <Text component="span" size="xs" c="dimmed">
                                    (Available: {e.quantityAvailable - (e.quantityReserved || 0)})
                                    {e.quantityReserved ? ` · ${e.quantityReserved} reserved` : ''})
                                  </Text>
                                )}
                              </Text>
                            }
                            checked={form.values.equipmentRequests.some(
                              (req) => req.equipmentId === e.id
                            )}
                            onChange={(ev) => {
                              if (ev.currentTarget.checked) {
                                form.setFieldValue('equipmentRequests', [
                                  ...form.values.equipmentRequests,
                                  { equipmentId: e.id, quantity: 1 },
                                ]);
                              } else {
                                form.setFieldValue(
                                  'equipmentRequests',
                                  form.values.equipmentRequests.filter(
                                    (req) => req.equipmentId !== e.id
                                  )
                                );
                              }
                            }}
                          />
                          {!e.isSingleItem &&
                            form.values.equipmentRequests.some(
                              (req) => req.equipmentId === e.id
                            ) && (
                              <NumberInput
                                size="xs"
                                min={1}
                                max={e.quantityAvailable - (e.quantityReserved || 0)}
                                value={
                                  form.values.equipmentRequests.find(
                                    (req) => req.equipmentId === e.id
                                  )?.quantity || 1
                                }
                                onChange={(val) => handleQuantityChange(e.id, val)}
                                style={{ width: 80 }}
                              />
                            )}
                        </Group>
                      </Paper>
                    ))}
                </Stack>
              </Card>

              {/* ITO Equipment */}
              <Card withBorder p="md" radius="md">
                <Text fw={700} size="sm" mb="md" color="grape">
                  ITO Equipment
                </Text>
                <Stack gap="sm">
                  {relevantEquipment
                    .filter((e) => e.departmentCode === 'ITO-MAIN')
                    .map((e) => (
                      <Paper key={e.id} withBorder p="xs" radius="sm">
                        <Group grow align="center">
                          <Checkbox
                            label={
                              <Text size="sm">
                                {isEquipmentBundled(e) && (
                                  <Badge
                                    component="span"
                                    size="xs"
                                    color="orange"
                                    variant="filled"
                                    mr={4}
                                    style={{ verticalAlign: 'middle' }}
                                  >
                                    ⭐SET
                                  </Badge>
                                )}
                                {e.name}{' '}
                                {e.isSingleItem ? (
                                  <Text component="span" size="xs" c="dimmed">
                                    (Single Item)
                                  </Text>
                                ) : (
                                  <Text component="span" size="xs" c="dimmed">
                                    (Available: {e.quantityAvailable - (e.quantityReserved || 0)})
                                    {e.quantityReserved ? ` · ${e.quantityReserved} reserved` : ''})
                                  </Text>
                                )}
                              </Text>
                            }
                            checked={form.values.equipmentRequests.some(
                              (req) => req.equipmentId === e.id
                            )}
                            onChange={(ev) => {
                              if (ev.currentTarget.checked) {
                                form.setFieldValue('equipmentRequests', [
                                  ...form.values.equipmentRequests,
                                  { equipmentId: e.id, quantity: 1 },
                                ]);
                              } else {
                                form.setFieldValue(
                                  'equipmentRequests',
                                  form.values.equipmentRequests.filter(
                                    (req) => req.equipmentId !== e.id
                                  )
                                );
                              }
                            }}
                          />
                          {!e.isSingleItem &&
                            form.values.equipmentRequests.some(
                              (req) => req.equipmentId === e.id
                            ) && (
                              <NumberInput
                                size="xs"
                                min={1}
                                max={e.quantityAvailable - (e.quantityReserved || 0)}
                                value={
                                  form.values.equipmentRequests.find(
                                    (req) => req.equipmentId === e.id
                                  )?.quantity || 1
                                }
                                onChange={(val) => handleQuantityChange(e.id, val)}
                                style={{ width: 80 }}
                              />
                            )}
                        </Group>
                      </Paper>
                    ))}
                </Stack>
              </Card>

              {/* OP Equipment */}
              <Card withBorder p="md" radius="md">
                <Text fw={700} size="sm" mb="md" color="grape">
                  OP Equipment
                </Text>
                <Stack gap="sm">
                  {relevantEquipment
                    .filter((e) => e.departmentCode === 'OP')
                    .map((e) => (
                      <Paper key={e.id} withBorder p="xs" radius="sm">
                        <Group grow align="center">
                          <Checkbox
                            label={
                              <Text size="sm">
                                {isEquipmentBundled(e) && (
                                  <Badge
                                    component="span"
                                    size="xs"
                                    color="orange"
                                    variant="filled"
                                    mr={4}
                                    style={{ verticalAlign: 'middle' }}
                                  >
                                    ⭐SET
                                  </Badge>
                                )}
                                {e.name}{' '}
                                {e.isSingleItem ? (
                                  <Text component="span" size="xs" c="dimmed">
                                    (Single Item)
                                  </Text>
                                ) : (
                                  <Text component="span" size="xs" c="dimmed">
                                    (Available: {e.quantityAvailable - (e.quantityReserved || 0)})
                                    {e.quantityReserved ? ` · ${e.quantityReserved} reserved` : ''})
                                  </Text>
                                )}
                              </Text>
                            }
                            checked={form.values.equipmentRequests.some(
                              (req) => req.equipmentId === e.id
                            )}
                            onChange={(ev) => {
                              if (ev.currentTarget.checked) {
                                form.setFieldValue('equipmentRequests', [
                                  ...form.values.equipmentRequests,
                                  { equipmentId: e.id, quantity: 1 },
                                ]);
                              } else {
                                form.setFieldValue(
                                  'equipmentRequests',
                                  form.values.equipmentRequests.filter(
                                    (req) => req.equipmentId !== e.id
                                  )
                                );
                              }
                            }}
                          />
                          {!e.isSingleItem &&
                            form.values.equipmentRequests.some(
                              (req) => req.equipmentId === e.id
                            ) && (
                              <NumberInput
                                size="xs"
                                min={1}
                                max={e.quantityAvailable - (e.quantityReserved || 0)}
                                value={
                                  form.values.equipmentRequests.find(
                                    (req) => req.equipmentId === e.id
                                  )?.quantity || 1
                                }
                                onChange={(val) => handleQuantityChange(e.id, val)}
                                style={{ width: 80 }}
                              />
                            )}
                        </Group>
                      </Paper>
                    ))}
                </Stack>
              </Card>

              {/* CDO Equipment */}
              <Card withBorder p="md" radius="md">
                <Text fw={700} size="sm" mb="md" color="teal">
                  CDO Equipment
                </Text>
                <Stack gap="sm">
                  {relevantEquipment
                    .filter((e) => e.departmentCode === 'CDO')
                    .map((e) => (
                      <Paper key={e.id} withBorder p="xs" radius="sm">
                        <Group grow align="center">
                          <Checkbox
                            label={
                              <Text size="sm">
                                {isEquipmentBundled(e) && (
                                  <Badge
                                    component="span"
                                    size="xs"
                                    color="orange"
                                    variant="filled"
                                    mr={4}
                                    style={{ verticalAlign: 'middle' }}
                                  >
                                    ⭐SET
                                  </Badge>
                                )}
                                {e.name}{' '}
                                {e.isSingleItem ? (
                                  <Text component="span" size="xs" c="dimmed">
                                    (Single Item)
                                  </Text>
                                ) : (
                                  <Text component="span" size="xs" c="dimmed">
                                    (Available: {e.quantityAvailable - (e.quantityReserved || 0)})
                                    {e.quantityReserved ? ` · ${e.quantityReserved} reserved` : ''})
                                  </Text>
                                )}
                              </Text>
                            }
                            checked={form.values.equipmentRequests.some(
                              (req) => req.equipmentId === e.id
                            )}
                            onChange={(ev) => {
                              if (ev.currentTarget.checked) {
                                form.setFieldValue('equipmentRequests', [
                                  ...form.values.equipmentRequests,
                                  { equipmentId: e.id, quantity: 1 },
                                ]);
                              } else {
                                form.setFieldValue(
                                  'equipmentRequests',
                                  form.values.equipmentRequests.filter(
                                    (req) => req.equipmentId !== e.id
                                  )
                                );
                              }
                            }}
                          />
                          {!e.isSingleItem &&
                            form.values.equipmentRequests.some(
                              (req) => req.equipmentId === e.id
                            ) && (
                              <NumberInput
                                size="xs"
                                min={1}
                                max={e.quantityAvailable - (e.quantityReserved || 0)}
                                value={
                                  form.values.equipmentRequests.find(
                                    (req) => req.equipmentId === e.id
                                  )?.quantity || 1
                                }
                                onChange={(val) => handleQuantityChange(e.id, val)}
                                style={{ width: 80 }}
                              />
                            )}
                        </Group>
                      </Paper>
                    ))}
                </Stack>
              </Card>
            </SimpleGrid>
          </Box>
        )}

        {/* Step 3: Attachments & Notes */}
        {activeStep === 2 && (
          <Box p="md">
            <Alert icon={<IconInfoCircle size={16} />} color="grape" radius="md" mb="lg">
              <Text fw={600} mb={4}>Required Attachments</Text>
              <Text size="sm">
                Upload the following documents:
                <br />
                • <b>For Student Activities:</b> Permit to Conduct Student Activities (PCSA)
                <br />
                • <b>For ALL events:</b> <strong>Audio/Video materials, editable backdrops, event program</strong>
                <br />or any supporting documents. Make sure to name your file/s properly for easier reviewing of your request.
              </Text>
              <br />
              <i>Mag-upload ng mga sumusunod na dokumento: Permit to Conduct Student Activities (para sa student activities), 
              audio/video materials, editable backdrops, at event program
              (para sa lahat ng events), o kahit anong dokumentong sumusuporta sa request ng paggamit ng facilities, siguraduhing maayos ang pagpapangalan ng mga na-upload na dokumento para sa mas pulidong pagsusuri ng iyong request.</i>
            </Alert>

            {isRescheduleMode && (
              <Textarea
                label="Reason for Reschedule"
                placeholder="Please explain why you need to reschedule this event (e.g., weather, emergency, etc.)"
                minRows={3}
                value={rescheduleReason}
                onChange={(e) => setRescheduleReason(e.currentTarget.value)}
                required
                description="Provide a clear reason for the reschedule request."
              />
            )}

            {/* === EXISTING ATTACHMENTS (to keep) === */}
            {attachmentsToKeep.length > 0 && (
              <Box>
                <Text size="xs" fw={600} c="dimmed" mb={4}>Currently attached files:</Text>
                <Stack gap="xs">
                  {attachmentsToKeep.map((path, idx) => {
                    const fileName = path.split('/').pop() || `file-${idx}`;
                    return (
                      <Paper key={idx} withBorder p="xs" radius="sm" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <IconFile size={14} />
                        <Text size="sm">{fileName}</Text>
                        <ActionIcon color="red" size="sm" onClick={() => {
                            setAttachmentsToKeep(prev => prev.filter(p => p !== path));
                          }}>
                          <IconTrash size={14} />
                        </ActionIcon>
                      </Paper>
                    );
                  })}
                </Stack>
              </Box>
            )}

            <Stack gap="md" mt="md">
              {/* === NEW FILE UPLOAD AREA === */}
              <div>
                <Text fw={600} size="sm" mb={4}>
                  Upload New Attachments {!isRescheduleMode && <Text span c="red">*</Text>}
                </Text>
                <Text size="xs" c="dimmed" mb="xs">
                  Upload PDF or image files. You can add multiple files.
                </Text>

                <FileInput
                  placeholder="Click to upload files or drag and drop"
                  multiple
                  accept="application/pdf,image/*"
                  size="sm"
                  value={form.values.attachments}
                  onChange={(files) => {
                    form.setFieldValue('attachments', files || []);
                  }}
                  styles={(theme) => ({
                    input: {
                      borderStyle: 'dashed',
                      borderWidth: '2px'
                    },
                  })}
                />

                {/* Error text only */}
                {form.errors.attachments && (
                  <Text c="red" size="xs" mt="xs">
                    {form.errors.attachments}
                  </Text>
                )}

                {form.values.attachments.length > 0 && (
                  <Box mt="sm">
                    <Text size="xs" fw={600} c="dimmed" mb={4}>
                      Uploaded Files ({form.values.attachments.length})
                    </Text>
                    <Stack gap="xs">
                      {form.values.attachments.map((file, index) => {
                        const { icon, color } = getFileMeta(file);

                        return (
                          <Paper
                            key={`${file.name}-${index}`}
                            withBorder
                            p="xs"
                            radius="sm"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 12
                            }}
                          >
                            <Group gap="sm" style={{ flex: 1, minWidth: 0 }}>
                              <ThemeIcon color={color} variant="light" size="md">
                                {icon}
                              </ThemeIcon>
                              <div style={{ minWidth: 0 }}>
                                <Text size="sm" fw={500} lineClamp={1}>
                                  {file.name}
                                </Text>
                                <Text size="xs" c="dimmed">
                                  {formatFileSize(file.size)}
                                </Text>
                              </div>
                            </Group>

                            {/* Delete button — inline on the right, large icon */}
                            <ActionIcon
                              color="red"
                              variant="filled"
                              size={38}
                              radius="md"
                              onClick={() => removeAttachment(index)}
                              aria-label={`Remove ${file.name}`}
                              onMouseEnter={() => setHoveredAttachment(index)}
                              onMouseLeave={() => setHoveredAttachment(null)}
                              style={{
                                opacity: hoveredAttachment === index ? 1 : 0.85,
                                transition: 'opacity 150ms ease',
                              }}
                            >
                              <IconTrash size={18} />
                            </ActionIcon>
                          </Paper>
                        );
                      })}
                    </Stack>
                  </Box>
                )}
              </div>

              {/* Requestor Notes */}
              <Textarea
                label="Requestor Notes"
                placeholder="Add any additional information... (Event Title, Purpose, etc.)"
                minRows={4}
                {...form.getInputProps('requestorNotes')}
                size="sm"
                required
                resize="vertical"
                description="Provide context about the event, special requests, or any other relevant details."
              />
            </Stack>
          </Box>
        )}

        {/* Step 4: Review */}
        {activeStep === 3 && (
          <Box p="md">
            <Alert color="blue" mb="lg" icon={<IconInfoCircle size={16} />}>
              Review your reservation details before submitting.
              <br />
              <i>Suriin ang mga detalye bago isumite.</i>
            </Alert>

            <Paper withBorder p="md" radius="md">
              <Stack gap="md">
                {/* Two‑column summary */}
                <SimpleGrid cols={2} spacing="sm">
                  <div>
                    <Text size="xs" c="dimmed" fw={600}>Type</Text>
                    <Text size="sm" fw={500}>{form.values.type.replace('_', ' ')}</Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed" fw={600}>Event / Activity</Text>
                    <Text size="sm" fw={500}>{form.values.eventName || '—'}</Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed" fw={600}>Venue Only</Text>
                    <Text size="sm" fw={500}>{form.values.isVenueOnly ? 'Yes' : 'No'}</Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed" fw={600}>Attendees</Text>
                    <Text size="sm" fw={500}>{form.values.attendeesCount}</Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed" fw={600}>Usage Hours</Text>
                    <Text size="sm" fw={500}>{form.values.usageHours || 0}</Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed" fw={600}>With Charge</Text>
                    <Text size="sm" fw={500}>{form.values.withCharge ? 'Yes' : 'No'}</Text>
                  </div>
                </SimpleGrid>

                <Divider />

                {/* Dates & Venues */}
                <div>
                  <Text size="xs" c="dimmed" fw={600} mb="xs">Dates & Venue/s</Text>
                  <Stack gap="xs">
                    {form.values.dates.map((d, i) => {
                      const placeName = d.placeId
                        ? places.find(p => p.id === d.placeId)?.name || d.placeId
                        : d.placeOther || 'Not specified';
                      return (
                        <Paper key={d.id} withBorder p="xs" radius="sm" bg="light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-7))">
                          <Group justify="space-between" wrap="nowrap">
                            <Badge color="blue" size="xs" variant="light">Date {i + 1}</Badge>
                            <Text size="xs" fw={500}>{formatDateOnly(d.date)}</Text>
                          </Group>
                          <SimpleGrid cols={2} spacing="xs" mt={4}>
                            <Text size="xs"><b>Starting Time:</b> {d.setupTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</Text>
                            <Text size="xs"><b>Event:</b> {d.eventStart.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} – {d.eventEnd.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</Text>
                            <Text size="xs"><b>Actual Time End:</b> {d.teardownTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</Text>
                            <Text size="xs"><b>Venue:</b> {placeName}</Text>
                          </SimpleGrid>
                        </Paper>
                      );
                    })}
                  </Stack>
                </div>

                <Divider />

                {/* Equipment */}
                <div>
                  <Text size="xs" c="dimmed" fw={600} mb="xs">Equipment Requested</Text>
                  {form.values.equipmentRequests.length === 0 ? (
                    <Text size="sm" c="dimmed" fs="italic">No equipment selected</Text>
                  ) : (
                    <Group gap="xs">
                      {form.values.equipmentRequests.map((req, idx) => {
                        const eq = equipment.find(e => e.id === req.equipmentId);
                        return (
                          <Badge key={idx} color={getDepartmentColor(eq?.departmentCode || '')} variant="light" size="md">
                            {eq?.name || req.equipmentId} x {req.quantity} ({eq?.departmentCode})
                          </Badge>
                        );
                      })}
                    </Group>
                  )}
                </div>

                {form.values.requestorNotes && (
                  <>
                    <Divider />
                    <div>
                      <Text size="xs" c="dimmed" fw={600} mb="xs">Requestor Notes</Text>
                      <Text size="sm">{form.values.requestorNotes}</Text>
                    </div>
                  </>
                )}

                {form.values.attachments.length > 0 && (
                  <>
                    <Divider />
                    <div>
                      <Text size="xs" c="dimmed" fw={600} mb="xs">Attachments</Text>
                      <Stack gap="xs">
                        {form.values.attachments.map((file, idx) => {
                          const { icon, color } = getFileMeta(file);
                          return (
                            <Group key={idx} gap="sm">
                              <ThemeIcon color={color} variant="light" size="sm">
                                {icon}
                              </ThemeIcon>
                              <Text size="sm">{file.name}</Text>
                              <Text size="xs" c="dimmed">({formatFileSize(file.size)})</Text>
                            </Group>
                          );
                        })}
                      </Stack>
                    </div>
                  </>
                )}

                <Divider label="Security Verification" labelPosition="center" />

                <PasswordInput
                  label="Confirm Security Password / Signature"
                  placeholder="Enter your password to confirm submission"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.currentTarget.value);
                    if (passwordError) setPasswordError('');
                  }}
                  error={passwordError}
                  required
                  leftSection={<IconLock size={16} />}
                  description="Your NCST D-Forms password is required to submit this reservation."
                />
              </Stack>
            </Paper>
          </Box>
        )}

        {/* Navigation Buttons */}
        <Group justify="space-between" mt="xl">
          <Button variant="default" onClick={prevStep} disabled={activeStep === 0} type="button">
            Back
          </Button>

          <Group gap="sm">
            <Button variant="filled" color="red" onClick={onClose} type="button">
              Cancel
            </Button>
            {activeStep === 3 ? (
              <Button key="submit-btn" type="submit" loading={submitting} color="blue">
                {isRescheduleMode ? 'Submit Reschedule' : isEditing ? 'Resubmit Revision' : 'Submit Request'}
              </Button>
            ) : (
              <Button key="next-btn" onClick={nextStep} color="blue" type="button">
                Next
              </Button>
            )}
          </Group>
        </Group>
      </form>
    </Modal>
  );
}

// Helper for department colors (used inside component)
function getDepartmentColor(deptCode: string): string {
  const colors: Record<string, string> = {
    'PSMO/FMO': 'blue',
    'ITO-MAIN': 'grape',
    'OP': 'green',
    'OSA': 'orange',
    'CDO': 'teal',
    'OCM': 'teal',
    'SAFETY-SECURITY': 'red',
    'HRD': 'pink',
    'ACAD': 'indigo',
  };
  return colors[deptCode] || 'gray';
}