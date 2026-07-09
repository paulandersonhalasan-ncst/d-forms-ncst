// components/types.ts
export type Priority = 'ROUTINE' | 'URGENT' | 'RUSH';
export type Purpose = 'FYI' | 'SIGNATURE' | 'ACTION' | 'COMMENTS' | 'APPROVAL' | 'REQUEST';
export type MemoStatus = 'FOR_APPROVAL' | 'PENDING' | 'ACKNOWLEDGED' | 'PROCESSING' | 'DENIED' | 'RESPONDED';

export interface MemoRecipientStatus {
  id: string;
  memoId: string;
  departmentName: string;
  status: 'PENDING' | 'ACKNOWLEDGED' | 'PROCESSING' | 'CLOSED' | 'RESOLVE' | 'DENIED' | 'RESPONDED' | 'COMPLETED';
  feedbackNote?: string | null;
  attachmentPaths?: string[];
  respondedAt?: string | null;
  acknowledgedAt?: string | null;
  processedById?: string | null;
  processedByName?: string | null;
  processedAt?: string | null;
  senderConfirmedById?: string | null;
  senderConfirmedByName?: string | null;
  senderConfirmedAt?: string | null;
  recipientConfirmedById?: string | null;
  recipientConfirmedByName?: string | null;
  recipientConfirmedAt?: string | null;
  closedById?: string | null;
  closedByName?: string | null;
  closedAt?: string | null;
  completedAt?: string | null;
  completedById?: string | null;
  completedByName?: string | null;
  isSenderClosing?: boolean;
  deniedAt?: string | null;
}

export interface Memo {
  id: string;
  referenceId: string | null;
  subject: string;
  content: string;
  priority: Priority;
  purpose: Purpose;
  senderId: string;
  senderName: string;
  senderDept: string;
  status: 'DRAFT' | 'FOR_APPROVAL' | 'APPROVED' | 'CLOSED' | 'DENIED' | 'RESPONDED' | string;
  createdAt: string | Date;
  deadlineAt: string | Date | null;
  parentMemoId: string | null;
  rootMemoId: string | null;
  isRevisedByHead?: boolean;
  attachmentPaths?: string[] | null;
  feedbackNote?: string | null;
  recipients?: MemoRecipientStatus[];
  sender?: {
    id: string;
    branch: 'MAIN' | 'IMUS' | 'NASTECH' | 'SHS';
    departmentCode: string;
  };
}

export interface Department {
  id: string;
  code: string;
  name?: string;
}

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

export type MemoFormValues = {
  subject: string;
  content: string;
  priority: Priority;
  purpose: Purpose;
  targetDepts: string[];
  parentMemoId: string | null;
  rootMemoId: string | null;
  memoAttachments: File[];
};