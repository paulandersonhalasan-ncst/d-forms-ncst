export type ReservationType = 'EMPLOYEE_ONLY' | 'WITH_STUDENTS';
export type ReservationStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REVISION_REQUESTED'
  | 'REJECTED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'RESCHEDULE_PENDING';
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'REVISION_REQUESTED' | 'ACKNOWLEDGED';

// ==========================================
// USER CONTEXT
// ==========================================
export interface UserContext {
  id: string;
  email: string;
  fname: string;
  lname: string;
  role: string;
  departmentCode: string;
  branch: string;
  oic_start: string | null;
  oic_end: string | null;
}

// ==========================================
// FRF TYPES
// ==========================================
export type SystemBranch = 'MAIN' | 'IMUS' | 'NASTECH' | 'SHS';

export interface EquipmentPlace {
  placeId: string;
  isBundled: boolean;
  place?: { id: string; name: string; branch: SystemBranch };
}

export interface Equipment {
  id: string;
  name: string;
  departmentCode: string;
  isSingleItem: boolean;
  quantityAvailable: number;
  quantityReserved?: number;
  branch?: SystemBranch | null;
  places?: EquipmentPlace[];
}

export interface FacilityApproval {
  id: string;
  departmentCode: string;
  stepOrder: number;
  status: ApprovalStatus;
  performedById?: string;
  performedByName?: string;
  performedAt?: string;
  remarks?: string;
  revisionReason?: string;
  acknowledgedAt?: string;
  performedBy?: {
    fname: string;
    lname: string;
  };
}

export interface FacilityAssignment {
  id: string;
  userId: string;
  user: { id: string; fname: string; lname: string; email: string };
  dutyStart: string;
  dutyEnd: string;
  dutyType: 'SETUP' | 'TEARDOWN' | 'OPERATOR' | 'ASSISTANT';
  notes?: string;
  isOvertime?: boolean;
}

export interface FacilityEquipmentRequest {
  id: string;
  equipmentId: string;
  equipment: Equipment;
  quantityRequested: number;
}

export interface FacilityReservation {
  id: string;
  referenceId: string;
  requestorId: string;
  requestor: {
    id: string;
    fname: string;
    lname: string;
    email: string;
    departmentCode: string;
  };
  requestorDept: string;
  type: ReservationType;
  eventName?: string;
  attendeesCount: number;
  usageHours?: number;
  withCharge?: boolean;
  equipmentRequests: FacilityEquipmentRequest[];
  attachments: string[];
  requestorNotes?: string;
  status: ReservationStatus;
  createdAt: string;
  updatedAt: string;
  approvals: FacilityApproval[];
  assignments: FacilityAssignment[];
  ocmEditedAt?: string;
  ocmEditedBy?: { id: string; fname: string; lname: string };
  dates: DateEntry[];

  isReschedule?: boolean;
  originalDates?: OriginalDateEntry[];

  originalApprovals?: FacilityApproval[];

  isVenueOnly?: boolean;

  packUpDoneAt?: string;
  packUpDoneById?: string;
  packUpDoneNotes?: string;
  packUpDoneBy?: { id: string; fname: string; lname: string; email: string; departmentCode: string };
  packUpDonePhotos?: string[];

  staffChangeRequestedAt?: string;
  staffChangeRequestedById?: string;
  staffChangeRequestedBy?: { id: string; fname: string; lname: string };
  staffChangeReason?: string;
}

export interface EventPlace {
  id: string;
  name: string;
  isActive: boolean;
  branch: SystemBranch; 
  category?: 'REGULAR' | 'CATEGORY_1' | 'CATEGORY_2';
}

// ==========================================
// DATE ENTRY – may sariling lugar
// ==========================================
export interface DateEntry {
  id: string;
  date: Date;
  dateStr: string;
  setupTime: Date;
  eventStart: Date;
  eventEnd: Date;
  teardownTime: Date;
  setupTimeStr: string;
  eventStartStr: string;
  eventEndStr: string;
  teardownTimeStr: string;
  placeId?: string;
  place?: { id: string; name: string };
  placeOther?: string;
}

// ==========================================
// PENDING ACTION TYPE
// ==========================================
export type FRFActionType =
  | 'APPROVE'
  | 'REJECT'
  | 'RETURN'
  | 'RESUBMIT'
  | 'ASSIGN'
  | 'OCM_FINALIZE'
  | 'NOTE'
  | 'RESCHEDULE'
  | 'PACKUP_DONE'
  | 'REQUEST_STAFF_CHANGE'; 

export interface PendingAction {
  type: FRFActionType;
  data: Record<string, unknown>;
}

// ==========================================
// FORM VALUES – walang top‑level na lugar
// ==========================================
export interface FRFFormValues {
  type: ReservationType;
  dates: DateEntry[];
  attendeesCount: number;
  usageHours?: number;
  withCharge: boolean;
  equipmentRequests: { equipmentId: string; quantity: number }[];
  attachments: File[];
  requestorNotes?: string;
  isEditing?: boolean;
  editingId?: string;
  eventName?: string;
  isVenueOnly?: boolean;
}

// ==========================================
// OCM FINAL EDIT DATA – may eventName at per‑date na lugar
// ==========================================
export interface OCMFinalEditData {
  eventName?: string;
  attendeesCount: number;
  usageHours: number;
  withCharge: boolean;
  requestorNotes: string;
  dates?: {
    id?: string;
    date: string;
    setupTime: string;
    eventStart: string;
    eventEnd: string;
    teardownTime: string;
    placeId?: string;
    placeOther?: string;
  }[];
}

// ==========================================
// ITO ASSIGNMENT
// ==========================================
export interface ITOAssignment {
  userId: string;
  dutyStart: Date;
  dutyEnd: Date;
  dutyType: 'SETUP' | 'TEARDOWN' | 'OPERATOR' | 'ASSISTANT';
  notes?: string;
  isOvertime?: boolean;
}

// ==========================================
// OIC HELPER
// ==========================================
export function isActiveHeadOrOIC(user: UserContext | null): boolean {
  if (!user) return false;

  // Check by role
  const role = user.role?.toUpperCase();
  if (role === 'DEPARTMENTHEAD' || role === 'DEPARTMENT_HEAD') {
    return true;
  }

  // Check OIC dates
  if (user.oic_start && user.oic_end) {
    try {
      const now = new Date();
      const start = new Date(user.oic_start);
      const end = new Date(user.oic_end);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && now >= start && now <= end) {
        return true;
      }
    } catch (e) {
      // ignore invalid date strings
    }
  }

  return false;
}

export interface OriginalDateEntry {
  date: string | Date;
  setupTime: string | Date;
  eventStart: string | Date;
  eventEnd: string | Date;
  teardownTime: string | Date;
  placeId?: string;
  placeOther?: string;
  place?: { name: string } | null;
}