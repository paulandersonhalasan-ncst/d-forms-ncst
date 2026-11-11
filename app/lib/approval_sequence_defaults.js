// lib/approval_sequence_defaults.js

export const TRIGGER_OPTIONS = [
  { value: 'always',               label: 'Always included' },
  { value: 'with_students',        label: 'Only if WITH_STUDENTS' },
  { value: 'has_ito_equipment',    label: 'Only if ITO equipment (not venue-only)' },
  { value: 'has_cdo_equipment',    label: 'Only if CDO equipment requested' },
  { value: 'has_physical_activity',label: 'Only if physical activity' },
];

export const STEP_TYPE_OPTIONS = [
  { value: 'APPROVAL',        label: 'Approval (gates completion)' },
  { value: 'ACKNOWLEDGEMENT', label: 'Acknowledgment (informational only)' },
];

export const TRIGGER_KEYS = TRIGGER_OPTIONS.map(o => o.value);
export const STEP_TYPES = STEP_TYPE_OPTIONS.map(o => o.value);

// Default FRF chain — mirrors the seed I gave you earlier.
// Order matters: OP must be first external approver.
export const DEFAULT_FRF_SEQUENCE = [
  { departmentCode: 'OP',               stepType: 'APPROVAL',        triggerKey: 'always' },
  { departmentCode: 'PSMO/FMO',         stepType: 'APPROVAL',        triggerKey: 'always' },
  { departmentCode: 'OSA',              stepType: 'APPROVAL',        triggerKey: 'with_students' },
  { departmentCode: 'CDO',              stepType: 'APPROVAL',        triggerKey: 'has_cdo_equipment' },
  { departmentCode: 'OCM',              stepType: 'APPROVAL',        triggerKey: 'always' },
  { departmentCode: 'SAFETY-SECURITY',  stepType: 'APPROVAL',        triggerKey: 'always' },
  { departmentCode: 'ITO-MAIN',         stepType: 'APPROVAL',        triggerKey: 'has_ito_equipment' },
  { departmentCode: 'HRD',              stepType: 'ACKNOWLEDGEMENT', triggerKey: 'always' },
  { departmentCode: 'HSO',              stepType: 'ACKNOWLEDGEMENT', triggerKey: 'has_physical_activity' },
];