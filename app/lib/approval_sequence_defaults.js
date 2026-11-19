// lib/approval_sequence_defaults.js

// Legacy static triggers — kept for backward compat with existing sequences.
// New lending departments should use the generic `has_equipment_from_{DEPT}`
// pattern, which is generated dynamically by `getTriggerOptions()` below.
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

// 🆕 Shared trigger validator — used by both the API route and the UI.
//    Accepts:
//      1. Any legacy static trigger (e.g. 'always', 'has_cdo_equipment')
//      2. Any generic `has_equipment_from_{DEPT}` with a non-empty dept
//
//    If `allowedLendingDepts` is provided, the {DEPT} part MUST be in that
//    list. Otherwise only the prefix shape is enforced (evaluator returns
//    false for unknown depts anyway, so this is safe).
//
//    @param {string} key
//    @param {string[]|null} [allowedLendingDepts]
//    @returns {boolean}
export function isValidTriggerKey(key, allowedLendingDepts = null) {
  if (typeof key !== 'string' || !key) return false;
  if (TRIGGER_KEYS.includes(key)) return true;

  const PREFIX = 'has_equipment_from_';
  if (!key.startsWith(PREFIX)) return false;

  const dept = key.slice(PREFIX.length);
  if (!dept) return false;

  if (Array.isArray(allowedLendingDepts)) {
    return allowedLendingDepts.includes(dept);
  }
  return true;
}

// 🆕 Departments that already have a dedicated legacy trigger above.
//    Used by getTriggerOptions() to avoid showing duplicate options
//    (e.g. both `has_cdo_equipment` AND `has_equipment_from_CDO`).
const LEGACY_EQUIPMENT_TRIGGER_DEPTS = new Set(['ITO-MAIN', 'CDO']);

// 🆕 Build the trigger Select options for the SequenceBuilder.
//    Merges the legacy list with per-lending-dept generic triggers so admins
//    can configure "only if {NEW_DEPT} equipment requested" without a
//    code change when a new lending dept is added via Settings.
//
//    @param {string[]} equipmentLendingDepartments
//    @returns {{ value: string; label: string }[]}
export function getTriggerOptions(equipmentLendingDepartments = []) {
  const legacy = TRIGGER_OPTIONS;
  const legacyValues = new Set(legacy.map(o => o.value));

  const dynamic = (equipmentLendingDepartments || [])
    .filter(Boolean)
    .filter(d => !LEGACY_EQUIPMENT_TRIGGER_DEPTS.has(d))   // skip CDO, ITO-MAIN
    .map(d => ({
      value: `has_equipment_from_${d}`,
      label: `Only if ${d} equipment requested`,
    }))
    .filter(o => !legacyValues.has(o.value));

  return [...legacy, ...dynamic];
}

// Default FRF chain — mirrors the seed I gave you earlier.
// Order matters: OP must be first external approver.
// Note: any lending dept NOT listed here will still work — admins can add
// them via the SequenceBuilder using the "Only if {DEPT} equipment requested"
// trigger. A warning in the SequenceBuilder flags any lending dept with no step.
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