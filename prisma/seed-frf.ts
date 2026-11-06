// prisma/seed-frf.ts
// Run:   npx tsx --env-file=.env prisma/seed-frf.ts
// Reset: npx tsx --env-file=.env prisma/seed-frf.ts --reset

import bcrypt from 'bcrypt';
import { PrismaClient } from '../app/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// ── Prisma init (same pattern as prisma/prisma.js) ──────────────
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    'DATABASE_URL is not set. Run with: npx tsx --env-file=.env prisma/seed-frf.ts',
  );
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// ── Types ───────────────────────────────────────────────────────
type UserRow  = Awaited<ReturnType<typeof prisma.user.create>>;
type PlaceRow = Awaited<ReturnType<typeof prisma.eventPlace.create>>;
type EquipRow = Awaited<ReturnType<typeof prisma.equipment.create>>;

type Branch       = 'MAIN' | 'IMUS' | 'NASTECH' | 'SHS';
type Role         = 'Staff' | 'DepartmentHead' | 'SuperUser' | 'Admin' | 'Faculty';
type PlaceCat     = 'REGULAR' | 'CATEGORY_1' | 'CATEGORY_2' | 'VIP';

// ── Helpers ─────────────────────────────────────────────────────
const daysFromNow = (n: number): Date => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
};

const withTime = (date: Date, hours: number, minutes: number = 0): Date => {
  const d = new Date(date);
  d.setHours(hours, minutes, 0, 0);
  return d;
};

async function ensureDepartment(code: string) {
  return prisma.department.upsert({
    where: { code },
    update: {},
    create: { code },
  });
}

type UserArgs = {
  email: string;
  fname: string;
  lname: string;
  role: Role;
  departmentCode: string;
  branch?: Branch;
};

