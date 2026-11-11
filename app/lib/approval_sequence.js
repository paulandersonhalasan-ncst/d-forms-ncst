// lib/approval_sequence.js
//
// Materializes the FRF approval chain from a DB-managed sequence
// based on the reservation's current context (type, equipment, etc.).
//
// Design notes:
//  - Requestor's own department is ALWAYS step 1, added by this helper.
//  - Sequence steps whose departmentCode matches the requestor's are skipped
//    (they'd self-approve via the requestor step anyway).
//  - stepOrder is renumbered 1..N after filtering.
//  - triggerKey determines whether a step is included; unknown keys default
//    to EXCLUDED (safe-by-default, don't silently add steps).

/**
 * @typedef {Object} MaterializationContext
 * @property {'EMPLOYEE_ONLY'|'WITH_STUDENTS'} type
 * @property {boolean} hasITOEquipment
 * @property {boolean} hasCDOEquipment
 * @property {boolean} hasPhysicalActivity
 * @property {boolean} isVenueOnly
 * @property {string} requestorDept
 */

/**
 * @typedef {Object} MaterializedStep
 * @property {string} departmentCode
 * @property {number} stepOrder
 * @property {'APPROVAL'|'ACKNOWLEDGEMENT'} stepType
 * @property {string|null} sequenceStepId
 * @property {boolean} isRequestorStep
 */

/**
 * Evaluate a step's triggerKey against the context.
 * @param {string} triggerKey
 * @param {MaterializationContext} ctx
 * @returns {boolean}
 */
function evaluateTrigger(triggerKey, ctx) {
  switch (triggerKey) {
    case 'always':
      return true;
    case 'with_students':
      return ctx.type === 'WITH_STUDENTS';
    case 'has_ito_equipment':
      // ITO approval not needed for venue-only
      return ctx.hasITOEquipment && !ctx.isVenueOnly;
    case 'has_cdo_equipment':
      return ctx.hasCDOEquipment;
    case 'has_physical_activity':
      return ctx.hasPhysicalActivity;
    default:
      return false;
  }
}

/**
 * Build the final ordered chain of approval + acknowledgement steps.
 * @param {MaterializationContext} ctx
 * @param {Array<{id:string, departmentCode:string, stepType:string, triggerKey:string, sequenceIndex:number}>} sequenceSteps
 * @returns {MaterializedStep[]}
 */
export function materializeApprovalChain(ctx, sequenceSteps) {
  /** @type {MaterializedStep[]} */
  const chain = [];

  // Step 1 — requestor's own department
  chain.push({
    departmentCode: ctx.requestorDept,
    stepOrder: 1,
    stepType: 'APPROVAL',
    sequenceStepId: null,
    isRequestorStep: true,
  });

  if (!Array.isArray(sequenceSteps) || sequenceSteps.length === 0) {
    return chain;
  }

  // Sort by sequenceIndex (defensive — DB might not be ordered)
  const sorted = [...sequenceSteps].sort((a, b) => a.sequenceIndex - b.sequenceIndex);

  let nextOrder = 2;
  for (const step of sorted) {
    // Skip steps whose dept is the requestor's — self-approval handled by step 1
    if (step.departmentCode === ctx.requestorDept) continue;

    if (!evaluateTrigger(step.triggerKey, ctx)) continue;

    chain.push({
      departmentCode: step.departmentCode,
      stepOrder: nextOrder++,
      stepType: step.stepType || 'APPROVAL',
      sequenceStepId: step.id || null,
      isRequestorStep: false,
    });
  }

  return chain;
}

/**
 * Fetch the active FRF sequence from the DB, or null if not configured.
 * Caller should reject creation if null — better to fail loudly than
 * create orphan reservations that can never be approved.
 */
export async function getFRFSequence(prisma) {
  const sequence = await prisma.approvalSequence.findUnique({
    where: { formType: 'FRF' },
    include: { steps: { orderBy: { sequenceIndex: 'asc' } } },
  });
  if (!sequence || !sequence.isActive) return null;
  return sequence;
}

/**
 * Detect whether a context has changed in a way that should trigger
 * re-approval on reschedule.
 *
 * B1 simplification: on reschedule, ALL non-requestor APPROVAL steps get
 * reset to PENDING. Acks are refreshed (re-notified when COMPLETED). We
 * keep this simple — if re-approvals become noisy, we can add per-dept
 * "keep approved if context unchanged" optimizations later.
 *
 * (Exported for future use / testing, not consumed by current route yet.)
 */
export function listApprovalDepartments(chain) {
  return chain.filter((s) => s.stepType === 'APPROVAL').map((s) => s.departmentCode);
}

export function listAckDepartments(chain) {
  return chain.filter((s) => s.stepType === 'ACKNOWLEDGEMENT').map((s) => s.departmentCode);
}