async function ensureUser({
  email, fname, lname, role, departmentCode, branch = 'MAIN',
}: UserArgs) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing;
  const password = await bcrypt.hash('Test1234!', 10);
  return prisma.user.create({
    data: {
      employee_id: `EMP-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
      email,
      password,
      fname,
      lname,
      role,
      departmentCode,
      branch,
    },
  });
}

type PlaceArgs = {
  name: string;
  branch: Branch;
  category: PlaceCat;
  hasSetItems?: boolean;
};

async function ensurePlace({
  name, branch, category, hasSetItems = false,
}: PlaceArgs) {
  return prisma.eventPlace.upsert({
    where: { name },
    update: {},
    create: { name, branch, category, hasSetItems, isActive: true },
  });
}

type EquipArgs = {
  name: string;
  departmentCode: string;
  isSingleItem: boolean;
  quantityAvailable: number;
  branch?: Branch;
};

async function ensureEquipment({
  name, departmentCode, isSingleItem, quantityAvailable, branch = 'MAIN',
}: EquipArgs) {
  const existing = await prisma.equipment.findFirst({
    where: { name, departmentCode, branch },
  });
  if (existing) return existing;
  return prisma.equipment.create({
    data: { name, departmentCode, isSingleItem, quantityAvailable, branch },
  });
}

// ── Realistic text filler for size testing ──────────────────────
const FRF_NOTE_BLOCKS = [
  'The requesting department has coordinated closely with facilities management and the safety office to ensure the venue remains operational throughout the activity. Furniture layouts will be finalized forty-eight hours prior to the event and any displaced items will be catalogued, photographed, and returned to their original positions at the conclusion of the activity. Escalation contacts from both the requesting department and PSMO have been pre-assigned and are available on-call throughout the scheduled window.',
  'Pre-event technical dry runs have been scheduled on the day prior to the event to verify that all audiovisual, lighting, and sound reinforcement equipment functions as specified in the technical rider. Any defects discovered during the dry run will be rectified before the event start time or will be escalated to the department head for contingency planning. Redundant cabling and adapter kits are being staged in a secured backstage area to address unexpected equipment mismatches.',
  'Crowd ingress and egress flow have been modelled against the venue occupancy limit and the expected attendance profile. Marshals will be positioned at every designated entry and exit point with clear identification, and secondary evacuation routes have been pre-walked and confirmed unobstructed. Should attendance exceed the projected figure, an overflow plan has been prepared with the compliance of the safety office and will be activated under the sole discretion of the safety marshall in charge.',
  'Equipment staging and custody protocols require that every item delivered to the venue be logged against the reservation identifier upon arrival, tracked through the duration of the event, and reconciled against the original manifest at the time of return. Discrepancies greater than one item will trigger a formal incident report and a departmental investigation under the equipment accountability policy. All personnel handling high-value equipment will acknowledge receipt of the applicable handling procedures in writing.',
  'Contingency planning for adverse weather has been prepared in coordination with the safety office. Should inclement weather arise, the activity will either be moved to the adjacent covered facility or postponed pending a rescheduling request to be filed by the focal person within twenty-four hours. All third-party vendors have been informed of the rescheduling clause in their respective letters of engagement and are contractually bound to accommodate a single rescheduling without penalty.',
  'First-aid capability for the duration of the event will be provided by a minimum of two certified first responders drawn from the safety office roster. A fully stocked first-aid station will be stationed at a clearly visible location near the primary entry point. All incidents, regardless of severity, will be documented in the incident log and forwarded to the DPO within seventy-two hours in compliance with the institution data handling policy.',
  'Post-event cleanup represents a shared obligation between the requesting department, the facilities team, and the third-party service provider engaged for waste hauling. A walkthrough inspection shall be conducted jointly at the conclusion of the activity to verify restoration to the pre-event condition. Any damages discovered during the walkthrough will be documented, photographed, and charged to the requesting department under the standard restitution schedule.',
  'Security detail arrangements for the venue perimeter have been discussed with the safety office. Entry is limited to individuals who present the pre-registration confirmation. VIP attendees and speakers will have pre-arranged secure ingress through the secondary entrance with brief, escorted accompaniment by an assigned marshall. Media presence has been coordinated separately and accommodated only within pre-designated zones as cleared by the office of the president.',
  'The requesting department commits to filing the post-activity report within five business days from the event conclusion. The report will include an attendee count verified against registration records, an accounting of equipment consumed or damaged, a summary of any incidents or near misses, and a photographic record of the venue before and after the event. Compliance with this reporting obligation is a precondition for future booking priority within the shared facility pool.',
  'Contact routing for the day of the event has been structured to avoid bottlenecks. The focal person of record is the single point of accountability for all communications originating from the requesting department. All escalations route through the department head first, with the safety office notified only in cases where personal safety is at risk. Facilities escalation runs in parallel to the requesting department chain and uses the dedicated hotline published in the departmental runbook.',
  'Documentation held by the requesting department for this activity includes the approved activity proposal, the participant list certified for data protection compliance, the equipment manifest countersigned by the facilities team, the signed activity risk assessment, and the vendor liability certificates. Copies have been transmitted to the compliance mailbox and a physical binder is retained at the venue for the duration of the event, available for inspection on demand.',
  'Community and stakeholder communications have been drafted and scheduled. Notices about road and parking access impacts have been posted through the official campus communication channels at least one week prior to the event. Any complaints received after the event will be routed to the focal person of record and addressed within forty-eight hours, with resolution status documented for the next scheduled cross-departmental review.',
];

const MEMO_BODY_BLOCKS = [
  'By authority of the office of the undersigned, this memorandum sets forth the procedural directives that govern the handling of all internal communications of a time-sensitive nature for the period indicated. It supersedes all prior verbal and written guidance in conflict herewith and enters immediately into force for all affected departments. Recipients are required to acknowledge receipt and to cascade the contents of this memorandum to all staff under their respective jurisdictions within the acknowledgment window specified below.',
  'The scope of applicability for this memorandum extends to all personnel within the sender department and to all recipient departments listed in the routing header. It does not extend to external partners except to the extent that such partners are formally integrated through an executed memorandum of understanding. Any conflict between this memorandum and pre-existing departmental standard operating procedures is to be resolved in favor of this memorandum until such time as the head of the recipient department files a written objection.',
  'Implementation of the directives set forth herein is to follow the timeline published at the close of this document. The rollout proceeds in four distinct phases, each with a documented checkpoint and a signoff by the accountable function. Slippage of more than two business days from the plan requires a formal variance notice to be filed with the approving authority. The approving authority reserves the right to amend the timeline at any point with reasonable notice to all recipient departments.',
  'Roles and responsibilities are described in the appendices attached to the memorandum. In brief, the sender department retains ownership of the initiative and is accountable for the outcomes. The recipient departments are accountable for execution within their respective scope. Coordination is provided through the designated points of contact listed in the routing header. Escalation of any issue that cannot be resolved at the operational level is to be elevated first to the sender department head and, if unresolved, to the office of the president for adjudication.',
  'Compliance monitoring will be carried out through a combination of periodic audit, spot-check verification, and voluntary self-reporting by the involved departments. Audit findings will be communicated in writing to the responsible department head within ten business days of the conclusion of the audit. Remediation plans are due within fifteen business days following the communication of findings. Repeated noncompliance will trigger escalation to the appropriate adjudicatory body under the applicable institutional guidelines.',
  'This memorandum is effective immediately and remains in force until it is formally withdrawn, amended, or superseded by a subsequent memorandum of equal or higher authority. Any amendment must be issued in writing by the same office that issued this memorandum. Verbal amendments, however communicated, do not carry any operational effect. Recipients are advised to retain the original copy of this memorandum in their departmental records for audit reference and for orientation of incoming personnel.',
  'Contact particulars for this memorandum are provided in the footer and repeated in the attached appendix. The focal person of record is solely responsible for coordinating all follow-up actions. Where the focal person of record is unavailable for a period exceeding forty-eight hours, a designated alternate shall exercise the delegated authority of the role. Such alternates must be pre-registered with the sending office so that the notification and acknowledgment trail remains auditable throughout.',
  'Data protection considerations apply to all personnel and materials associated with this memorandum. Personal information about beneficiaries, applicants, or affected parties may only be processed to the extent necessary to achieve the stated purpose. Processing activities must comply with the institution data privacy policy and the applicable privacy notice. Any suspected or confirmed data breach must be escalated to the DPO within seventy-two hours, without prejudice to any concurrent reporting to the National Privacy Commission.',
  'Interpretation of any ambiguity in this memorandum is reserved to the sending office. Recipients who encounter ambiguity in application should document the specific circumstance and the interpretive decision taken, and forward this documentation to the sending office within five business days of the decision. The sending office will issue a written clarification within ten business days, which will be circulated to all recipient departments and will supersede the original interpretive decision if it conflicts.',
  'Acknowledgment of this memorandum is mandatory. Recipients who fail to acknowledge within the specified window will be counted as noncompliant and reported accordingly. The sending office considers acknowledgment to be a positive act, not a passive one; silence does not constitute acknowledgment. Recipients who have a legitimate reason for non-acknowledgment must communicate the reason in writing within the acknowledgment window to preserve their compliance status and to request accommodation.',
  'Historical context for the directive outlined in this memorandum is summarized in the attached appendix. The reader is encouraged to consult this context to understand the origins of the changes being mandated and the specific operational pressures that motivated them. It is not the intention of the sending office to impose compliance by fiat; rather, the office seeks to align recipient departments toward a shared understanding of the operational realities that have driven this decision and its accompanying timetable.',
  'The sending office appreciates the cooperation of all recipient departments and recognizes that compliance with this memorandum will require incremental adjustment in operational tempo. Support resources, including printed runbooks, e-learning modules, and on-demand advisory hours, are available through the office of the undersigned. Recipients are encouraged to make use of these resources proactively rather than at the point of audit, so that compliance is embedded in practice rather than retrofitted for the sake of appearance.',
];

function buildContent(
  blocks: string[] | undefined | null,
  targetKB: number,
  seed: number = 0,
  caller: string = 'unknown',
): string {
  if (!Array.isArray(blocks) || blocks.length === 0) {
    console.error(
      `❌ buildContent: invalid "blocks" from ${caller} ` +
      `(got ${blocks === null ? 'null' : typeof blocks}, expected non-empty string[])`,
    );
    const placeholder = `[Placeholder content — ${targetKB} KB requested, blocks invalid from ${caller}]. `;
    const targetChars = Math.min(targetKB * 1024, 32_000);
    return placeholder.repeat(Math.ceil(targetChars / placeholder.length)).slice(0, targetChars);
  }

  // Excel hard-limits a single cell to 32,767 chars.
  // Cap at 32,000 so exports always fit — leave 767 chars headroom for formatting.
  const EXCEL_CELL_LIMIT = 32_000;
  const targetChars = Math.min(targetKB * 1024, EXCEL_CELL_LIMIT);

  const parts: string[] = [];
  let totalChars = 0;
  let idx = ((Math.trunc(seed) % blocks.length) + blocks.length) % blocks.length;

  while (totalChars < targetChars) {
    const block = blocks[idx % blocks.length];
    if (typeof block !== 'string') {
      console.error(
        `❌ buildContent: missing block at idx=${idx} (seed=${seed}) from ${caller}`,
      );
      break;
    }

    // If this block would overflow the cap, trim it and stop.
    const remaining = targetChars - totalChars;
    if (block.length + 2 > remaining) {
      if (remaining > 2) parts.push(block.slice(0, remaining - 2));
      totalChars = targetChars;
      break;
    }

    parts.push(block);
    totalChars += block.length + 2;
    idx++;
  }

  return parts.join('\n\n');
}

// ---------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------
async function main() {
  // ---------- RESET (optional) ----------
    if (process.argv.includes('--reset')) {
    // All seeded notifications have titles prefixed with "[SEED]"
    const delNotif = await prisma.notification.deleteMany({
      where: { title: { startsWith: '[SEED]' } },
    });

    // BackupExport rows marked with seeded filenames
    const delBackup = await prisma.backupExport.deleteMany({
      where: { filename: { startsWith: 'seed-' } },
    });

    const delFRF = await prisma.facilityReservation.deleteMany({
      where: { referenceId: { startsWith: 'FRF-SEED-' } },
    });
    const delMemo = await prisma.memo.deleteMany({
      where: { referenceId: { startsWith: 'MEMO-SEED-' } },
    });

    // Audit trail + login security — marker-prefixed so we can target them
    const delActivity = await prisma.activityLog.deleteMany({
      where: { details: { startsWith: '[SEED]' } },
    });
    const delLogin = await prisma.loginLog.deleteMany({
      where: { ip_address: { startsWith: '203.0.113.' } },  // TEST-NET-3 reserved range
    });

    // Branch/scenario users — targeted by email pattern, not role
    const SEED_USER_EMAILS = [
      'imus.head@test.ncst.edu.ph', 'nastech.head@test.ncst.edu.ph', 'shs.head@test.ncst.edu.ph',
      'imus.staff@test.ncst.edu.ph', 'nastech.staff@test.ncst.edu.ph', 'shs.staff@test.ncst.edu.ph',
      'disabled.user@test.ncst.edu.ph', 'reset.user@test.ncst.edu.ph',
      'psmo.oic@test.ncst.edu.ph', 'ocm.oic.ended@test.ncst.edu.ph', 'ito.oic.upcoming@test.ncst.edu.ph',
    ];
    const delUsers = await prisma.user.deleteMany({
      where: {
        email: { in: SEED_USER_EMAILS },
        // only delete if they don't own any surviving FRFs/Memos (safety)
        facilityRequests: { none: { referenceId: { not: { startsWith: 'FRF-SEED-' } } } },
        memosCreated:     { none: { referenceId: { not: { startsWith: 'MEMO-SEED-' } } } },
      },
    });

    console.log(
      `🗑️  Reset: ${delFRF.count} FRF(s), ${delMemo.count} memo(s), ` +
      `${delNotif.count} notif(s), ${delBackup.count} backup(s), ` +
      `${delActivity.count} activity log(s), ${delLogin.count} login log(s), ` +
      `${delUsers.count} seeded scenario user(s)\n`,
    );
  }

  // ---------- 1. DEPARTMENTS ----------
  console.log('📁 Ensuring departments…');
  const DEPTS = ['PSMO/FMO', 'OCM', 'SAFETY-SECURITY', 'ITO-MAIN', 'HRD', 'ACAD', 'OSA', 'OP', 'CDO'];
  for (const code of DEPTS) await ensureDepartment(code);
  console.log(`   ✅ ${DEPTS.length} departments ready\n`);

  // ---------- 2. USERS ----------
  console.log('👤 Ensuring users…');
  const U: Record<string, UserRow>  = {};

  // Department Heads (needed for approval chain + notifications)
  const heads = [
    { key: 'PSMO',    email: 'psmo.head@test.ncst.edu.ph',    fname: 'Pedro',   lname: 'Santos',     dept: 'PSMO/FMO' },
    { key: 'OCM',     email: 'ocm.head@test.ncst.edu.ph',     fname: 'Olivia',  lname: 'Cruz',       dept: 'OCM' },
    { key: 'SS',      email: 'safety.head@test.ncst.edu.ph',  fname: 'Sofia',   lname: 'Reyes',      dept: 'SAFETY-SECURITY' },
    { key: 'ITO',     email: 'ito.head@test.ncst.edu.ph',     fname: 'Ivan',    lname: 'Torres',     dept: 'ITO-MAIN' },
    { key: 'HRD',     email: 'hrd.head@test.ncst.edu.ph',     fname: 'Helena',  lname: 'Diaz',       dept: 'HRD' },
    { key: 'ACAD_H',  email: 'acad.head@test.ncst.edu.ph',    fname: 'Andrea',  lname: 'Cruz',       dept: 'ACAD' },
    { key: 'OSA_H',   email: 'osa.head@test.ncst.edu.ph',     fname: 'Oscar',   lname: 'Mercado',    dept: 'OSA' },
    { key: 'OP_H',    email: 'op.head@test.ncst.edu.ph',      fname: 'Olga',    lname: 'Padilla',    dept: 'OP' },
    { key: 'CDO_H',   email: 'cdo.head@test.ncst.edu.ph',     fname: 'Carlo',   lname: 'Domingo',    dept: 'CDO' },
  ] as const;
  for (const h of heads) {
    U[h.key] = await ensureUser({
      email: h.email,
      fname: h.fname,
      lname: h.lname,
      role: 'DepartmentHead',
      departmentCode: h.dept,
    });
  }

  // Staff (requestors + ITO assignees)
  const staff = [
    { key: 'STAFF_ACAD', email: 'acad.staff@test.ncst.edu.ph', fname: 'Sam',   lname: 'Villanueva', dept: 'ACAD',  role: 'Staff' },
    { key: 'STAFF_ITO',  email: 'ito.staff@test.ncst.edu.ph',  fname: 'Ian',   lname: 'Navarro',    dept: 'ITO-MAIN', role: 'Staff' },
    { key: 'STAFF_OSA',  email: 'osa.staff@test.ncst.edu.ph',  fname: 'Sarah', lname: 'Lopez',      dept: 'OSA',   role: 'Staff' },
    { key: 'STAFF_HRD',  email: 'hrd.staff@test.ncst.edu.ph',  fname: 'Hazel', lname: 'Ramos',      dept: 'HRD',   role: 'Staff' },
    { key: 'ITO_S1',     email: 'ito.staff1@test.ncst.edu.ph', fname: 'Iggy',  lname: 'Bautista',   dept: 'ITO-MAIN', role: 'Staff' },
    { key: 'ITO_S2',     email: 'ito.staff2@test.ncst.edu.ph', fname: 'Iris',  lname: 'Garcia',     dept: 'ITO-MAIN', role: 'Staff' },
    // 🆕 Extra staff across departments
    { key: 'STAFF_OCM',  email: 'ocm.staff@test.ncst.edu.ph',  fname: 'Oliver', lname: 'Castro',    dept: 'OCM',    role: 'Staff' },
    { key: 'STAFF_PSMO', email: 'psmo.staff@test.ncst.edu.ph', fname: 'Paolo',  lname: 'Aquino',    dept: 'PSMO/FMO', role: 'Staff' },
    { key: 'STAFF_SS',   email: 'safety.staff@test.ncst.edu.ph', fname: 'Sasha', lname: 'Morales',  dept: 'SAFETY-SECURITY', role: 'Staff' },
    { key: 'STAFF_OP',   email: 'op.staff@test.ncst.edu.ph',   fname: 'Owen',   lname: 'Rivera',    dept: 'OP',     role: 'Staff' },
    { key: 'STAFF_CDO',  email: 'cdo.staff@test.ncst.edu.ph',  fname: 'Cleo',   lname: 'Fernandez', dept: 'CDO',    role: 'Staff' },
    { key: 'ITO_S3',     email: 'ito.staff3@test.ncst.edu.ph', fname: 'Iñigo',  lname: 'Salazar',   dept: 'ITO-MAIN', role: 'Staff' },
    { key: 'FACULTY_1',  email: 'faculty1@test.ncst.edu.ph',   fname: 'Felix',  lname: 'Marquez',   dept: 'ACAD',   role: 'Faculty' },
    { key: 'FACULTY_2',  email: 'faculty2@test.ncst.edu.ph',   fname: 'Fiona',  lname: 'Villareal', dept: 'ACAD',   role: 'Faculty' },
    { key: 'ADMIN',      email: 'admin@test.ncst.edu.ph',      fname: 'Ada',    lname: 'Nakamura',  dept: 'ACAD',   role: 'Admin' },
    { key: 'SUPERUSER',  email: 'superuser@test.ncst.edu.ph',  fname: 'Sven',   lname: 'Okafor',    dept: 'ACAD',   role: 'SuperUser' },
  ] as const;
  for (const s of staff) {
    U[s.key] = await ensureUser({
      email: s.email,
      fname: s.fname,
      lname: s.lname,
      role: s.role,
      departmentCode: s.dept,
    });
  }
  console.log(`   ✅ ${Object.keys(U).length} users ready (password: Test1234!)\n`);

  // ---------- 3. PLACES ----------
  console.log('📍 Ensuring event places…');
  const P: Record<string, PlaceRow> = {};
  const places = [
    { key: 'GYM',    name: 'NCST Gym',                branch: 'MAIN', category: 'CATEGORY_2' },
    { key: 'FIELD',  name: 'NCST Field',              branch: 'MAIN', category: 'CATEGORY_2' },
    { key: 'HRM',    name: 'HRM Bar',                 branch: 'MAIN', category: 'CATEGORY_1' },
    { key: 'AVR',    name: 'AVR Main',                branch: 'MAIN', category: 'REGULAR' },
    { key: 'MPH',    name: 'Multi-Purpose Hall 2/F',  branch: 'MAIN', category: 'REGULAR' },
    { key: 'CONF',   name: 'Conference Room A (VIP)', branch: 'MAIN', category: 'VIP' },
    // 🆕 More branches + categories
    { key: 'GYM_IMU',   name: 'NCST Gym - IMUS',           branch: 'IMUS',    category: 'CATEGORY_2' },
    { key: 'AVR_IMU',   name: 'AVR IMUS',                  branch: 'IMUS',    category: 'REGULAR' },
    { key: 'AUD_NAST',  name: 'Auditorium NASTECH',        branch: 'NASTECH', category: 'CATEGORY_1' },
    { key: 'ROOM_NAST', name: 'Multi-Media Room NASTECH',  branch: 'NASTECH', category: 'REGULAR' },
    { key: 'GYM_SHS',   name: 'SHS Gym',                   branch: 'SHS',     category: 'CATEGORY_2' },
    { key: 'LIB',       name: 'Library Function Room',     branch: 'MAIN',    category: 'REGULAR' },
    { key: 'CAFE',      name: 'Student Cafeteria',         branch: 'MAIN',    category: 'REGULAR' },
    { key: 'VIP_LOUNGE',name: 'Presidential Lounge',       branch: 'MAIN',    category: 'VIP' },
  ] as const;
  for (const p of places) P[p.key] = await ensurePlace(p);
  console.log(`   ✅ ${places.length} places ready\n`);

  // ---------- 4. EQUIPMENT ----------
  console.log('🎤 Ensuring equipment…');
  const E: Record<string, EquipRow> = {};
  const eqs = [
    { key: 'LED',    name: 'LED Wall',         departmentCode: 'ITO-MAIN', isSingleItem: true,  quantityAvailable: 1 },
    { key: 'PROJ',   name: 'Projector',        departmentCode: 'ITO-MAIN', isSingleItem: false, quantityAvailable: 10 },
    { key: 'MIC',    name: 'Wireless Mic',     departmentCode: 'ITO-MAIN', isSingleItem: false, quantityAvailable: 20 },
    { key: 'STAND',  name: 'Mic Stand',        departmentCode: 'ITO-MAIN', isSingleItem: false, quantityAvailable: 15 },
    { key: 'CHAIR',  name: 'Monobloc Chair',   departmentCode: 'PSMO/FMO', isSingleItem: false, quantityAvailable: 200 },
    { key: 'TABLE',  name: 'Folding Table',    departmentCode: 'PSMO/FMO', isSingleItem: false, quantityAvailable: 30 },
    // 🆕 More variety for approval-chain testing
    { key: 'TENT',   name: 'Event Tent',       departmentCode: 'PSMO/FMO', isSingleItem: false, quantityAvailable: 8 },
    { key: 'SKIRT',  name: 'Table Skirt',      departmentCode: 'PSMO/FMO', isSingleItem: false, quantityAvailable: 40 },
    { key: 'SPEAKER',name: 'Speaker Set',      departmentCode: 'OP',       isSingleItem: false, quantityAvailable: 4 },
    { key: 'MIXER',  name: 'Audio Mixer',      departmentCode: 'OP',       isSingleItem: true,  quantityAvailable: 2 },
    { key: 'CAM',    name: 'DSLR Camera',      departmentCode: 'CDO',      isSingleItem: false, quantityAvailable: 3 },
    { key: 'TRIPOD', name: 'Camera Tripod',    departmentCode: 'CDO',      isSingleItem: false, quantityAvailable: 5 },
  ] as const;
  for (const e of eqs) E[e.key] = await ensureEquipment(e);
  console.log(`   ✅ ${eqs.length} equipment ready\n`);

  // ---------- 5. FRF RESERVATIONS ----------
  console.log('📋 Creating FRF reservations…\n');
  const YEAR = new Date().getFullYear();

  interface ApprovalSeed {
    dept: string;
    stepOrder: number;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'REVISION_REQUESTED' | 'ACKNOWLEDGED';
    performedByKey?: string;
    performedAt?: Date;
    remarks?: string;
  }

  interface AssignmentSeed {
    userKey: string;
    dutyType: 'SETUP' | 'TEARDOWN' | 'OPERATOR' | 'ASSISTANT';
    dayOffset?: number;
    startHour: number;
    endHour: number;
    isOvertime?: boolean;
    notes?: string;
  }

  interface CreateFRFArgs {
    refSuffix: string;
    requestorKey: string;
    status:
      | 'DRAFT'
      | 'PENDING_APPROVAL'
      | 'APPROVED'
      | 'REVISION_REQUESTED'
      | 'REJECTED'
      | 'COMPLETED'
      | 'CANCELLED'
      | 'RESCHEDULE_PENDING';
    type?: 'EMPLOYEE_ONLY' | 'WITH_STUDENTS';
    eventName: string;
    attendees?: number;
    isVenueOnly?: boolean;
    isReschedule?: boolean;
    daysOffset?: number;
    placeKey?: string;
    equipmentKeys?: string[];
    approvals?: ApprovalSeed[];
    assignments?: AssignmentSeed[];
    packUpDone?: boolean;
    createdDaysAgo?: number;
    originalDatesSnapshot?: Array<{       // 🆕 (for reschedule cards)
      date: Date; setupTime: Date; eventStart: Date;
      eventEnd: Date; teardownTime: Date;
      placeId?: string; placeOther?: string;
    }>;
  }

  async function createFRF({
    refSuffix,
    requestorKey,
    status,
    type = 'EMPLOYEE_ONLY',
    eventName,
    attendees = 50,
    isVenueOnly = false,
    isReschedule = false,
    daysOffset = 14,
    placeKey = 'AVR',
    equipmentKeys = [],
    approvals = [],
    assignments = [],
    packUpDone = false,
    createdDaysAgo = 0,
    originalDatesSnapshot,
  }: CreateFRFArgs) {
    const referenceId = `FRF-SEED-${refSuffix}-${YEAR}`;
    const existing = await prisma.facilityReservation.findUnique({ where: { referenceId } });
    if (existing) {
      console.log(`   ⏭️  ${referenceId} already exists — skipping`);
      return existing;
    }

    const requestor = U[requestorKey];
    if (!requestor) {
      const available = Object.keys(U).sort().join(', ');
      throw new Error(
        `Missing requestor key "${requestorKey}". Available keys: ${available}`,
      );
    }

    const eventDate = daysFromNow(daysOffset);
    const setupTime    = withTime(eventDate, 6);
    const eventStart   = withTime(eventDate, 8);
    const eventEnd     = withTime(eventDate, 17);
    const teardownTime = withTime(eventDate, 19);

    const approvalData = approvals.map(a => ({
      departmentCode: a.dept,
      stepOrder: a.stepOrder,
      status: a.status,
      performedById: a.performedByKey ? U[a.performedByKey]?.id : null,
      performedAt: a.performedAt || null,
      remarks: a.remarks || null,
    }));

    const assignmentData = assignments.map(a => {
      const dutyDate = daysFromNow(daysOffset + (a.dayOffset || 0));
      return {
        userId: U[a.userKey]?.id,
        dutyStart: withTime(dutyDate, a.startHour),
        dutyEnd:   withTime(dutyDate, a.endHour),
        dutyType:  a.dutyType,
        isOvertime: !!a.isOvertime,
        notes: a.notes || null,
      };
    });

    const created = await prisma.facilityReservation.create({
      data: {
        referenceId,
        requestorId: requestor.id,
        requestorDept: requestor.departmentCode,
        type,
        eventName,
        attendeesCount: attendees,
        usageHours: 8,
        withCharge: false,
        requestorNotes: buildContent(
          FRF_NOTE_BLOCKS,
          64,
          refSuffix.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0),
        ),
        status,
        isVenueOnly,
        isReschedule,
        dates: {
          create: [{
            date: eventDate,
            setupTime,
            eventStart,
            eventEnd,
            teardownTime,
            placeId: P[placeKey]?.id,
          }],
        },
        ...(equipmentKeys.length > 0 && {
          equipmentRequests: {
            create: equipmentKeys.map(k => ({
              equipmentId: E[k].id,
              quantityRequested: 1,
            })),
          },
        }),
        ...(approvalData.length > 0 && { approvals: { create: approvalData } }),
        ...(assignmentData.length > 0 && { assignments: { create: assignmentData } }),
        ...(packUpDone && {
          packUpDoneAt: daysFromNow(daysOffset + 1),
          packUpDoneById: U.ITO.id,
          packUpDoneNotes: 'All equipment returned in good condition.',
          packUpDonePhotos: [],
        }),
        ...(createdDaysAgo > 0 && {
          createdAt: daysFromNow(-createdDaysAgo),
        }),
        ...(originalDatesSnapshot && {
          originalDates: originalDatesSnapshot.map(d => ({
            date: d.date.toISOString(),
            setupTime: d.setupTime.toISOString(),
            eventStart: d.eventStart.toISOString(),
            eventEnd: d.eventEnd.toISOString(),
            teardownTime: d.teardownTime.toISOString(),
            placeId: d.placeId,
            placeOther: d.placeOther,
          })),
        }),
      },
    });

    console.log(`   ✅ ${referenceId}  →  ${status}`);
    return created;
  }

    // ═══════════════════════════════════════════════════════════
  // MEMO SEED
  // ═══════════════════════════════════════════════════════════

  interface MemoRecipientSeed {
    dept: string;
    status: 'PENDING' | 'ACKNOWLEDGED' | 'PROCESSING' | 'COMPLETED' | 'CLOSED' | 'DENIED' | 'RESPONDED';
    acknowledgedByName?: string;
    processedByName?: string;
    completedByName?: string;
    closedByName?: string;
    deniedByName?: string;
    feedbackNote?: string;
  }

  interface CreateMemoArgs {
    refSeq: number;
    senderKey: string;
    subject: string;
    priority?: 'ROUTINE' | 'URGENT' | 'RUSH';
    purpose?: 'FYI' | 'SIGNATURE' | 'ACTION' | 'COMMENTS' | 'APPROVAL' | 'REQUEST';
    status: 'DRAFT' | 'FOR_APPROVAL' | 'APPROVED' | 'CLOSED';
    recipients?: MemoRecipientSeed[];
    contentKB?: number;
    createdDaysAgo?: number;
  }

  async function createMemo({
    refSeq,
    senderKey,
    subject,
    priority = 'ROUTINE',
    purpose = 'FYI',
    status,
    recipients = [],
    contentKB = 32,
    createdDaysAgo = 0,
  }: CreateMemoArgs) {
    const referenceId = `MEMO-SEED-${YEAR}-${String(refSeq).padStart(4, '0')}`;
    const existing = await prisma.memo.findUnique({ where: { referenceId } });
    if (existing) {
      console.log(`   ⏭️  ${referenceId} already exists — skipping`);
      return existing;
    }

    const sender = U[senderKey];
    if (!sender) {
      const available = Object.keys(U).sort().join(', ');
      throw new Error(
        `Missing memo sender key "${senderKey}". Available keys: ${available}`,
      );
    }

    const content = buildContent(MEMO_BODY_BLOCKS, contentKB, refSeq);
    const createdAt = createdDaysAgo > 0 ? daysFromNow(-createdDaysAgo) : new Date();
    const deadlineAt =
      priority === 'RUSH'
        ? new Date(createdAt.getTime() + 3 * 24 * 60 * 60 * 1000)
        : null;

    const recipientData = recipients.map(r => ({
      departmentName: r.dept,
      status: r.status,
      acknowledgedByName:
        r.acknowledgedByName || (r.status !== 'PENDING' ? 'Department Head' : null),
      acknowledgedAt: r.status !== 'PENDING' ? new Date() : null,
      processedByName:
        r.processedByName ||
        (['PROCESSING', 'COMPLETED', 'CLOSED'].includes(r.status) ? 'Department Staff' : null),
      processedAt: ['PROCESSING', 'COMPLETED', 'CLOSED'].includes(r.status) ? new Date() : null,
      completedByName:
        r.completedByName ||
        (['COMPLETED', 'CLOSED'].includes(r.status) ? 'Department Staff' : null),
      completedAt: ['COMPLETED', 'CLOSED'].includes(r.status) ? new Date() : null,
      closedByName: r.closedByName || (r.status === 'CLOSED' ? 'Department Head' : null),
      closedAt: r.status === 'CLOSED' ? new Date() : null,
      closedByRole: r.status === 'CLOSED' ? 'RECIPIENT' : null,
      deniedByName: r.deniedByName || (r.status === 'DENIED' ? 'Department Head' : null),
      deniedAt: r.status === 'DENIED' ? new Date() : null,
      respondedAt: r.status === 'RESPONDED' ? new Date() : null,
      feedbackNote: r.feedbackNote || null,
    }));

    const historyData = [
      {
        performedById: sender.id,
        performedByName: `${sender.fname} ${sender.lname}`,
        actorRole: 'SENDER' as const,
        action: 'CREATED' as const,
        remarks: 'Memo created.',
        createdAt,
      },
      ...recipients
        .filter(r => r.status !== 'PENDING')
        .map(r => ({
          departmentName: r.dept,
          performedById: sender.id,
          performedByName: r.acknowledgedByName || 'Department Head',
          actorRole: 'RECIPIENT' as const,
          action: (
            r.status === 'CLOSED'
              ? 'CLOSED'
              : r.status === 'DENIED'
                ? 'DENIED'
                : r.status === 'COMPLETED'
                  ? 'COMPLETED'
                  : r.status === 'PROCESSING'
                    ? 'PROCESSING_STARTED'
                    : 'ACKNOWLEDGED'
          ) as 'CLOSED' | 'DENIED' | 'COMPLETED' | 'PROCESSING_STARTED' | 'ACKNOWLEDGED',
          remarks: `${r.status.charAt(0) + r.status.slice(1).toLowerCase()} by recipient.`,
          createdAt: new Date(),
        })),
    ];

    const created = await prisma.memo.create({
      data: {
        referenceId,
        subject,
        content,
        priority,
        purpose,
        senderId: sender.id,
        senderName: `${sender.fname} ${sender.lname}`,
        senderDept: sender.departmentCode,
        status,
        deadlineAt,
        createdAt,
        lastActivityAt: createdAt,
        ...(recipientData.length > 0 && { recipients: { create: recipientData } }),
        history: { create: historyData },
      },
    });

    console.log(`   ✅ ${referenceId}  →  ${status}  (${content.length} chars)`);
    return created;
  }

  // ── 01. DRAFT (ACAD staff) ────────────────────────────────────
  await createFRF({
    refSuffix: 'ACAD-9001',
    requestorKey: 'STAFF_ACAD',
    status: 'DRAFT',
    eventName: 'Draft — Intramurals Planning',
    attendees: 100,
    placeKey: 'GYM',
    equipmentKeys: ['MIC', 'CHAIR'],
  });

  // ── 02. DRAFT (ITO staff — sees own dept draft) ──────────────
  await createFRF({
    refSuffix: 'ITOMAIN-9002',
    requestorKey: 'STAFF_ITO',
    status: 'DRAFT',
    eventName: 'Draft — IT Orientation',
    attendees: 30,
    placeKey: 'AVR',
    equipmentKeys: ['PROJ', 'MIC'],
  });

  // ── 03. PENDING_APPROVAL — step 1 waiting on PSMO ───────────
  await createFRF({
    refSuffix: 'ACAD-9003',
    requestorKey: 'STAFF_ACAD',
    status: 'PENDING_APPROVAL',
    eventName: 'Research Symposium 2026',
    attendees: 150,
    placeKey: 'AVR',
    equipmentKeys: ['PROJ', 'MIC'],
    daysOffset: 21,
    approvals: [
      { dept: 'PSMO/FMO',        stepOrder: 1, status: 'PENDING' },
      { dept: 'OCM',              stepOrder: 2, status: 'PENDING' },
      { dept: 'SAFETY-SECURITY', stepOrder: 3, status: 'PENDING' },
      { dept: 'ITO-MAIN',         stepOrder: 4, status: 'PENDING' },
    ],
  });

  // ── 04. PENDING_APPROVAL — step 1 approved, waiting on OSA ──
  await createFRF({
    refSuffix: 'OSA-9004',
    requestorKey: 'STAFF_OSA',
    status: 'PENDING_APPROVAL',
    type: 'WITH_STUDENTS',
    eventName: 'Student Leadership Summit',
    attendees: 80,
    placeKey: 'MPH',
    equipmentKeys: ['PROJ'],
    daysOffset: 18,
    approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'APPROVED',
        performedByKey: 'PSMO', performedAt: new Date(), remarks: 'Facility clear.' },
      { dept: 'OSA',              stepOrder: 2, status: 'PENDING' },
      { dept: 'OCM',              stepOrder: 3, status: 'PENDING' },
      { dept: 'SAFETY-SECURITY', stepOrder: 4, status: 'PENDING' },
    ],
  });

  // ── 05. APPROVED — all depts approved, awaiting ITO assignment
  await createFRF({
    refSuffix: 'ACAD-9005',
    requestorKey: 'STAFF_ACAD',
    status: 'APPROVED',
    eventName: 'Faculty General Assembly',
    attendees: 200,
    placeKey: 'GYM',
    equipmentKeys: ['MIC', 'PROJ'],
    daysOffset: 10,
    approvals: [
      { dept: 'PSMO/FMO',        stepOrder: 1, status: 'APPROVED', performedByKey: 'PSMO', performedAt: new Date(), remarks: 'OK.' },
      { dept: 'OCM',              stepOrder: 2, status: 'APPROVED', performedByKey: 'OCM',  performedAt: new Date(), remarks: 'OK.' },
      { dept: 'SAFETY-SECURITY', stepOrder: 3, status: 'APPROVED', performedByKey: 'SS',   performedAt: new Date(), remarks: 'OK.' },
      { dept: 'ITO-MAIN',         stepOrder: 4, status: 'APPROVED', performedByKey: 'ITO',  performedAt: new Date(), remarks: 'Assigned.' },
    ],
  });

  // ── 06. COMPLETED — past event + assignments + pack-up done ─
  await createFRF({
    refSuffix: 'ACAD-9006',
    requestorKey: 'STAFF_ACAD',
    status: 'COMPLETED',
    eventName: 'Alumni Homecoming 2026',
    attendees: 250,
    placeKey: 'GYM',
    equipmentKeys: ['MIC', 'PROJ', 'CHAIR'],
    daysOffset: -5,
    approvals: [
      { dept: 'PSMO/FMO',        stepOrder: 1, status: 'APPROVED', performedByKey: 'PSMO', performedAt: daysFromNow(-10), remarks: 'OK.' },
      { dept: 'OCM',              stepOrder: 2, status: 'APPROVED', performedByKey: 'OCM',  performedAt: daysFromNow(-10), remarks: 'OK.' },
      { dept: 'SAFETY-SECURITY', stepOrder: 3, status: 'APPROVED', performedByKey: 'SS',   performedAt: daysFromNow(-10), remarks: 'OK.' },
      { dept: 'ITO-MAIN',         stepOrder: 4, status: 'APPROVED', performedByKey: 'ITO',  performedAt: daysFromNow(-10), remarks: 'Assigned.' },
    ],
    assignments: [
      { userKey: 'ITO_S1', dutyType: 'SETUP',     dayOffset: -5, startHour: 6,  endHour: 8,  isOvertime: true },
      { userKey: 'ITO_S1', dutyType: 'OPERATOR',  dayOffset: -5, startHour: 8,  endHour: 17 },
      { userKey: 'ITO_S2', dutyType: 'TEARDOWN',  dayOffset: -5, startHour: 17, endHour: 20, isOvertime: true },
    ],
    packUpDone: true,
  });

  // ── 07. REJECTED by PSMO ────────────────────────────────────
  await createFRF({
    refSuffix: 'OSA-9007',
    requestorKey: 'STAFF_OSA',
    status: 'REJECTED',
    type: 'WITH_STUDENTS',
    eventName: 'Outdoor Concert Proposal',
    attendees: 500,
    placeKey: 'FIELD',
    daysOffset: 30,
    approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'REJECTED',
        performedByKey: 'PSMO', performedAt: new Date(), remarks: 'Field is under repair.' },
      { dept: 'OSA',      stepOrder: 2, status: 'REJECTED',
        remarks: 'Blocked by PSMO rejection.' },
    ],
  });

  // ── 08. REVISION_REQUESTED by OCM ───────────────────────────
  await createFRF({
    refSuffix: 'ACAD-9008',
    requestorKey: 'STAFF_ACAD',
    status: 'REVISION_REQUESTED',
    eventName: 'Weekend Seminar',
    attendees: 40,
    placeKey: 'CONF',
    equipmentKeys: ['PROJ'],
    daysOffset: 15,
    approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'APPROVED',
        performedByKey: 'PSMO', performedAt: new Date(), remarks: 'OK.' },
      { dept: 'OCM',      stepOrder: 2, status: 'REVISION_REQUESTED',
        performedByKey: 'OCM', performedAt: new Date(),
        remarks: 'Please provide more detail or move to a smaller room.' },
    ],
  });

  // ── 09. RESCHEDULE_PENDING ──────────────────────────────────
  await createFRF({
    refSuffix: 'ACAD-9009',
    requestorKey: 'STAFF_ACAD',
    status: 'RESCHEDULE_PENDING',
    eventName: 'Department Retreat (Rescheduled)',
    attendees: 60,
    placeKey: 'MPH',
    equipmentKeys: ['PROJ'],
    daysOffset: 25,
    isReschedule: true,
    approvals: [
      { dept: 'PSMO/FMO',        stepOrder: 1, status: 'PENDING' },
      { dept: 'OCM',              stepOrder: 2, status: 'PENDING' },
      { dept: 'SAFETY-SECURITY', stepOrder: 3, status: 'PENDING' },
    ],
  });

  // ── 10. DRAFT (HRD staff — proves multi-dept filtering) ─────
  await createFRF({
    refSuffix: 'HRD-9010',
    requestorKey: 'STAFF_HRD',
    status: 'DRAFT',
    eventName: 'HR Onboarding Session',
    attendees: 25,
    placeKey: 'AVR',
    equipmentKeys: ['MIC'],
  });

    // ═══════════════════════════════════════════════════════════
  // EXPANDED SEED (30 more records)
  // ═══════════════════════════════════════════════════════════

  // ── 11-15. MORE DRAFTS (5) ─────────────────────────────────
  await createFRF({
    refSuffix: 'OCM-9011', requestorKey: 'STAFF_OCM', status: 'DRAFT',
    eventName: 'Draft — Marketing Campaign Briefing',
    attendees: 20, placeKey: 'CONF', equipmentKeys: ['PROJ'],
  });

  await createFRF({
    refSuffix: 'PSMO-9012', requestorKey: 'STAFF_PSMO', status: 'DRAFT',
    eventName: 'Draft — Facility Inspection',
    attendees: 10, placeKey: 'LIB',
  });

  await createFRF({
    refSuffix: 'SS-9013', requestorKey: 'STAFF_SS', status: 'DRAFT',
    eventName: 'Draft — Safety Drill Simulation',
    attendees: 300, placeKey: 'GYM', equipmentKeys: ['LED', 'MIC'],
  });

  await createFRF({
    refSuffix: 'OP-9014', requestorKey: 'STAFF_OP', status: 'DRAFT',
    eventName: 'Draft — Board Meeting Setup',
    attendees: 15, placeKey: 'VIP_LOUNGE', equipmentKeys: ['SPEAKER'],
  });

  await createFRF({
    refSuffix: 'FACULTY-9015', requestorKey: 'FACULTY_1', status: 'DRAFT',
    eventName: 'Draft — Thesis Defense Setup',
    attendees: 12, placeKey: 'CONF', equipmentKeys: ['PROJ', 'MIC'],
  });

  // ── 16-22. PENDING_APPROVAL STEP 1 (7) ─────────────────────
  await createFRF({
    refSuffix: 'OCM-9016', requestorKey: 'STAFF_OCM', status: 'PENDING_APPROVAL',
    eventName: 'Marketing Launch Event',
    attendees: 80, placeKey: 'AVR', equipmentKeys: ['PROJ', 'MIC'], daysOffset: 20,
    approvals: [
      { dept: 'OCM', stepOrder: 1, status: 'PENDING' },
      { dept: 'PSMO/FMO', stepOrder: 2, status: 'PENDING' },
      { dept: 'SAFETY-SECURITY', stepOrder: 3, status: 'PENDING' },
      { dept: 'ITO-MAIN', stepOrder: 4, status: 'PENDING' },
    ],
  });

  await createFRF({
    refSuffix: 'SS-9017', requestorKey: 'STAFF_SS', status: 'PENDING_APPROVAL',
    eventName: 'Emergency Response Drill',
    attendees: 400, placeKey: 'GYM', equipmentKeys: ['LED', 'MIC', 'SPEAKER'], daysOffset: 28,
    approvals: [
      { dept: 'SAFETY-SECURITY', stepOrder: 1, status: 'PENDING' },
      { dept: 'PSMO/FMO', stepOrder: 2, status: 'PENDING' },
      { dept: 'OP', stepOrder: 3, status: 'PENDING' },  // LED wall
      { dept: 'OCM', stepOrder: 4, status: 'PENDING' },
      { dept: 'ITO-MAIN', stepOrder: 5, status: 'PENDING' },
    ],
  });

  await createFRF({
    refSuffix: 'OP-9018', requestorKey: 'STAFF_OP', status: 'PENDING_APPROVAL',
    eventName: 'Presidential Address Rehearsal',
    attendees: 250, placeKey: 'AVR_IMU', daysOffset: 15,
    approvals: [
      { dept: 'OP', stepOrder: 1, status: 'PENDING' },
      { dept: 'PSMO/FMO', stepOrder: 2, status: 'PENDING' },
      { dept: 'SAFETY-SECURITY', stepOrder: 3, status: 'PENDING' },
    ],
  });

  await createFRF({
    refSuffix: 'CDO-9019', requestorKey: 'STAFF_CDO', status: 'PENDING_APPROVAL',
    eventName: 'Photoshoot for Yearbook',
    attendees: 25, placeKey: 'AUD_NAST', equipmentKeys: ['CAM', 'TRIPOD'], daysOffset: 22,
    approvals: [
      { dept: 'CDO', stepOrder: 1, status: 'PENDING' },
      { dept: 'PSMO/FMO', stepOrder: 2, status: 'PENDING' },
      { dept: 'SAFETY-SECURITY', stepOrder: 3, status: 'PENDING' },
    ],
  });

  // 🎯 Tests ITO-MAIN staff-created (self-assign bug path)
  await createFRF({
    refSuffix: 'ITOMAIN-9020', requestorKey: 'STAFF_ITO', status: 'PENDING_APPROVAL',
    eventName: 'IT Infrastructure Upgrade Briefing',
    attendees: 35, placeKey: 'ROOM_NAST', equipmentKeys: ['PROJ', 'MIC'], daysOffset: 18,
    approvals: [
      { dept: 'ITO-MAIN', stepOrder: 1, status: 'PENDING' },
      { dept: 'PSMO/FMO', stepOrder: 2, status: 'PENDING' },
      { dept: 'SAFETY-SECURITY', stepOrder: 3, status: 'PENDING' },
    ],
  });

  await createFRF({
    refSuffix: 'FACULTY-9021', requestorKey: 'FACULTY_2', status: 'PENDING_APPROVAL',
    eventName: 'Guest Lecture — Industry Expert',
    attendees: 100, placeKey: 'AVR', equipmentKeys: ['PROJ'], daysOffset: 14,
    approvals: [
      { dept: 'ACAD', stepOrder: 1, status: 'PENDING' },
      { dept: 'PSMO/FMO', stepOrder: 2, status: 'PENDING' },
      { dept: 'SAFETY-SECURITY', stepOrder: 3, status: 'PENDING' },
    ],
  });

  await createFRF({
    refSuffix: 'PSMO-9022', requestorKey: 'STAFF_PSMO', status: 'PENDING_APPROVAL',
    eventName: 'Facility Maintenance Briefing',
    attendees: 15, placeKey: 'LIB', daysOffset: 12,
    approvals: [
      // PSMO is both requestor AND approver step 1 → step 1 must be APPROVED (head override)
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'PENDING' },
      { dept: 'OCM', stepOrder: 2, status: 'PENDING' },
      { dept: 'SAFETY-SECURITY', stepOrder: 3, status: 'PENDING' },
    ],
  });

  // ── 23-26. PENDING AT DEEPER STEPS (4) ─────────────────────
  await createFRF({
    refSuffix: 'OCM-9023', requestorKey: 'STAFF_OCM', status: 'PENDING_APPROVAL',
    eventName: 'Brand Refresh Presentation',
    attendees: 60, placeKey: 'AVR', equipmentKeys: ['PROJ'], daysOffset: 16,
    approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'APPROVED', performedByKey: 'PSMO', performedAt: new Date(), remarks: 'OK.' },
      { dept: 'OCM', stepOrder: 2, status: 'PENDING' },
      { dept: 'SAFETY-SECURITY', stepOrder: 3, status: 'PENDING' },
      { dept: 'ITO-MAIN', stepOrder: 4, status: 'PENDING' },
    ],
  });

  await createFRF({
    refSuffix: 'OP-9024', requestorKey: 'STAFF_OP', status: 'PENDING_APPROVAL',
    eventName: 'Leadership Summit',
    attendees: 120, placeKey: 'AUD_NAST', equipmentKeys: ['SPEAKER', 'MIC'], daysOffset: 24,
    approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'APPROVED', performedByKey: 'PSMO', performedAt: new Date(), remarks: 'OK.' },
      { dept: 'OCM', stepOrder: 2, status: 'APPROVED', performedByKey: 'OCM', performedAt: new Date(), remarks: 'OK.' },
      { dept: 'SAFETY-SECURITY', stepOrder: 3, status: 'PENDING' },
      { dept: 'ITO-MAIN', stepOrder: 4, status: 'PENDING' },
    ],
  });

  await createFRF({
    refSuffix: 'CDO-9025', requestorKey: 'STAFF_CDO', status: 'PENDING_APPROVAL',
    eventName: 'Video Production — Recruitment Ad',
    attendees: 40, placeKey: 'AVR_IMU', equipmentKeys: ['CAM', 'TRIPOD', 'PROJ'], daysOffset: 20,
    approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'APPROVED', performedByKey: 'PSMO', performedAt: new Date(), remarks: 'OK.' },
      { dept: 'CDO', stepOrder: 2, status: 'APPROVED', performedByKey: 'CDO_H', performedAt: new Date(), remarks: 'OK.' },
      { dept: 'SAFETY-SECURITY', stepOrder: 3, status: 'APPROVED', performedByKey: 'SS', performedAt: new Date(), remarks: 'OK.' },
      { dept: 'ITO-MAIN', stepOrder: 4, status: 'PENDING' },   // ← needs assignment
    ],
  });

  await createFRF({
    refSuffix: 'OSA-9026', requestorKey: 'STAFF_OSA', status: 'PENDING_APPROVAL',
    type: 'WITH_STUDENTS',
    eventName: 'Student Fair 2026',
    attendees: 300, placeKey: 'GYM_SHS', equipmentKeys: ['MIC', 'CHAIR', 'TENT'], daysOffset: 30,
    approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'APPROVED', performedByKey: 'PSMO', performedAt: new Date(), remarks: 'OK.' },
      { dept: 'OSA', stepOrder: 2, status: 'PENDING' },
      { dept: 'OCM', stepOrder: 3, status: 'PENDING' },
      { dept: 'SAFETY-SECURITY', stepOrder: 4, status: 'PENDING' },
      { dept: 'ITO-MAIN', stepOrder: 5, status: 'PENDING' },
    ],
  });

  // ── 27-30. APPROVED (4) ────────────────────────────────────
  await createFRF({
    refSuffix: 'OCM-9027', requestorKey: 'STAFF_OCM', status: 'APPROVED',
    eventName: 'Product Launch Event',
    attendees: 100, placeKey: 'AVR', equipmentKeys: ['MIC', 'PROJ'], daysOffset: 8,
    approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'APPROVED', performedByKey: 'PSMO', performedAt: new Date(), remarks: 'OK.' },
      { dept: 'OCM', stepOrder: 2, status: 'APPROVED', performedByKey: 'OCM', performedAt: new Date(), remarks: 'OK.' },
      { dept: 'SAFETY-SECURITY', stepOrder: 3, status: 'APPROVED', performedByKey: 'SS', performedAt: new Date(), remarks: 'OK.' },
      { dept: 'ITO-MAIN', stepOrder: 4, status: 'APPROVED', performedByKey: 'ITO', performedAt: new Date(), remarks: 'Assigned.' },
    ],
    assignments: [
      { userKey: 'ITO_S1', dutyType: 'SETUP', dayOffset: 8, startHour: 6, endHour: 8, isOvertime: true },
      { userKey: 'ITO_S2', dutyType: 'OPERATOR', dayOffset: 8, startHour: 8, endHour: 17 },
    ],
  });

  await createFRF({
    refSuffix: 'SS-9028', requestorKey: 'STAFF_SS', status: 'APPROVED',
    eventName: 'Fire Safety Seminar',
    attendees: 150, placeKey: 'GYM', equipmentKeys: ['MIC', 'SPEAKER'], daysOffset: 6,
    approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'APPROVED', performedByKey: 'PSMO', performedAt: new Date(), remarks: 'OK.' },
      { dept: 'SAFETY-SECURITY', stepOrder: 2, status: 'APPROVED', performedByKey: 'SS', performedAt: new Date(), remarks: 'OK.' },
      { dept: 'ITO-MAIN', stepOrder: 3, status: 'APPROVED', performedByKey: 'ITO', performedAt: new Date(), remarks: 'Assigned.' },
    ],
    assignments: [
      { userKey: 'ITO_S3', dutyType: 'SETUP', dayOffset: 6, startHour: 6, endHour: 8, isOvertime: true },
      { userKey: 'ITO_S3', dutyType: 'TEARDOWN', dayOffset: 6, startHour: 17, endHour: 20, isOvertime: true },
    ],
  });

  await createFRF({
    refSuffix: 'ACAD-9029', requestorKey: 'STAFF_ACAD', status: 'APPROVED',
    eventName: 'Library Study Session',
    attendees: 30, placeKey: 'LIB', equipmentKeys: [],
    daysOffset: 5, isVenueOnly: true,
    approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'APPROVED', performedByKey: 'PSMO', performedAt: new Date(), remarks: 'OK.' },
      { dept: 'OCM', stepOrder: 2, status: 'APPROVED', performedByKey: 'OCM', performedAt: new Date(), remarks: 'OK.' },
      { dept: 'SAFETY-SECURITY', stepOrder: 3, status: 'APPROVED', performedByKey: 'SS', performedAt: new Date(), remarks: 'OK.' },
      // no ITO — venue only
    ],
  });

  await createFRF({
    refSuffix: 'OP-9030', requestorKey: 'STAFF_OP', status: 'APPROVED',
    eventName: 'Board of Trustees Meeting',
    attendees: 20, placeKey: 'VIP_LOUNGE', equipmentKeys: ['SPEAKER', 'MIXER'], daysOffset: 4,
    approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'APPROVED', performedByKey: 'PSMO', performedAt: new Date(), remarks: 'OK.' },
      { dept: 'OP', stepOrder: 2, status: 'APPROVED', performedByKey: 'OP_H', performedAt: new Date(), remarks: 'OK.' },
      { dept: 'OCM', stepOrder: 3, status: 'APPROVED', performedByKey: 'OCM', performedAt: new Date(), remarks: 'OK.' },
      { dept: 'SAFETY-SECURITY', stepOrder: 4, status: 'APPROVED', performedByKey: 'SS', performedAt: new Date(), remarks: 'OK.' },
      { dept: 'ITO-MAIN', stepOrder: 5, status: 'APPROVED', performedByKey: 'ITO', performedAt: new Date(), remarks: 'Assigned.' },
    ],
    assignments: [
      { userKey: 'ITO_S1', dutyType: 'SETUP', dayOffset: 4, startHour: 7, endHour: 9, isOvertime: true },
    ],
  });

  // ── 31-36. COMPLETED (backdated for analytics) ─────────────
  await createFRF({
    refSuffix: 'ACAD-9031', requestorKey: 'STAFF_ACAD', status: 'COMPLETED',
    eventName: 'General Assembly — Q1',
    attendees: 180, placeKey: 'GYM', equipmentKeys: ['MIC', 'PROJ'],
    daysOffset: -90, createdDaysAgo: 95, packUpDone: true,
    approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'APPROVED', performedByKey: 'PSMO', performedAt: daysFromNow(-92), remarks: 'OK.' },
      { dept: 'OCM', stepOrder: 2, status: 'APPROVED', performedByKey: 'OCM', performedAt: daysFromNow(-92), remarks: 'OK.' },
      { dept: 'SAFETY-SECURITY', stepOrder: 3, status: 'APPROVED', performedByKey: 'SS', performedAt: daysFromNow(-92), remarks: 'OK.' },
      { dept: 'ITO-MAIN', stepOrder: 4, status: 'APPROVED', performedByKey: 'ITO', performedAt: daysFromNow(-92), remarks: 'Assigned.' },
    ],
    assignments: [
      { userKey: 'ITO_S1', dutyType: 'SETUP', dayOffset: -90, startHour: 6, endHour: 8, isOvertime: true },
      { userKey: 'ITO_S2', dutyType: 'OPERATOR', dayOffset: -90, startHour: 8, endHour: 17 },
    ],
  });

  await createFRF({
    refSuffix: 'OCM-9032', requestorKey: 'STAFF_OCM', status: 'COMPLETED',
    eventName: 'Recruitment Fair 2026',
    attendees: 500, placeKey: 'GYM', equipmentKeys: ['LED', 'MIC', 'SPEAKER'],
    daysOffset: -60, createdDaysAgo: 75, packUpDone: true,
    approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'APPROVED', performedByKey: 'PSMO', performedAt: daysFromNow(-70), remarks: 'OK.' },
      { dept: 'OCM', stepOrder: 2, status: 'APPROVED', performedByKey: 'OCM', performedAt: daysFromNow(-70), remarks: 'OK.' },
      { dept: 'OP', stepOrder: 3, status: 'APPROVED', performedByKey: 'OP_H', performedAt: daysFromNow(-70), remarks: 'LED wall checked.' },
      { dept: 'SAFETY-SECURITY', stepOrder: 4, status: 'APPROVED', performedByKey: 'SS', performedAt: daysFromNow(-70), remarks: 'OK.' },
      { dept: 'ITO-MAIN', stepOrder: 5, status: 'APPROVED', performedByKey: 'ITO', performedAt: daysFromNow(-70), remarks: 'Assigned.' },
    ],
    assignments: [
      { userKey: 'ITO_S1', dutyType: 'SETUP', dayOffset: -60, startHour: 5, endHour: 8, isOvertime: true },
      { userKey: 'ITO_S2', dutyType: 'OPERATOR', dayOffset: -60, startHour: 8, endHour: 18 },
      { userKey: 'ITO_S3', dutyType: 'TEARDOWN', dayOffset: -60, startHour: 18, endHour: 22, isOvertime: true },
    ],
  });

  await createFRF({
    refSuffix: 'OP-9033', requestorKey: 'STAFF_OP', status: 'COMPLETED',
    eventName: 'President\'s Birthday Celebration',
    attendees: 220, placeKey: 'AUD_NAST', equipmentKeys: ['SPEAKER', 'MIC'],
    daysOffset: -30, createdDaysAgo: 45, packUpDone: true,
    approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'APPROVED', performedByKey: 'PSMO', performedAt: daysFromNow(-40), remarks: 'OK.' },
      { dept: 'OP', stepOrder: 2, status: 'APPROVED', performedByKey: 'OP_H', performedAt: daysFromNow(-40), remarks: 'OK.' },
      { dept: 'OCM', stepOrder: 3, status: 'APPROVED', performedByKey: 'OCM', performedAt: daysFromNow(-40), remarks: 'OK.' },
      { dept: 'SAFETY-SECURITY', stepOrder: 4, status: 'APPROVED', performedByKey: 'SS', performedAt: daysFromNow(-40), remarks: 'OK.' },
      { dept: 'ITO-MAIN', stepOrder: 5, status: 'APPROVED', performedByKey: 'ITO', performedAt: daysFromNow(-40), remarks: 'Assigned.' },
    ],
    assignments: [
      { userKey: 'ITO_S3', dutyType: 'OPERATOR', dayOffset: -30, startHour: 8, endHour: 20 },
    ],
  });

  await createFRF({
    refSuffix: 'SS-9034', requestorKey: 'STAFF_SS', status: 'COMPLETED',
    eventName: 'Earthquake Drill',
    attendees: 800, placeKey: 'FIELD', equipmentKeys: ['MIC', 'SPEAKER'],
    daysOffset: -14, createdDaysAgo: 21, packUpDone: true,
    approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'APPROVED', performedByKey: 'PSMO', performedAt: daysFromNow(-18), remarks: 'OK.' },
      { dept: 'SAFETY-SECURITY', stepOrder: 2, status: 'APPROVED', performedByKey: 'SS', performedAt: daysFromNow(-18), remarks: 'OK.' },
      { dept: 'ITO-MAIN', stepOrder: 3, status: 'APPROVED', performedByKey: 'ITO', performedAt: daysFromNow(-18), remarks: 'Assigned.' },
    ],
    assignments: [
      { userKey: 'ITO_S1', dutyType: 'SETUP', dayOffset: -14, startHour: 5, endHour: 7, isOvertime: true },
      { userKey: 'ITO_S1', dutyType: 'OPERATOR', dayOffset: -14, startHour: 7, endHour: 12 },
      { userKey: 'ITO_S2', dutyType: 'TEARDOWN', dayOffset: -14, startHour: 12, endHour: 14 },
    ],
  });

  await createFRF({
    refSuffix: 'FACULTY-9035', requestorKey: 'FACULTY_1', status: 'COMPLETED',
    eventName: 'Seminar on AI Ethics',
    attendees: 75, placeKey: 'AVR', equipmentKeys: ['PROJ', 'MIC'],
    daysOffset: -7, createdDaysAgo: 14, packUpDone: true,
    approvals: [
      { dept: 'ACAD', stepOrder: 1, status: 'APPROVED', performedByKey: 'ACAD_H', performedAt: daysFromNow(-10), remarks: 'OK.' },
      { dept: 'PSMO/FMO', stepOrder: 2, status: 'APPROVED', performedByKey: 'PSMO', performedAt: daysFromNow(-10), remarks: 'OK.' },
      { dept: 'SAFETY-SECURITY', stepOrder: 3, status: 'APPROVED', performedByKey: 'SS', performedAt: daysFromNow(-10), remarks: 'OK.' },
      { dept: 'ITO-MAIN', stepOrder: 4, status: 'APPROVED', performedByKey: 'ITO', performedAt: daysFromNow(-10), remarks: 'Assigned.' },
    ],
    assignments: [
      { userKey: 'ITO_S2', dutyType: 'SETUP', dayOffset: -7, startHour: 6, endHour: 8, isOvertime: true },
      { userKey: 'ITO_S2', dutyType: 'OPERATOR', dayOffset: -7, startHour: 8, endHour: 17 },
    ],
  });

  // Completed but NOT yet pack-up done → shows in "Assigned to Me" for ITO staff
  await createFRF({
    refSuffix: 'ACAD-9036', requestorKey: 'STAFF_ACAD', status: 'COMPLETED',
    eventName: 'Faculty Retreat',
    attendees: 60, placeKey: 'MPH', equipmentKeys: ['PROJ'],
    daysOffset: -1, createdDaysAgo: 10,
    approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'APPROVED', performedByKey: 'PSMO', performedAt: daysFromNow(-8), remarks: 'OK.' },
      { dept: 'OCM', stepOrder: 2, status: 'APPROVED', performedByKey: 'OCM', performedAt: daysFromNow(-8), remarks: 'OK.' },
      { dept: 'SAFETY-SECURITY', stepOrder: 3, status: 'APPROVED', performedByKey: 'SS', performedAt: daysFromNow(-8), remarks: 'OK.' },
      { dept: 'ITO-MAIN', stepOrder: 4, status: 'APPROVED', performedByKey: 'ITO', performedAt: daysFromNow(-8), remarks: 'Assigned.' },
    ],
    assignments: [
      { userKey: 'ITO_S1', dutyType: 'SETUP', dayOffset: -1, startHour: 6, endHour: 8, isOvertime: true },
      { userKey: 'ITO_S1', dutyType: 'OPERATOR', dayOffset: -1, startHour: 8, endHour: 17 },
    ],
    // Note: packUpDone NOT set → shows in ITO_S1's "Assigned to Me" tab
  });

  // ── 37-39. REJECTED (3) ────────────────────────────────────
  await createFRF({
    refSuffix: 'SS-9037', requestorKey: 'STAFF_SS', status: 'REJECTED',
    eventName: 'Outdoor Sports Fest',
    attendees: 600, placeKey: 'FIELD', daysOffset: 20, createdDaysAgo: 5,
    approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'REJECTED', performedByKey: 'PSMO', performedAt: new Date(), remarks: 'Field unavailable during this period.' },
      { dept: 'SAFETY-SECURITY', stepOrder: 2, status: 'REJECTED', remarks: 'Blocked by PSMO.' },
    ],
  });

  await createFRF({
    refSuffix: 'CDO-9038', requestorKey: 'STAFF_CDO', status: 'REJECTED',
    eventName: 'Late Night Photo Shoot',
    attendees: 10, placeKey: 'AVR', equipmentKeys: ['CAM'], daysOffset: 10, createdDaysAgo: 3,
    approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'APPROVED', performedByKey: 'PSMO', performedAt: new Date(), remarks: 'OK.' },
      { dept: 'CDO', stepOrder: 2, status: 'APPROVED', performedByKey: 'CDO_H', performedAt: new Date(), remarks: 'OK.' },
      { dept: 'SAFETY-SECURITY', stepOrder: 3, status: 'REJECTED', performedByKey: 'SS', performedAt: new Date(), remarks: 'No after-hours access approved.' },
    ],
  });

  await createFRF({
    refSuffix: 'OSA-9039', requestorKey: 'STAFF_OSA', status: 'REJECTED',
    type: 'WITH_STUDENTS',
    eventName: 'Student Overnight Camp',
    attendees: 100, placeKey: 'GYM_SHS', daysOffset: 25, createdDaysAgo: 4,
    approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'APPROVED', performedByKey: 'PSMO', performedAt: new Date(), remarks: 'OK.' },
      { dept: 'OSA', stepOrder: 2, status: 'REJECTED', performedByKey: 'OSA_H', performedAt: new Date(), remarks: 'No overnight activities allowed by policy.' },
    ],
  });

  // ── 40-41. REVISION_REQUESTED (2) ──────────────────────────
  await createFRF({
    refSuffix: 'PSMO-9040', requestorKey: 'STAFF_PSMO', status: 'REVISION_REQUESTED',
    eventName: 'Equipment Inventory Meeting',
    attendees: 20, placeKey: 'LIB', daysOffset: 12, createdDaysAgo: 6,
    approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'APPROVED', performedByKey: 'PSMO', performedAt: new Date(), remarks: 'OK.' },
      { dept: 'OCM', stepOrder: 2, status: 'REVISION_REQUESTED', performedByKey: 'OCM', performedAt: new Date(), remarks: 'Please attach the inventory list to your request.' },
    ],
  });

  await createFRF({
    refSuffix: 'OCM-9041', requestorKey: 'STAFF_OCM', status: 'REVISION_REQUESTED',
    eventName: 'Brand Film Premiere',
    attendees: 90, placeKey: 'AUD_NAST', equipmentKeys: ['PROJ', 'SPEAKER'], daysOffset: 15, createdDaysAgo: 8,
    approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'APPROVED', performedByKey: 'PSMO', performedAt: new Date(), remarks: 'OK.' },
      { dept: 'OCM', stepOrder: 2, status: 'APPROVED', performedByKey: 'OCM', performedAt: new Date(), remarks: 'OK.' },
      { dept: 'SAFETY-SECURITY', stepOrder: 3, status: 'APPROVED', performedByKey: 'SS', performedAt: new Date(), remarks: 'OK.' },
      { dept: 'ITO-MAIN', stepOrder: 4, status: 'REVISION_REQUESTED', performedByKey: 'ITO', performedAt: new Date(), remarks: 'Please specify the number of speakers required.' },
    ],
  });

  // ── 42-44. RESCHEDULE_PENDING (with original snapshot) ─────
  const origSnap1 = {
    date: daysFromNow(20), setupTime: withTime(daysFromNow(20), 6),
    eventStart: withTime(daysFromNow(20), 8), eventEnd: withTime(daysFromNow(20), 17),
    teardownTime: withTime(daysFromNow(20), 19), placeId: P.AVR.id,
  };
  await createFRF({
    refSuffix: 'ACAD-9042', requestorKey: 'STAFF_ACAD', status: 'RESCHEDULE_PENDING',
    eventName: 'Postponed: Training Workshop',
    attendees: 45, placeKey: 'AUD_NAST', equipmentKeys: ['PROJ', 'MIC'],
    daysOffset: 32, createdDaysAgo: 15, isReschedule: true,
    approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'PENDING' },
      { dept: 'OCM', stepOrder: 2, status: 'PENDING' },
      { dept: 'SAFETY-SECURITY', stepOrder: 3, status: 'PENDING' },
      { dept: 'ITO-MAIN', stepOrder: 4, status: 'PENDING' },
    ],
    originalDatesSnapshot: [origSnap1],
  });

  const origSnap2 = {
    date: daysFromNow(18), setupTime: withTime(daysFromNow(18), 6),
    eventStart: withTime(daysFromNow(18), 8), eventEnd: withTime(daysFromNow(18), 17),
    teardownTime: withTime(daysFromNow(18), 19), placeId: P.GYM.id,
  };
  await createFRF({
    refSuffix: 'ITOMAIN-9043', requestorKey: 'STAFF_ITO', status: 'RESCHEDULE_PENDING',
    eventName: 'Postponed: ITO Year-end Party',
    attendees: 60, placeKey: 'ROOM_NAST', equipmentKeys: ['PROJ', 'MIC'],
    daysOffset: 40, createdDaysAgo: 20, isReschedule: true,
    approvals: [
      { dept: 'ITO-MAIN', stepOrder: 1, status: 'PENDING' },
      { dept: 'PSMO/FMO', stepOrder: 2, status: 'PENDING' },
      { dept: 'SAFETY-SECURITY', stepOrder: 3, status: 'PENDING' },
    ],
    originalDatesSnapshot: [origSnap2],
  });

  await createFRF({
    refSuffix: 'OSA-9044', requestorKey: 'STAFF_OSA', status: 'RESCHEDULE_PENDING',
    type: 'WITH_STUDENTS',
    eventName: 'Postponed: Leadership Training',
    attendees: 70, placeKey: 'CONF', equipmentKeys: ['PROJ', 'SPEAKER'],
    daysOffset: 28, createdDaysAgo: 12, isReschedule: true,
    approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'PENDING' },
      { dept: 'OSA', stepOrder: 2, status: 'PENDING' },
      { dept: 'SAFETY-SECURITY', stepOrder: 3, status: 'PENDING' },
    ],
    originalDatesSnapshot: [{
      date: daysFromNow(15), setupTime: withTime(daysFromNow(15), 6),
      eventStart: withTime(daysFromNow(15), 8), eventEnd: withTime(daysFromNow(15), 17),
      teardownTime: withTime(daysFromNow(15), 19), placeId: P.CONF.id,
    }],
  });

  // ── 45-48. EDGE CASES (4) ──────────────────────────────────
  await createFRF({
    refSuffix: 'FACULTY-9045', requestorKey: 'FACULTY_2', status: 'PENDING_APPROVAL',
    eventName: 'Small Group Study Session',
    attendees: 8, placeKey: 'LIB', equipmentKeys: [], daysOffset: 10, createdDaysAgo: 1,
    isVenueOnly: true,
    approvals: [
      { dept: 'ACAD', stepOrder: 1, status: 'PENDING' },
      { dept: 'PSMO/FMO', stepOrder: 2, status: 'PENDING' },
      { dept: 'OCM', stepOrder: 3, status: 'PENDING' },
      { dept: 'SAFETY-SECURITY', stepOrder: 4, status: 'PENDING' },
      // no ITO — venue only
    ],
  });

  await createFRF({
    refSuffix: 'OP-9046', requestorKey: 'STAFF_OP', status: 'PENDING_APPROVAL',
    eventName: 'VIP Reception — Visiting Delegates',
    attendees: 30, placeKey: 'CONF', equipmentKeys: ['SPEAKER'], daysOffset: 1, createdDaysAgo: 0,
    approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'APPROVED', performedByKey: 'PSMO', performedAt: new Date(), remarks: 'Rush approved.' },
      { dept: 'OP', stepOrder: 2, status: 'PENDING' },
      { dept: 'SAFETY-SECURITY', stepOrder: 3, status: 'PENDING' },
      { dept: 'ITO-MAIN', stepOrder: 4, status: 'PENDING' },
    ],
  });

  await createFRF({
    refSuffix: 'ACAD-9047', requestorKey: 'STAFF_ACAD', status: 'APPROVED',
    eventName: 'Summer Program (3 days)',
    attendees: 40, placeKey: 'AVR', equipmentKeys: ['PROJ', 'MIC'], daysOffset: 45, createdDaysAgo: 5,
    approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'APPROVED', performedByKey: 'PSMO', performedAt: new Date(), remarks: 'OK.' },
      { dept: 'OCM', stepOrder: 2, status: 'APPROVED', performedByKey: 'OCM', performedAt: new Date(), remarks: 'OK.' },
      { dept: 'SAFETY-SECURITY', stepOrder: 3, status: 'APPROVED', performedByKey: 'SS', performedAt: new Date(), remarks: 'OK.' },
      { dept: 'ITO-MAIN', stepOrder: 4, status: 'APPROVED', performedByKey: 'ITO', performedAt: new Date(), remarks: 'Assigned.' },
    ],
    assignments: [
      { userKey: 'ITO_S1', dutyType: 'SETUP', dayOffset: 45, startHour: 6, endHour: 8, isOvertime: true },
      { userKey: 'ITO_S1', dutyType: 'OPERATOR', dayOffset: 45, startHour: 8, endHour: 17 },
    ],
  });

  // 🎯 With LED Wall — forces OP into chain
  await createFRF({
    refSuffix: 'ACAD-9048', requestorKey: 'STAFF_ACAD', status: 'PENDING_APPROVAL',
    eventName: 'Student Film Festival (LED Screening)',
    attendees: 250, placeKey: 'GYM', equipmentKeys: ['LED', 'MIC', 'SPEAKER'],
    daysOffset: 35, createdDaysAgo: 2,
    approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'PENDING' },
      { dept: 'OP', stepOrder: 2, status: 'PENDING' },       // LED wall triggers OP
      { dept: 'OCM', stepOrder: 3, status: 'PENDING' },
      { dept: 'SAFETY-SECURITY', stepOrder: 4, status: 'PENDING' },
      { dept: 'ITO-MAIN', stepOrder: 5, status: 'PENDING' },
    ],
  });

    // ═══════════════════════════════════════════════════════════
  // EXTRA FRFs — 30 more (total 78)
  // ═══════════════════════════════════════════════════════════
  const EXTRA_FRFS: CreateFRFArgs[] = [
    { refSuffix: 'ACAD-9050', requestorKey: 'FACULTY_1', status: 'DRAFT', eventName: 'Draft — Science Fair Setup', attendees: 100, placeKey: 'GYM', equipmentKeys: ['CHAIR', 'TABLE'] },
    { refSuffix: 'OCM-9051', requestorKey: 'STAFF_OCM', status: 'DRAFT', eventName: 'Draft — Alumni Newsletter Launch', attendees: 30, placeKey: 'LIB', equipmentKeys: ['PROJ'] },
    { refSuffix: 'PSMO-9052', requestorKey: 'STAFF_PSMO', status: 'DRAFT', eventName: 'Draft — Quarterly Inventory Audit', attendees: 15, placeKey: 'ROOM_NAST' },
    { refSuffix: 'OP-9053', requestorKey: 'STAFF_OP', status: 'DRAFT', eventName: 'Draft — Executive Team Retreat', attendees: 25, placeKey: 'VIP_LOUNGE', equipmentKeys: ['SPEAKER'] },
    { refSuffix: 'CDO-9054', requestorKey: 'STAFF_CDO', status: 'DRAFT', eventName: 'Draft — Photojournalism Workshop', attendees: 40, placeKey: 'AUD_NAST', equipmentKeys: ['CAM', 'TRIPOD'] },

    { refSuffix: 'ACAD-9055', requestorKey: 'STAFF_ACAD', status: 'PENDING_APPROVAL', eventName: 'Faculty Development Seminar', attendees: 90, placeKey: 'AVR', equipmentKeys: ['PROJ', 'MIC'], daysOffset: 22, approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'PENDING' },
      { dept: 'OCM', stepOrder: 2, status: 'PENDING' },
      { dept: 'SAFETY-SECURITY', stepOrder: 3, status: 'PENDING' },
      { dept: 'ITO-MAIN', stepOrder: 4, status: 'PENDING' },
    ]},
    { refSuffix: 'OCM-9056', requestorKey: 'STAFF_OCM', status: 'PENDING_APPROVAL', eventName: 'Rebranding Campaign Launch', attendees: 60, placeKey: 'AVR_IMU', equipmentKeys: ['PROJ', 'MIC'], daysOffset: 19, approvals: [
      { dept: 'OCM', stepOrder: 1, status: 'PENDING' },
      { dept: 'PSMO/FMO', stepOrder: 2, status: 'PENDING' },
      { dept: 'SAFETY-SECURITY', stepOrder: 3, status: 'PENDING' },
    ]},
    { refSuffix: 'SS-9057', requestorKey: 'STAFF_SS', status: 'PENDING_APPROVAL', eventName: 'Campus Safety Orientation', attendees: 250, placeKey: 'AUD_NAST', equipmentKeys: ['MIC', 'PROJ'], daysOffset: 26, approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'APPROVED', performedByKey: 'PSMO', performedAt: new Date(), remarks: 'Confirmed.' },
      { dept: 'SAFETY-SECURITY', stepOrder: 2, status: 'PENDING' },
      { dept: 'ITO-MAIN', stepOrder: 3, status: 'PENDING' },
    ]},
    { refSuffix: 'OP-9058', requestorKey: 'STAFF_OP', status: 'PENDING_APPROVAL', eventName: 'Presidential Roundtable', attendees: 20, placeKey: 'VIP_LOUNGE', equipmentKeys: ['MIXER'], daysOffset: 12, approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'APPROVED', performedByKey: 'PSMO', performedAt: new Date(), remarks: 'OK.' },
      { dept: 'OP', stepOrder: 2, status: 'PENDING' },
      { dept: 'SAFETY-SECURITY', stepOrder: 3, status: 'PENDING' },
      { dept: 'ITO-MAIN', stepOrder: 4, status: 'PENDING' },
    ]},
    { refSuffix: 'CDO-9059', requestorKey: 'STAFF_CDO', status: 'PENDING_APPROVAL', eventName: 'Documentary Screening', attendees: 80, placeKey: 'AUD_NAST', equipmentKeys: ['CAM', 'PROJ', 'SPEAKER'], daysOffset: 21, approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'PENDING' },
      { dept: 'CDO', stepOrder: 2, status: 'PENDING' },
      { dept: 'SAFETY-SECURITY', stepOrder: 3, status: 'PENDING' },
      { dept: 'ITO-MAIN', stepOrder: 4, status: 'PENDING' },
    ]},
    { refSuffix: 'OSA-9060', requestorKey: 'STAFF_OSA', status: 'PENDING_APPROVAL', type: 'WITH_STUDENTS', eventName: 'Sports Tryouts', attendees: 150, placeKey: 'GYM_SHS', equipmentKeys: ['MIC'], daysOffset: 17, approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'APPROVED', performedByKey: 'PSMO', performedAt: new Date(), remarks: 'OK.' },
      { dept: 'OSA', stepOrder: 2, status: 'APPROVED', performedByKey: 'OSA_H', performedAt: new Date(), remarks: 'OK.' },
      { dept: 'OCM', stepOrder: 3, status: 'PENDING' },
      { dept: 'SAFETY-SECURITY', stepOrder: 4, status: 'PENDING' },
    ]},
    { refSuffix: 'FACULTY-9061', requestorKey: 'FACULTY_2', status: 'PENDING_APPROVAL', eventName: 'Research Colloquium', attendees: 55, placeKey: 'ROOM_NAST', equipmentKeys: ['PROJ'], daysOffset: 20, approvals: [
      { dept: 'ACAD', stepOrder: 1, status: 'PENDING' },
      { dept: 'PSMO/FMO', stepOrder: 2, status: 'PENDING' },
      { dept: 'SAFETY-SECURITY', stepOrder: 3, status: 'PENDING' },
    ]},

    { refSuffix: 'ACAD-9062', requestorKey: 'STAFF_ACAD', status: 'APPROVED', eventName: 'Curriculum Review Workshop', attendees: 45, placeKey: 'CONF', equipmentKeys: ['PROJ'], daysOffset: 9, approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'APPROVED', performedByKey: 'PSMO', performedAt: new Date(), remarks: 'OK.' },
      { dept: 'OCM', stepOrder: 2, status: 'APPROVED', performedByKey: 'OCM', performedAt: new Date(), remarks: 'OK.' },
      { dept: 'SAFETY-SECURITY', stepOrder: 3, status: 'APPROVED', performedByKey: 'SS', performedAt: new Date(), remarks: 'OK.' },
      { dept: 'ITO-MAIN', stepOrder: 4, status: 'APPROVED', performedByKey: 'ITO', performedAt: new Date(), remarks: 'Assigned.' },
    ], assignments: [{ userKey: 'ITO_S2', dutyType: 'SETUP', dayOffset: 9, startHour: 6, endHour: 8, isOvertime: true }]},
    { refSuffix: 'OCM-9063', requestorKey: 'STAFF_OCM', status: 'APPROVED', eventName: 'PR Planning Session', attendees: 30, placeKey: 'LIB', equipmentKeys: ['PROJ'], daysOffset: 7, approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'APPROVED', performedByKey: 'PSMO', performedAt: new Date(), remarks: 'OK.' },
      { dept: 'OCM', stepOrder: 2, status: 'APPROVED', performedByKey: 'OCM', performedAt: new Date(), remarks: 'OK.' },
      { dept: 'SAFETY-SECURITY', stepOrder: 3, status: 'APPROVED', performedByKey: 'SS', performedAt: new Date(), remarks: 'OK.' },
      { dept: 'ITO-MAIN', stepOrder: 4, status: 'APPROVED', performedByKey: 'ITO', performedAt: new Date(), remarks: 'Assigned.' },
    ], assignments: [{ userKey: 'ITO_S3', dutyType: 'OPERATOR', dayOffset: 7, startHour: 8, endHour: 17 }]},
    { refSuffix: 'SS-9064', requestorKey: 'STAFF_SS', status: 'APPROVED', eventName: 'Fire Drill Coordination', attendees: 400, placeKey: 'FIELD', equipmentKeys: ['MIC'], daysOffset: 3, approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'APPROVED', performedByKey: 'PSMO', performedAt: new Date(), remarks: 'OK.' },
      { dept: 'SAFETY-SECURITY', stepOrder: 2, status: 'APPROVED', performedByKey: 'SS', performedAt: new Date(), remarks: 'OK.' },
      { dept: 'ITO-MAIN', stepOrder: 3, status: 'APPROVED', performedByKey: 'ITO', performedAt: new Date(), remarks: 'Assigned.' },
    ], assignments: [
      { userKey: 'ITO_S1', dutyType: 'SETUP', dayOffset: 3, startHour: 5, endHour: 7, isOvertime: true },
      { userKey: 'ITO_S2', dutyType: 'OPERATOR', dayOffset: 3, startHour: 7, endHour: 12 },
    ]},

    { refSuffix: 'ACAD-9065', requestorKey: 'STAFF_ACAD', status: 'COMPLETED', eventName: 'Midterm Exams Setup', attendees: 200, placeKey: 'GYM', equipmentKeys: ['CHAIR', 'TABLE'], daysOffset: -40, createdDaysAgo: 50, packUpDone: true, approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'APPROVED', performedByKey: 'PSMO', performedAt: daysFromNow(-45), remarks: 'OK.' },
      { dept: 'OCM', stepOrder: 2, status: 'APPROVED', performedByKey: 'OCM', performedAt: daysFromNow(-45), remarks: 'OK.' },
      { dept: 'SAFETY-SECURITY', stepOrder: 3, status: 'APPROVED', performedByKey: 'SS', performedAt: daysFromNow(-45), remarks: 'OK.' },
      { dept: 'ITO-MAIN', stepOrder: 4, status: 'APPROVED', performedByKey: 'ITO', performedAt: daysFromNow(-45), remarks: 'Assigned.' },
    ], assignments: [{ userKey: 'ITO_S1', dutyType: 'SETUP', dayOffset: -40, startHour: 6, endHour: 8, isOvertime: true }]},
    { refSuffix: 'OCM-9066', requestorKey: 'STAFF_OCM', status: 'COMPLETED', eventName: 'Media Day 2026', attendees: 60, placeKey: 'AVR', equipmentKeys: ['CAM', 'MIC'], daysOffset: -25, createdDaysAgo: 35, packUpDone: true, approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'APPROVED', performedByKey: 'PSMO', performedAt: daysFromNow(-30), remarks: 'OK.' },
      { dept: 'OCM', stepOrder: 2, status: 'APPROVED', performedByKey: 'OCM', performedAt: daysFromNow(-30), remarks: 'OK.' },
      { dept: 'SAFETY-SECURITY', stepOrder: 3, status: 'APPROVED', performedByKey: 'SS', performedAt: daysFromNow(-30), remarks: 'OK.' },
      { dept: 'ITO-MAIN', stepOrder: 4, status: 'APPROVED', performedByKey: 'ITO', performedAt: daysFromNow(-30), remarks: 'Assigned.' },
    ], assignments: [{ userKey: 'ITO_S2', dutyType: 'OPERATOR', dayOffset: -25, startHour: 8, endHour: 17 }]},
    { refSuffix: 'OSA-9067', requestorKey: 'STAFF_OSA', status: 'COMPLETED', type: 'WITH_STUDENTS', eventName: 'Club Fair 2026', attendees: 300, placeKey: 'GYM_SHS', equipmentKeys: ['MIC', 'SPEAKER', 'TENT'], daysOffset: -18, createdDaysAgo: 28, packUpDone: true, approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'APPROVED', performedByKey: 'PSMO', performedAt: daysFromNow(-22), remarks: 'OK.' },
      { dept: 'OSA', stepOrder: 2, status: 'APPROVED', performedByKey: 'OSA_H', performedAt: daysFromNow(-22), remarks: 'OK.' },
      { dept: 'SAFETY-SECURITY', stepOrder: 3, status: 'APPROVED', performedByKey: 'SS', performedAt: daysFromNow(-22), remarks: 'OK.' },
      { dept: 'ITO-MAIN', stepOrder: 4, status: 'APPROVED', performedByKey: 'ITO', performedAt: daysFromNow(-22), remarks: 'Assigned.' },
    ], assignments: [
      { userKey: 'ITO_S1', dutyType: 'SETUP', dayOffset: -18, startHour: 5, endHour: 8, isOvertime: true },
      { userKey: 'ITO_S2', dutyType: 'TEARDOWN', dayOffset: -18, startHour: 17, endHour: 20, isOvertime: true },
    ]},
    { refSuffix: 'OP-9068', requestorKey: 'STAFF_OP', status: 'COMPLETED', eventName: 'Trustees Meeting', attendees: 25, placeKey: 'VIP_LOUNGE', equipmentKeys: ['SPEAKER'], daysOffset: -8, createdDaysAgo: 16, packUpDone: true, approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'APPROVED', performedByKey: 'PSMO', performedAt: daysFromNow(-10), remarks: 'OK.' },
      { dept: 'OP', stepOrder: 2, status: 'APPROVED', performedByKey: 'OP_H', performedAt: daysFromNow(-10), remarks: 'OK.' },
      { dept: 'SAFETY-SECURITY', stepOrder: 3, status: 'APPROVED', performedByKey: 'SS', performedAt: daysFromNow(-10), remarks: 'OK.' },
      { dept: 'ITO-MAIN', stepOrder: 4, status: 'APPROVED', performedByKey: 'ITO', performedAt: daysFromNow(-10), remarks: 'Assigned.' },
    ], assignments: [{ userKey: 'ITO_S3', dutyType: 'SETUP', dayOffset: -8, startHour: 7, endHour: 9, isOvertime: true }]},

    { refSuffix: 'ACAD-9069', requestorKey: 'STAFF_ACAD', status: 'REJECTED', eventName: 'Field Day Proposal', attendees: 500, placeKey: 'FIELD', daysOffset: 35, createdDaysAgo: 4, approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'REJECTED', performedByKey: 'PSMO', performedAt: new Date(), remarks: 'Field unavailable in this period.' },
      { dept: 'OCM', stepOrder: 2, status: 'REJECTED', remarks: 'Blocked.' },
    ]},
    { refSuffix: 'OSA-9070', requestorKey: 'STAFF_OSA', status: 'REJECTED', type: 'WITH_STUDENTS', eventName: 'Overnight Field Trip', attendees: 60, placeKey: 'GYM_SHS', daysOffset: 40, createdDaysAgo: 2, approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'APPROVED', performedByKey: 'PSMO', performedAt: new Date(), remarks: 'OK.' },
      { dept: 'OSA', stepOrder: 2, status: 'REJECTED', performedByKey: 'OSA_H', performedAt: new Date(), remarks: 'Overnight trips suspended this term.' },
    ]},

    { refSuffix: 'ACAD-9071', requestorKey: 'STAFF_ACAD', status: 'REVISION_REQUESTED', eventName: 'Industry Forum', attendees: 120, placeKey: 'AUD_NAST', equipmentKeys: ['PROJ', 'MIC'], daysOffset: 24, createdDaysAgo: 7, approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'APPROVED', performedByKey: 'PSMO', performedAt: new Date(), remarks: 'OK.' },
      { dept: 'OCM', stepOrder: 2, status: 'REVISION_REQUESTED', performedByKey: 'OCM', performedAt: new Date(), remarks: 'Please attach vendor contracts.' },
    ]},
    { refSuffix: 'OP-9072', requestorKey: 'STAFF_OP', status: 'REVISION_REQUESTED', eventName: 'Investiture Ceremony', attendees: 200, placeKey: 'AUD_NAST', equipmentKeys: ['SPEAKER', 'MIC', 'LED'], daysOffset: 30, createdDaysAgo: 9, approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'APPROVED', performedByKey: 'PSMO', performedAt: new Date(), remarks: 'OK.' },
      { dept: 'OP', stepOrder: 2, status: 'APPROVED', performedByKey: 'OP_H', performedAt: new Date(), remarks: 'OK.' },
      { dept: 'SAFETY-SECURITY', stepOrder: 3, status: 'REVISION_REQUESTED', performedByKey: 'SS', performedAt: new Date(), remarks: 'Clarify evacuation plan.' },
    ]},

    { refSuffix: 'ACAD-9073', requestorKey: 'STAFF_ACAD', status: 'RESCHEDULE_PENDING', eventName: 'Postponed: Team Building', attendees: 40, placeKey: 'CONF', equipmentKeys: ['PROJ'], daysOffset: 42, createdDaysAgo: 11, isReschedule: true, approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'PENDING' },
      { dept: 'OCM', stepOrder: 2, status: 'PENDING' },
      { dept: 'SAFETY-SECURITY', stepOrder: 3, status: 'PENDING' },
    ], originalDatesSnapshot: [{
      date: daysFromNow(20), setupTime: withTime(daysFromNow(20), 6),
      eventStart: withTime(daysFromNow(20), 8), eventEnd: withTime(daysFromNow(20), 17),
      teardownTime: withTime(daysFromNow(20), 19), placeId: P.CONF.id,
    }]},
    { refSuffix: 'FACULTY-9074', requestorKey: 'FACULTY_1', status: 'RESCHEDULE_PENDING', eventName: 'Postponed: Seminar on Assessment', attendees: 30, placeKey: 'ROOM_NAST', equipmentKeys: ['PROJ'], daysOffset: 38, createdDaysAgo: 13, isReschedule: true, approvals: [
      { dept: 'ACAD', stepOrder: 1, status: 'PENDING' },
      { dept: 'PSMO/FMO', stepOrder: 2, status: 'PENDING' },
      { dept: 'SAFETY-SECURITY', stepOrder: 3, status: 'PENDING' },
    ], originalDatesSnapshot: [{
      date: daysFromNow(16), setupTime: withTime(daysFromNow(16), 6),
      eventStart: withTime(daysFromNow(16), 8), eventEnd: withTime(daysFromNow(16), 17),
      teardownTime: withTime(daysFromNow(16), 19), placeId: P.ROOM_NAST.id,
    }]},

    { refSuffix: 'ACAD-9075', requestorKey: 'STAFF_ACAD', status: 'PENDING_APPROVAL', eventName: 'Robotics Competition', attendees: 150, placeKey: 'GYM', equipmentKeys: ['LED', 'MIC', 'SPEAKER'], daysOffset: 33, createdDaysAgo: 1, approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'PENDING' },
      { dept: 'OP', stepOrder: 2, status: 'PENDING' },
      { dept: 'OCM', stepOrder: 3, status: 'PENDING' },
      { dept: 'SAFETY-SECURITY', stepOrder: 4, status: 'PENDING' },
      { dept: 'ITO-MAIN', stepOrder: 5, status: 'PENDING' },
    ]},
    { refSuffix: 'HRD-9076', requestorKey: 'STAFF_HRD', status: 'PENDING_APPROVAL', eventName: 'Employee Wellness Fair', attendees: 120, placeKey: 'CAFE', equipmentKeys: ['MIC'], daysOffset: 15, createdDaysAgo: 3, approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'APPROVED', performedByKey: 'PSMO', performedAt: new Date(), remarks: 'OK.' },
      { dept: 'HRD', stepOrder: 2, status: 'APPROVED', performedByKey: 'HRD', performedAt: new Date(), remarks: 'OK.' },
      { dept: 'OCM', stepOrder: 3, status: 'APPROVED', performedByKey: 'OCM', performedAt: new Date(), remarks: 'OK.' },
      { dept: 'SAFETY-SECURITY', stepOrder: 4, status: 'PENDING' },
    ]},
    { refSuffix: 'OCM-9077', requestorKey: 'STAFF_OCM', status: 'APPROVED', eventName: 'Awards Night Rehearsal', attendees: 90, placeKey: 'AUD_NAST', equipmentKeys: ['LED', 'MIC', 'SPEAKER'], daysOffset: 6, approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'APPROVED', performedByKey: 'PSMO', performedAt: new Date(), remarks: 'OK.' },
      { dept: 'OP', stepOrder: 2, status: 'APPROVED', performedByKey: 'OP_H', performedAt: new Date(), remarks: 'LED checked.' },
      { dept: 'OCM', stepOrder: 3, status: 'APPROVED', performedByKey: 'OCM', performedAt: new Date(), remarks: 'OK.' },
      { dept: 'SAFETY-SECURITY', stepOrder: 4, status: 'APPROVED', performedByKey: 'SS', performedAt: new Date(), remarks: 'OK.' },
      { dept: 'ITO-MAIN', stepOrder: 5, status: 'APPROVED', performedByKey: 'ITO', performedAt: new Date(), remarks: 'Assigned.' },
    ], assignments: [
      { userKey: 'ITO_S1', dutyType: 'SETUP', dayOffset: 6, startHour: 6, endHour: 8, isOvertime: true },
      { userKey: 'ITO_S3', dutyType: 'OPERATOR', dayOffset: 6, startHour: 8, endHour: 17 },
    ]},
    { refSuffix: 'CDO-9078', requestorKey: 'STAFF_CDO', status: 'COMPLETED', eventName: 'Marketing Photo Shoot', attendees: 20, placeKey: 'AVR', equipmentKeys: ['CAM', 'TRIPOD'], daysOffset: -4, createdDaysAgo: 12, packUpDone: true, approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'APPROVED', performedByKey: 'PSMO', performedAt: daysFromNow(-8), remarks: 'OK.' },
      { dept: 'CDO', stepOrder: 2, status: 'APPROVED', performedByKey: 'CDO_H', performedAt: daysFromNow(-8), remarks: 'OK.' },
      { dept: 'SAFETY-SECURITY', stepOrder: 3, status: 'APPROVED', performedByKey: 'SS', performedAt: daysFromNow(-8), remarks: 'OK.' },
      { dept: 'ITO-MAIN', stepOrder: 4, status: 'APPROVED', performedByKey: 'ITO', performedAt: daysFromNow(-8), remarks: 'Assigned.' },
    ], assignments: [{ userKey: 'ITO_S2', dutyType: 'OPERATOR', dayOffset: -4, startHour: 9, endHour: 15 }]},
    { refSuffix: 'SS-9079', requestorKey: 'STAFF_SS', status: 'PENDING_APPROVAL', eventName: 'Earthquake Preparedness Seminar', attendees: 200, placeKey: 'AUD_NAST', equipmentKeys: ['PROJ', 'MIC'], daysOffset: 27, createdDaysAgo: 2, approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'PENDING' },
      { dept: 'SAFETY-SECURITY', stepOrder: 2, status: 'PENDING' },
      { dept: 'OCM', stepOrder: 3, status: 'PENDING' },
      { dept: 'ITO-MAIN', stepOrder: 4, status: 'PENDING' },
    ]},
  ];
  for (const frf of EXTRA_FRFS) await createFRF(frf);

    // ═══════════════════════════════════════════════════════════
  // BATCH 2 — 20 more FRFs (bulk-fill for backup > 5 MB)
  // ═══════════════════════════════════════════════════════════
  console.log('📋 Adding batch-2 FRFs (bulk fill)…\n');

  const BATCH_2_FRFS: CreateFRFArgs[] = [
    { refSuffix: 'ACAD-9301', requestorKey: 'STAFF_ACAD', status: 'PENDING_APPROVAL', eventName: 'Accreditation Prep Orientation', attendees: 80, placeKey: 'MPH', equipmentKeys: ['PROJ', 'MIC'], daysOffset: 20, approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'PENDING' },
      { dept: 'OCM', stepOrder: 2, status: 'PENDING' },
      { dept: 'SAFETY-SECURITY', stepOrder: 3, status: 'PENDING' },
      { dept: 'ITO-MAIN', stepOrder: 4, status: 'PENDING' },
    ]},
    { refSuffix: 'OCM-9302', requestorKey: 'STAFF_OCM', status: 'PENDING_APPROVAL', eventName: 'Press Conference Setup', attendees: 40, placeKey: 'CONF', equipmentKeys: ['PROJ', 'MIC'], daysOffset: 15, approvals: [
      { dept: 'OCM', stepOrder: 1, status: 'PENDING' },
      { dept: 'PSMO/FMO', stepOrder: 2, status: 'PENDING' },
      { dept: 'SAFETY-SECURITY', stepOrder: 3, status: 'PENDING' },
    ]},
    { refSuffix: 'SS-9303', requestorKey: 'STAFF_SS', status: 'PENDING_APPROVAL', eventName: 'Emergency Preparedness Workshop', attendees: 200, placeKey: 'GYM', equipmentKeys: ['LED', 'MIC', 'SPEAKER'], daysOffset: 28, approvals: [
      { dept: 'SAFETY-SECURITY', stepOrder: 1, status: 'PENDING' },
      { dept: 'PSMO/FMO', stepOrder: 2, status: 'PENDING' },
      { dept: 'OP', stepOrder: 3, status: 'PENDING' },
      { dept: 'ITO-MAIN', stepOrder: 4, status: 'PENDING' },
    ]},
    { refSuffix: 'CDO-9304', requestorKey: 'STAFF_CDO', status: 'PENDING_APPROVAL', eventName: 'BTS Promo Shoot', attendees: 15, placeKey: 'AUD_NAST', equipmentKeys: ['CAM', 'TRIPOD'], daysOffset: 22, approvals: [
      { dept: 'CDO', stepOrder: 1, status: 'PENDING' },
      { dept: 'PSMO/FMO', stepOrder: 2, status: 'PENDING' },
      { dept: 'SAFETY-SECURITY', stepOrder: 3, status: 'PENDING' },
    ]},
    { refSuffix: 'OP-9305', requestorKey: 'STAFF_OP', status: 'PENDING_APPROVAL', eventName: 'Board Retreat Planning', attendees: 25, placeKey: 'VIP_LOUNGE', equipmentKeys: ['SPEAKER', 'MIXER'], daysOffset: 18, approvals: [
      { dept: 'OP', stepOrder: 1, status: 'PENDING' },
      { dept: 'PSMO/FMO', stepOrder: 2, status: 'PENDING' },
      { dept: 'SAFETY-SECURITY', stepOrder: 3, status: 'PENDING' },
    ]},
    { refSuffix: 'OSA-9306', requestorKey: 'STAFF_OSA', status: 'PENDING_APPROVAL', type: 'WITH_STUDENTS', eventName: 'Student Council Induction', attendees: 250, placeKey: 'GYM_SHS', equipmentKeys: ['MIC', 'SPEAKER'], daysOffset: 32, approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'APPROVED', performedByKey: 'PSMO', performedAt: daysFromNow(-1), remarks: 'OK.' },
      { dept: 'OSA', stepOrder: 2, status: 'PENDING' },
      { dept: 'OCM', stepOrder: 3, status: 'PENDING' },
      { dept: 'SAFETY-SECURITY', stepOrder: 4, status: 'PENDING' },
      { dept: 'ITO-MAIN', stepOrder: 5, status: 'PENDING' },
    ]},
    { refSuffix: 'ACAD-9307', requestorKey: 'STAFF_ACAD', status: 'APPROVED', eventName: 'Faculty Seminar — Research Outputs', attendees: 100, placeKey: 'AVR', equipmentKeys: ['PROJ', 'MIC'], daysOffset: 11, createdDaysAgo: 3, approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'APPROVED', performedByKey: 'PSMO', performedAt: daysFromNow(-2), remarks: 'OK.' },
      { dept: 'OCM', stepOrder: 2, status: 'APPROVED', performedByKey: 'OCM', performedAt: daysFromNow(-2), remarks: 'OK.' },
      { dept: 'SAFETY-SECURITY', stepOrder: 3, status: 'APPROVED', performedByKey: 'SS', performedAt: daysFromNow(-2), remarks: 'OK.' },
      { dept: 'ITO-MAIN', stepOrder: 4, status: 'APPROVED', performedByKey: 'ITO', performedAt: daysFromNow(-2), remarks: 'Assigned.' },
    ], assignments: [
      { userKey: 'ITO_S1', dutyType: 'SETUP', dayOffset: 11, startHour: 6, endHour: 8, isOvertime: true },
      { userKey: 'ITO_S2', dutyType: 'OPERATOR', dayOffset: 11, startHour: 8, endHour: 17 },
    ]},
    { refSuffix: 'OCM-9308', requestorKey: 'STAFF_OCM', status: 'APPROVED', eventName: 'Media Appreciation Night', attendees: 60, placeKey: 'CAFE', equipmentKeys: ['MIC', 'SPEAKER'], daysOffset: 9, createdDaysAgo: 2, approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'APPROVED', performedByKey: 'PSMO', performedAt: daysFromNow(-1), remarks: 'OK.' },
      { dept: 'OCM', stepOrder: 2, status: 'APPROVED', performedByKey: 'OCM', performedAt: daysFromNow(-1), remarks: 'OK.' },
      { dept: 'SAFETY-SECURITY', stepOrder: 3, status: 'APPROVED', performedByKey: 'SS', performedAt: daysFromNow(-1), remarks: 'OK.' },
      { dept: 'ITO-MAIN', stepOrder: 4, status: 'APPROVED', performedByKey: 'ITO', performedAt: daysFromNow(-1), remarks: 'Assigned.' },
    ], assignments: [
      { userKey: 'ITO_S3', dutyType: 'OPERATOR', dayOffset: 9, startHour: 17, endHour: 22, isOvertime: true },
    ]},
    { refSuffix: 'SS-9309', requestorKey: 'STAFF_SS', status: 'APPROVED', eventName: 'Campus Fire Drill Coordination', attendees: 500, placeKey: 'FIELD', equipmentKeys: ['MIC', 'SPEAKER'], daysOffset: 5, createdDaysAgo: 4, approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'APPROVED', performedByKey: 'PSMO', performedAt: daysFromNow(-3), remarks: 'OK.' },
      { dept: 'SAFETY-SECURITY', stepOrder: 2, status: 'APPROVED', performedByKey: 'SS', performedAt: daysFromNow(-3), remarks: 'OK.' },
      { dept: 'ITO-MAIN', stepOrder: 3, status: 'APPROVED', performedByKey: 'ITO', performedAt: daysFromNow(-3), remarks: 'Assigned.' },
    ], assignments: [
      { userKey: 'ITO_S1', dutyType: 'SETUP', dayOffset: 5, startHour: 5, endHour: 7, isOvertime: true },
      { userKey: 'ITO_S2', dutyType: 'OPERATOR', dayOffset: 5, startHour: 7, endHour: 12 },
    ]},
    { refSuffix: 'FACULTY-9310', requestorKey: 'FACULTY_2', status: 'APPROVED', eventName: 'Guest Lecture — Data Science', attendees: 75, placeKey: 'ROOM_NAST', equipmentKeys: ['PROJ', 'MIC'], daysOffset: 7, createdDaysAgo: 3, approvals: [
      { dept: 'ACAD', stepOrder: 1, status: 'APPROVED', performedByKey: 'ACAD_H', performedAt: daysFromNow(-2), remarks: 'OK.' },
      { dept: 'PSMO/FMO', stepOrder: 2, status: 'APPROVED', performedByKey: 'PSMO', performedAt: daysFromNow(-2), remarks: 'OK.' },
      { dept: 'SAFETY-SECURITY', stepOrder: 3, status: 'APPROVED', performedByKey: 'SS', performedAt: daysFromNow(-2), remarks: 'OK.' },
      { dept: 'ITO-MAIN', stepOrder: 4, status: 'APPROVED', performedByKey: 'ITO', performedAt: daysFromNow(-2), remarks: 'Assigned.' },
    ], assignments: [
      { userKey: 'ITO_S2', dutyType: 'SETUP', dayOffset: 7, startHour: 6, endHour: 8, isOvertime: true },
    ]},
    { refSuffix: 'ACAD-9311', requestorKey: 'STAFF_ACAD', status: 'COMPLETED', eventName: 'Alumni Homecoming Wrap-up', attendees: 200, placeKey: 'GYM', equipmentKeys: ['MIC', 'PROJ'], daysOffset: -8, createdDaysAgo: 20, packUpDone: true, approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'APPROVED', performedByKey: 'PSMO', performedAt: daysFromNow(-12), remarks: 'OK.' },
      { dept: 'OCM', stepOrder: 2, status: 'APPROVED', performedByKey: 'OCM', performedAt: daysFromNow(-12), remarks: 'OK.' },
      { dept: 'SAFETY-SECURITY', stepOrder: 3, status: 'APPROVED', performedByKey: 'SS', performedAt: daysFromNow(-12), remarks: 'OK.' },
      { dept: 'ITO-MAIN', stepOrder: 4, status: 'APPROVED', performedByKey: 'ITO', performedAt: daysFromNow(-12), remarks: 'Assigned.' },
    ], assignments: [
      { userKey: 'ITO_S1', dutyType: 'SETUP', dayOffset: -8, startHour: 6, endHour: 8, isOvertime: true },
      { userKey: 'ITO_S3', dutyType: 'OPERATOR', dayOffset: -8, startHour: 8, endHour: 17 },
    ]},
    { refSuffix: 'OCM-9312', requestorKey: 'STAFF_OCM', status: 'COMPLETED', eventName: 'Awards Night Rehearsal Wrap', attendees: 90, placeKey: 'AUD_NAST', equipmentKeys: ['LED', 'MIC', 'SPEAKER'], daysOffset: -5, createdDaysAgo: 15, approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'APPROVED', performedByKey: 'PSMO', performedAt: daysFromNow(-10), remarks: 'OK.' },
      { dept: 'OP', stepOrder: 2, status: 'APPROVED', performedByKey: 'OP_H', performedAt: daysFromNow(-10), remarks: 'OK.' },
      { dept: 'OCM', stepOrder: 3, status: 'APPROVED', performedByKey: 'OCM', performedAt: daysFromNow(-10), remarks: 'OK.' },
      { dept: 'SAFETY-SECURITY', stepOrder: 4, status: 'APPROVED', performedByKey: 'SS', performedAt: daysFromNow(-10), remarks: 'OK.' },
      { dept: 'ITO-MAIN', stepOrder: 5, status: 'APPROVED', performedByKey: 'ITO', performedAt: daysFromNow(-10), remarks: 'Assigned.' },
    ], assignments: [
      { userKey: 'ITO_S1', dutyType: 'SETUP', dayOffset: -5, startHour: 6, endHour: 8, isOvertime: true },
      { userKey: 'ITO_S2', dutyType: 'OPERATOR', dayOffset: -5, startHour: 8, endHour: 17 },
    ]},
    { refSuffix: 'OP-9313', requestorKey: 'STAFF_OP', status: 'COMPLETED', eventName: 'Investiture Ceremony — Legacy', attendees: 300, placeKey: 'AUD_NAST', equipmentKeys: ['SPEAKER', 'MIC', 'LED'], daysOffset: -22, createdDaysAgo: 40, packUpDone: true, approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'APPROVED', performedByKey: 'PSMO', performedAt: daysFromNow(-30), remarks: 'OK.' },
      { dept: 'OP', stepOrder: 2, status: 'APPROVED', performedByKey: 'OP_H', performedAt: daysFromNow(-30), remarks: 'OK.' },
      { dept: 'OCM', stepOrder: 3, status: 'APPROVED', performedByKey: 'OCM', performedAt: daysFromNow(-30), remarks: 'OK.' },
      { dept: 'SAFETY-SECURITY', stepOrder: 4, status: 'APPROVED', performedByKey: 'SS', performedAt: daysFromNow(-30), remarks: 'OK.' },
      { dept: 'ITO-MAIN', stepOrder: 5, status: 'APPROVED', performedByKey: 'ITO', performedAt: daysFromNow(-30), remarks: 'Assigned.' },
    ], assignments: [
      { userKey: 'ITO_S1', dutyType: 'SETUP', dayOffset: -22, startHour: 5, endHour: 7, isOvertime: true },
      { userKey: 'ITO_S2', dutyType: 'OPERATOR', dayOffset: -22, startHour: 7, endHour: 18 },
      { userKey: 'ITO_S3', dutyType: 'TEARDOWN', dayOffset: -22, startHour: 18, endHour: 22, isOvertime: true },
    ]},
    { refSuffix: 'CDO-9314', requestorKey: 'STAFF_CDO', status: 'COMPLETED', eventName: 'Graduation Photo Shoot Session', attendees: 20, placeKey: 'AVR_IMU', equipmentKeys: ['CAM', 'TRIPOD'], daysOffset: -10, createdDaysAgo: 18, packUpDone: true, approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'APPROVED', performedByKey: 'PSMO', performedAt: daysFromNow(-15), remarks: 'OK.' },
      { dept: 'CDO', stepOrder: 2, status: 'APPROVED', performedByKey: 'CDO_H', performedAt: daysFromNow(-15), remarks: 'OK.' },
      { dept: 'SAFETY-SECURITY', stepOrder: 3, status: 'APPROVED', performedByKey: 'SS', performedAt: daysFromNow(-15), remarks: 'OK.' },
      { dept: 'ITO-MAIN', stepOrder: 4, status: 'APPROVED', performedByKey: 'ITO', performedAt: daysFromNow(-15), remarks: 'Assigned.' },
    ], assignments: [
      { userKey: 'ITO_S2', dutyType: 'OPERATOR', dayOffset: -10, startHour: 9, endHour: 15 },
    ]},
    { refSuffix: 'SS-9315', requestorKey: 'STAFF_SS', status: 'REJECTED', eventName: 'Late-Night Study Session Proposal', attendees: 40, placeKey: 'LIB', daysOffset: 20, createdDaysAgo: 4, approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'APPROVED', performedByKey: 'PSMO', performedAt: daysFromNow(-3), remarks: 'OK.' },
      { dept: 'SAFETY-SECURITY', stepOrder: 2, status: 'REJECTED', performedByKey: 'SS', performedAt: daysFromNow(-2), remarks: 'After-hours student access is not permitted by current policy.' },
    ]},
    { refSuffix: 'OSA-9316', requestorKey: 'STAFF_OSA', status: 'REJECTED', type: 'WITH_STUDENTS', eventName: 'Outdoor Overnight Camp (Resubmission)', attendees: 80, placeKey: 'FIELD', daysOffset: 25, createdDaysAgo: 3, approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'APPROVED', performedByKey: 'PSMO', performedAt: daysFromNow(-2), remarks: 'OK.' },
      { dept: 'OSA', stepOrder: 2, status: 'REJECTED', performedByKey: 'OSA_H', performedAt: daysFromNow(-1), remarks: 'Overnight camping on the field is not permitted.' },
    ]},
    { refSuffix: 'OCM-9317', requestorKey: 'STAFF_OCM', status: 'REVISION_REQUESTED', eventName: 'Product Preview Event', attendees: 60, placeKey: 'AVR', equipmentKeys: ['PROJ', 'MIC'], daysOffset: 16, createdDaysAgo: 6, approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'APPROVED', performedByKey: 'PSMO', performedAt: daysFromNow(-4), remarks: 'OK.' },
      { dept: 'OCM', stepOrder: 2, status: 'REVISION_REQUESTED', performedByKey: 'OCM', performedAt: daysFromNow(-3), remarks: 'Please provide guest list and speaker bios.' },
    ]},
    { refSuffix: 'ACAD-9318', requestorKey: 'STAFF_ACAD', status: 'RESCHEDULE_PENDING', eventName: 'Postponed: Curriculum Workshop', attendees: 50, placeKey: 'CONF', equipmentKeys: ['PROJ'], daysOffset: 40, createdDaysAgo: 10, isReschedule: true, approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'PENDING' },
      { dept: 'OCM', stepOrder: 2, status: 'PENDING' },
      { dept: 'SAFETY-SECURITY', stepOrder: 3, status: 'PENDING' },
    ], originalDatesSnapshot: [{
      date: daysFromNow(18), setupTime: withTime(daysFromNow(18), 6),
      eventStart: withTime(daysFromNow(18), 8), eventEnd: withTime(daysFromNow(18), 17),
      teardownTime: withTime(daysFromNow(18), 19), placeId: P.CONF.id,
    }]},
    { refSuffix: 'FACULTY-9319', requestorKey: 'FACULTY_1', status: 'DRAFT', eventName: 'Draft — Capstone Defense', attendees: 50, placeKey: 'CONF', equipmentKeys: ['PROJ'] },
    { refSuffix: 'HRD-9320', requestorKey: 'STAFF_HRD', status: 'DRAFT', eventName: 'Draft — Onboarding Orientation', attendees: 40, placeKey: 'CAFE', equipmentKeys: ['MIC'] },
  ];

  for (const frf of BATCH_2_FRFS) await createFRF(frf);
  console.log('');

    // ═══════════════════════════════════════════════════════════
  // MEMOS — 40 records
  // ═══════════════════════════════════════════════════════════
  interface MemoSeed {
    senderKey: string;
    subject: string;
    priority?: 'ROUTINE' | 'URGENT' | 'RUSH';
    purpose?: 'FYI' | 'SIGNATURE' | 'ACTION' | 'COMMENTS' | 'APPROVAL' | 'REQUEST';
    status: 'DRAFT' | 'FOR_APPROVAL' | 'APPROVED' | 'CLOSED';
    recipients: Array<{ dept: string; status: 'PENDING' | 'ACKNOWLEDGED' | 'PROCESSING' | 'COMPLETED' | 'CLOSED' | 'DENIED' | 'RESPONDED'; feedback?: string }>;
    daysAgo?: number;
  }

  const MEMO_SEEDS: MemoSeed[] = [
    // Drafts (unsubmitted)
    { senderKey: 'STAFF_ACAD', subject: 'Draft — Proposal for Annual Science Week', status: 'DRAFT', recipients: [], daysAgo: 2 },
    { senderKey: 'STAFF_OCM', subject: 'Draft — Q4 Marketing Plan Overview', status: 'DRAFT', recipients: [], daysAgo: 1 },
    { senderKey: 'STAFF_PSMO', subject: 'Draft — Facilities Inventory Rollover', status: 'DRAFT', recipients: [], daysAgo: 5 },
    { senderKey: 'STAFF_SS', subject: 'Draft — Campus Safety Bulletin #12', status: 'DRAFT', recipients: [], daysAgo: 3 },
    { senderKey: 'STAFF_CDO', subject: 'Draft — Reels Content Calendar', status: 'DRAFT', recipients: [], daysAgo: 4 },

    // FOR_APPROVAL (submitted by staff, waiting for head)
    { senderKey: 'STAFF_ACAD', subject: 'Request for Extended Library Hours', priority: 'ROUTINE', purpose: 'REQUEST', status: 'FOR_APPROVAL', recipients: [{ dept: 'OCM', status: 'PENDING' }, { dept: 'PSMO/FMO', status: 'PENDING' }], daysAgo: 3 },
    { senderKey: 'STAFF_OCM', subject: 'Memo on Rebranding Rollout Timeline', priority: 'URGENT', purpose: 'ACTION', status: 'FOR_APPROVAL', recipients: [{ dept: 'OP', status: 'PENDING' }, { dept: 'PSMO/FMO', status: 'PENDING' }], daysAgo: 2 },
    { senderKey: 'STAFF_SS', subject: 'Request for Additional Fire Extinguishers', priority: 'RUSH', purpose: 'REQUEST', status: 'FOR_APPROVAL', recipients: [{ dept: 'PSMO/FMO', status: 'PENDING' }], daysAgo: 1 },
    { senderKey: 'STAFF_CDO', subject: 'Notice of Revamped Photography Guidelines', priority: 'ROUTINE', purpose: 'FYI', status: 'FOR_APPROVAL', recipients: [{ dept: 'OCM', status: 'PENDING' }], daysAgo: 4 },
    { senderKey: 'STAFF_HRD', subject: 'For Signature — Employee Handbook Draft', priority: 'ROUTINE', purpose: 'SIGNATURE', status: 'FOR_APPROVAL', recipients: [{ dept: 'OCM', status: 'PENDING' }, { dept: 'OP', status: 'PENDING' }], daysAgo: 5 },
    { senderKey: 'STAFF_OP', subject: 'Proposal for Executive Retreat Venue', priority: 'ROUTINE', purpose: 'APPROVAL', status: 'FOR_APPROVAL', recipients: [{ dept: 'PSMO/FMO', status: 'PENDING' }], daysAgo: 2 },
    { senderKey: 'FACULTY_1', subject: 'Request for Research Grant Allocation', priority: 'URGENT', purpose: 'REQUEST', status: 'FOR_APPROVAL', recipients: [{ dept: 'OCM', status: 'PENDING' }, { dept: 'OP', status: 'PENDING' }], daysAgo: 3 },
    { senderKey: 'STAFF_ACAD', subject: 'Comments on Proposed Curriculum Changes', priority: 'ROUTINE', purpose: 'COMMENTS', status: 'FOR_APPROVAL', recipients: [{ dept: 'OCM', status: 'PENDING' }], daysAgo: 6 },

    // APPROVED (dispatched, varied recipient statuses)
    { senderKey: 'ACAD_H', subject: 'Faculty Development Program — Q4 Schedule', priority: 'ROUTINE', purpose: 'FYI', status: 'APPROVED', recipients: [{ dept: 'OCM', status: 'ACKNOWLEDGED' }, { dept: 'HRD', status: 'PROCESSING' }], daysAgo: 15 },
    { senderKey: 'OCM', subject: 'New Brand Guidelines for Print Materials', priority: 'URGENT', purpose: 'ACTION', status: 'APPROVED', recipients: [{ dept: 'CDO', status: 'COMPLETED' }, { dept: 'OP', status: 'ACKNOWLEDGED' }, { dept: 'PSMO/FMO', status: 'PENDING' }], daysAgo: 20 },
    { senderKey: 'PSMO', subject: 'Updated Equipment Reservation Protocol', priority: 'ROUTINE', purpose: 'FYI', status: 'APPROVED', recipients: [{ dept: 'ITO-MAIN', status: 'CLOSED' }, { dept: 'OCM', status: 'CLOSED' }], daysAgo: 25 },
    { senderKey: 'SS', subject: 'Mandatory Safety Briefing for All Staff', priority: 'RUSH', purpose: 'ACTION', status: 'APPROVED', recipients: [{ dept: 'HRD', status: 'ACKNOWLEDGED' }, { dept: 'OCM', status: 'PROCESSING' }, { dept: 'ACAD', status: 'ACKNOWLEDGED' }], daysAgo: 10 },
    { senderKey: 'OCM', subject: 'Annual Report Submission — Reminder', priority: 'ROUTINE', purpose: 'REQUEST', status: 'APPROVED', recipients: [{ dept: 'ACAD', status: 'COMPLETED' }, { dept: 'PSMO/FMO', status: 'COMPLETED' }, { dept: 'SS', status: 'PENDING' }], daysAgo: 30 },
    { senderKey: 'HRD', subject: 'New Onboarding Procedure for Q1', priority: 'ROUTINE', purpose: 'FYI', status: 'APPROVED', recipients: [{ dept: 'ACAD', status: 'ACKNOWLEDGED' }, { dept: 'PSMO/FMO', status: 'ACKNOWLEDGED' }, { dept: 'ITO-MAIN', status: 'PENDING' }], daysAgo: 12 },
    { senderKey: 'ACAD_H', subject: 'Notice of Change in Curricular Offering', priority: 'URGENT', purpose: 'FYI', status: 'APPROVED', recipients: [{ dept: 'OCM', status: 'CLOSED' }, { dept: 'OP', status: 'CLOSED' }], daysAgo: 45 },
    { senderKey: 'OCM', subject: 'Communications Protocol — Urgent Advisories', priority: 'ROUTINE', purpose: 'FYI', status: 'APPROVED', recipients: [{ dept: 'SS', status: 'ACKNOWLEDGED' }, { dept: 'CDO', status: 'PROCESSING' }], daysAgo: 8 },
    { senderKey: 'OP_H', subject: 'Presidential Directive: Cross-Dept Coordination', priority: 'RUSH', purpose: 'ACTION', status: 'APPROVED', recipients: [{ dept: 'OCM', status: 'PROCESSING' }, { dept: 'PSMO/FMO', status: 'ACKNOWLEDGED' }, { dept: 'ACAD', status: 'PENDING' }], daysAgo: 3 },
    { senderKey: 'ITO', subject: 'Software License Renewal Notice', priority: 'URGENT', purpose: 'REQUEST', status: 'APPROVED', recipients: [{ dept: 'OP', status: 'COMPLETED' }, { dept: 'OCM', status: 'COMPLETED' }], daysAgo: 22 },
    { senderKey: 'PSMO', subject: 'Scheduled Maintenance: Ventilation Systems', priority: 'ROUTINE', purpose: 'FYI', status: 'APPROVED', recipients: [{ dept: 'ACAD', status: 'ACKNOWLEDGED' }, { dept: 'SS', status: 'ACKNOWLEDGED' }, { dept: 'HRD', status: 'CLOSED' }], daysAgo: 18 },
    { senderKey: 'SS', subject: 'Advisory: Updated Emergency Contact List', priority: 'ROUTINE', purpose: 'FYI', status: 'APPROVED', recipients: [{ dept: 'PSMO/FMO', status: 'CLOSED' }, { dept: 'ACAD', status: 'CLOSED' }, { dept: 'OCM', status: 'PENDING' }], daysAgo: 14 },
    { senderKey: 'OCM', subject: 'Brand Asset Distribution — Logo Pack v3', priority: 'ROUTINE', purpose: 'ACTION', status: 'APPROVED', recipients: [{ dept: 'CDO', status: 'COMPLETED' }, { dept: 'OP', status: 'ACKNOWLEDGED' }], daysAgo: 7 },
    { senderKey: 'HRD', subject: 'Submission of Performance Evaluation Forms', priority: 'URGENT', purpose: 'REQUEST', status: 'APPROVED', recipients: [{ dept: 'ACAD', status: 'COMPLETED' }, { dept: 'ITO-MAIN', status: 'COMPLETED' }, { dept: 'CDO', status: 'COMPLETED' }], daysAgo: 32 },
    { senderKey: 'ACAD_H', subject: 'Departmental Meeting Notes — Q3', priority: 'ROUTINE', purpose: 'FYI', status: 'APPROVED', recipients: [{ dept: 'OCM', status: 'CLOSED' }], daysAgo: 26 },
    { senderKey: 'ITO', subject: 'Notice of Email Gateway Upgrade', priority: 'ROUTINE', purpose: 'FYI', status: 'APPROVED', recipients: [{ dept: 'HRD', status: 'ACKNOWLEDGED' }, { dept: 'ACAD', status: 'PENDING' }], daysAgo: 9 },

    // CLOSED (all recipients closed)
    { senderKey: 'ACAD_H', subject: 'Faculty Retreat 2026 — Final Logistics', priority: 'ROUTINE', purpose: 'FYI', status: 'CLOSED', recipients: [{ dept: 'PSMO/FMO', status: 'CLOSED' }, { dept: 'OCM', status: 'CLOSED' }, { dept: 'ITO-MAIN', status: 'CLOSED' }], daysAgo: 60 },
    { senderKey: 'OCM', subject: 'Media Coverage Summary — Q1 Activities', priority: 'ROUTINE', purpose: 'FYI', status: 'CLOSED', recipients: [{ dept: 'OP', status: 'CLOSED' }, { dept: 'CDO', status: 'CLOSED' }], daysAgo: 55 },
    { senderKey: 'PSMO', subject: 'Completed: Annual Equipment Inventory', priority: 'ROUTINE', purpose: 'FYI', status: 'CLOSED', recipients: [{ dept: 'ITO-MAIN', status: 'CLOSED' }, { dept: 'OCM', status: 'CLOSED' }, { dept: 'CDO', status: 'CLOSED' }], daysAgo: 48 },
    { senderKey: 'SS', subject: 'Post-Drill Assessment — February', priority: 'ROUTINE', purpose: 'FYI', status: 'CLOSED', recipients: [{ dept: 'OP', status: 'CLOSED' }, { dept: 'HRD', status: 'CLOSED' }], daysAgo: 40 },
    { senderKey: 'HRD', subject: 'Employee Benefits Briefing — Wrap-Up', priority: 'ROUTINE', purpose: 'FYI', status: 'CLOSED', recipients: [{ dept: 'ACAD', status: 'CLOSED' }, { dept: 'OCM', status: 'CLOSED' }, { dept: 'SS', status: 'CLOSED' }], daysAgo: 35 },
    { senderKey: 'OP_H', subject: 'Directive: New Travel Policy', priority: 'URGENT', purpose: 'ACTION', status: 'CLOSED', recipients: [{ dept: 'HRD', status: 'CLOSED' }, { dept: 'OCM', status: 'CLOSED' }], daysAgo: 28 },
  ];

  for (let i = 0; i < MEMO_SEEDS.length; i++) {
    const s = MEMO_SEEDS[i];
    const recipientSeeds: MemoRecipientSeed[] = s.recipients.map(r => ({
      dept: r.dept,
      status: r.status,
      feedbackNote: r.feedback,
    }));

    await createMemo({
      refSeq: i + 1,
      senderKey: s.senderKey,
      subject: s.subject,
      priority: s.priority,
      purpose: s.purpose,
      status: s.status,
      recipients: recipientSeeds,
      contentKB: 32,
      createdDaysAgo: s.daysAgo,
    });
  }

  // ═══════════════════════════════════════════════════════════
  // OIC USERS — DepartmentHeads with active oic_start/oic_end
  // ═══════════════════════════════════════════════════════════
  console.log('👤 Ensuring OIC users…');

  type OICArgs = {
    email: string;
    fname: string;
    lname: string;
    departmentCode: string;
    branch?: Branch;
    oicStart: string;   // ISO string — schema declares String?, not DateTime
    oicEnd: string;
  };

  async function ensureOIC({
    email, fname, lname, departmentCode, branch = 'MAIN', oicStart, oicEnd,
  }: OICArgs) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return prisma.user.update({
        where: { email },
        data: { oic_start: oicStart, oic_end: oicEnd },
      });
    }
    const password = await bcrypt.hash('Test1234!', 10);
    return prisma.user.create({
      data: {
        employee_id: `EMP-OIC-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
        email,
        password,
        fname,
        lname,
        role: 'DepartmentHead',
        departmentCode,
        branch,
        oic_start: oicStart,
        oic_end: oicEnd,
      },
    });
  }

  U['OIC_PSMO_ACTIVE'] = await ensureOIC({
    email: 'psmo.oic@test.ncst.edu.ph',
    fname: 'Pia', lname: 'Salazar',
    departmentCode: 'PSMO/FMO',
    oicStart: daysFromNow(-5).toISOString(),
    oicEnd:   daysFromNow(9).toISOString(),
  });
  U['OIC_OCM_ENDED'] = await ensureOIC({
    email: 'ocm.oic.ended@test.ncst.edu.ph',
    fname: 'Enzo', lname: 'Bautista',
    departmentCode: 'OCM',
    oicStart: daysFromNow(-30).toISOString(),
    oicEnd:   daysFromNow(-5).toISOString(),
  });
  U['OIC_ITO_UPCOMING'] = await ensureOIC({
    email: 'ito.oic.upcoming@test.ncst.edu.ph',
    fname: 'Ursula', lname: 'Ramos',
    departmentCode: 'ITO-MAIN',
    oicStart: daysFromNow(10).toISOString(),
    oicEnd:   daysFromNow(24).toISOString(),
  });
  console.log(`   ✅ 3 OIC users ready (active / ended / upcoming)\n`);

  // ═══════════════════════════════════════════════════════════
  // EXTRA PLACES + EQUIPMENT
  // ═══════════════════════════════════════════════════════════
  console.log('📍 Adding extra places & equipment…');

  const extraPlaces = [
    { key: 'ROOFTOP',   name: 'Rooftop Garden',            branch: 'MAIN',    category: 'VIP' },
    { key: 'LAB_NAST',  name: 'Computer Lab 3 NASTECH',    branch: 'NASTECH', category: 'REGULAR' },
    { key: 'COURT_SHS', name: 'Covered Court SHS',         branch: 'SHS',     category: 'CATEGORY_1' },
    { key: 'HALL_IMUS', name: 'Function Hall IMUS',        branch: 'IMUS',    category: 'CATEGORY_1' },
  ] as const;
  for (const p of extraPlaces) P[p.key] = await ensurePlace(p);

  const extraEquipment = [
    { key: 'LAPTOP',   name: 'Presentation Laptop',   departmentCode: 'ITO-MAIN',  isSingleItem: false, quantityAvailable: 5 },
    { key: 'CLICKER',  name: 'Wireless Clicker',      departmentCode: 'ITO-MAIN',  isSingleItem: false, quantityAvailable: 8 },
    { key: 'ROSTRUM',  name: 'Podium Rostrum',        departmentCode: 'PSMO/FMO',  isSingleItem: true,  quantityAvailable: 1 },
    { key: 'LIGHTBAR', name: 'Stage Light Bar',       departmentCode: 'OP',        isSingleItem: false, quantityAvailable: 6 },
    { key: 'GIMBAL',   name: 'Camera Gimbal',         departmentCode: 'CDO',       isSingleItem: false, quantityAvailable: 2 },
    { key: 'TROLLEY',  name: 'Utility Trolley',       departmentCode: 'PSMO/FMO',  isSingleItem: false, quantityAvailable: 4 },
  ] as const;
  for (const e of extraEquipment) E[e.key] = await ensureEquipment(e);
  console.log(`   ✅ +4 places, +6 equipment ready\n`);

  // ═══════════════════════════════════════════════════════════
  // FRFs — Elapsed-state + edge cases
  // ═══════════════════════════════════════════════════════════
  console.log('📋 Adding elapsed-state + edge-case FRFs…\n');

  // ⏱  Elapsed state: freshly created (green), mid-aged (yellow), stale (red)
  await createFRF({
    refSuffix: 'ACAD-9101', requestorKey: 'STAFF_ACAD', status: 'PENDING_APPROVAL',
    eventName: 'Freshly Submitted — Elapsed GREEN',
    attendees: 40, placeKey: 'AVR', equipmentKeys: ['PROJ'],
    daysOffset: 20, createdDaysAgo: 0,
    approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'PENDING' },
      { dept: 'OCM',      stepOrder: 2, status: 'PENDING' },
      { dept: 'SAFETY-SECURITY', stepOrder: 3, status: 'PENDING' },
    ],
  });

  await createFRF({
    refSuffix: 'OCM-9102', requestorKey: 'STAFF_OCM', status: 'PENDING_APPROVAL',
    eventName: 'Mid-aged Request — Elapsed YELLOW',
    attendees: 60, placeKey: 'MPH', equipmentKeys: ['PROJ', 'MIC'],
    daysOffset: 18, createdDaysAgo: 3,
    approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'APPROVED', performedByKey: 'PSMO', performedAt: daysFromNow(-2), remarks: 'OK.' },
      { dept: 'OCM',      stepOrder: 2, status: 'PENDING' },
      { dept: 'SAFETY-SECURITY', stepOrder: 3, status: 'PENDING' },
    ],
  });

  await createFRF({
    refSuffix: 'SS-9103', requestorKey: 'STAFF_SS', status: 'PENDING_APPROVAL',
    eventName: 'Stale Request — Elapsed RED',
    attendees: 100, placeKey: 'GYM', equipmentKeys: ['LED', 'MIC'],
    daysOffset: 12, createdDaysAgo: 8,
    approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'PENDING' },
      { dept: 'SAFETY-SECURITY', stepOrder: 2, status: 'PENDING' },
      { dept: 'ITO-MAIN', stepOrder: 3, status: 'PENDING' },
    ],
  });

  // 🎯 OIC-pending — approvals waiting on OIC heads
  await createFRF({
    refSuffix: 'ACAD-9104', requestorKey: 'STAFF_ACAD', status: 'PENDING_APPROVAL',
    eventName: 'Waiting on OIC (PSMO)',
    attendees: 50, placeKey: 'AVR', equipmentKeys: ['PROJ'],
    daysOffset: 22, createdDaysAgo: 2,
    approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'PENDING' },   // OIC PSMO can act
      { dept: 'OCM',      stepOrder: 2, status: 'PENDING' },
    ],
  });

  // 🎯 Upcoming branch venues
  await createFRF({
    refSuffix: 'ACAD-9105', requestorKey: 'STAFF_ACAD', status: 'PENDING_APPROVAL',
    eventName: 'NATECH Lab Session',
    attendees: 30, placeKey: 'LAB_NAST', equipmentKeys: ['LAPTOP', 'CLICKER'],
    daysOffset: 14, createdDaysAgo: 1,
    approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'PENDING' },
      { dept: 'ITO-MAIN', stepOrder: 2, status: 'PENDING' },
    ],
  });

  await createFRF({
    refSuffix: 'OSA-9106', requestorKey: 'STAFF_OSA', status: 'APPROVED',
    eventName: 'SHS Sports Clinic',
    attendees: 180, placeKey: 'COURT_SHS', equipmentKeys: ['MIC', 'SPEAKER'],
    daysOffset: 11, createdDaysAgo: 4,
    approvals: [
      { dept: 'PSMO/FMO',        stepOrder: 1, status: 'APPROVED', performedByKey: 'PSMO', performedAt: daysFromNow(-3), remarks: 'OK.' },
      { dept: 'OSA',              stepOrder: 2, status: 'APPROVED', performedByKey: 'OSA_H', performedAt: daysFromNow(-3), remarks: 'OK.' },
      { dept: 'SAFETY-SECURITY', stepOrder: 3, status: 'APPROVED', performedByKey: 'SS',   performedAt: daysFromNow(-3), remarks: 'OK.' },
      { dept: 'ITO-MAIN',         stepOrder: 4, status: 'APPROVED', performedByKey: 'ITO',  performedAt: daysFromNow(-3), remarks: 'Assigned.' },
    ],
    assignments: [
      { userKey: 'ITO_S1', dutyType: 'SETUP',    dayOffset: 11, startHour: 6, endHour: 8, isOvertime: true },
      { userKey: 'ITO_S2', dutyType: 'OPERATOR', dayOffset: 11, startHour: 8, endHour: 16 },
    ],
  });

  // 🎯 Rooftop VIP event (unusual place)
  await createFRF({
    refSuffix: 'OP-9107', requestorKey: 'STAFF_OP', status: 'APPROVED',
    eventName: 'VIP Rooftop Reception',
    attendees: 25, placeKey: 'ROOFTOP', equipmentKeys: ['SPEAKER', 'MIXER'],
    daysOffset: 7, createdDaysAgo: 5,
    approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'APPROVED', performedByKey: 'PSMO', performedAt: daysFromNow(-4), remarks: 'VIP approved.' },
      { dept: 'OP',       stepOrder: 2, status: 'APPROVED', performedByKey: 'OP_H', performedAt: daysFromNow(-4), remarks: 'OK.' },
      { dept: 'SAFETY-SECURITY', stepOrder: 3, status: 'APPROVED', performedByKey: 'SS', performedAt: daysFromNow(-4), remarks: 'OK.' },
      { dept: 'ITO-MAIN', stepOrder: 4, status: 'APPROVED', performedByKey: 'ITO', performedAt: daysFromNow(-4), remarks: 'Assigned.' },
    ],
    assignments: [
      { userKey: 'ITO_S3', dutyType: 'OPERATOR', dayOffset: 7, startHour: 17, endHour: 22, isOvertime: true },
    ],
  });

  // 🎯 Multi-day event (3-day summer program)
  await createFRF({
    refSuffix: 'ACAD-9108', requestorKey: 'STAFF_ACAD', status: 'COMPLETED',
    eventName: '3-Day Summer Program (Multi-day)',
    attendees: 50, placeKey: 'AVR', equipmentKeys: ['PROJ', 'MIC'],
    daysOffset: -20, createdDaysAgo: 30, packUpDone: true,
    approvals: [
      { dept: 'PSMO/FMO',        stepOrder: 1, status: 'APPROVED', performedByKey: 'PSMO', performedAt: daysFromNow(-25), remarks: 'OK.' },
      { dept: 'OCM',              stepOrder: 2, status: 'APPROVED', performedByKey: 'OCM', performedAt: daysFromNow(-25), remarks: 'OK.' },
      { dept: 'SAFETY-SECURITY', stepOrder: 3, status: 'APPROVED', performedByKey: 'SS', performedAt: daysFromNow(-25), remarks: 'OK.' },
      { dept: 'ITO-MAIN',         stepOrder: 4, status: 'APPROVED', performedByKey: 'ITO', performedAt: daysFromNow(-25), remarks: 'Assigned.' },
    ],
    assignments: [
      { userKey: 'ITO_S1', dutyType: 'SETUP',     dayOffset: -20, startHour: 6,  endHour: 8,  isOvertime: true },
      { userKey: 'ITO_S1', dutyType: 'OPERATOR',  dayOffset: -20, startHour: 8,  endHour: 17 },
      { userKey: 'ITO_S2', dutyType: 'OPERATOR',  dayOffset: -19, startHour: 8,  endHour: 17 },
      { userKey: 'ITO_S3', dutyType: 'OPERATOR',  dayOffset: -18, startHour: 8,  endHour: 17 },
      { userKey: 'ITO_S2', dutyType: 'TEARDOWN',  dayOffset: -18, startHour: 17, endHour: 20, isOvertime: true },
    ],
  });

  // 🎯 CANCELLED (terminal state — should NOT appear in "Pending" tabs)
  await createFRF({
    refSuffix: 'OCM-9109', requestorKey: 'STAFF_OCM', status: 'CANCELLED',
    eventName: 'Cancelled — Venue Conflict',
    attendees: 40, placeKey: 'MPH',
    daysOffset: 15, createdDaysAgo: 2,
  });

  // 🎯 Assignments pending packup (shows in ITO "Assigned to Me" / needs pack-up)
  await createFRF({
    refSuffix: 'SS-9110', requestorKey: 'STAFF_SS', status: 'COMPLETED',
    eventName: 'Drill Wrap-up (pending pack-up)',
    attendees: 200, placeKey: 'FIELD', equipmentKeys: ['MIC', 'SPEAKER'],
    daysOffset: -2, createdDaysAgo: 10,
    // packUpDone intentionally false → pack-up reminder flow
    approvals: [
      { dept: 'PSMO/FMO',        stepOrder: 1, status: 'APPROVED', performedByKey: 'PSMO', performedAt: daysFromNow(-8), remarks: 'OK.' },
      { dept: 'SAFETY-SECURITY', stepOrder: 2, status: 'APPROVED', performedByKey: 'SS', performedAt: daysFromNow(-8), remarks: 'OK.' },
      { dept: 'ITO-MAIN',         stepOrder: 3, status: 'APPROVED', performedByKey: 'ITO', performedAt: daysFromNow(-8), remarks: 'Assigned.' },
    ],
    assignments: [
      { userKey: 'ITO_S2', dutyType: 'SETUP',    dayOffset: -2, startHour: 5, endHour: 7, isOvertime: true },
      { userKey: 'ITO_S2', dutyType: 'OPERATOR', dayOffset: -2, startHour: 7, endHour: 12 },
    ],
  });

  // 🎯 Rejected with long remarks (UI test)
  await createFRF({
    refSuffix: 'CDO-9111', requestorKey: 'STAFF_CDO', status: 'REJECTED',
    eventName: 'Rejected — Long remarks',
    attendees: 30, placeKey: 'AUD_NAST', equipmentKeys: ['CAM', 'TRIPOD'],
    daysOffset: 25, createdDaysAgo: 3,
    approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'APPROVED', performedByKey: 'PSMO', performedAt: daysFromNow(-2), remarks: 'OK.' },
      { dept: 'CDO',      stepOrder: 2, status: 'REJECTED', performedByKey: 'CDO_H', performedAt: daysFromNow(-1),
        remarks: 'The proposed shoot conflicts with scheduled maintenance on the auditorium audio system. Please resubmit after the maintenance window (announced monthly via IOM) or select AVR IMUS as an alternate location. Contact the CDO equipment custodian for the current maintenance calendar before resubmitting.' },
    ],
  });

  // 🎯 Reschedule with place change (original venue ≠ new venue)
  await createFRF({
    refSuffix: 'ACAD-9112', requestorKey: 'STAFF_ACAD', status: 'RESCHEDULE_PENDING',
    eventName: 'Reschedule — Venue changed',
    attendees: 45, placeKey: 'AUD_NAST', equipmentKeys: ['PROJ', 'MIC'],
    daysOffset: 28, createdDaysAgo: 6, isReschedule: true,
    approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'PENDING' },
      { dept: 'OCM',      stepOrder: 2, status: 'PENDING' },
      { dept: 'SAFETY-SECURITY', stepOrder: 3, status: 'PENDING' },
    ],
    originalDatesSnapshot: [{
      date: daysFromNow(20), setupTime: withTime(daysFromNow(20), 6),
      eventStart: withTime(daysFromNow(20), 8), eventEnd: withTime(daysFromNow(20), 17),
      teardownTime: withTime(daysFromNow(20), 19),
      placeId: P.AVR.id,   // original was AVR, rescheduled to AUD_NAST
    }],
  });

  // 🎯 Venue-only (no equipment, no ITO step)
  await createFRF({
    refSuffix: 'FACULTY-9113', requestorKey: 'FACULTY_1', status: 'APPROVED',
    eventName: 'Silent Reading Session (venue-only)',
    attendees: 25, placeKey: 'LIB', equipmentKeys: [],
    daysOffset: 6, createdDaysAgo: 3, isVenueOnly: true,
    approvals: [
      { dept: 'ACAD',             stepOrder: 1, status: 'APPROVED', performedByKey: 'ACAD_H', performedAt: daysFromNow(-2), remarks: 'OK.' },
      { dept: 'PSMO/FMO',         stepOrder: 2, status: 'APPROVED', performedByKey: 'PSMO', performedAt: daysFromNow(-2), remarks: 'OK.' },
      { dept: 'OCM',              stepOrder: 3, status: 'APPROVED', performedByKey: 'OCM',  performedAt: daysFromNow(-2), remarks: 'OK.' },
      { dept: 'SAFETY-SECURITY',  stepOrder: 4, status: 'APPROVED', performedByKey: 'SS',   performedAt: daysFromNow(-2), remarks: 'OK.' },
      // no ITO-MAIN step — venue-only
    ],
  });

  // 🎯 ITO-MAIN requestor self-assign (known workflow bug)
  await createFRF({
    refSuffix: 'ITOMAIN-9114', requestorKey: 'STAFF_ITO', status: 'APPROVED',
    eventName: 'ITO Staff Training (self-assign bug)',
    attendees: 20, placeKey: 'ROOM_NAST', equipmentKeys: ['PROJ', 'LAPTOP'],
    daysOffset: 9, createdDaysAgo: 4,
    // ITO-MAIN filtered from approval chain when requestor is ITO-MAIN
    approvals: [
      { dept: 'PSMO/FMO',        stepOrder: 1, status: 'APPROVED', performedByKey: 'PSMO', performedAt: daysFromNow(-3), remarks: 'OK.' },
      { dept: 'SAFETY-SECURITY', stepOrder: 2, status: 'APPROVED', performedByKey: 'SS',   performedAt: daysFromNow(-3), remarks: 'OK.' },
    ],
    // NO assignments — stuck at APPROVED, no one to assign staff
  });

  // 🎯 Same-day 2 events (calendar collision test)
  await createFRF({
    refSuffix: 'OCM-9115', requestorKey: 'STAFF_OCM', status: 'PENDING_APPROVAL',
    eventName: 'Same-day Event A (Morning)',
    attendees: 60, placeKey: 'MPH', daysOffset: 17, createdDaysAgo: 1,
    approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'PENDING' },
      { dept: 'OCM',      stepOrder: 2, status: 'PENDING' },
    ],
  });
  await createFRF({
    refSuffix: 'OSA-9116', requestorKey: 'STAFF_OSA', status: 'PENDING_APPROVAL',
    eventName: 'Same-day Event B (Afternoon)',
    attendees: 80, placeKey: 'MPH', daysOffset: 17, createdDaysAgo: 1,
    approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'PENDING' },
      { dept: 'OSA',      stepOrder: 2, status: 'PENDING' },
    ],
  });

  // ═══════════════════════════════════════════════════════════
  // NOTIFICATIONS
  // ═══════════════════════════════════════════════════════════
  console.log('🔔 Seeding notifications…\n');

  type NotifEntityType = 'FRF' | 'IOM' | 'SYSTEM' | 'USER';

  interface NotifSeed {
    userKey: string;                 // recipient
    senderKey?: string;              // defaults to SUPERUSER (system sender)
    title: string;
    message: string;
    entityType?: NotifEntityType;
    entityId?: string;
    isRead?: boolean;
    daysAgo?: number;
  }

  async function ensureNotification({
    userKey, senderKey = 'SUPERUSER', title, message,
    entityType, entityId, isRead = false, daysAgo = 0,
  }: NotifSeed) {
    const recipient = U[userKey];
    const sender    = U[senderKey];
    if (!recipient || !sender) return null;

    // Idempotency: match by recipient + title + entityId
    const existing = await prisma.notification.findFirst({
      where: { recipientId: recipient.id, title, ...(entityId ? { entityId } : {}) },
    });
    if (existing) return existing;

    // Only FRF/IOM routes are deep-linkable
    const linkUrl =
      entityId && (entityType === 'FRF' || entityType === 'IOM')
        ? `/dashboard/forms/${entityType === 'FRF' ? 'frf' : 'iom'}?tab=all&focus=${entityId}`
        : null;

    return prisma.notification.create({
      data: {
        recipientId: recipient.id,
        senderId:    sender.id,
        title,
        message,
        isRead,
        linkUrl,
        entityType: entityType ?? null,
        entityId:   entityId   ?? null,
        createdAt:  daysFromNow(-daysAgo),
      },
    });
  }

  // ── FRF notifications ───────────────────────────────────────
  const frf9003 = await prisma.facilityReservation.findUnique({ where: { referenceId: `FRF-SEED-ACAD-9003-${YEAR}` } });
  const frf9005 = await prisma.facilityReservation.findUnique({ where: { referenceId: `FRF-SEED-ACAD-9005-${YEAR}` } });
  const frf9006 = await prisma.facilityReservation.findUnique({ where: { referenceId: `FRF-SEED-ACAD-9006-${YEAR}` } });
  const frf9007 = await prisma.facilityReservation.findUnique({ where: { referenceId: `FRF-SEED-OSA-9007-${YEAR}` } });
  const frf9008 = await prisma.facilityReservation.findUnique({ where: { referenceId: `FRF-SEED-ACAD-9008-${YEAR}` } });

  const notifFRF: NotifSeed[] = [
    // Pending approvals — requestor is sender, head is recipient
    { userKey: 'PSMO', senderKey: 'STAFF_ACAD', title: '[SEED] FRF needs PSMO approval',   message: 'Research Symposium 2026 is awaiting your review.', entityType: 'FRF', entityId: frf9003?.id, daysAgo: 2 },
    { userKey: 'OCM',  senderKey: 'STAFF_ACAD', title: '[SEED] FRF needs OCM approval',    message: 'Research Symposium 2026 is awaiting your review.', entityType: 'FRF', entityId: frf9003?.id, daysAgo: 2 },
    { userKey: 'SS',   senderKey: 'STAFF_ACAD', title: '[SEED] FRF needs Safety approval', message: 'Research Symposium 2026 is awaiting your review.', entityType: 'FRF', entityId: frf9003?.id, daysAgo: 2 },
    { userKey: 'ITO',  senderKey: 'STAFF_ACAD', title: '[SEED] FRF needs ITO approval',    message: 'Research Symposium 2026 is awaiting your review.', entityType: 'FRF', entityId: frf9003?.id, daysAgo: 2 },

    // Status-change — head is sender, requestor is recipient
    { userKey: 'STAFF_ACAD', senderKey: 'PSMO', title: '[SEED] FRF Approved',         message: 'Faculty General Assembly has been fully approved.',  entityType: 'FRF', entityId: frf9005?.id, daysAgo: 1, isRead: true },
    { userKey: 'STAFF_ACAD', senderKey: 'ITO',  title: '[SEED] FRF Completed',        message: 'Alumni Homecoming 2026 has been marked complete.',   entityType: 'FRF', entityId: frf9006?.id, daysAgo: 4, isRead: true },
    { userKey: 'STAFF_ACAD', senderKey: 'OCM',  title: '[SEED] FRF Revision Requested', message: 'OCM has requested revisions on Weekend Seminar.',  entityType: 'FRF', entityId: frf9008?.id, daysAgo: 1 },
    { userKey: 'STAFF_OSA',  senderKey: 'PSMO', title: '[SEED] FRF Rejected',         message: 'Outdoor Concert Proposal was rejected by PSMO.',     entityType: 'FRF', entityId: frf9007?.id, daysAgo: 3, isRead: true },

    // Assignments — head is sender, staff is recipient
    { userKey: 'ITO_S1', senderKey: 'ITO', title: '[SEED] New assignment: SETUP',    message: 'Faculty General Assembly — SETUP on event day.',          entityType: 'FRF', entityId: frf9005?.id, daysAgo: 1 },
    { userKey: 'ITO_S2', senderKey: 'ITO', title: '[SEED] New assignment: OPERATOR', message: 'Faculty General Assembly — OPERATOR on event day.',       entityType: 'FRF', entityId: frf9005?.id, daysAgo: 1 },
    { userKey: 'ITO_S1', senderKey: 'ITO', title: '[SEED] Pack-up pending',          message: 'Alumni Homecoming equipment needs pack-up confirmation.', entityType: 'FRF', entityId: frf9006?.id, daysAgo: 2 },

    // Elapsed-state reminders (system-generated, no entity)
    { userKey: 'PSMO',       title: '[SEED] Overdue review reminder', message: 'Stale Request — Elapsed RED has been pending > 72 hours.',    entityType: 'SYSTEM', daysAgo: 5 },
    { userKey: 'STAFF_ACAD', title: '[SEED] Overdue review reminder', message: 'Your request Mid-aged Request — Elapsed YELLOW is still pending.', entityType: 'SYSTEM', daysAgo: 1 },
  ];

  for (const n of notifFRF) await ensureNotification(n);

  // ── IOM notifications ───────────────────────────────────────
  const memo1  = await prisma.memo.findUnique({ where: { referenceId: `MEMO-SEED-${YEAR}-0001` } });
  const memo6  = await prisma.memo.findUnique({ where: { referenceId: `MEMO-SEED-${YEAR}-0006` } });
  const memo13 = await prisma.memo.findUnique({ where: { referenceId: `MEMO-SEED-${YEAR}-0013` } });
  const memo14 = await prisma.memo.findUnique({ where: { referenceId: `MEMO-SEED-${YEAR}-0014` } });

  const notifIOM: NotifSeed[] = [
    { userKey: 'OCM',  senderKey: 'STAFF_ACAD', title: '[SEED] New memo for approval', message: 'Request for Extended Library Hours is awaiting approval.', entityType: 'IOM', entityId: memo6?.id, daysAgo: 2 },
    { userKey: 'PSMO', senderKey: 'STAFF_ACAD', title: '[SEED] New memo for approval', message: 'Request for Extended Library Hours is awaiting approval.', entityType: 'IOM', entityId: memo6?.id, daysAgo: 2 },
    { userKey: 'OP_H', senderKey: 'STAFF_OCM',  title: '[SEED] New memo for approval', message: 'Memo on Rebranding Rollout Timeline is awaiting approval.', entityType: 'IOM', entityId: memo6?.id, daysAgo: 2 },

    { userKey: 'STAFF_ACAD', senderKey: 'OCM', title: '[SEED] Memo acknowledged',     message: 'Faculty Development Program — Q4 Schedule was acknowledged by OCM.', entityType: 'IOM', entityId: memo13?.id, daysAgo: 5, isRead: true },
    { userKey: 'STAFF_ACAD', senderKey: 'HRD', title: '[SEED] Memo completed',        message: 'Faculty Development Program — Q4 Schedule was completed by HRD.',   entityType: 'IOM', entityId: memo13?.id, daysAgo: 4 },
    { userKey: 'HRD',        senderKey: 'ACAD_H', title: '[SEED] Memo needs processing', message: 'Faculty Development Program — Q4 Schedule requires your action.', entityType: 'IOM', entityId: memo13?.id, daysAgo: 3 },

    { userKey: 'OCM',  senderKey: 'STAFF_SS', title: '[SEED] RUSH memo pending', message: 'Request for Additional Fire Extinguishers is marked RUSH.', entityType: 'IOM', entityId: memo1?.id,  daysAgo: 0 },
    { userKey: 'PSMO', senderKey: 'STAFF_SS', title: '[SEED] RUSH memo pending', message: 'Request for Additional Fire Extinguishers is marked RUSH.', entityType: 'IOM', entityId: memo14?.id, daysAgo: 0 },
  ];

  for (const n of notifIOM) await ensureNotification(n);

  // ── Legacy notification (no deep link — exercises fallback router) ──
  await ensureNotification({
    userKey: 'SUPERUSER',
    senderKey: 'SUPERUSER',
    title: '[SEED] Welcome to D-Forms',
    message: 'Your SuperUser account has been created. Visit /dashboard/super/backup to explore backup tools.',
    entityType: 'SYSTEM',
    daysAgo: 30,
    isRead: true,
  });

  const notifCount = await prisma.notification.count({
    where: { title: { startsWith: '[SEED]' } },
  });
  console.log(`   ✅ ${notifCount} notification(s) ready\n`);

  // ═══════════════════════════════════════════════════════════
  // BACKUP EXPORT HISTORY (Sprint 6)
  // ═══════════════════════════════════════════════════════════
  console.log('💾 Seeding backup export history…\n');

  interface BackupSeed {
    filename: string;
    sizeBytes: number;
    deliveryMode: 'attached' | 'link';
    scope: string;
    recipientEmails: string[];
    blobUrl?: string;
    downloadCount?: number;
    lastDownloadedAt?: Date;
    deletedAt?: Date;
    daysAgo?: number;
  }

  async function ensureBackupExport(s: BackupSeed) {
    const existing = await prisma.backupExport.findFirst({
      where: { filename: s.filename, createdById: U.SUPERUSER.id },
    });
    if (existing) return existing;

    return prisma.backupExport.create({
      data: {
        filename: s.filename,
        sizeBytes: s.sizeBytes,
        deliveryMode: s.deliveryMode,
        scope: s.scope,
        recipientEmails: s.recipientEmails,
        blobUrl: s.blobUrl ?? null,
        createdById: U.SUPERUSER.id,
        createdAt: daysFromNow(-(s.daysAgo ?? 0)),
        downloadCount: s.downloadCount ?? 0,
        lastDownloadedAt: s.lastDownloadedAt ?? null,
        deletedAt: s.deletedAt ?? null,
      },
    });
  }

  const backupSeeds: BackupSeed[] = [
    // Attached mode (email only, no blob)
    { filename: 'seed-backup-memos-2026-01.json',  sizeBytes: 1_250_000,  deliveryMode: 'attached', scope: 'memos',             recipientEmails: ['superuser@test.ncst.edu.ph'],                      daysAgo: 20 },
    { filename: 'seed-backup-frf-2026-02.json',    sizeBytes: 2_800_000,  deliveryMode: 'attached', scope: 'frf',               recipientEmails: ['superuser@test.ncst.edu.ph'],                      daysAgo: 18 },
    { filename: 'seed-backup-users-2026-03.xlsx',  sizeBytes: 340_000,    deliveryMode: 'attached', scope: 'users',             recipientEmails: ['superuser@test.ncst.edu.ph', 'admin@test.ncst.edu.ph'], daysAgo: 14 },
    { filename: 'seed-backup-system-2026-04.json', sizeBytes: 4_900_000,  deliveryMode: 'attached', scope: 'system',            recipientEmails: ['superuser@test.ncst.edu.ph'],                      daysAgo: 10 },

    // Link mode (blob) — downloaded
    { filename: 'seed-backup-full-2026-05.json',   sizeBytes: 8_500_000,  deliveryMode: 'link',     scope: 'memos,frf,users,system', recipientEmails: ['superuser@test.ncst.edu.ph'], blobUrl: 'https://example.blob/seed/backup-full-05.json', downloadCount: 3, lastDownloadedAt: daysFromNow(-3), daysAgo: 7 },
    { filename: 'seed-backup-frf-2026-06.json',    sizeBytes: 6_100_000,  deliveryMode: 'link',     scope: 'frf',               recipientEmails: ['superuser@test.ncst.edu.ph'],                      blobUrl: 'https://example.blob/seed/backup-frf-06.json',  downloadCount: 1, lastDownloadedAt: daysFromNow(-2), daysAgo: 5 },
    { filename: 'seed-backup-memos-2026-07.json',  sizeBytes: 7_200_000,  deliveryMode: 'link',     scope: 'memos',             recipientEmails: ['superuser@test.ncst.edu.ph', 'acad.head@test.ncst.edu.ph'], blobUrl: 'https://example.blob/seed/backup-memos-07.json', downloadCount: 0, daysAgo: 3 },
    { filename: 'seed-backup-full-2026-08.json',   sizeBytes: 9_300_000,  deliveryMode: 'link',     scope: 'memos,frf,users,system', recipientEmails: ['superuser@test.ncst.edu.ph'], blobUrl: 'https://example.blob/seed/backup-full-08.json', downloadCount: 5, lastDownloadedAt: daysFromNow(-1), daysAgo: 2 },

    // Deleted (tests the "Show deleted" filter / audit trail)
    { filename: 'seed-backup-memos-2025-11.json',  sizeBytes: 1_050_000,  deliveryMode: 'attached', scope: 'memos',             recipientEmails: ['superuser@test.ncst.edu.ph'],                      daysAgo: 90, deletedAt: daysFromNow(-60) },
    { filename: 'seed-backup-full-2025-12.json',   sizeBytes: 4_500_000,  deliveryMode: 'link',     scope: 'memos,frf',         recipientEmails: ['superuser@test.ncst.edu.ph'], blobUrl: 'https://example.blob/seed/backup-full-12.json', downloadCount: 2, lastDownloadedAt: daysFromNow(-70), daysAgo: 75, deletedAt: daysFromNow(-40) },

    // One at the 5 MB boundary (tests attachment threshold)
    { filename: 'seed-backup-frf-2026-09.json',    sizeBytes: 5_242_880,  deliveryMode: 'attached', scope: 'frf',               recipientEmails: ['superuser@test.ncst.edu.ph'],                      daysAgo: 1 },
    { filename: 'seed-backup-frf-2026-10.json',    sizeBytes: 5_242_881,  deliveryMode: 'link',     scope: 'frf',               recipientEmails: ['superuser@test.ncst.edu.ph'], blobUrl: 'https://example.blob/seed/backup-frf-10.json', downloadCount: 0, daysAgo: 0 },
  ];

  for (const b of backupSeeds) await ensureBackupExport(b);
  console.log(`   ✅ ${backupSeeds.length} backup export record(s) ready\n`);

  // ═══════════════════════════════════════════════════════════
  // FORM SETTINGS + PRIVACY SETTINGS (singletons)
  // ═══════════════════════════════════════════════════════════
  console.log('⚙️  Ensuring singleton settings…\n');

  try {
    await prisma.formSettings.upsert({
      where: { id: 'single' },                 // schema default is "single", not "singleton"
      update: {},
      create: {
        id: 'single',
        minAdvanceDaysRegular: 7,
        minAdvanceDaysVIP: 1,
        maxEventsPerDay: 2,
        minRescheduleDays: 3,
        enableVipMode: true,
        updatedBy: U.SUPERUSER.id,
      },
    });
    console.log('   ✅ FormSettings singleton ready');
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`   ⚠️  FormSettings seed skipped: ${msg}`);
  }

  try {
    await prisma.privacySettings.upsert({
      where: { id: 'singleton' },              // schema default is "singleton"
      update: {},
      create: {
        id: 'singleton',
        dpoRegistrationNo: 'NPC-DPO-2026-00123',
        dpoRegisteredDate: daysFromNow(-180),
        dpoOfficerName: 'Dana P. Ortiz',
        dpoContactEmail: 'dpo@ncst.edu.ph',
        dpoContactPhone: '+63 (46) 123-4567',
        dpoOfficeAddress: 'National College of Science and Technology, Dasmariñas City, Cavite',
        noticeText:
          'The National College of Science and Technology (NCST) Digital Forms Platform (D-Forms) ' +
          'collects, processes, and stores personal information in accordance with the Data Privacy Act ' +
          'of 2012 (RA 10173) and its Implementing Rules and Regulations.\n\n' +
          'Personal information collected through D-Forms (including names, email addresses, and ' +
          'department affiliation) is used solely for the purpose of processing Inter-Office Memoranda ' +
          'and Facility Reservation Requests. Data is retained for a period of five (5) academic years ' +
          'following the terminal state of the associated record, after which it is securely disposed of.\n\n' +
          'Data subjects may exercise their rights under the DPA — including access, correction, and ' +
          'erasure — by contacting the Data Protection Officer (DPO) through the official NCST channels.',
        lastUpdated: daysFromNow(-90),
        updatedById: U.SUPERUSER.id,
        updatedByName: `${U.SUPERUSER.fname} ${U.SUPERUSER.lname}`,
      },
    });
    console.log('   ✅ PrivacySettings singleton ready');
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`   ⚠️  PrivacySettings seed skipped: ${msg}`);
  }

  // ═══════════════════════════════════════════════════════════
  // EXTRA MEMOS — terminal-state + varied recipient states
  // ═══════════════════════════════════════════════════════════
  console.log('📝 Adding extra memos…\n');

  const extraMemoSeeds: Array<{
    senderKey: string;
    subject: string;
    priority?: 'ROUTINE' | 'URGENT' | 'RUSH';
    purpose?: 'FYI' | 'SIGNATURE' | 'ACTION' | 'COMMENTS' | 'APPROVAL' | 'REQUEST';
    status: 'DRAFT' | 'FOR_APPROVAL' | 'APPROVED' | 'CLOSED';
    recipients: MemoRecipientSeed[];
    daysAgo?: number;
  }> = [
    { senderKey: 'STAFF_HRD', subject: 'Draft — Performance Review Cycle Memo', status: 'DRAFT', recipients: [], daysAgo: 2 },
    { senderKey: 'FACULTY_2', subject: 'Draft — Thesis Defense Schedule', status: 'DRAFT', recipients: [], daysAgo: 1 },

    { senderKey: 'STAFF_ACAD', subject: 'For Signature — Faculty Load Notice', priority: 'URGENT', purpose: 'SIGNATURE', status: 'FOR_APPROVAL',
      recipients: [{ dept: 'HRD', status: 'PENDING' }, { dept: 'OCM', status: 'PENDING' }], daysAgo: 2 },

    { senderKey: 'OCM', subject: 'Media Guidelines — Q1 Refresh', priority: 'ROUTINE', purpose: 'FYI', status: 'APPROVED',
      recipients: [
        { dept: 'CDO', status: 'COMPLETED' },
        { dept: 'ACAD', status: 'ACKNOWLEDGED' },
        { dept: 'OP', status: 'PROCESSING' },
        { dept: 'SS', status: 'PENDING' },
      ], daysAgo: 5 },

    { senderKey: 'SS', subject: 'Denied — After-hours Access Request', priority: 'RUSH', purpose: 'REQUEST', status: 'APPROVED',
      recipients: [
        { dept: 'CDO', status: 'DENIED', feedbackNote: 'No after-hours access approved by safety office.' },
        { dept: 'OP', status: 'CLOSED' },
      ], daysAgo: 8 },

    { senderKey: 'OP_H', subject: 'Directive: New Records Retention Policy', priority: 'URGENT', purpose: 'ACTION', status: 'CLOSED',
      recipients: [
        { dept: 'HRD', status: 'CLOSED' },
        { dept: 'ACAD', status: 'CLOSED' },
        { dept: 'OCM', status: 'CLOSED' },
      ], daysAgo: 50 },

    { senderKey: 'HRD', subject: 'Notice: New Leave Filing Procedure', priority: 'ROUTINE', purpose: 'FYI', status: 'APPROVED',
      recipients: [
        { dept: 'ACAD', status: 'ACKNOWLEDGED' },
        { dept: 'ITO-MAIN', status: 'ACKNOWLEDGED' },
        { dept: 'PSMO/FMO', status: 'ACKNOWLEDGED' },
      ], daysAgo: 6 },

    { senderKey: 'PSMO', subject: 'Response Required — Inventory Rollover', priority: 'URGENT', purpose: 'REQUEST', status: 'APPROVED',
      recipients: [
        { dept: 'ACAD', status: 'RESPONDED', feedbackNote: 'Rolled over 42 items. Full manifest attached.' },
        { dept: 'ITO-MAIN', status: 'RESPONDED', feedbackNote: 'All IT equipment accounted for.' },
        { dept: 'CDO', status: 'PENDING' },
      ], daysAgo: 4 },

    { senderKey: 'OCM', subject: 'Closed — Welcome Kit Distribution Complete', priority: 'ROUTINE', purpose: 'FYI', status: 'CLOSED',
      recipients: [
        { dept: 'HRD', status: 'CLOSED' },
        { dept: 'OSA', status: 'CLOSED' },
      ], daysAgo: 22 },

    { senderKey: 'ITO', subject: 'System Maintenance Window — Weekend', priority: 'URGENT', purpose: 'FYI', status: 'APPROVED',
      recipients: [
        { dept: 'ACAD', status: 'ACKNOWLEDGED' },
        { dept: 'PSMO/FMO', status: 'ACKNOWLEDGED' },
        { dept: 'HRD', status: 'ACKNOWLEDGED' },
        { dept: 'OCM', status: 'PROCESSING' },
      ], daysAgo: 1 },
  ];

  let memoSeq = MEMO_SEEDS.length + 1;
  for (const s of extraMemoSeeds) {
    await createMemo({
      refSeq: memoSeq++,
      senderKey: s.senderKey,
      subject: s.subject,
      priority: s.priority,
      purpose: s.purpose,
      status: s.status,
      recipients: s.recipients,
      contentKB: 32,
      createdDaysAgo: s.daysAgo,
    });
  }

    // ═══════════════════════════════════════════════════════════
  // BATCH 2 — 15 more memos (bulk-fill)
  // ═══════════════════════════════════════════════════════════
  console.log('📝 Adding batch-2 memos (bulk fill)…\n');

  const BATCH_2_MEMOS: Array<{
    senderKey: string;
    subject: string;
    priority?: 'ROUTINE' | 'URGENT' | 'RUSH';
    purpose?: 'FYI' | 'SIGNATURE' | 'ACTION' | 'COMMENTS' | 'APPROVAL' | 'REQUEST';
    status: 'DRAFT' | 'FOR_APPROVAL' | 'APPROVED' | 'CLOSED';
    recipients: MemoRecipientSeed[];
    daysAgo?: number;
  }> = [
    // DRAFTS
    { senderKey: 'STAFF_ACAD', subject: 'Draft — Faculty Assembly Agenda', status: 'DRAFT', recipients: [], daysAgo: 1 },
    { senderKey: 'STAFF_OCM',  subject: 'Draft — Media Coverage Report',   status: 'DRAFT', recipients: [], daysAgo: 3 },
    { senderKey: 'STAFF_SS',   subject: 'Draft — Safe Campus Bulletin',    status: 'DRAFT', recipients: [], daysAgo: 2 },
    { senderKey: 'FACULTY_2',  subject: 'Draft — Research Grant Response', status: 'DRAFT', recipients: [], daysAgo: 4 },

    // FOR_APPROVAL
    { senderKey: 'STAFF_ACAD', subject: 'Request for Promotional Materials', priority: 'ROUTINE', purpose: 'REQUEST',   status: 'FOR_APPROVAL', recipients: [{ dept: 'OCM', status: 'PENDING' }, { dept: 'CDO', status: 'PENDING' }], daysAgo: 2 },
    { senderKey: 'STAFF_HRD',  subject: 'For Signature — Contract Renewal',   priority: 'URGENT',  purpose: 'SIGNATURE', status: 'FOR_APPROVAL', recipients: [{ dept: 'OP', status: 'PENDING' }], daysAgo: 1 },
    { senderKey: 'STAFF_OCM',  subject: 'Action Required — Social Media Blitz', priority: 'RUSH',   purpose: 'ACTION',    status: 'FOR_APPROVAL', recipients: [{ dept: 'CDO', status: 'PENDING' }], daysAgo: 1 },
    { senderKey: 'STAFF_OSA',  subject: 'Request for Student Activities Fund', priority: 'ROUTINE', purpose: 'REQUEST',   status: 'FOR_APPROVAL', recipients: [{ dept: 'OCM', status: 'PENDING' }, { dept: 'OP', status: 'PENDING' }], daysAgo: 4 },

    // APPROVED
    { senderKey: 'ACAD_H', subject: 'Q4 Curriculum Review Schedule',            priority: 'ROUTINE', purpose: 'FYI',    status: 'APPROVED', recipients: [{ dept: 'OCM', status: 'ACKNOWLEDGED' }, { dept: 'HRD', status: 'PROCESSING' }], daysAgo: 12 },
    { senderKey: 'OCM',    subject: 'Brand Refresh — Content Guidelines v2',    priority: 'URGENT',  purpose: 'ACTION', status: 'APPROVED', recipients: [{ dept: 'CDO', status: 'COMPLETED' }, { dept: 'OP', status: 'ACKNOWLEDGED' }], daysAgo: 9 },
    { senderKey: 'ITO',    subject: 'Wi-Fi Network Maintenance Notice',          priority: 'ROUTINE', purpose: 'FYI',    status: 'APPROVED', recipients: [{ dept: 'ACAD', status: 'ACKNOWLEDGED' }, { dept: 'PSMO/FMO', status: 'ACKNOWLEDGED' }, { dept: 'HRD', status: 'ACKNOWLEDGED' }], daysAgo: 5 },
    { senderKey: 'SS',     subject: 'Earthquake Drill Post-Mortem Notes',        priority: 'ROUTINE', purpose: 'FYI',    status: 'APPROVED', recipients: [{ dept: 'PSMO/FMO', status: 'CLOSED' }, { dept: 'OCM', status: 'ACKNOWLEDGED' }], daysAgo: 15 },

    // CLOSED
    { senderKey: 'OP_H', subject: 'Directive: New Faculty Evaluation Criteria', priority: 'URGENT',  purpose: 'ACTION', status: 'CLOSED', recipients: [{ dept: 'HRD', status: 'CLOSED' }, { dept: 'ACAD', status: 'CLOSED' }], daysAgo: 40 },
    { senderKey: 'HRD',  subject: 'Benefits Enrollment Wrap-Up Report',         priority: 'ROUTINE', purpose: 'FYI',    status: 'CLOSED', recipients: [{ dept: 'OCM', status: 'CLOSED' }, { dept: 'SS', status: 'CLOSED' }], daysAgo: 30 },
    { senderKey: 'PSMO', subject: 'Annual Facilities Inspection — Completed',   priority: 'ROUTINE', purpose: 'FYI',    status: 'CLOSED', recipients: [{ dept: 'OCM', status: 'CLOSED' }, { dept: 'ITO-MAIN', status: 'CLOSED' }], daysAgo: 50 },
  ];

  let memoSeqB2 = 130;
  for (const s of BATCH_2_MEMOS) {
    await createMemo({
      refSeq: memoSeqB2++,
      senderKey: s.senderKey,
      subject: s.subject,
      priority: s.priority,
      purpose: s.purpose,
      status: s.status,
      recipients: s.recipients,
      contentKB: 32,
      createdDaysAgo: s.daysAgo,
    });
  }
  console.log('');

    // ═══════════════════════════════════════════════════════════
  // BRANCH USERS — IMUS / NASTECH / SHS heads + staff
  // ═══════════════════════════════════════════════════════════
  console.log('👥 Adding branch users…\n');

  const branchUsers = [
    { key: 'IMUS_H',     email: 'imus.head@test.ncst.edu.ph',     fname: 'Marco',   lname: 'Reyes',     role: 'DepartmentHead', dept: 'ACAD',    branch: 'IMUS' },
    { key: 'NASTECH_H',  email: 'nastech.head@test.ncst.edu.ph',  fname: 'Nina',    lname: 'Aquino',    role: 'DepartmentHead', dept: 'ACAD',    branch: 'NASTECH' },
    { key: 'SHS_H',      email: 'shs.head@test.ncst.edu.ph',      fname: 'Sandro',  lname: 'Villareal', role: 'DepartmentHead', dept: 'ACAD',    branch: 'SHS' },
    { key: 'IMUS_S',     email: 'imus.staff@test.ncst.edu.ph',    fname: 'Mira',    lname: 'Lim',       role: 'Staff',          dept: 'ACAD',    branch: 'IMUS' },
    { key: 'NASTECH_S',  email: 'nastech.staff@test.ncst.edu.ph', fname: 'Noel',    lname: 'Castro',    role: 'Staff',          dept: 'ACAD',    branch: 'NASTECH' },
    { key: 'SHS_S',      email: 'shs.staff@test.ncst.edu.ph',     fname: 'Sina',    lname: 'Garcia',    role: 'Staff',          dept: 'ACAD',    branch: 'SHS' },
  ] as const;
  for (const b of branchUsers) {
    U[b.key] = await ensureUser({
      email: b.email, fname: b.fname, lname: b.lname,
      role: b.role as Role,
      departmentCode: b.dept,
      branch: b.branch as Branch,
    });
  }
  console.log(`   ✅ ${branchUsers.length} branch users ready\n`);

  // ═══════════════════════════════════════════════════════════
  // SCENARIO USERS — disabled + pending password reset
  // ═══════════════════════════════════════════════════════════
  console.log('🔐 Adding edge-case auth users…\n');

  // 1. Disabled account — should fail every auth check
  const disabledEmail = 'disabled.user@test.ncst.edu.ph';
  const disabledExisting = await prisma.user.findUnique({ where: { email: disabledEmail } });
  if (!disabledExisting) {
    const pw = await bcrypt.hash('Test1234!', 10);
    await prisma.user.create({
      data: {
        employee_id: `EMP-DIS-${Date.now()}`,
        email: disabledEmail,
        password: pw,
        fname: 'Dana', lname: 'Disabled',
        role: 'Staff',
        departmentCode: 'HRD',
        branch: 'MAIN',
        disabled: true,
      },
    });
    console.log('   ✅ Disabled user ready (disabled.user@test.ncst.edu.ph)');
  }

  // 2. Password-reset-in-progress user (valid token, 1 day left)
  const resetEmail = 'reset.user@test.ncst.edu.ph';
  const resetExisting = await prisma.user.findUnique({ where: { email: resetEmail } });
  if (!resetExisting) {
    const pw = await bcrypt.hash('OldPass1!', 10);
    await prisma.user.create({
      data: {
        employee_id: `EMP-RST-${Date.now()}`,
        email: resetEmail,
        password: pw,
        fname: 'Rita', lname: 'Reset',
        role: 'Staff',
        departmentCode: 'ACAD',
        branch: 'MAIN',
        forgot_password: true,
        resetToken: 'seed-reset-token-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        resetTokenExpiry: daysFromNow(1),
      },
    });
    console.log('   ✅ Reset-token user ready (reset.user@test.ncst.edu.ph)');
  }
  console.log('');

  // ═══════════════════════════════════════════════════════════
  // EQUIPMENT ↔ PLACE BUNDLES (EquipmentPlace)
  // ═══════════════════════════════════════════════════════════
  console.log('🔗 Ensuring equipment-place bundles…\n');

  const placeBundles: Array<{ equip: keyof typeof E; place: keyof typeof P; isBundled: boolean }> = [
    // AVR Main has projector + mic + clicker pre-wired
    { equip: 'PROJ',    place: 'AVR',       isBundled: true },
    { equip: 'MIC',     place: 'AVR',       isBundled: true },
    { equip: 'CLICKER', place: 'AVR',       isBundled: true },
    // Gym has LED wall + speakers + mic stands
    { equip: 'LED',     place: 'GYM',       isBundled: true },
    { equip: 'SPEAKER', place: 'GYM',       isBundled: true },
    { equip: 'MIC',     place: 'GYM',       isBundled: true },
    // MPH basic AV
    { equip: 'PROJ',    place: 'MPH',       isBundled: true },
    { equip: 'MIC',     place: 'MPH',       isBundled: true },
    // VIP Lounge — premium audio only (no projector, it's designed for intimate meetings)
    { equip: 'MIXER',   place: 'VIP_LOUNGE', isBundled: true },
    { equip: 'SPEAKER', place: 'VIP_LOUNGE', isBundled: true },
    // Auditorium NASTECH — full AV
    { equip: 'LED',     place: 'AUD_NAST',  isBundled: true },
    { equip: 'MIC',     place: 'AUD_NAST',  isBundled: true },
    { equip: 'SPEAKER', place: 'AUD_NAST',  isBundled: true },
    { equip: 'PROJ',    place: 'AUD_NAST',  isBundled: true },
    // Computer Lab NASTECH — laptops + clicker
    { equip: 'LAPTOP',  place: 'LAB_NAST',  isBundled: true },
    { equip: 'CLICKER', place: 'LAB_NAST',  isBundled: true },
    // SHS Gym
    { equip: 'MIC',     place: 'GYM_SHS',   isBundled: true },
    { equip: 'SPEAKER', place: 'GYM_SHS',   isBundled: true },
    // IMUS AVR
    { equip: 'PROJ',    place: 'AVR_IMU',   isBundled: true },
    { equip: 'MIC',     place: 'AVR_IMU',   isBundled: true },
    // Conference Room A (VIP) — full AV
    { equip: 'PROJ',    place: 'CONF',      isBundled: true },
    { equip: 'MIC',     place: 'CONF',      isBundled: true },
    // Non-bundled (optional-per-event)
    { equip: 'CAM',     place: 'AUD_NAST',  isBundled: false },
    { equip: 'TRIPOD',  place: 'AUD_NAST',  isBundled: false },
  ];

  let bundleCount = 0;
  for (const b of placeBundles) {
    const eqId = E[b.equip]?.id;
    const plId = P[b.place]?.id;
    if (!eqId || !plId) continue;
    await prisma.equipmentPlace.upsert({
      where: { equipmentId_placeId: { equipmentId: eqId, placeId: plId } },
      update: {},
      create: { equipmentId: eqId, placeId: plId, isBundled: b.isBundled },
    });
    bundleCount++;
  }
  console.log(`   ✅ ${bundleCount} equipment-place bundle(s) ready\n`);

  // ═══════════════════════════════════════════════════════════
  // MEMO THREADING — root + replies
  // ═══════════════════════════════════════════════════════════
  console.log('🧵 Creating memo thread (root + 3 replies)…\n');

  const rootRef = `MEMO-SEED-${YEAR}-0100`;
  const existingRoot = await prisma.memo.findUnique({ where: { referenceId: rootRef } });

  if (!existingRoot) {
    const rootMemo = await prisma.memo.create({
      data: {
        referenceId: rootRef,
        subject: 'Campus Safety Protocol — Q4 Update',
        content: buildContent(MEMO_BODY_BLOCKS, 16, 100, 'threading/root'),
        priority: 'URGENT',
        purpose: 'ACTION',
        senderId: U.SS.id,
        senderName: `${U.SS.fname} ${U.SS.lname}`,
        senderDept: 'SAFETY-SECURITY',
        status: 'APPROVED',
        recipients: {
          create: [
            { departmentName: 'HRD',  status: 'ACKNOWLEDGED', acknowledgedByName: `${U.HRD.fname} ${U.HRD.lname}`, acknowledgedAt: daysFromNow(-4) },
            { departmentName: 'ACAD', status: 'ACKNOWLEDGED', acknowledgedByName: `${U.ACAD_H.fname} ${U.ACAD_H.lname}`, acknowledgedAt: daysFromNow(-3) },
            { departmentName: 'OCM',  status: 'PROCESSING',   acknowledgedByName: `${U.OCM.fname} ${U.OCM.lname}`, acknowledgedAt: daysFromNow(-3), processedByName: 'OCM Staff', processedAt: daysFromNow(-2) },
          ],
        },
        history: {
          create: [
            { performedById: U.SS.id, performedByName: `${U.SS.fname} ${U.SS.lname}`, actorRole: 'SENDER',    action: 'CREATED', remarks: 'Root memo created.', createdAt: daysFromNow(-5) },
            { performedById: U.HRD.id, performedByName: `${U.HRD.fname} ${U.HRD.lname}`, actorRole: 'RECIPIENT', action: 'ACKNOWLEDGED', departmentName: 'HRD', remarks: 'Acknowledged by HRD.', createdAt: daysFromNow(-4) },
            { performedById: U.ACAD_H.id, performedByName: `${U.ACAD_H.fname} ${U.ACAD_H.lname}`, actorRole: 'RECIPIENT', action: 'ACKNOWLEDGED', departmentName: 'ACAD', remarks: 'Acknowledged by ACAD.', createdAt: daysFromNow(-3) },
          ],
        },
        createdAt: daysFromNow(-5),
        lastActivityAt: daysFromNow(-2),
      },
    });
    // self-reference the root
    await prisma.memo.update({
      where: { id: rootMemo.id },
      data: { rootMemoId: rootMemo.id },
    });

    // Reply 1 — HRD head
    await prisma.memo.create({
      data: {
        referenceId: `MEMO-SEED-${YEAR}-0101`,
        subject: 'RE: Campus Safety Protocol — Q4 Update',
        content: 'HRD acknowledges. Cascade to all branch offices completed. No objections.',
        priority: 'URGENT',
        purpose: 'COMMENTS',
        senderId: U.HRD.id,
        senderName: `${U.HRD.fname} ${U.HRD.lname}`,
        senderDept: 'HRD',
        status: 'APPROVED',
        parentMemoId: rootMemo.id,
        rootMemoId:   rootMemo.id,
        history: {
          create: [
            { performedById: U.HRD.id, performedByName: `${U.HRD.fname} ${U.HRD.lname}`, actorRole: 'SENDER', action: 'CREATED', remarks: 'Reply created.', createdAt: daysFromNow(-4) },
          ],
        },
        createdAt: daysFromNow(-4),
        lastActivityAt: daysFromNow(-4),
      },
    });

    // Reply 2 — ACAD head, with a concern
    await prisma.memo.create({
      data: {
        referenceId: `MEMO-SEED-${YEAR}-0102`,
        subject: 'RE: Campus Safety Protocol — Q4 Update',
        content: 'ACAD sees an issue with the new timing. The proposed 6am evacuation check conflicts with the faculty assembly. Please advise.',
        priority: 'URGENT',
        purpose: 'COMMENTS',
        senderId: U.ACAD_H.id,
        senderName: `${U.ACAD_H.fname} ${U.ACAD_H.lname}`,
        senderDept: 'ACAD',
        status: 'APPROVED',
        parentMemoId: rootMemo.id,
        rootMemoId:   rootMemo.id,
        history: {
          create: [
            { performedById: U.ACAD_H.id, performedByName: `${U.ACAD_H.fname} ${U.ACAD_H.lname}`, actorRole: 'SENDER', action: 'CREATED', remarks: 'Reply with concern.', createdAt: daysFromNow(-3) },
          ],
        },
        createdAt: daysFromNow(-3),
        lastActivityAt: daysFromNow(-3),
      },
    });

    // Reply 3 — Safety head responds (nested under reply 2)
    const reply2 = await prisma.memo.findUnique({ where: { referenceId: `MEMO-SEED-${YEAR}-0102` } });
    if (reply2) {
      await prisma.memo.create({
        data: {
          referenceId: `MEMO-SEED-${YEAR}-0103`,
          subject: 'RE: Campus Safety Protocol — Q4 Update',
          content: 'Resolved. Timing shifted to 5:30am — HRD will announce separately.',
          priority: 'URGENT',
          purpose: 'COMMENTS',
          senderId: U.SS.id,
          senderName: `${U.SS.fname} ${U.SS.lname}`,
          senderDept: 'SAFETY-SECURITY',
          status: 'APPROVED',
          parentMemoId: reply2.id,
          rootMemoId:   rootMemo.id,
          history: {
            create: [
              { performedById: U.SS.id, performedByName: `${U.SS.fname} ${U.SS.lname}`, actorRole: 'SENDER', action: 'REPLIED', remarks: 'Resolved concern.', createdAt: daysFromNow(-2) },
            ],
          },
          createdAt: daysFromNow(-2),
          lastActivityAt: daysFromNow(-2),
        },
      });
    }
    console.log('   ✅ Thread: root + 3 replies\n');
  } else {
    console.log('   ⏭️  Thread already exists — skipping\n');
  }

  // ═══════════════════════════════════════════════════════════
  // HEAD-REVISED MEMO — full revision metadata
  // ═══════════════════════════════════════════════════════════
  console.log('✏️  Creating head-revised memo…\n');

  const revisedRef = `MEMO-SEED-${YEAR}-0110`;
  const existingRevised = await prisma.memo.findUnique({ where: { referenceId: revisedRef } });
  if (!existingRevised) {
    await prisma.memo.create({
      data: {
        referenceId: revisedRef,
        subject: 'Proposed Extension of Library Operating Hours',
        revisedSubject: 'Proposed Extension of Library Operating Hours (Revised per Head)',
        content: buildContent(MEMO_BODY_BLOCKS, 24, 110, 'head-revised'),
        headNote: 'Approved in principle. Head revised the schedule to respect the current safety office curfew on after-hours student presence.',
        revisedHeadNote: 'The proposed 9pm cut-off is not achievable under the current curfew. Revised to 7pm and requires a signed safety waiver before further escalation.',
        isRevisedByHead: true,
        priority: 'ROUTINE',
        purpose: 'APPROVAL',
        senderId: U.STAFF_ACAD.id,
        senderName: `${U.STAFF_ACAD.fname} ${U.STAFF_ACAD.lname}`,
        senderDept: 'ACAD',
        status: 'FOR_APPROVAL',
        recipients: {
          create: [
            { departmentName: 'OCM', status: 'PENDING' },
            { departmentName: 'PSMO/FMO', status: 'PENDING' },
          ],
        },
        history: {
          create: [
            { performedById: U.STAFF_ACAD.id, performedByName: `${U.STAFF_ACAD.fname} ${U.STAFF_ACAD.lname}`, actorRole: 'SENDER', action: 'CREATED', remarks: 'Original submitted.', createdAt: daysFromNow(-6) },
            { performedById: U.ACAD_H.id, performedByName: `${U.ACAD_H.fname} ${U.ACAD_H.lname}`, actorRole: 'SENDER', action: 'APPROVED', remarks: 'Approved with revision.', createdAt: daysFromNow(-4) },
            { performedById: U.ACAD_H.id, performedByName: `${U.ACAD_H.fname} ${U.ACAD_H.lname}`, actorRole: 'SENDER', action: 'REVISED_BY_HEAD', remarks: 'Head revised content before dispatch.', createdAt: daysFromNow(-4) },
          ],
        },
        createdAt: daysFromNow(-6),
        lastActivityAt: daysFromNow(-4),
      },
    });
    console.log('   ✅ Head-revised memo ready\n');
  } else {
    console.log('   ⏭️  Head-revised memo exists — skipping\n');
  }

  // ═══════════════════════════════════════════════════════════
  // CONFIRMATION-MODE MEMO — two-way sign-off flow
  // ═══════════════════════════════════════════════════════════
  console.log('🤝 Creating CONFIRMATION-mode memo…\n');

  const confirmRef = `MEMO-SEED-${YEAR}-0120`;
  const existingConfirm = await prisma.memo.findUnique({ where: { referenceId: confirmRef } });
  if (!existingConfirm) {
    await prisma.memo.create({
      data: {
        referenceId: confirmRef,
        subject: 'Mutual Agreement — Shared Facility Use Q4',
        content: buildContent(MEMO_BODY_BLOCKS, 20, 120, 'confirmation'),
        resolutionMode: 'CONFIRMATION',
        priority: 'URGENT',
        purpose: 'APPROVAL',
        senderId: U.PSMO.id,
        senderName: `${U.PSMO.fname} ${U.PSMO.lname}`,
        senderDept: 'PSMO/FMO',
        status: 'APPROVED',
        recipients: {
          create: [
            {
              departmentName: 'OCM',
              status: 'COMPLETED',
              acknowledgedByName: `${U.OCM.fname} ${U.OCM.lname}`,
              acknowledgedAt: daysFromNow(-5),
              processedByName: 'OCM Staff',
              processedAt: daysFromNow(-4),
              completedByName: 'OCM Staff',
              completedAt: daysFromNow(-3),
              // Recipient confirmed first
              recipientConfirmedById: U.OCM.id,
              recipientConfirmedByName: `${U.OCM.fname} ${U.OCM.lname}`,
              recipientConfirmedAt: daysFromNow(-2),
              recipientConfirmationNote: 'OCM confirms the shared usage terms are acceptable.',
              // Sender confirmed after
              senderConfirmedById: U.PSMO.id,
              senderConfirmedByName: `${U.PSMO.fname} ${U.PSMO.lname}`,
              senderConfirmedAt: daysFromNow(-1),
              senderConfirmationNote: 'PSMO confirms the allocation. Effective immediately.',
            },
            {
              departmentName: 'SAFETY-SECURITY',
              status: 'COMPLETED',
              acknowledgedByName: `${U.SS.fname} ${U.SS.lname}`,
              acknowledgedAt: daysFromNow(-4),
              processedByName: 'SS Staff',
              processedAt: daysFromNow(-4),
              completedByName: 'SS Staff',
              completedAt: daysFromNow(-3),
              // Recipient confirmed but sender not yet → pending 2nd sign-off
              recipientConfirmedById: U.SS.id,
              recipientConfirmedByName: `${U.SS.fname} ${U.SS.lname}`,
              recipientConfirmedAt: daysFromNow(-2),
              recipientConfirmationNote: 'Safety office confirms.',
            },
            {
              departmentName: 'ITO-MAIN',
              status: 'PROCESSING',
              acknowledgedByName: `${U.ITO.fname} ${U.ITO.lname}`,
              acknowledgedAt: daysFromNow(-3),
              processedByName: 'ITO Staff',
              processedAt: daysFromNow(-2),
            },
          ],
        },
        history: {
          create: [
            { performedById: U.PSMO.id, performedByName: `${U.PSMO.fname} ${U.PSMO.lname}`, actorRole: 'SENDER', action: 'CREATED', remarks: 'Confirmation-mode memo created.', createdAt: daysFromNow(-6) },
            { performedById: U.OCM.id,  performedByName: `${U.OCM.fname} ${U.OCM.lname}`,   actorRole: 'RECIPIENT', departmentName: 'OCM', action: 'RECIPIENT_CONFIRMED', remarks: 'OCM signed off.', createdAt: daysFromNow(-2) },
            { performedById: U.PSMO.id, performedByName: `${U.PSMO.fname} ${U.PSMO.lname}`, actorRole: 'SENDER',    departmentName: 'OCM', action: 'SENDER_CONFIRMED', remarks: 'PSMO countersigned OCM.', createdAt: daysFromNow(-1) },
            { performedById: U.SS.id,   performedByName: `${U.SS.fname} ${U.SS.lname}`,     actorRole: 'RECIPIENT', departmentName: 'SAFETY-SECURITY', action: 'RECIPIENT_CONFIRMED', remarks: 'Safety signed off.', createdAt: daysFromNow(-2) },
          ],
        },
        createdAt: daysFromNow(-6),
        lastActivityAt: daysFromNow(-1),
      },
    });
    console.log('   ✅ CONFIRMATION-mode memo ready (OCM done, SS awaiting PSMO counter-sign)\n');
  } else {
    console.log('   ⏭️  CONFIRMATION memo exists — skipping\n');
  }

  // ═══════════════════════════════════════════════════════════
  // MULTI-DAY FRFs — 2-day and 3-day events
  // ═══════════════════════════════════════════════════════════
  console.log('📅 Creating multi-day FRFs…\n');

  const multiDaySeeds: Array<{
    refSuffix: string;
    requestorKey: string;
    eventName: string;
    placeKey: keyof typeof P;
    equipmentKeys: Array<keyof typeof E>;
    dayOffsets: number[];      // e.g. [-20, -19, -18]
    status: 'APPROVED' | 'COMPLETED' | 'PENDING_APPROVAL';
    attendees: number;
    packUpDone?: boolean;
  }> = [
    {
      refSuffix: 'ACAD-9201', requestorKey: 'STAFF_ACAD',
      eventName: '3-Day Faculty Training Camp',
      placeKey: 'AUD_NAST', equipmentKeys: ['PROJ', 'MIC', 'SPEAKER'],
      dayOffsets: [60, 61, 62], status: 'APPROVED', attendees: 120,
    },
    {
      refSuffix: 'OCM-9202', requestorKey: 'STAFF_OCM',
      eventName: '2-Day Marketing Bootcamp',
      placeKey: 'AVR', equipmentKeys: ['PROJ'],
      dayOffsets: [45, 46], status: 'APPROVED', attendees: 40,
    },
    {
      refSuffix: 'SS-9203', requestorKey: 'STAFF_SS',
      eventName: '2-Day Earthquake Drill Series',
      placeKey: 'FIELD', equipmentKeys: ['MIC', 'SPEAKER'],
      dayOffsets: [-10, -9], status: 'COMPLETED', attendees: 600, packUpDone: true,
    },
    {
      refSuffix: 'OSA-9204', requestorKey: 'STAFF_OSA',
      eventName: '3-Day Student Leadership Camp (multi-day)',
      placeKey: 'GYM_SHS', equipmentKeys: ['MIC', 'CHAIR', 'TENT'],
      dayOffsets: [55, 56, 57], status: 'PENDING_APPROVAL', attendees: 180,
    },
  ];

  for (const m of multiDaySeeds) {
    const referenceId = `FRF-SEED-${m.refSuffix}-${YEAR}`;
    const existing = await prisma.facilityReservation.findUnique({ where: { referenceId } });
    if (existing) { console.log(`   ⏭️  ${referenceId} exists — skipping`); continue; }

    const requestor = U[m.requestorKey];
    if (!requestor) continue;

    const approveAll = m.status !== 'PENDING_APPROVAL';
    const approvals = approveAll
      ? [
          { departmentCode: 'PSMO/FMO',        stepOrder: 1, status: 'APPROVED' as const, performedById: U.PSMO.id, performedAt: daysFromNow(m.dayOffsets[0] - 10), remarks: 'Approved.' },
          { departmentCode: 'OCM',              stepOrder: 2, status: 'APPROVED' as const, performedById: U.OCM.id,  performedAt: daysFromNow(m.dayOffsets[0] - 10), remarks: 'Approved.' },
          { departmentCode: 'SAFETY-SECURITY', stepOrder: 3, status: 'APPROVED' as const, performedById: U.SS.id,   performedAt: daysFromNow(m.dayOffsets[0] - 10), remarks: 'Approved.' },
          { departmentCode: 'ITO-MAIN',         stepOrder: 4, status: 'APPROVED' as const, performedById: U.ITO.id,  performedAt: daysFromNow(m.dayOffsets[0] - 10), remarks: 'Assigned.' },
        ]
      : [
          { departmentCode: 'PSMO/FMO',        stepOrder: 1, status: 'PENDING' as const },
          { departmentCode: 'OCM',              stepOrder: 2, status: 'PENDING' as const },
          { departmentCode: 'SAFETY-SECURITY', stepOrder: 3, status: 'PENDING' as const },
          { departmentCode: 'ITO-MAIN',         stepOrder: 4, status: 'PENDING' as const },
        ];

    const day1 = daysFromNow(m.dayOffsets[0]);
    const assignments = m.status === 'PENDING_APPROVAL' ? [] : [
      { userId: U.ITO_S1.id, dutyType: 'SETUP' as const,   dutyStart: withTime(day1, 6), dutyEnd: withTime(day1, 8), isOvertime: true },
      { userId: U.ITO_S2.id, dutyType: 'OPERATOR' as const, dutyStart: withTime(day1, 8), dutyEnd: withTime(day1, 17) },
    ];

    await prisma.facilityReservation.create({
      data: {
        referenceId,
        requestorId: requestor.id,
        requestorDept: requestor.departmentCode,
        type: 'EMPLOYEE_ONLY',
        eventName: m.eventName,
        attendeesCount: m.attendees,
        status: m.status,
        isVenueOnly: false,
        requestorNotes: buildContent(FRF_NOTE_BLOCKS, 8, m.dayOffsets[0], 'multi-day/' + m.refSuffix),
        dates: {
          create: m.dayOffsets.map(offset => {
            const d = daysFromNow(offset);
            return {
              date: d,
              setupTime: withTime(d, 6),
              eventStart: withTime(d, 8),
              eventEnd: withTime(d, 17),
              teardownTime: withTime(d, 19),
              placeId: P[m.placeKey].id,
            };
          }),
        },
        equipmentRequests: {
          create: m.equipmentKeys.map(k => ({ equipmentId: E[k].id, quantityRequested: 1 })),
        },
        approvals: { create: approvals },
        ...(assignments.length > 0 && { assignments: { create: assignments } }),
        ...(m.packUpDone && {
          packUpDoneAt: daysFromNow(m.dayOffsets[m.dayOffsets.length - 1] + 1),
          packUpDoneById: U.ITO.id,
          packUpDoneNotes: 'Multi-day pack-up completed.',
          packUpDonePhotos: [],
        }),
      },
    });
    console.log(`   ✅ ${referenceId} → ${m.status} (${m.dayOffsets.length} days)`);
  }
  console.log('');

  // ═══════════════════════════════════════════════════════════
  // ATTACHMENTS — populate attachmentPaths / attachments arrays
  // ═══════════════════════════════════════════════════════════
  console.log('📎 Populating attachments on key records…\n');

  // 3 FRFs with attachments
  const frfWithAttachments = [
    { refSuffix: 'ACAD-9005', files: [
      'https://example.blob/seed/frf/acad-9005/event-proposal.pdf',
      'https://example.blob/seed/frf/acad-9005/risk-assessment.pdf',
    ]},
    { refSuffix: 'OSA-9004', files: [
      'https://example.blob/seed/frf/osa-9004/student-list.xlsx',
    ]},
    { refSuffix: 'ACAD-9006', files: [
      'https://example.blob/seed/frf/acad-9006/post-event-report.pdf',
      'https://example.blob/seed/frf/acad-9006/venue-before.jpg',
      'https://example.blob/seed/frf/acad-9006/venue-after.jpg',
    ]},
  ];
  for (const rec of frfWithAttachments) {
    const frf = await prisma.facilityReservation.findUnique({ where: { referenceId: `FRF-SEED-${rec.refSuffix}-${YEAR}` } });
    if (frf && frf.attachments.length === 0) {
      await prisma.facilityReservation.update({
        where: { id: frf.id },
        data: { attachments: rec.files },
      });
    }
  }

  // 2 memos with attachments
  const memoWithAttachments = [
    { refSeq: 6, files: [
      'https://example.blob/seed/memo/0006/library-hours-study.pdf',
    ]},
    { refSeq: 14, files: [
      'https://example.blob/seed/memo/0014/brand-guidelines-v3.pdf',
      'https://example.blob/seed/memo/0014/logo-pack-v3.zip',
    ]},
  ];
  for (const rec of memoWithAttachments) {
    const refId = `MEMO-SEED-${YEAR}-${String(rec.refSeq).padStart(4, '0')}`;
    const memo = await prisma.memo.findUnique({ where: { referenceId: refId } });
    if (memo && memo.attachmentPaths.length === 0) {
      await prisma.memo.update({
        where: { id: memo.id },
        data: { attachmentPaths: rec.files },
      });
    }
  }
  console.log('   ✅ Attachments set on 3 FRFs + 2 memos\n');

  // ═══════════════════════════════════════════════════════════
  // MEMO HISTORY — fill missing action variants
  // ═══════════════════════════════════════════════════════════
  console.log('📜 Filling missing MemoHistory action variants…\n');

  // Attach additional history events to memo 13 (Faculty Development Program)
  const historyMemo = await prisma.memo.findUnique({ where: { referenceId: `MEMO-SEED-${YEAR}-0013` } });
  if (historyMemo) {
    const existing = await prisma.memoHistory.findMany({
      where: { memoId: historyMemo.id },
      select: { action: true },
    });
    const have = new Set(existing.map(h => h.action));
    const toAdd: Array<{
      action: 'APPROVED' | 'ASSIGNED' | 'PROCESSING_JOINED' | 'REVERTED' | 'DISAPPROVED';
      actorRole: 'SENDER' | 'RECIPIENT' | 'ADMIN' | 'SYSTEM';
      performedById: string;
      performedByName: string;
      departmentName?: string;
      remarks: string;
    }> = [
      { action: 'APPROVED',         actorRole: 'SENDER',    performedById: U.ACAD_H.id, performedByName: `${U.ACAD_H.fname} ${U.ACAD_H.lname}`, remarks: 'Approved by sender head.', departmentName: undefined },
      { action: 'ASSIGNED',         actorRole: 'RECIPIENT', performedById: U.OCM.id,    performedByName: `${U.OCM.fname} ${U.OCM.lname}`,     remarks: 'Assigned to OCM staff.', departmentName: 'OCM' },
      { action: 'PROCESSING_JOINED', actorRole: 'RECIPIENT', performedById: U.HRD.id,  performedByName: 'HRD Staff',                          remarks: 'Second staff joined processing.', departmentName: 'HRD' },
    ];
    for (const h of toAdd) {
      if (have.has(h.action)) continue;
      await prisma.memoHistory.create({
        data: {
          memoId: historyMemo.id,
          departmentName: h.departmentName ?? null,
          performedById: h.performedById,
          performedByName: h.performedByName,
          actorRole: h.actorRole,
          action: h.action,
          remarks: h.remarks,
        },
      });
    }
  }

  // Attach a REVERTED event to memo 8 (Fire Extinguisher request — was rejected then reverted)
  const revertMemo = await prisma.memo.findUnique({ where: { referenceId: `MEMO-SEED-${YEAR}-0008` } });
  if (revertMemo) {
    const hasReverted = await prisma.memoHistory.findFirst({ where: { memoId: revertMemo.id, action: 'REVERTED' } });
    if (!hasReverted) {
      await prisma.memoHistory.create({
        data: {
          memoId: revertMemo.id,
          performedById: U.PSMO.id,
          performedByName: `${U.PSMO.fname} ${U.PSMO.lname}`,
          actorRole: 'ADMIN',
          action: 'REVERTED',
          remarks: 'Reverted to PENDING after procurement reallocation.',
        },
      });
    }
  }
  console.log('   ✅ Memo history variants added\n');

  // ═══════════════════════════════════════════════════════════
  // ACTIVITY LOG — admin audit trail
  // ═══════════════════════════════════════════════════════════
  console.log('📋 Seeding ActivityLog (audit trail)…\n');

  interface ActivitySeed {
    userKey?: string;
    email?: string;
    action: string;
    details: string;
    ipAddress?: string;
    daysAgo: number;
  }

  const activitySeeds: ActivitySeed[] = [
    // Login / logout pattern (multiple users)
    { userKey: 'SUPERUSER',  action: 'LOGIN_SUCCESS', details: '[SEED] SuperUser login from campus network.',               ipAddress: '203.0.113.42', daysAgo: 0 },
    { userKey: 'ADMIN',      action: 'LOGIN_SUCCESS', details: '[SEED] Admin login.',                                       ipAddress: '203.0.113.43', daysAgo: 0 },
    { userKey: 'PSMO',       action: 'LOGIN_SUCCESS', details: '[SEED] PSMO Head login.',                                   ipAddress: '203.0.113.50', daysAgo: 1 },
    { userKey: 'OCM',        action: 'LOGIN_SUCCESS', details: '[SEED] OCM Head login.',                                    ipAddress: '203.0.113.51', daysAgo: 1 },
    { userKey: 'SS',         action: 'LOGIN_SUCCESS', details: '[SEED] Safety Head login.',                                 ipAddress: '203.0.113.52', daysAgo: 1 },
    { userKey: 'ITO',        action: 'LOGIN_SUCCESS', details: '[SEED] ITO Head login.',                                    ipAddress: '203.0.113.53', daysAgo: 2 },
    { userKey: 'HRD',        action: 'LOGIN_SUCCESS', details: '[SEED] HRD Head login.',                                    ipAddress: '203.0.113.54', daysAgo: 2 },
    { userKey: 'ACAD_H',     action: 'LOGIN_SUCCESS', details: '[SEED] ACAD Head login.',                                   ipAddress: '203.0.113.55', daysAgo: 2 },
    { userKey: 'STAFF_ACAD', action: 'LOGIN_SUCCESS', details: '[SEED] ACAD staff login.',                                   ipAddress: '203.0.113.60', daysAgo: 0 },
    { userKey: 'STAFF_ITO',  action: 'LOGIN_SUCCESS', details: '[SEED] ITO staff login.',                                    ipAddress: '203.0.113.61', daysAgo: 0 },
    { userKey: 'STAFF_OCM',  action: 'LOGIN_SUCCESS', details: '[SEED] OCM staff login.',                                    ipAddress: '203.0.113.62', daysAgo: 1 },
    { userKey: 'STAFF_OSA',  action: 'LOGIN_SUCCESS', details: '[SEED] OSA staff login.',                                    ipAddress: '203.0.113.63', daysAgo: 1 },
    { userKey: 'ITO_S1',     action: 'LOGIN_SUCCESS', details: '[SEED] ITO staff 1 login.',                                  ipAddress: '203.0.113.64', daysAgo: 0 },
    { userKey: 'ITO_S2',     action: 'LOGIN_SUCCESS', details: '[SEED] ITO staff 2 login.',                                  ipAddress: '203.0.113.65', daysAgo: 0 },
    { userKey: 'FACULTY_1',  action: 'LOGIN_SUCCESS', details: '[SEED] Faculty 1 login.',                                    ipAddress: '203.0.113.70', daysAgo: 3 },

    // Logout
    { userKey: 'STAFF_ACAD', action: 'LOGOUT',        details: '[SEED] ACAD staff logout.',                                   ipAddress: '203.0.113.60', daysAgo: 0 },
    { userKey: 'PSMO',       action: 'LOGOUT',        details: '[SEED] PSMO Head logout.',                                   ipAddress: '203.0.113.50', daysAgo: 1 },

    // Failed logins — attacker pattern
    { email: 'unknown@test.ncst.edu.ph',  action: 'LOGIN_FAILURE', details: '[SEED] Unknown account attempted.',  ipAddress: '198.51.100.7', daysAgo: 3 },
    { userKey: 'STAFF_ACAD',              action: 'LOGIN_FAILURE', details: '[SEED] Wrong password attempt 1.',   ipAddress: '198.51.100.8', daysAgo: 2 },
    { userKey: 'STAFF_ACAD',              action: 'LOGIN_FAILURE', details: '[SEED] Wrong password attempt 2.',   ipAddress: '198.51.100.8', daysAgo: 2 },
    { userKey: 'STAFF_ACAD',              action: 'LOGIN_FAILURE', details: '[SEED] Wrong password attempt 3.',   ipAddress: '198.51.100.8', daysAgo: 2 },

    // User management
    { userKey: 'SUPERUSER', action: 'USER_CREATE', details: '[SEED] Created user: disabled.user@test.ncst.edu.ph',        ipAddress: '203.0.113.42', daysAgo: 5 },
    { userKey: 'SUPERUSER', action: 'USER_CREATE', details: '[SEED] Created user: reset.user@test.ncst.edu.ph',           ipAddress: '203.0.113.42', daysAgo: 5 },
    { userKey: 'SUPERUSER', action: 'USER_UPDATE', details: '[SEED] Disabled: disabled.user@test.ncst.edu.ph',             ipAddress: '203.0.113.42', daysAgo: 4 },
    { userKey: 'ADMIN',     action: 'USER_UPDATE', details: '[SEED] Reset password: reset.user@test.ncst.edu.ph',          ipAddress: '203.0.113.43', daysAgo: 1 },

    // Department ops
    { userKey: 'SUPERUSER', action: 'DEPT_CREATE', details: '[SEED] Ensured department: PSMO/FMO',                        ipAddress: '203.0.113.42', daysAgo: 30 },
    { userKey: 'SUPERUSER', action: 'DEPT_UPDATE', details: '[SEED] Ensured department: ACAD',                            ipAddress: '203.0.113.42', daysAgo: 30 },

    // FRF workflow actions
    { userKey: 'STAFF_ACAD', action: 'FRF_CREATE',      details: `[SEED] Created FRF-SEED-ACAD-9003-${YEAR}.`,             ipAddress: '203.0.113.60', daysAgo: 4 },
    { userKey: 'STAFF_ACAD', action: 'FRF_SUBMIT_DRAFT', details: `[SEED] Submitted FRF-SEED-ACAD-9003-${YEAR}.`,           ipAddress: '203.0.113.60', daysAgo: 4 },
    { userKey: 'PSMO',       action: 'FRF_APPROVE',     details: `[SEED] Approved PSMO step on FRF-SEED-ACAD-9005-${YEAR}.`, ipAddress: '203.0.113.50', daysAgo: 3 },
    { userKey: 'ITO',        action: 'FRF_ASSIGN_STAFF', details: `[SEED] Assigned ITO_S1 & ITO_S2 on FRF-SEED-ACAD-9005-${YEAR}.`, ipAddress: '203.0.113.53', daysAgo: 3 },
    { userKey: 'STAFF_OSA',  action: 'FRF_CANCEL',      details: `[SEED] Cancelled FRF-SEED-OCM-9109-${YEAR}.`,              ipAddress: '203.0.113.63', daysAgo: 2 },

    // Memo workflow actions
    { userKey: 'STAFF_ACAD', action: 'MEMO_CREATE', details: `[SEED] Created MEMO-SEED-${YEAR}-0006.`,                     ipAddress: '203.0.113.60', daysAgo: 3 },
    { userKey: 'ACAD_H',     action: 'MEMO_APPROVE', details: `[SEED] Approved MEMO-SEED-${YEAR}-0013.`,                   ipAddress: '203.0.113.55', daysAgo: 15 },
    { userKey: 'HRD',        action: 'MEMO_ACKNOWLEDGE', details: `[SEED] Acknowledged MEMO-SEED-${YEAR}-0013.`,            ipAddress: '203.0.113.54', daysAgo: 14 },
    { userKey: 'OCM',        action: 'MEMO_PROCESS_START', details: `[SEED] Started processing MEMO-SEED-${YEAR}-0014.`,    ipAddress: '203.0.113.51', daysAgo: 5 },

    // Backup actions (Sprint 6)
    { userKey: 'SUPERUSER', action: 'ADMIN_EXPORT_MEMOS',  details: '[SEED] Exported memos (12,500 records).',             ipAddress: '203.0.113.42', daysAgo: 7 },
    { userKey: 'SUPERUSER', action: 'ADMIN_EXPORT_FRFS',   details: '[SEED] Exported FRFs (78 records).',                  ipAddress: '203.0.113.42', daysAgo: 5 },
    { userKey: 'SUPERUSER', action: 'ADMIN_IMPORT_MEMOS',  details: '[SEED] Imported 200 memos from backup.',              ipAddress: '203.0.113.42', daysAgo: 3 },
    { userKey: 'SUPERUSER', action: 'ADMIN_DELETE_MEMOS',  details: '[SEED] Deleted 12 memos via backup panel.',           ipAddress: '203.0.113.42', daysAgo: 2 },
    { userKey: 'SUPERUSER', action: 'ADMIN_BACKUP_EMAIL',  details: '[SEED] Sent backup via email to superuser@test.ncst.edu.ph.', ipAddress: '203.0.113.42', daysAgo: 1 },

    // Password change
    { userKey: 'STAFF_ACAD', action: 'CHANGE_PASSWORD', details: '[SEED] Password changed by user.',                       ipAddress: '203.0.113.60', daysAgo: 45 },
    { userKey: 'STAFF_OCM',  action: 'RESET_PASSWORD',  details: '[SEED] Password reset via emailed token.',                ipAddress: '203.0.113.62', daysAgo: 20 },
    { userKey: 'STAFF_OSA',  action: 'FORGOT_PASSWORD', details: '[SEED] Password reset requested.',                       ipAddress: '203.0.113.63', daysAgo: 8 },
  ];

  let activityCount = 0;
  for (const a of activitySeeds) {
    const user = a.userKey ? U[a.userKey] : null;
    // Idempotency: skip if identical (userId + action + details) exists
    const existing = await prisma.activityLog.findFirst({
      where: { action: a.action, details: a.details, userId: user?.id ?? null },
    });
    if (existing) continue;
    await prisma.activityLog.create({
      data: {
        userId: user?.id ?? null,
        email: a.email ?? user?.email ?? null,
        action: a.action,
        details: a.details,
        ipAddress: a.ipAddress ?? null,
        createdAt: daysFromNow(-a.daysAgo),
      },
    });
    activityCount++;
  }
  console.log(`   ✅ ${activityCount} activity log entries ready\n`);

    // ═══════════════════════════════════════════════════════════
  // BATCH 3 — 30 more FRFs (extra padding for > 5 MB backup)
  // ═══════════════════════════════════════════════════════════
  console.log('📋 Adding batch-3 FRFs…\n');

  const BATCH_3_FRFS: CreateFRFArgs[] = [
    // ── Drafts (3) ──
    { refSuffix: 'ACAD-9401', requestorKey: 'STAFF_ACAD', status: 'DRAFT', eventName: 'Draft — Sports Fest Setup', attendees: 80, placeKey: 'FIELD', equipmentKeys: ['MIC', 'CHAIR', 'TENT'] },
    { refSuffix: 'OCM-9402', requestorKey: 'STAFF_OCM', status: 'DRAFT', eventName: 'Draft — Orientation Week AVP', attendees: 30, placeKey: 'CONF', equipmentKeys: ['PROJ'] },
    { refSuffix: 'CDO-9403', requestorKey: 'STAFF_CDO', status: 'DRAFT', eventName: 'Draft — Photo Session Batch 3', attendees: 15, placeKey: 'ROOM_NAST', equipmentKeys: ['CAM', 'GIMBAL'] },

    // ── Pending Approval (8) ──
    { refSuffix: 'ACAD-9404', requestorKey: 'STAFF_ACAD', status: 'PENDING_APPROVAL', eventName: 'Inter-College Quiz Bee', attendees: 120, placeKey: 'AVR', equipmentKeys: ['PROJ', 'MIC', 'SPEAKER'], daysOffset: 21, createdDaysAgo: 2, approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'PENDING' },
      { dept: 'OCM', stepOrder: 2, status: 'PENDING' },
      { dept: 'SAFETY-SECURITY', stepOrder: 3, status: 'PENDING' },
      { dept: 'ITO-MAIN', stepOrder: 4, status: 'PENDING' },
    ]},
    { refSuffix: 'OCM-9405', requestorKey: 'STAFF_OCM', status: 'PENDING_APPROVAL', eventName: 'Regional PR Summit', attendees: 200, placeKey: 'AUD_NAST', equipmentKeys: ['LED', 'MIC', 'SPEAKER', 'PROJ'], daysOffset: 35, createdDaysAgo: 3, approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'APPROVED', performedByKey: 'PSMO', performedAt: daysFromNow(-2), remarks: 'Facility approved.' },
      { dept: 'OCM', stepOrder: 2, status: 'PENDING' },
      { dept: 'OP', stepOrder: 3, status: 'PENDING' },
      { dept: 'SAFETY-SECURITY', stepOrder: 4, status: 'PENDING' },
      { dept: 'ITO-MAIN', stepOrder: 5, status: 'PENDING' },
    ]},
    { refSuffix: 'SS-9406', requestorKey: 'STAFF_SS', status: 'PENDING_APPROVAL', eventName: 'Campus-Wide Safety Orientation', attendees: 500, placeKey: 'GYM', equipmentKeys: ['MIC', 'SPEAKER', 'LED'], daysOffset: 18, createdDaysAgo: 1, approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'PENDING' },
      { dept: 'OP', stepOrder: 2, status: 'PENDING' },
      { dept: 'SAFETY-SECURITY', stepOrder: 3, status: 'PENDING' },
      { dept: 'ITO-MAIN', stepOrder: 4, status: 'PENDING' },
    ]},
    { refSuffix: 'CDO-9407', requestorKey: 'STAFF_CDO', status: 'PENDING_APPROVAL', eventName: 'Documentary Film Premiere', attendees: 150, placeKey: 'AUD_NAST', equipmentKeys: ['PROJ', 'SPEAKER', 'MIC', 'LIGHTBAR'], daysOffset: 28, createdDaysAgo: 4, approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'APPROVED', performedByKey: 'PSMO', performedAt: daysFromNow(-2), remarks: 'OK.' },
      { dept: 'CDO', stepOrder: 2, status: 'PENDING' },
      { dept: 'SAFETY-SECURITY', stepOrder: 3, status: 'PENDING' },
      { dept: 'ITO-MAIN', stepOrder: 4, status: 'PENDING' },
    ]},
    { refSuffix: 'OP-9408', requestorKey: 'STAFF_OP', status: 'PENDING_APPROVAL', eventName: 'Presidential Media Briefing', attendees: 60, placeKey: 'VIP_LOUNGE', equipmentKeys: ['SPEAKER', 'MIXER', 'MIC'], daysOffset: 10, createdDaysAgo: 1, approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'APPROVED', performedByKey: 'PSMO', performedAt: daysFromNow(-1), remarks: 'OK.' },
      { dept: 'OP', stepOrder: 2, status: 'PENDING' },
      { dept: 'SAFETY-SECURITY', stepOrder: 3, status: 'PENDING' },
      { dept: 'ITO-MAIN', stepOrder: 4, status: 'PENDING' },
    ]},
    { refSuffix: 'OSA-9409', requestorKey: 'STAFF_OSA', status: 'PENDING_APPROVAL', type: 'WITH_STUDENTS', eventName: 'College Week Celebration', attendees: 350, placeKey: 'GYM_SHS', equipmentKeys: ['MIC', 'SPEAKER', 'TENT', 'CHAIR'], daysOffset: 30, createdDaysAgo: 2, approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'APPROVED', performedByKey: 'PSMO', performedAt: daysFromNow(-1), remarks: 'OK.' },
      { dept: 'OSA', stepOrder: 2, status: 'APPROVED', performedByKey: 'OSA_H', performedAt: daysFromNow(-1), remarks: 'OK.' },
      { dept: 'OCM', stepOrder: 3, status: 'PENDING' },
      { dept: 'SAFETY-SECURITY', stepOrder: 4, status: 'PENDING' },
      { dept: 'ITO-MAIN', stepOrder: 5, status: 'PENDING' },
    ]},
    { refSuffix: 'FACULTY-9410', requestorKey: 'FACULTY_2', status: 'PENDING_APPROVAL', eventName: 'Research Forum — Session 3', attendees: 70, placeKey: 'ROOM_NAST', equipmentKeys: ['PROJ', 'MIC'], daysOffset: 14, createdDaysAgo: 3, approvals: [
      { dept: 'ACAD', stepOrder: 1, status: 'PENDING' },
      { dept: 'PSMO/FMO', stepOrder: 2, status: 'PENDING' },
      { dept: 'SAFETY-SECURITY', stepOrder: 3, status: 'PENDING' },
      { dept: 'ITO-MAIN', stepOrder: 4, status: 'PENDING' },
    ]},
    { refSuffix: 'HRD-9411', requestorKey: 'STAFF_HRD', status: 'PENDING_APPROVAL', eventName: 'Recognition Rites 2026', attendees: 400, placeKey: 'GYM', equipmentKeys: ['LED', 'MIC', 'SPEAKER', 'PROJ'], daysOffset: 40, createdDaysAgo: 5, approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'APPROVED', performedByKey: 'PSMO', performedAt: daysFromNow(-3), remarks: 'OK.' },
      { dept: 'HRD', stepOrder: 2, status: 'APPROVED', performedByKey: 'HRD', performedAt: daysFromNow(-3), remarks: 'OK.' },
      { dept: 'OCM', stepOrder: 3, status: 'PENDING' },
      { dept: 'OP', stepOrder: 4, status: 'PENDING' },
      { dept: 'SAFETY-SECURITY', stepOrder: 5, status: 'PENDING' },
      { dept: 'ITO-MAIN', stepOrder: 6, status: 'PENDING' },
    ]},

    // ── Approved (6) ──
    { refSuffix: 'ACAD-9412', requestorKey: 'STAFF_ACAD', status: 'APPROVED', eventName: 'Parent-Teacher Conference', attendees: 150, placeKey: 'MPH', equipmentKeys: ['PROJ', 'MIC'], daysOffset: 8, createdDaysAgo: 4, approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'APPROVED', performedByKey: 'PSMO', performedAt: daysFromNow(-3), remarks: 'OK.' },
      { dept: 'OCM', stepOrder: 2, status: 'APPROVED', performedByKey: 'OCM', performedAt: daysFromNow(-3), remarks: 'OK.' },
      { dept: 'SAFETY-SECURITY', stepOrder: 3, status: 'APPROVED', performedByKey: 'SS', performedAt: daysFromNow(-3), remarks: 'OK.' },
      { dept: 'ITO-MAIN', stepOrder: 4, status: 'APPROVED', performedByKey: 'ITO', performedAt: daysFromNow(-3), remarks: 'Assigned.' },
    ], assignments: [
      { userKey: 'ITO_S1', dutyType: 'SETUP', dayOffset: 8, startHour: 6, endHour: 8, isOvertime: true },
      { userKey: 'ITO_S3', dutyType: 'OPERATOR', dayOffset: 8, startHour: 8, endHour: 16 },
    ]},
    { refSuffix: 'OCM-9413', requestorKey: 'STAFF_OCM', status: 'APPROVED', eventName: 'Founders Day AVP Screening', attendees: 200, placeKey: 'AUD_NAST', equipmentKeys: ['LED', 'MIC', 'SPEAKER'], daysOffset: 6, createdDaysAgo: 3, approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'APPROVED', performedByKey: 'PSMO', performedAt: daysFromNow(-2), remarks: 'OK.' },
      { dept: 'OP', stepOrder: 2, status: 'APPROVED', performedByKey: 'OP_H', performedAt: daysFromNow(-2), remarks: 'OK.' },
      { dept: 'OCM', stepOrder: 3, status: 'APPROVED', performedByKey: 'OCM', performedAt: daysFromNow(-2), remarks: 'OK.' },
      { dept: 'SAFETY-SECURITY', stepOrder: 4, status: 'APPROVED', performedByKey: 'SS', performedAt: daysFromNow(-2), remarks: 'OK.' },
      { dept: 'ITO-MAIN', stepOrder: 5, status: 'APPROVED', performedByKey: 'ITO', performedAt: daysFromNow(-2), remarks: 'Assigned.' },
    ], assignments: [
      { userKey: 'ITO_S2', dutyType: 'SETUP', dayOffset: 6, startHour: 6, endHour: 8, isOvertime: true },
      { userKey: 'ITO_S1', dutyType: 'OPERATOR', dayOffset: 6, startHour: 8, endHour: 20 },
    ]},
    { refSuffix: 'SS-9414', requestorKey: 'STAFF_SS', status: 'APPROVED', eventName: 'Crisis Management Workshop', attendees: 120, placeKey: 'AVR', equipmentKeys: ['PROJ', 'MIC'], daysOffset: 12, createdDaysAgo: 5, approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'APPROVED', performedByKey: 'PSMO', performedAt: daysFromNow(-3), remarks: 'OK.' },
      { dept: 'SAFETY-SECURITY', stepOrder: 2, status: 'APPROVED', performedByKey: 'SS', performedAt: daysFromNow(-3), remarks: 'OK.' },
      { dept: 'ITO-MAIN', stepOrder: 3, status: 'APPROVED', performedByKey: 'ITO', performedAt: daysFromNow(-3), remarks: 'Assigned.' },
    ], assignments: [
      { userKey: 'ITO_S2', dutyType: 'SETUP', dayOffset: 12, startHour: 6, endHour: 8, isOvertime: true },
    ]},
    { refSuffix: 'OP-9415', requestorKey: 'STAFF_OP', status: 'APPROVED', eventName: 'Board Review Session', attendees: 30, placeKey: 'CONF', equipmentKeys: ['PROJ', 'MIC'], daysOffset: 5, createdDaysAgo: 2, approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'APPROVED', performedByKey: 'PSMO', performedAt: daysFromNow(-1), remarks: 'OK.' },
      { dept: 'OP', stepOrder: 2, status: 'APPROVED', performedByKey: 'OP_H', performedAt: daysFromNow(-1), remarks: 'OK.' },
      { dept: 'OCM', stepOrder: 3, status: 'APPROVED', performedByKey: 'OCM', performedAt: daysFromNow(-1), remarks: 'OK.' },
      { dept: 'SAFETY-SECURITY', stepOrder: 4, status: 'APPROVED', performedByKey: 'SS', performedAt: daysFromNow(-1), remarks: 'OK.' },
      { dept: 'ITO-MAIN', stepOrder: 5, status: 'APPROVED', performedByKey: 'ITO', performedAt: daysFromNow(-1), remarks: 'Assigned.' },
    ], assignments: [
      { userKey: 'ITO_S3', dutyType: 'SETUP', dayOffset: 5, startHour: 7, endHour: 9, isOvertime: true },
    ]},
    { refSuffix: 'FACULTY-9416', requestorKey: 'FACULTY_1', status: 'APPROVED', eventName: 'Advisory Class Session', attendees: 25, placeKey: 'LIB', equipmentKeys: [], daysOffset: 4, createdDaysAgo: 2, isVenueOnly: true, approvals: [
      { dept: 'ACAD', stepOrder: 1, status: 'APPROVED', performedByKey: 'ACAD_H', performedAt: daysFromNow(-1), remarks: 'OK.' },
      { dept: 'PSMO/FMO', stepOrder: 2, status: 'APPROVED', performedByKey: 'PSMO', performedAt: daysFromNow(-1), remarks: 'OK.' },
      { dept: 'OCM', stepOrder: 3, status: 'APPROVED', performedByKey: 'OCM', performedAt: daysFromNow(-1), remarks: 'OK.' },
      { dept: 'SAFETY-SECURITY', stepOrder: 4, status: 'APPROVED', performedByKey: 'SS', performedAt: daysFromNow(-1), remarks: 'OK.' },
    ]},
    { refSuffix: 'OSA-9417', requestorKey: 'STAFF_OSA', status: 'APPROVED', type: 'WITH_STUDENTS', eventName: 'Peer Counselors Training', attendees: 60, placeKey: 'HALL_IMUS', equipmentKeys: ['MIC', 'PROJ'], daysOffset: 15, createdDaysAgo: 4, approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'APPROVED', performedByKey: 'PSMO', performedAt: daysFromNow(-3), remarks: 'OK.' },
      { dept: 'OSA', stepOrder: 2, status: 'APPROVED', performedByKey: 'OSA_H', performedAt: daysFromNow(-3), remarks: 'OK.' },
      { dept: 'OCM', stepOrder: 3, status: 'APPROVED', performedByKey: 'OCM', performedAt: daysFromNow(-3), remarks: 'OK.' },
      { dept: 'SAFETY-SECURITY', stepOrder: 4, status: 'APPROVED', performedByKey: 'SS', performedAt: daysFromNow(-3), remarks: 'OK.' },
      { dept: 'ITO-MAIN', stepOrder: 5, status: 'APPROVED', performedByKey: 'ITO', performedAt: daysFromNow(-3), remarks: 'Assigned.' },
    ], assignments: [
      { userKey: 'ITO_S1', dutyType: 'OPERATOR', dayOffset: 15, startHour: 8, endHour: 17 },
    ]},

    // ── Completed (4) ──
    { refSuffix: 'ACAD-9418', requestorKey: 'STAFF_ACAD', status: 'COMPLETED', eventName: 'Q3 Faculty Assembly', attendees: 180, placeKey: 'GYM', equipmentKeys: ['LED', 'MIC', 'PROJ'], daysOffset: -45, createdDaysAgo: 60, packUpDone: true, approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'APPROVED', performedByKey: 'PSMO', performedAt: daysFromNow(-50), remarks: 'OK.' },
      { dept: 'OP', stepOrder: 2, status: 'APPROVED', performedByKey: 'OP_H', performedAt: daysFromNow(-50), remarks: 'OK.' },
      { dept: 'OCM', stepOrder: 3, status: 'APPROVED', performedByKey: 'OCM', performedAt: daysFromNow(-50), remarks: 'OK.' },
      { dept: 'SAFETY-SECURITY', stepOrder: 4, status: 'APPROVED', performedByKey: 'SS', performedAt: daysFromNow(-50), remarks: 'OK.' },
      { dept: 'ITO-MAIN', stepOrder: 5, status: 'APPROVED', performedByKey: 'ITO', performedAt: daysFromNow(-50), remarks: 'Assigned.' },
    ], assignments: [
      { userKey: 'ITO_S1', dutyType: 'SETUP', dayOffset: -45, startHour: 5, endHour: 7, isOvertime: true },
      { userKey: 'ITO_S2', dutyType: 'OPERATOR', dayOffset: -45, startHour: 7, endHour: 17 },
      { userKey: 'ITO_S3', dutyType: 'TEARDOWN', dayOffset: -45, startHour: 17, endHour: 20, isOvertime: true },
    ]},
    { refSuffix: 'OCM-9419', requestorKey: 'STAFF_OCM', status: 'COMPLETED', eventName: 'National PR Summit 2025', attendees: 300, placeKey: 'AUD_NAST', equipmentKeys: ['LED', 'MIC', 'SPEAKER'], daysOffset: -75, createdDaysAgo: 90, packUpDone: true, approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'APPROVED', performedByKey: 'PSMO', performedAt: daysFromNow(-80), remarks: 'OK.' },
      { dept: 'OP', stepOrder: 2, status: 'APPROVED', performedByKey: 'OP_H', performedAt: daysFromNow(-80), remarks: 'OK.' },
      { dept: 'OCM', stepOrder: 3, status: 'APPROVED', performedByKey: 'OCM', performedAt: daysFromNow(-80), remarks: 'OK.' },
      { dept: 'SAFETY-SECURITY', stepOrder: 4, status: 'APPROVED', performedByKey: 'SS', performedAt: daysFromNow(-80), remarks: 'OK.' },
      { dept: 'ITO-MAIN', stepOrder: 5, status: 'APPROVED', performedByKey: 'ITO', performedAt: daysFromNow(-80), remarks: 'Assigned.' },
    ], assignments: [
      { userKey: 'ITO_S2', dutyType: 'SETUP', dayOffset: -75, startHour: 5, endHour: 8, isOvertime: true },
      { userKey: 'ITO_S1', dutyType: 'OPERATOR', dayOffset: -75, startHour: 8, endHour: 18 },
    ]},
    { refSuffix: 'CDO-9420', requestorKey: 'STAFF_CDO', status: 'COMPLETED', eventName: 'Annual Yearbook Shoot', attendees: 40, placeKey: 'ROOM_NAST', equipmentKeys: ['CAM', 'TRIPOD', 'GIMBAL'], daysOffset: -15, createdDaysAgo: 25, packUpDone: true, approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'APPROVED', performedByKey: 'PSMO', performedAt: daysFromNow(-20), remarks: 'OK.' },
      { dept: 'CDO', stepOrder: 2, status: 'APPROVED', performedByKey: 'CDO_H', performedAt: daysFromNow(-20), remarks: 'OK.' },
      { dept: 'SAFETY-SECURITY', stepOrder: 3, status: 'APPROVED', performedByKey: 'SS', performedAt: daysFromNow(-20), remarks: 'OK.' },
      { dept: 'ITO-MAIN', stepOrder: 4, status: 'APPROVED', performedByKey: 'ITO', performedAt: daysFromNow(-20), remarks: 'Assigned.' },
    ], assignments: [
      { userKey: 'ITO_S3', dutyType: 'OPERATOR', dayOffset: -15, startHour: 9, endHour: 17 },
    ]},
    { refSuffix: 'HRD-9421', requestorKey: 'STAFF_HRD', status: 'COMPLETED', eventName: 'Onboarding Batch 5', attendees: 30, placeKey: 'CAFE', equipmentKeys: ['MIC', 'PROJ'], daysOffset: -12, createdDaysAgo: 20, packUpDone: true, approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'APPROVED', performedByKey: 'PSMO', performedAt: daysFromNow(-15), remarks: 'OK.' },
      { dept: 'HRD', stepOrder: 2, status: 'APPROVED', performedByKey: 'HRD', performedAt: daysFromNow(-15), remarks: 'OK.' },
      { dept: 'OCM', stepOrder: 3, status: 'APPROVED', performedByKey: 'OCM', performedAt: daysFromNow(-15), remarks: 'OK.' },
      { dept: 'SAFETY-SECURITY', stepOrder: 4, status: 'APPROVED', performedByKey: 'SS', performedAt: daysFromNow(-15), remarks: 'OK.' },
      { dept: 'ITO-MAIN', stepOrder: 5, status: 'APPROVED', performedByKey: 'ITO', performedAt: daysFromNow(-15), remarks: 'Assigned.' },
    ], assignments: [
      { userKey: 'ITO_S1', dutyType: 'SETUP', dayOffset: -12, startHour: 7, endHour: 9, isOvertime: true },
    ]},

    // ── Rejected (2) ──
    { refSuffix: 'ACAD-9422', requestorKey: 'STAFF_ACAD', status: 'REJECTED', eventName: 'Concert Proposal (Rock Band)', attendees: 800, placeKey: 'FIELD', daysOffset: 30, createdDaysAgo: 6, approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'REJECTED', performedByKey: 'PSMO', performedAt: daysFromNow(-4), remarks: 'Field is reserved for the entire week.' },
      { dept: 'OCM', stepOrder: 2, status: 'REJECTED', remarks: 'Blocked.' },
    ]},
    { refSuffix: 'SS-9423', requestorKey: 'STAFF_SS', status: 'REJECTED', eventName: 'Late Night Bonfire Activity', attendees: 50, placeKey: 'FIELD', daysOffset: 20, createdDaysAgo: 3, approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'APPROVED', performedByKey: 'PSMO', performedAt: daysFromNow(-2), remarks: 'OK.' },
      { dept: 'SAFETY-SECURITY', stepOrder: 2, status: 'REJECTED', performedByKey: 'SS', performedAt: daysFromNow(-1), remarks: 'Open fire is prohibited on campus premises.' },
    ]},

    // ── Revision Requested (2) ──
    { refSuffix: 'OCM-9424', requestorKey: 'STAFF_OCM', status: 'REVISION_REQUESTED', eventName: 'Podcast Recording Session', attendees: 20, placeKey: 'CONF', equipmentKeys: ['MIC', 'MIXER', 'SPEAKER'], daysOffset: 18, createdDaysAgo: 5, approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'APPROVED', performedByKey: 'PSMO', performedAt: daysFromNow(-3), remarks: 'OK.' },
      { dept: 'OCM', stepOrder: 2, status: 'REVISION_REQUESTED', performedByKey: 'OCM', performedAt: daysFromNow(-2), remarks: 'Please submit the list of interviewees and topic outline.' },
    ]},
    { refSuffix: 'CDO-9425', requestorKey: 'STAFF_CDO', status: 'REVISION_REQUESTED', eventName: 'Aerial Footage Drone Shoot', attendees: 10, placeKey: 'FIELD', equipmentKeys: ['CAM'], daysOffset: 22, createdDaysAgo: 4, approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'APPROVED', performedByKey: 'PSMO', performedAt: daysFromNow(-2), remarks: 'OK.' },
      { dept: 'CDO', stepOrder: 2, status: 'APPROVED', performedByKey: 'CDO_H', performedAt: daysFromNow(-2), remarks: 'OK.' },
      { dept: 'SAFETY-SECURITY', stepOrder: 3, status: 'REVISION_REQUESTED', performedByKey: 'SS', performedAt: daysFromNow(-1), remarks: 'Provide CAAP drone permit and flight plan.' },
    ]},

    // ── Reschedule Pending (2) ──
    { refSuffix: 'ACAD-9426', requestorKey: 'STAFF_ACAD', status: 'RESCHEDULE_PENDING', eventName: 'Postponed: Alumni Assembly', attendees: 200, placeKey: 'GYM', equipmentKeys: ['MIC', 'PROJ', 'LED'], daysOffset: 45, createdDaysAgo: 12, isReschedule: true, approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'PENDING' },
      { dept: 'OP', stepOrder: 2, status: 'PENDING' },
      { dept: 'OCM', stepOrder: 3, status: 'PENDING' },
      { dept: 'SAFETY-SECURITY', stepOrder: 4, status: 'PENDING' },
      { dept: 'ITO-MAIN', stepOrder: 5, status: 'PENDING' },
    ], originalDatesSnapshot: [{
      date: daysFromNow(25), setupTime: withTime(daysFromNow(25), 6),
      eventStart: withTime(daysFromNow(25), 8), eventEnd: withTime(daysFromNow(25), 17),
      teardownTime: withTime(daysFromNow(25), 19), placeId: P.GYM.id,
    }]},
    { refSuffix: 'FACULTY-9427', requestorKey: 'FACULTY_2', status: 'RESCHEDULE_PENDING', eventName: 'Postponed: Capstone Presentation', attendees: 35, placeKey: 'ROOM_NAST', equipmentKeys: ['PROJ'], daysOffset: 33, createdDaysAgo: 9, isReschedule: true, approvals: [
      { dept: 'ACAD', stepOrder: 1, status: 'PENDING' },
      { dept: 'PSMO/FMO', stepOrder: 2, status: 'PENDING' },
      { dept: 'SAFETY-SECURITY', stepOrder: 3, status: 'PENDING' },
    ], originalDatesSnapshot: [{
      date: daysFromNow(14), setupTime: withTime(daysFromNow(14), 6),
      eventStart: withTime(daysFromNow(14), 8), eventEnd: withTime(daysFromNow(14), 17),
      teardownTime: withTime(daysFromNow(14), 19), placeId: P.ROOM_NAST.id,
    }]},

    // ── Cancelled + edge cases (3) ──
    { refSuffix: 'OCM-9428', requestorKey: 'STAFF_OCM', status: 'CANCELLED', eventName: 'Cancelled — Logistics Issue', attendees: 50, placeKey: 'MPH', daysOffset: 16, createdDaysAgo: 3 },
    { refSuffix: 'PSMO-9429', requestorKey: 'STAFF_PSMO', status: 'PENDING_APPROVAL', eventName: 'Facility Audit Walk-through', attendees: 15, placeKey: 'ROOM_NAST', daysOffset: 14, createdDaysAgo: 1, approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'APPROVED', performedByKey: 'PSMO', performedAt: daysFromNow(-1), remarks: 'PSMO head override.' },
      { dept: 'OCM', stepOrder: 2, status: 'PENDING' },
      { dept: 'SAFETY-SECURITY', stepOrder: 3, status: 'PENDING' },
    ]},
    { refSuffix: 'ITOMAIN-9430', requestorKey: 'STAFF_ITO', status: 'APPROVED', eventName: 'IT Staff Training — Batch 3', attendees: 25, placeKey: 'ROOM_NAST', equipmentKeys: ['PROJ', 'LAPTOP'], daysOffset: 10, createdDaysAgo: 3, approvals: [
      { dept: 'PSMO/FMO', stepOrder: 1, status: 'APPROVED', performedByKey: 'PSMO', performedAt: daysFromNow(-2), remarks: 'OK.' },
      { dept: 'SAFETY-SECURITY', stepOrder: 2, status: 'APPROVED', performedByKey: 'SS', performedAt: daysFromNow(-2), remarks: 'OK.' },
      // ITO-MAIN filtered out (requestor dept) — self-assign bug repro
    ]},
  ];

  for (const frf of BATCH_3_FRFS) await createFRF(frf);
  console.log('');

    // ═══════════════════════════════════════════════════════════
  // BATCH 3 — 20 more memos (extra padding)
  // ═══════════════════════════════════════════════════════════
  console.log('📝 Adding batch-3 memos…\n');

  const BATCH_3_MEMOS: Array<{
    senderKey: string;
    subject: string;
    priority?: 'ROUTINE' | 'URGENT' | 'RUSH';
    purpose?: 'FYI' | 'SIGNATURE' | 'ACTION' | 'COMMENTS' | 'APPROVAL' | 'REQUEST';
    status: 'DRAFT' | 'FOR_APPROVAL' | 'APPROVED' | 'CLOSED';
    recipients: MemoRecipientSeed[];
    daysAgo?: number;
  }> = [
    // DRAFTS (4)
    { senderKey: 'STAFF_ACAD', subject: 'Draft — Summer Bridge Program Plan',       status: 'DRAFT', recipients: [], daysAgo: 1 },
    { senderKey: 'STAFF_OCM',  subject: 'Draft — Crisis Communications Playbook',   status: 'DRAFT', recipients: [], daysAgo: 2 },
    { senderKey: 'STAFF_SS',   subject: 'Draft — Campus Safety Week Plan',          status: 'DRAFT', recipients: [], daysAgo: 3 },
    { senderKey: 'STAFF_CDO',  subject: 'Draft — Photojournalism Series Outline',   status: 'DRAFT', recipients: [], daysAgo: 1 },

    // FOR_APPROVAL (5)
    { senderKey: 'STAFF_ACAD', subject: 'Request for Additional Classroom Supplies', priority: 'ROUTINE', purpose: 'REQUEST',   status: 'FOR_APPROVAL', recipients: [{ dept: 'OCM', status: 'PENDING' }, { dept: 'PSMO/FMO', status: 'PENDING' }], daysAgo: 2 },
    { senderKey: 'STAFF_OCM',  subject: 'Approval Request — Logo Redesign Phase 2',  priority: 'URGENT',  purpose: 'APPROVAL',  status: 'FOR_APPROVAL', recipients: [{ dept: 'OP', status: 'PENDING' }], daysAgo: 1 },
    { senderKey: 'STAFF_SS',   subject: 'For Signature — Emergency Evacuation Plan', priority: 'URGENT',  purpose: 'SIGNATURE', status: 'FOR_APPROVAL', recipients: [{ dept: 'PSMO/FMO', status: 'PENDING' }, { dept: 'OP', status: 'PENDING' }], daysAgo: 3 },
    { senderKey: 'STAFF_HRD',  subject: 'Action Required — Q4 Performance Reviews',  priority: 'RUSH',    purpose: 'ACTION',    status: 'FOR_APPROVAL', recipients: [{ dept: 'ACAD', status: 'PENDING' }, { dept: 'ITO-MAIN', status: 'PENDING' }, { dept: 'CDO', status: 'PENDING' }], daysAgo: 2 },
    { senderKey: 'FACULTY_1',  subject: 'Comments on Revised Academic Calendar',     priority: 'ROUTINE', purpose: 'COMMENTS',  status: 'FOR_APPROVAL', recipients: [{ dept: 'ACAD', status: 'PENDING' }], daysAgo: 4 },

    // APPROVED (7)
    { senderKey: 'ACAD_H', subject: 'Curriculum Alignment Directive — Batch 3',    priority: 'ROUTINE', purpose: 'ACTION', status: 'APPROVED', recipients: [{ dept: 'OCM', status: 'ACKNOWLEDGED' }, { dept: 'HRD', status: 'PROCESSING' }, { dept: 'ITO-MAIN', status: 'ACKNOWLEDGED' }], daysAgo: 14 },
    { senderKey: 'OCM',    subject: 'Brand Voice Update — v4 Guidelines',           priority: 'URGENT',  purpose: 'FYI',    status: 'APPROVED', recipients: [{ dept: 'CDO', status: 'COMPLETED' }, { dept: 'OP', status: 'ACKNOWLEDGED' }, { dept: 'ACAD', status: 'PROCESSING' }], daysAgo: 8 },
    { senderKey: 'ITO',    subject: 'Scheduled Server Migration — Weekend Window',  priority: 'URGENT',  purpose: 'FYI',    status: 'APPROVED', recipients: [{ dept: 'ACAD', status: 'ACKNOWLEDGED' }, { dept: 'OCM', status: 'ACKNOWLEDGED' }, { dept: 'HRD', status: 'PENDING' }], daysAgo: 5 },
    { senderKey: 'SS',     subject: 'Advisory — Updated Fire Exit Routes',          priority: 'ROUTINE', purpose: 'FYI',    status: 'APPROVED', recipients: [{ dept: 'PSMO/FMO', status: 'ACKNOWLEDGED' }, { dept: 'OCM', status: 'CLOSED' }], daysAgo: 10 },
    { senderKey: 'PSMO',   subject: 'Equipment Rotation Schedule — Q4',             priority: 'ROUTINE', purpose: 'ACTION', status: 'APPROVED', recipients: [{ dept: 'ITO-MAIN', status: 'PROCESSING' }, { dept: 'OCM', status: 'COMPLETED' }], daysAgo: 6 },
    { senderKey: 'HRD',    subject: 'Employee Wellness Survey Results',             priority: 'ROUTINE', purpose: 'FYI',    status: 'APPROVED', recipients: [{ dept: 'OP', status: 'ACKNOWLEDGED' }, { dept: 'ACAD', status: 'ACKNOWLEDGED' }, { dept: 'SS', status: 'ACKNOWLEDGED' }], daysAgo: 12 },
    { senderKey: 'OP_H',   subject: 'Executive Directive — Process Standardization', priority: 'URGENT', purpose: 'ACTION', status: 'APPROVED', recipients: [{ dept: 'HRD', status: 'PROCESSING' }, { dept: 'OCM', status: 'ACKNOWLEDGED' }, { dept: 'PSMO/FMO', status: 'PENDING' }], daysAgo: 4 },

    // CLOSED (4)
    { senderKey: 'ACAD_H', subject: 'Accreditation Visit — Wrap-up Notes',          priority: 'ROUTINE', purpose: 'FYI',    status: 'CLOSED', recipients: [{ dept: 'OCM', status: 'CLOSED' }, { dept: 'PSMO/FMO', status: 'CLOSED' }, { dept: 'HRD', status: 'CLOSED' }], daysAgo: 55 },
    { senderKey: 'OCM',    subject: 'Founders Day Recap and Media Coverage',        priority: 'ROUTINE', purpose: 'FYI',    status: 'CLOSED', recipients: [{ dept: 'OP', status: 'CLOSED' }, { dept: 'CDO', status: 'CLOSED' }, { dept: 'PSMO/FMO', status: 'CLOSED' }], daysAgo: 42 },
    { senderKey: 'SS',     subject: 'Fire Drill Assessment — Completed',            priority: 'ROUTINE', purpose: 'FYI',    status: 'CLOSED', recipients: [{ dept: 'PSMO/FMO', status: 'CLOSED' }, { dept: 'HRD', status: 'CLOSED' }, { dept: 'ACAD', status: 'CLOSED' }], daysAgo: 30 },
    { senderKey: 'OP_H',   subject: 'Directive: New Campus Visitor Policy',         priority: 'URGENT',  purpose: 'ACTION', status: 'CLOSED', recipients: [{ dept: 'SS', status: 'CLOSED' }, { dept: 'OCM', status: 'CLOSED' }, { dept: 'HRD', status: 'CLOSED' }], daysAgo: 25 },
  ];

  let memoSeqB3 = 200;
  for (const s of BATCH_3_MEMOS) {
    await createMemo({
      refSeq: memoSeqB3++,
      senderKey: s.senderKey,
      subject: s.subject,
      priority: s.priority,
      purpose: s.purpose,
      status: s.status,
      recipients: s.recipients,
      contentKB: 32,
      createdDaysAgo: s.daysAgo,
    });
  }
  console.log('');

  // ═══════════════════════════════════════════════════════════
  // LOGIN LOG — security dashboard data
  // ═══════════════════════════════════════════════════════════
  console.log('🔑 Seeding LoginLog (security dashboard)…\n');

  interface LoginSeed {
    userKey?: string;
    email?: string;
    status: 'SUCCESS' | 'FAILURE';
    ipAddress: string;
    daysAgo: number;
  }

  const loginSeeds: LoginSeed[] = [
    // 7-day trend: healthy mix, with a spike of failures 2 days ago
    { userKey: 'SUPERUSER',  status: 'SUCCESS', ipAddress: '203.0.113.42', daysAgo: 0 },
    { userKey: 'SUPERUSER',  status: 'SUCCESS', ipAddress: '203.0.113.42', daysAgo: 1 },
    { userKey: 'SUPERUSER',  status: 'SUCCESS', ipAddress: '203.0.113.42', daysAgo: 2 },
    { userKey: 'SUPERUSER',  status: 'SUCCESS', ipAddress: '203.0.113.42', daysAgo: 3 },
    { userKey: 'SUPERUSER',  status: 'SUCCESS', ipAddress: '203.0.113.42', daysAgo: 4 },
    { userKey: 'SUPERUSER',  status: 'SUCCESS', ipAddress: '203.0.113.42', daysAgo: 5 },
    { userKey: 'SUPERUSER',  status: 'SUCCESS', ipAddress: '203.0.113.42', daysAgo: 6 },

    { userKey: 'ADMIN',      status: 'SUCCESS', ipAddress: '203.0.113.43', daysAgo: 0 },
    { userKey: 'ADMIN',      status: 'SUCCESS', ipAddress: '203.0.113.43', daysAgo: 1 },
    { userKey: 'ADMIN',      status: 'SUCCESS', ipAddress: '203.0.113.43', daysAgo: 3 },
    { userKey: 'ADMIN',      status: 'SUCCESS', ipAddress: '203.0.113.43', daysAgo: 5 },

    { userKey: 'PSMO',       status: 'SUCCESS', ipAddress: '203.0.113.50', daysAgo: 0 },
    { userKey: 'PSMO',       status: 'SUCCESS', ipAddress: '203.0.113.50', daysAgo: 1 },
    { userKey: 'PSMO',       status: 'SUCCESS', ipAddress: '203.0.113.50', daysAgo: 2 },
    { userKey: 'OCM',        status: 'SUCCESS', ipAddress: '203.0.113.51', daysAgo: 1 },
    { userKey: 'SS',         status: 'SUCCESS', ipAddress: '203.0.113.52', daysAgo: 1 },
    { userKey: 'ITO',        status: 'SUCCESS', ipAddress: '203.0.113.53', daysAgo: 2 },
    { userKey: 'HRD',        status: 'SUCCESS', ipAddress: '203.0.113.54', daysAgo: 2 },
    { userKey: 'ACAD_H',     status: 'SUCCESS', ipAddress: '203.0.113.55', daysAgo: 2 },
    { userKey: 'OSA_H',      status: 'SUCCESS', ipAddress: '203.0.113.56', daysAgo: 4 },
    { userKey: 'OP_H',       status: 'SUCCESS', ipAddress: '203.0.113.57', daysAgo: 4 },
    { userKey: 'CDO_H',      status: 'SUCCESS', ipAddress: '203.0.113.58', daysAgo: 4 },

    { userKey: 'STAFF_ACAD', status: 'SUCCESS', ipAddress: '203.0.113.60', daysAgo: 0 },
    { userKey: 'STAFF_ACAD', status: 'SUCCESS', ipAddress: '203.0.113.60', daysAgo: 1 },
    { userKey: 'STAFF_ACAD', status: 'SUCCESS', ipAddress: '203.0.113.60', daysAgo: 2 },
    { userKey: 'STAFF_ACAD', status: 'SUCCESS', ipAddress: '203.0.113.60', daysAgo: 4 },
    { userKey: 'STAFF_ITO',  status: 'SUCCESS', ipAddress: '203.0.113.61', daysAgo: 0 },
    { userKey: 'STAFF_OCM',  status: 'SUCCESS', ipAddress: '203.0.113.62', daysAgo: 1 },
    { userKey: 'STAFF_OSA',  status: 'SUCCESS', ipAddress: '203.0.113.63', daysAgo: 1 },
    { userKey: 'STAFF_HRD',  status: 'SUCCESS', ipAddress: '203.0.113.66', daysAgo: 3 },
    { userKey: 'ITO_S1',     status: 'SUCCESS', ipAddress: '203.0.113.64', daysAgo: 0 },
    { userKey: 'ITO_S2',     status: 'SUCCESS', ipAddress: '203.0.113.65', daysAgo: 0 },
    { userKey: 'ITO_S3',     status: 'SUCCESS', ipAddress: '203.0.113.67', daysAgo: 2 },
    { userKey: 'FACULTY_1',  status: 'SUCCESS', ipAddress: '203.0.113.70', daysAgo: 3 },

    // FAILURE cluster — 2 days ago, same IP, increasing attempts (brute-force pattern)
    { userKey: 'STAFF_ACAD', status: 'FAILURE', ipAddress: '198.51.100.8', daysAgo: 2 },
    { userKey: 'STAFF_ACAD', status: 'FAILURE', ipAddress: '198.51.100.8', daysAgo: 2 },
    { userKey: 'STAFF_ACAD', status: 'FAILURE', ipAddress: '198.51.100.8', daysAgo: 2 },
    { userKey: 'STAFF_ACAD', status: 'FAILURE', ipAddress: '198.51.100.8', daysAgo: 2 },
    { userKey: 'STAFF_ACAD', status: 'FAILURE', ipAddress: '198.51.100.8', daysAgo: 2 },
    // Unknown-account attempts (no userId)
    { email: 'unknown1@test.ncst.edu.ph', status: 'FAILURE', ipAddress: '198.51.100.9', daysAgo: 2 },
    { email: 'unknown2@test.ncst.edu.ph', status: 'FAILURE', ipAddress: '198.51.100.9', daysAgo: 2 },
    { email: 'admin123@test.ncst.edu.ph', status: 'FAILURE', ipAddress: '198.51.100.9', daysAgo: 2 },

    // Disabled account attempting login (should always fail)
    { userKey: 'HRD',         status: 'FAILURE', ipAddress: '203.0.113.54', daysAgo: 1 },
    { email: disabledEmail,   status: 'FAILURE', ipAddress: '203.0.113.80', daysAgo: 1 },
    { email: disabledEmail,   status: 'FAILURE', ipAddress: '203.0.113.80', daysAgo: 0 },

    // Older failures (historical noise)
    { userKey: 'ITO_S2',      status: 'FAILURE', ipAddress: '203.0.113.65', daysAgo: 5 },
    { userKey: 'STAFF_OCM',   status: 'FAILURE', ipAddress: '203.0.113.62', daysAgo: 6 },
  ];

  let loginCount = 0;
  for (const l of loginSeeds) {
    const user = l.userKey ? U[l.userKey] : null;
    await prisma.loginLog.create({
      data: {
        userId: user?.id ?? null,
        email: l.email ?? user?.email ?? null,
        status: l.status,
        ip_address: l.ipAddress,
        attempted_at: daysFromNow(-l.daysAgo),
      },
    });
    loginCount++;
  }
  console.log(`   ✅ ${loginCount} login log entries ready\n`);

  console.log('\n🎉 Seed complete!');
  console.log('\n📊 What to test next:');
  console.log('   • Login as acad.staff@test.ncst.edu.ph / Test1234!');
  console.log('     → see 4 personal FRFs + 2 drafts');
  console.log('   • Login as psmo.head@test.ncst.edu.ph / Test1234!');
  console.log('     → Pending Approval tab has 3 waiting');
  console.log('   • Login as ito.head@test.ncst.edu.ph / Test1234!');
  console.log('     → Assigned to Me / Action Board populated');
  console.log('   • Login as ito.staff1@test.ncst.edu.ph / Test1234!');
  console.log('     → Completed tab shows Alumni Homecoming');


  // ═══════════════════════════════════════════════════════════
  // --purge : nuke ALL seed-tagged data (including users/places/
  //           equipment/departments) in FK-safe order
  // ═══════════════════════════════════════════════════════════
  if (process.argv.includes('--purge')) {
    console.log('🧨 PURGE mode — wiping all seed-tagged data in FK-safe order…\n');

    // 1. Notifications (cascade from User, but clear explicitly)
    const p1 = await prisma.notification.deleteMany({});
    console.log(`   ✓ ${p1.count} notification(s)`);

    // 2. BackupExports (Restrict on User — MUST go before users)
    const p2 = await prisma.backupExport.deleteMany({});
    console.log(`   ✓ ${p2.count} backup export(s)`);

    // 3. ActivityLogs (SetNull on User — clear for cleanliness)
    const p3 = await prisma.activityLog.deleteMany({});
    console.log(`   ✓ ${p3.count} activity log(s)`);

    // 4. LoginLogs (cascade from User)
    const p4 = await prisma.loginLog.deleteMany({});
    console.log(`   ✓ ${p4.count} login log(s)`);

    // 5. Memos — split by parentMemoId to be safe on self-referencing rootMemoId
    const p5a = await prisma.memo.deleteMany({ where: { parentMemoId: { not: null } } });
    const p5b = await prisma.memo.deleteMany({ where: { parentMemoId: null } });
    console.log(`   ✓ ${p5a.count + p5b.count} memo(s)`);

    // 6. FacilityReservations (cascade approvals/assignments/dates/equipment requests)
    const p6 = await prisma.facilityReservation.deleteMany({});
    console.log(`   ✓ ${p6.count} reservation(s)`);

    // 7. EquipmentPlace join rows
    const p7 = await prisma.equipmentPlace.deleteMany({});
    console.log(`   ✓ ${p7.count} equipment-place bundle(s)`);

    // 8. Equipment (Restrict from Department)
    const p8 = await prisma.equipment.deleteMany({});
    console.log(`   ✓ ${p8.count} equipment item(s)`);

    // 9. EventPlaces
    const p9 = await prisma.eventPlace.deleteMany({});
    console.log(`   ✓ ${p9.count} place(s)`);

    // 10. Users (Restrict from Department — now safe, no children left)
    const p10 = await prisma.user.deleteMany({});
    console.log(`   ✓ ${p10.count} user(s)`);

    // 11. Departments (Restrict from Users + Equipment — now safe)
    const p11 = await prisma.department.deleteMany({});
    console.log(`   ✓ ${p11.count} department(s)`);

    // 12. Singletons
    const p12 = await prisma.formSettings.deleteMany({});
    const p13 = await prisma.privacySettings.deleteMany({});
    console.log(`   ✓ ${p12.count} form setting(s) + ${p13.count} privacy setting(s)`);

    console.log('\n✅ PURGE complete. Database is empty.\n');
    return; // don't continue to seeding
  }
}

main()
  .catch((e) => {
    console.error('\n❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());