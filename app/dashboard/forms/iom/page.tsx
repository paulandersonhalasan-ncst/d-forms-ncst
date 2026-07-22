// app/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useForm } from '@mantine/form';
import { useDisclosure, useToggle } from '@mantine/hooks';
import {
  Container,
  Card,
  Title,
  Group,
  Text,
  Button,
  Badge,
  Tabs,
  Stack,
  Alert,
  TextInput,
  LoadingOverlay,
  Modal,
  Timeline,
  Box,
  Loader,
  UnstyledButton,
  SimpleGrid,
  Collapse,
  ActionIcon,
  SegmentedControl,
  ScrollArea
} from '@mantine/core';
import {
  IconPlus,
  IconInbox,
  IconPlayerPlay,
  IconSend,
  IconCircleCheck,
  IconLayersIntersect,
  IconThumbUp,
  IconInfoCircle,
  IconMessageReply,
  IconGitBranch,
  IconUserCheck,
  IconChevronDown
} from '@tabler/icons-react';
import useSWR from 'swr';

// Import shared types
import { Priority, Purpose, Memo, UserContext, Department } from './component/types';

// Import components
import MemoCard from './component/memoCard';
import CreateMemoModal from './component/createMemoModal';
import ViewMemoModal from './component/viewMemoModal';
import PasswordGateModal from './component/passwordGateModal';
import SuperEditModal from './component/superEditModal';

import { useSearchParams } from 'next/navigation';

function CollapsibleAlert({
  title,
  icon,
  color = "blue",
  children,
  defaultOpen = true,
}: {
  title: string;
  icon?: React.ReactNode;
  color?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [opened, setOpened] = useState(defaultOpen);

  return (
    <Alert
      color={color}
      radius="md"
      mb="md"
      p="sm"
      autoContrast
      style={{
        cursor: "pointer",
        userSelect: "none",
      }}
      onClick={() => setOpened((o) => !o)}
      styles={(theme) => ({
        root: {
          border: `1px solid ${theme.colors[color]?.[3] ?? theme.colors.blue[3]}`,
        },
        title: {
          width: "100%",
        },
        body: {
          width: "100%",
        },
      })}
      title={
        <Group
          justify="space-between"
          wrap="nowrap"
          onClick={() => setOpened((o) => !o)}
          style={{ cursor: "pointer", width: "100%" }}
        >
          <Group gap="xs" wrap="nowrap">
            {icon}

            <Text fw={500} size="sm">
              {title}
            </Text>
          </Group>

          <ActionIcon variant="subtle" color={color}>
            <IconChevronDown
              size={16}
              style={{
                transform: opened ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 150ms ease",
              }}
            />
          </ActionIcon>
        </Group>
      }
    >
      <Collapse expanded={opened}>
        <Text
          size="xs"
          mt="xs"
          lh={1.6}
        >
          {children}
        </Text>
      </Collapse>
    </Alert>
  );
}

function KanbanBoard({
  memos,
  isApprovalTab,
  currentUser,
  activeDepartment,
  isAdminOrSuper,
  isHeadOrOIC,
  processOICAllowance,
  onReply,
  onPrint,
  onViewThread,
  onExpand,
  onSuperEdit,
  triggerActionPasswordCheck,
  allMemos,
  departmentStaff,
  totalDepartments,
}: {
  memos: Memo[];
  isApprovalTab: boolean;
  currentUser: UserContext | null;
  activeDepartment: string;
  isAdminOrSuper: boolean;
  isHeadOrOIC: boolean;
  processOICAllowance: boolean;
  onReply: (memo: Memo) => void;
  onPrint: (memo: Memo) => void;
  onViewThread: (memo: Memo) => void;
  onExpand: (memo: Memo) => void;
  onSuperEdit: (memo: Memo, mode: 'edit' | 'approve') => void;
  triggerActionPasswordCheck: (
    type:
      | 'CREATE'
      | 'ACKNOWLEDGE'
      | 'START_PROCESSING'
      | 'DENY'
      | 'CLOSED'
      | 'APPROVE'
      | 'DISAPPROVE_DRAFT'
      | 'JOIN_PROCESSING'
      | 'ASSIGN',
    data: Record<string, unknown>
  ) => void;
  allMemos: Memo[];
  departmentStaff: { id: string; fname: string; lname: string }[];
  totalDepartments: number;
}) {
  // ✅ Tamang type annotation
  const groups: Record<Priority, Memo[]> = {
    ROUTINE: memos.filter((m) => m.priority === 'ROUTINE'),
    URGENT: memos.filter((m) => m.priority === 'URGENT'),
    RUSH: memos.filter((m) => m.priority === 'RUSH'),
  };

  const columnColors: Record<Priority, string> = {
    ROUTINE: 'blue',
    URGENT: 'orange',
    RUSH: 'red',
  };

  return (
    <SimpleGrid cols={3} spacing="lg" style={{ alignItems: 'flex-start' }}>
      {Object.entries(groups).map(([priority, items]) => {
        // ✅ I-cast ang priority sa tamang type
        const colorKey = priority as keyof typeof columnColors;
        const color = columnColors[colorKey];

        return (
          <Stack key={priority} gap="md" style={{ maxHeight: '100%' }}>
            <Card
              withBorder
              p="sm"
              bg={`var(--mantine-color-${color}-0)`}
            >
              <Group justify="space-between">
                <Text fw={700} size="sm" c={color}>
                  {priority}
                </Text>
                <Badge color={color}>{items.length}</Badge>
              </Group>
            </Card>

            <ScrollArea style={{ height: 'calc(100vh - 380px)' }} type="auto">
              {items.length === 0 ? (
                <Text c="dimmed" size="xs" ta="center" py="md">
                  No memos
                </Text>
              ) : (
                <Stack gap="sm">
                  {items.map((memo) => {
                    const rootId = memo.rootMemoId || memo.id;
                    const threadCount = allMemos.filter(
                      (m) => m.rootMemoId === rootId || m.id === rootId
                    ).length;
                    return (
                      <MemoCard
                        key={memo.id}
                        memo={memo}
                        isApprovalTab={isApprovalTab}
                        currentUser={currentUser}
                        activeDepartment={activeDepartment}
                        isAdminOrSuper={isAdminOrSuper}
                        isHeadOrOIC={isHeadOrOIC}
                        processOICAllowance={processOICAllowance}
                        threadCount={threadCount}
                        totalDepartments={totalDepartments}
                        onReply={onReply}
                        onPrint={onPrint}
                        onViewThread={onViewThread}
                        onExpand={onExpand}
                        onSuperEdit={onSuperEdit}
                        triggerActionPasswordCheck={triggerActionPasswordCheck}
                        allMemos={allMemos}
                        departmentStaff={departmentStaff}
                      />
                    );
                  })}
                </Stack>
              )}
            </ScrollArea>
          </Stack>
        );
      })}
    </SimpleGrid>
  );
}

export default function IOMDashboardPage() {
  // ---- Disclosure hooks ----
  const [opened, { open, close }] = useDisclosure(false);
  const [passModalOpened, { open: openPassModal, close: closePassModal }] = useDisclosure(false);
  const [threadModalOpened, { open: openThreadModal, close: closeThreadModal }] = useDisclosure(false);
  const [expandNoteOpened, { open: openExpandNoteModal, close: closeExpandNoteModal }] = useDisclosure(false);
  const [superEditOpened, { open: openSuperEditModal, close: closeSuperEditModal }] = useDisclosure(false);

  // ---- State ----
  const [submitting, setSubmitting] = useState(false);
  const [departments, setDepartments] = useState<{ value: string; label: string }[]>([]);
  const [loadingDepts, setLoadingDepts] = useState(true);
  const [loadingMemos, setLoadingMemos] = useState(true);
  const [currentUser, setCurrentUser] = useState<UserContext | null>(null);
  const [pageLoading, setPageLoading] = useState(true);

  const handleClosePassModal = () => {
    setFeedbackNote('');
    setConfirmPassword('');
    setPassError('');
    setActionAttachment(null);
    closePassModal(); // calls the original disclosure close
  };

  const [pendingAction, setPendingAction] = useState<{
    type:
      | 'CREATE'
      | 'ACKNOWLEDGE'
      | 'START_PROCESSING'
      | 'DENY'
      | 'CLOSED'
      | 'APPROVE'
      | 'DISAPPROVE_DRAFT'
      | 'JOIN_PROCESSING'
      | 'ASSIGN';
    data: Record<string, unknown>;
  } | null>(null);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passError, setPassError] = useState('');
  const [feedbackNote, setFeedbackNote] = useState('');
  const [actionAttachment, setActionAttachment] = useState<File | null>(null);

  const [activeThreadMemos, setActiveThreadMemos] = useState<Memo[]>([]);
  const [selectedMemoForExpand, setSelectedMemoForExpand] = useState<Memo | null>(null);

  const [headEditSubject, setHeadEditSubject] = useState('');
  const [headEditContent, setHeadEditContent] = useState('');
  const [headSelectedMemoId, setHeadSelectedMemoId] = useState('');
  const [retainedAttachments, setRetainedAttachments] = useState<string[]>([]);
  const [headNewAttachments, setHeadNewAttachments] = useState<File[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [sortByDate, toggleSortByDate] = useToggle(['NEWEST', 'OLDEST'] as const);

  const [headNote, setHeadNote] = useState('');

  const [departmentStaff, setDepartmentStaff] = useState<{ id: string; fname: string; lname: string }[]>([]);

  const searchParams = useSearchParams();
  const urlTab = searchParams.get('tab');

  const [superEditMode, setSuperEditMode] = useState<'edit' | 'approve'>('approve');

  const [reverting, setReverting] = useState(false);

  const fetcher = (url: string) => fetch(url).then(res => res.json());

  // ---- Form for creating memo ----
  const form = useForm({
    initialValues: {
      subject: '',
      content: '',
      priority: 'ROUTINE' as Priority,
      purpose: 'FYI' as Purpose,
      targetDepts: [] as string[],
      parentMemoId: null as string | null,
      rootMemoId: null as string | null,
      memoAttachments: [] as File[],
    },
    validate: {
      subject: (value) => (value.length < 2 ? 'Subject header is required' : null),
      content: (value) => (value.length < 5 ? 'Content of memo is too short' : null),
      targetDepts: (value) => (value.length === 0 ? 'Select a recipient department' : null),
    },
  });

  // ---- Helper functions & derived state (kailangan bago ang memo filters) ----
  const isCurrentlyOIC = () => {
    if (!currentUser?.oic_start || !currentUser?.oic_end) return false;
    const now = new Date().getTime();
    const start = new Date(currentUser.oic_start).getTime();
    const end = new Date(currentUser.oic_end).getTime();
    return now >= start && now <= end;
  };

  const activeDepartment = currentUser?.departmentCode || '';
  const processOICAllowance = isCurrentlyOIC();
  const userRole = currentUser?.role?.toUpperCase() || '';
  const isAdminOrSuper = ['ADMIN', 'SUPERUSER', 'Admin', 'SuperUser'].includes(userRole);
  const isDepartmentHead = ['DEPARTMENTHEAD', 'DepartmentHead', 'OIC'].includes(userRole);

  const isHeadOrOIC = isDepartmentHead || isCurrentlyOIC();


  const [viewMode, setViewMode] = useState<'tile' | 'kanban'>('tile');

  // ---- SWR for memos with polling (15 seconds) ----
  const { data: memosData, mutate: mutateMemos } = useSWR<Memo[]>(
    '../../../api/memos',
    fetcher,
    {
      refreshInterval: 15000,
      revalidateOnFocus: true,
      dedupingInterval: 10000,
      onError: (err) => {
        console.error('Failed to load memos:', err);
      },
    }
  );

  const memos: Memo[] = Array.isArray(memosData) ? memosData : [];

  // ---- Memo lists (gumagamit ng activeDepartment at iba pang derived state) ----
  // Ongoing sent memos
  const ongoingSentMemos = memos.filter(
    (memo) => memo.senderDept === activeDepartment &&
              memo.status === 'APPROVED' &&
              memo.recipients?.some(r => !['CLOSED', 'DENIED', 'COMPLETED'].includes(r.status))
  );

  const sentByUserMemos = memos.filter((memo) => {
    // 1. Basic Check: Dapat galing sa department ninyo at valid ang status
    const isFromMyDept = memo.senderDept === activeDepartment;
    const hasValidStatus = ['APPROVED', 'FOR_APPROVAL', 'CLOSED', 'DENIED'].includes(memo.status);
    
    if (!isFromMyDept || !hasValidStatus) return false;

    // 2. Alamin kung ang kasalukuyang user ang mismong gumawa (applicable sa lahat)
    const isMine = memo.senderId === currentUser?.id;

    // 3. LOGIC PARA SA HEAD / OIC / ADMIN
    if (isHeadOrOIC || isAdminOrSuper) {
      // Makikita nila sa "Sent by You" kung:
      // a. Sila ang mismong gumawa (isMine)
      // b. Inedit nila yung memo ng staff (isRevisedByHead)
      // c. Na-approve/naipadala na nila ito papunta sa ibang department (APPROVED, CLOSED, DENIED)
      // Note: Hindi kasama ang staff's 'FOR_APPROVAL' dito kasi dapat nasa "For Approval / Review" tab pa 'yon ng Head.
      return isMine || memo.isRevisedByHead || ['APPROVED', 'CLOSED', 'DENIED'].includes(memo.status);
    }

    // 4. LOGIC PARA SA STAFF
    // Kung ordinaryong staff lang, strictly mga sariling gawa lang ang lalabas
    return isMine;
  });

  // Closed sent memos
  // const closedSentMemos = memos.filter(
  //   (memo) => memo.senderDept === activeDepartment &&
  //             memo.status === 'CLOSED' && memo.senderId === currentUser?.id || memo.isRevisedByHead === true
  // );

  const allMemosLedgerList = isAdminOrSuper ? memos : [];

  const allMemosGlobal = memos;
  
  // ---- Memo lists ----

  // For Approval - Staff drafts (Head only)
  const forApprovalMemos = memos.filter(
    (memo) => memo.senderDept === activeDepartment && memo.status === 'FOR_APPROVAL'
  );

  // Inbound - Incoming pending memos (Head only)
  const inboundMemos = memos.filter((memo) => {
    if (memo.status === 'FOR_APPROVAL' || memo.status === 'CLOSED' || memo.status === 'DENIED') return false;
    return memo.recipients?.some(
      (r) => r.departmentName === activeDepartment && r.status === 'PENDING'
    );
  });

  // Outbound - Memos sent by your department (active, not fully resolved)
  const outboundMemos = memos.filter((memo) => {
    if (memo.senderDept !== activeDepartment) return false;
    if (memo.status !== 'APPROVED') return false;
    
    // Skip kung walang recipients (for safety)
    if (!memo.recipients || memo.recipients.length === 0) return false;
    
    // Ipakita lamang kung hindi pa lahat ng recipients ay resolved
    const allResolved = memo.recipients.every(r =>
      ['CLOSED', 'DENIED', 'COMPLETED'].includes(r.status)
    );
    return !allResolved;
  });

  // Action Board - Acknowledged/Processing memos (FREE FOR ALL)
  const actionBoardMemos = memos.filter((memo) => {
    if (memo.status === 'FOR_APPROVAL' || memo.status === 'CLOSED' || memo.status === 'DENIED') return false;
    return memo.recipients?.some(
      (r) =>
        r.departmentName === activeDepartment &&
        ['ACKNOWLEDGED', 'PROCESSING'].includes(r.status)
    );
  });

  // Assigned to Me - Memos na assigned sa current user
  const assignedToMeMemos = memos.filter((memo) => {
    if (memo.status === 'FOR_APPROVAL' || memo.status === 'CLOSED' || memo.status === 'DENIED') return false;
    return memo.recipients?.some(
      (r) =>
        r.departmentName === activeDepartment &&
        r.assignedToIds?.includes(currentUser?.id ?? '') && // ✅ array na ngayon
        !['COMPLETED', 'CLOSED', 'DENIED'].includes(r.status)
    );
  });

  // Archived/Resolved
  const resolvedMemos = memos.filter((memo) => {
    // Skip kung walang recipients
    if (!memo.recipients || memo.recipients.length === 0) return false;

    if (isAdminOrSuper) {
      return memo.recipients.some((r) =>
        ['COMPLETED', 'RESPONDED', 'DENIED', 'CLOSED'].includes(r.status)
      );
    }

    const isRecipientResolved = memo.recipients.some(
      (r) =>
        r.departmentName === activeDepartment &&
        ['COMPLETED', 'RESPONDED', 'DENIED', 'CLOSED'].includes(r.status)
    );

    const isSenderResolved =
      memo.senderDept === activeDepartment &&
      memo.recipients.every((r) =>
        ['COMPLETED', 'RESPONDED', 'DENIED', 'CLOSED'].includes(r.status)
      );

    return isRecipientResolved || isSenderResolved;
  });

  // ---- Active tab state (gamit ang isAdminOrSuper at isDepartmentHead) ----
  const [activeTab, setActiveTab] = useState<string | null>(() => {
    if (urlTab) return urlTab;
    if (isAdminOrSuper) return 'all_memos';
    if (isHeadOrOIC) return 'approval';
    return 'action_board';
  });

  // ---- Ref para malaman kung nag-manual change ang user ----
  const userChangedTab = useRef(false);

  // ---- Effect para i-auto-set ang tab (pero hindi kung nag-manual na) ----
  useEffect(() => {
    if (urlTab) return; // ✅ Huwag i‑override kung may URL tab
    
    if (!userChangedTab.current) {
      let desired: string | null = null;
      if (isAdminOrSuper) desired = 'all_memos';
      else if (isHeadOrOIC) desired = 'approval';
      else desired = 'action_board';
      if (desired && activeTab !== desired) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setActiveTab(desired);
      }
    }
  }, [isAdminOrSuper, isHeadOrOIC, activeTab, urlTab]);

  // ---- Handler para sa pag-click ng tab ----
  const handleTabChange = (value: string | null) => {
    userChangedTab.current = true;
    setActiveTab(value);
    // ✅ I‑clear ang search kapag nag‑switch sa archived tab
    if (value === 'archived') {
      setSearchTerm('');
    }
  };

  // ---- Data fetching (initialization) ----
  useEffect(() => {
    const initializeDashboard = async () => {
      try {
        const authRes = await fetch('/api/auth/me');
        const authData = await authRes.json();
        let userDeptCode = '';
        if (authData.success) {
          setCurrentUser(authData.data);
          userDeptCode = authData.data.departmentCode;
        }

        const deptRes = await fetch('/api/department/get');
        const deptData = await deptRes.json();
        if (deptData.success && Array.isArray(deptData.data)) {
          const mappedDepts = deptData.data
            .filter((dept: Department) => dept.code && dept.code !== userDeptCode)
            .map((dept: Department) => ({
              value: dept.code,
              label: dept.name ? `${dept.code} - ${dept.name}` : dept.code,
            }));
          setDepartments(mappedDepts);
        } else {
          setDepartments([]);
        }

        setPageLoading(false);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingDepts(false);
        setLoadingMemos(false);
        setPageLoading(false);
      }
    };
    initializeDashboard();
  }, []);

  // ---- Refresh listener para sa mga manual refresh galing sa IOM actions ----
  useEffect(() => {
    const handleRefresh = () => mutateMemos();
    window.addEventListener('refresh-notifications', handleRefresh);
    return () => window.removeEventListener('refresh-notifications', handleRefresh);
  }, [mutateMemos]);

  // I‑fetch ang staff members (same department, exclude current user)
  useEffect(() => {
    const fetchStaff = async () => {
      if (currentUser?.departmentCode && isHeadOrOIC) {
        try {
          // ✅ Gamitin ang tamang route at parameters
          const res = await fetch(`/api/user/get?sameDepartment=true&role=Staff`);
          const data = await res.json();
          if (data.success) {
            setDepartmentStaff(data.data);
          }
        } catch (err) {
          console.error('Failed to fetch staff:', err);
        }
      }
    };
    fetchStaff();
  }, [currentUser?.departmentCode, isHeadOrOIC]);

  // ---- Filter & sort ----
  const getFilteredMemos = (list: Memo[]) => {
    const filtered = list.filter((memo) => {
      const searchLower = searchTerm.toLowerCase();
      if (!searchLower) return true;
      
      return (
        memo.subject?.toLowerCase().includes(searchLower) ||
        memo.referenceId?.toLowerCase().includes(searchLower) ||
        memo.content?.toLowerCase().includes(searchLower) ||
        memo.senderName?.toLowerCase().includes(searchLower) ||
        memo.sender?.branch?.toLowerCase().includes(searchLower) // ✅ Optional chaining
      );
    });
    return [...filtered].sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return sortByDate === 'NEWEST' ? dateB - dateA : dateA - dateB;
    });
  };

  // ---- Handlers ----
  const triggerActionPasswordCheck = (
    type:
      | 'CREATE'
      | 'ACKNOWLEDGE'
      | 'START_PROCESSING'
      | 'DENY'
      | 'CLOSED'
      | 'APPROVE'
      | 'DISAPPROVE_DRAFT'
      | 'JOIN_PROCESSING'
      | 'ASSIGN',
    data: Record<string, unknown>
  ) => {
    setConfirmPassword('');
    setPassError('');
    setFeedbackNote('');
    setActionAttachment(null);
    setPendingAction({ type, data });
    openPassModal();
  };

  const handlePasswordGateVerificationSubmit = async () => {
    if (!confirmPassword) {
      setPassError('Password is required.');
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      if (pendingAction?.data?.memoId) {
        formData.append('memoId', String(pendingAction.data.memoId));
      }
      formData.append('departmentName', (pendingAction?.data?.departmentName as string) || '');
      formData.append('action', pendingAction?.type || '');
      formData.append('password', confirmPassword);
      formData.append('feedbackNote', feedbackNote || headNote || '');
      const isSenderClosing = pendingAction?.data?.isSenderClosing ? 'true' : 'false';
      formData.append('isSenderClosing', isSenderClosing);

      // ✅ Idagdag ito para sa APPROVE
      if (pendingAction?.type === 'APPROVE') {
        const memoId = pendingAction.data.memoId as string;
        const currentMemo = memos.find(m => m.id === memoId);
        if (currentMemo) {
          const retainedAtts = currentMemo.attachmentPaths || [];
          formData.append('retainedAttachments', JSON.stringify(retainedAtts));
        }
      }

      if (pendingAction?.type === 'ASSIGN' && pendingAction?.data?.assignedToId) {
        formData.append('assignedToId', String(pendingAction.data.assignedToId));
      }

      if (pendingAction?.type === 'CREATE' && pendingAction?.data) {
        formData.append('subject', String(pendingAction.data.subject || ''));
        formData.append('content', String(pendingAction.data.content || ''));
        formData.append('priority', String(pendingAction.data.priority || 'ROUTINE'));
        formData.append('purpose', String(pendingAction.data.purpose || 'FYI'));

        const parentId = pendingAction.data.parentMemoId as string | null;
        const rootId = pendingAction.data.rootMemoId as string | null;

        formData.append('parentMemoId', parentId !== null && parentId !== undefined ? parentId : '');
        formData.append('rootMemoId', rootId !== null && rootId !== undefined ? rootId : '');

        console.log('📤 Sending to API:', {
          parentMemoId: parentId,
          rootMemoId: rootId,
        });

        const targetDepts = pendingAction.data.targetDepts as string[];
        if (Array.isArray(targetDepts)) {
          targetDepts.forEach((dept) => formData.append('targetDepts', dept));
        }

        const memoAttachments = pendingAction.data.memoAttachments as File[] | undefined;
        if (memoAttachments && Array.isArray(memoAttachments)) {
          for (const file of memoAttachments) {
            if (file instanceof File && file.size > 0) {
              formData.append('memoAttachments', file);
            }
          }
        }
      }

      if (actionAttachment) {
        formData.append('attachments', actionAttachment);
      }

      const fetchMethod = pendingAction?.type === 'CREATE' ? 'POST' : 'PATCH';
      const response = await fetch('../../../api/memos', {
        method: fetchMethod,
        body: formData,
      });
      const result = await response.json();

      if (result.success) {
        closePassModal();
        setConfirmPassword('');
        setFeedbackNote('');
        setActionAttachment(null);
        if (pendingAction?.type === 'CREATE') {
          close();
          form.reset();
        } else {
          closeExpandNoteModal();
        }
        // ✅ I-force ang revalidation
        await mutateMemos(undefined, { revalidate: true });
        window.dispatchEvent(new Event('refresh-notifications'));
        alert(`Success! Memo has been ${pendingAction?.type === 'CREATE' ? 'created' : 'processed'}.`);
      } else {
        setPassError(result.message || 'Something went wrong.');
      }
    } catch (error) {
      console.error('Error submitting action:', error);
      setPassError('Internal server error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  const triggerSuperEditReview = (memo: Memo, mode: 'edit' | 'approve' = 'approve') => {
    setHeadSelectedMemoId(memo.id);
    // Gumamit ng revised kung mayroon
    setHeadEditSubject(memo.revisedSubject || memo.subject);
    setHeadEditContent(memo.content);
    setHeadNote(memo.revisedHeadNote || memo.headNote || '');
    setFeedbackNote('');
    setRetainedAttachments(memo.attachmentPaths || []);
    setHeadNewAttachments([]);
    setConfirmPassword('');
    setPassError('');
    setSuperEditMode(mode);
    openSuperEditModal();
  };

  const handleSuperEditSubmit = () => {
    if (superEditMode === 'edit') {
      handleSuperEditSaveRevision();
    } else {
      handleSuperEditAndApproveSubmit();
    }
  };

    const handleSuperEditAndApproveSubmit = async () => {
      // Validate password
      if (!confirmPassword) {
        setPassError('Signature password is required.');
        return;
      }
      // Validate feedbackNote (required)
      if (!feedbackNote) {
        setPassError('Remarks/Feedback note is required for approval.');
        return;
      }
      // HeadNote is optional, so no validation needed
      setSubmitting(true);
      setPassError('');
      try {
        const formData = new FormData();
        formData.append('memoId', headSelectedMemoId);
        formData.append('action', 'APPROVE');
        formData.append('password', confirmPassword);
        formData.append('subject', headEditSubject);
        formData.append('content', headEditContent);
        formData.append('headNote', headNote || ''); // optional
        formData.append('feedbackNote', feedbackNote); // required
        formData.append('retainedAttachments', JSON.stringify(retainedAttachments));
        headNewAttachments.forEach((file) => {
          formData.append('headNewAttachments', file);
        });

        // Debug log
        console.log('📤 SuperEdit FormData:');
        for (const [key, value] of formData.entries()) {
          console.log(key, value);
        }

        const response = await fetch('../../../api/memos', {
          method: 'PATCH',
          body: formData,
        });
        const result = await response.json();
        if (response.ok) {
          alert('Memorandum reviewed, signed, and broadcasted successfully!');
          closeSuperEditModal();
          mutateMemos();
        } else {
          setPassError(result.message || 'Security verification failed.');
        }
      } catch (err) {
        console.error(err);
        setPassError('System infrastructure timeout.');
      } finally {
        setSubmitting(false);
      }
    };

  const handleReplyClick = (parentMemo: Memo) => {
    console.log('📝 Replying to memo:', {
      id: parentMemo.id,
      rootMemoId: parentMemo.rootMemoId,
    });

    form.reset();
    form.setValues({
      subject: parentMemo.subject.startsWith('Re:') ? parentMemo.subject : `Re: ${parentMemo.subject}`,
      content: '',
      priority: parentMemo.priority,
      purpose: 'ACTION',
      targetDepts: [parentMemo.senderDept],
      parentMemoId: parentMemo.id,
      rootMemoId: parentMemo.rootMemoId || parentMemo.id,
      memoAttachments: [],
    });
    open();
  };

  const handleViewThread = (selectedMemo: Memo) => {
    const rootId = selectedMemo.rootMemoId || selectedMemo.id;
    const filtered = memos.filter((m) => m.rootMemoId === rootId || m.id === rootId);
    const sortedThread = [...filtered].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    setActiveThreadMemos(sortedThread);
    openThreadModal();
  };

  const handleExpandNoteOpen = (memo: Memo) => {
    setSelectedMemoForExpand(memo);
    openExpandNoteModal();
  };

  const handleSuperEditSaveRevision = async () => {
    if (!confirmPassword) {
      setPassError('Signature password is required.');
      return;
    }
    setSubmitting(true);
    setPassError('');
    try {
      const formData = new FormData();
      formData.append('memoId', headSelectedMemoId);
      formData.append('action', 'REVISE_DRAFT');
      formData.append('password', confirmPassword);
      formData.append('subject', headEditSubject);
      // ⚠️ HUWAG isama ang content – backend ang bahala sa original content
      formData.append('headNote', headNote || '');
      if (feedbackNote) formData.append('feedbackNote', feedbackNote);
      formData.append('retainedAttachments', JSON.stringify(retainedAttachments));
      headNewAttachments.forEach((file) => {
        formData.append('headNewAttachments', file);
      });

      const response = await fetch('../../../api/memos', {
        method: 'PATCH',
        body: formData,
      });
      const result = await response.json();
      if (response.ok) {
        alert('Draft updated successfully!');
        closeSuperEditModal();
        mutateMemos();
      } else {
        setPassError(result.message || 'Update failed.');
      }
    } catch (err) {
      console.error(err);
      setPassError('System error.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevertAndSave = async () => {
    if (!confirm('Revert all changes? This will discard your edits and restore the original draft.')) return;
    if (!confirmPassword) {
      setPassError('Signature password is required to revert.');
      return;
    }
    setReverting(true);
    setPassError('');
    try {
      const formData = new FormData();
      formData.append('memoId', headSelectedMemoId);
      formData.append('action', 'REVERT_TO_ORIGINAL');
      formData.append('password', confirmPassword);
      // Huwag nang magdagdag ng subject o headNote

      const response = await fetch('../../../api/memos', {
        method: 'PATCH',
        body: formData,
      });
      const result = await response.json();
      if (response.ok) {
        alert('Memo reverted to original draft.');
        closeSuperEditModal();
        mutateMemos();
      } else {
        setPassError(result.message || 'Revert failed.');
      }
    } catch (err) {
      console.error(err);
      setPassError('System error.');
    } finally {
      setReverting(false);
    }
  };

    const handlePrintMemo = (memo: Memo) => {
      const printWindow = window.open('', '_blank', 'width=800,height=600');
      if (!printWindow) return;

      const recipientDepts =
        memo.recipients?.map((r) => `${r.departmentName} [${r.status}]`).join(', ') || 'None';

      const latestHistory = memo.history && memo.history.length > 0 ? memo.history[0] : null;
      // const latestRemarkHtml = latestHistory?.remarks ? `
      //   <div style="margin-top:20px;padding:10px 14px;border-left:3px solid black;font-size:13px;page-break-inside:avoid;">
      //     <div style="font-weight:bold;margin-bottom:4px;">📌 LATEST MEMO REMARK</div>
      //     <div style="white-space:pre-wrap;">${latestHistory.remarks}</div>
      //     <div style="font-size:11px;color:#555;margin-top:4px;">
      //       By: <b>${latestHistory.performedByName}</b> 
      //       (${latestHistory.actorRole === 'SENDER' ? 'Sender' : 
      //         latestHistory.actorRole === 'RECIPIENT' ? 'Recipient' : 'System'}) 
      //       at ${new Date(latestHistory.createdAt).toLocaleString()}
      //     </div>
      //   </div>
      // ` : '';

      const printSubject = memo.revisedSubject || memo.subject;
      const printHeadNote = memo.revisedHeadNote || memo.headNote;

      const headNoteHtml = printHeadNote ? `
        <div style="margin-top:16px;padding:10px 14px;border-left:3px solid #70438a;background-color:#fcf8ff;">
          <strong>Department Head Notes:</strong>
          <div style="white-space:pre-wrap;">${printHeadNote}</div>
        </div>
      ` : '';

      const attachmentNotice =
        memo.attachmentPaths && memo.attachmentPaths.length > 0
          ? `
            <div style="margin-top:16px;border:1px solid #000;padding:10px 14px;page-break-inside:avoid;">
              <div style="font-weight:bold;margin-bottom:8px;text-decoration:underline;">ATTACHED DOCUMENTS</div>
              <ol style="margin:0;padding-left:20px;font-size:13px;">
                ${memo.attachmentPaths
                  .map((path) => {
                    const fileName =
                      path.split('/').pop()?.replace(/^\d+-(\d+-)?/, '') || 'Unnamed Attachment';
                    return `<li style="margin-bottom:2px;">${fileName}</li>`;
                  })
                  .join('')}
              </ol>
              <div style="margin-top:6px;font-size:11px;color:#555;">Total Attachments: ${memo.attachmentPaths.length}</div>
            </div>
          `
          : '';

      const dispatchMatrixRows =
        memo.recipients && memo.recipients.length > 0
          ? memo.recipients
              .map((rec) => {
                // ✅ Determine the correct timestamp based on recipient's status
                let actionTimestamp = null;
                let actionLabel = '';

                if (rec.status === 'PENDING') {
                  actionTimestamp = null;
                  actionLabel = 'Awaiting action';
                } else if (rec.status === 'ACKNOWLEDGED') {
                  actionTimestamp = rec.acknowledgedAt || rec.respondedAt;
                  actionLabel = 'Acknowledged';
                } else if (rec.status === 'PROCESSING') {
                  actionTimestamp = rec.processedAt || rec.respondedAt;
                  actionLabel = 'Processing';
                } else if (rec.status === 'COMPLETED') {
                  actionTimestamp = rec.completedAt || rec.recipientConfirmedAt;
                  actionLabel = 'Completed';
                } else if (rec.status === 'CLOSED') {
                  actionTimestamp = rec.closedAt || rec.senderConfirmedAt || rec.recipientConfirmedAt;
                  actionLabel = 'Closed';
                } else if (rec.status === 'DENIED') {
                  actionTimestamp = rec.deniedAt;
                  actionLabel = 'Denied';
                } else if (rec.status === 'RESPONDED') {
                  actionTimestamp = rec.respondedAt;
                  actionLabel = 'Replied';
                }

                const formattedTimestamp = actionTimestamp
                  ? new Date(actionTimestamp).toLocaleString()
                  : null;

                const recipientHistory = memo.history?.filter(
                  (h) => h.departmentName === rec.departmentName
                );
                // Gamitin ang feedbackNote ng recipient bilang remark
                const latestRemark = rec.feedbackNote || null;

                // Kunin ang pangalan ng gumawa batay sa status
                let performerName = '';
                let performerRole = '';
                if (rec.status === 'ACKNOWLEDGED' && rec.acknowledgedByName) {
                  performerName = rec.acknowledgedByName;
                  performerRole = 'Recipient';
                } else if (rec.status === 'PROCESSING' && rec.processedByName) {
                  performerName = rec.processedByName;
                  performerRole = 'Recipient';
                } else if (rec.status === 'COMPLETED' && rec.completedByName) {
                  performerName = rec.completedByName;
                  performerRole = 'Recipient';
                } else if (rec.status === 'CLOSED' && rec.closedByName) {
                  performerName = rec.closedByName;
                  performerRole = rec.closedByRole || 'Recipient';
                } else if (rec.status === 'DENIED' && rec.deniedByName) {
                  performerName = rec.deniedByName;
                  performerRole = 'Recipient';
                } else if (rec.status === 'RESPONDED') {
                  // walang specific field, gamitin na lang ang feedbackNote
                }

                const performerInfo = performerName
                  ? `<div style="font-size:10px;color:#666;margin-top:2px;border-left:2px solid #666;padding-left:5px;"><b>PERFORMED BY:</b> ${performerName} (${performerRole})</div>`
                  : '';

                const closedByInfo =
                  rec.status === 'CLOSED' && rec.closedByName
                    ? `<div style="font-size:10px;color:#666;margin-top:2px;border-left:2px solid #666;padding-left:5px;"><b>CLOSED BY:</b> ${rec.closedByName}</div>`
                    : '';

                return `
                  <tr style="border-bottom:1px dashed #000;page-break-inside:avoid;">
                    <td style="padding:6px 4px;font-weight:bold;vertical-align:top;">${rec.departmentName}</td>
                    <td style="padding:6px 4px;vertical-align:top;">
                      <span style="padding:1px 6px;border:1px solid #000;font-size:11px;font-weight:bold;display:inline-block;background-color:${
                        rec.status === 'CLOSED' ? '#e6f7e6' : 
                        rec.status === 'DENIED' ? '#ffe6e6' : 
                        rec.status === 'COMPLETED' ? '#e6f0ff' : 
                        'transparent'
                      };">${rec.status}</span>
                    </td>
                    <td style="padding:6px 4px;font-size:12px;vertical-align:top;word-break:break-word;">
                      <div style="font-weight:500;margin-bottom:4px;white-space:pre-wrap;">${latestRemark || '--'}</div>
                      ${formattedTimestamp ? `<div style="font-size:10px;color:#444;margin-top:2px;border-left:2px solid #000;padding-left:5px;"><b>${actionLabel} AT:</b> ${formattedTimestamp}</div>` : ''}
                      ${performerInfo}
                      ${closedByInfo}
                    </td>
                  </tr>
                `;
              })
              .join('')
          : `<tr><td colspan="3" style="text-align:center;padding:10px;color:#000;border-bottom:1px dashed #000;">No recipient records found.</td></tr>`;

      const dispatchMatrixTable = `
        <div style="margin-top:24px;page-break-inside:avoid;">
          <div style="font-weight:bold;margin-bottom:6px;text-decoration:underline;font-size:13px;">DISPATCH ROUTE TRACKING MATRIX</div>
          <table style="width:100%;border-collapse:collapse;font-size:12px;text-align:left;font-family:monospace;table-layout:fixed;">
            <thead>
              <tr style="border-bottom:2px solid #000;font-weight:bold;">
                <th style="padding:4px 4px;width:20%;">DEPARTMENT</th>
                <th style="padding:4px 4px;width:18%;">STATUS</th>
                <th style="padding:4px 4px;width:62%;">REMARKS & TRANSACTION TIMESTAMP</th>
              </tr>
            </thead>
            <tbody>
              ${dispatchMatrixRows}
            </tbody>
          </table>
        </div>
      `;

      printWindow.document.write(`
        <html>
          <head>
            <title>Print Memo - ${memo.referenceId || 'DRAFT'}</title>
            <style>
              body { 
                font-family: monospace; 
                line-height: 1.5; 
                padding: 24px 30px; 
                color: #000; 
                font-size: 13px; 
              }
              .header { 
                text-align: center; 
                margin-bottom: 18px; 
                font-weight: bold; 
                font-size: 17px; 
                letter-spacing: 1px; 
              }
              .meta-table { 
                width: 100%; 
                border-collapse: collapse; 
                margin-bottom: 14px; 
              }
              .meta-table td { 
                padding: 3px 0; 
                vertical-align: top; 
              }
              .meta-label { 
                width: 120px; 
                font-weight: bold; 
              }
              .content-box { 
                border-top: 2px dashed #000; 
                border-bottom: 2px dashed #000; 
                padding: 16px 0; 
                margin-bottom: 14px; 
                white-space: pre-wrap; 
                font-size: 14px; 
              }
              @media print {
                tr { page-break-inside: avoid !important; }
              }
            </style>
          </head>
          <body>
            <div class="header">NCST E-FORMS | INTER-OFFICE MEMORANDUM<br>==========================</div>
            <table class="meta-table">
              <tr><td class="meta-label">REF ID:</td><td><strong>${memo.referenceId || 'DRAFT (PENDING APPROVAL)'}</strong></td></tr>
              <tr><td class="meta-label">DATE CREATED:</td><td>${new Date(memo.createdAt).toLocaleString()}</td></tr>
              <tr><td class="meta-label">FROM (SENDER):</td><td>${memo.senderName} (${memo.senderDept}) ${memo.isRevisedByHead ? '[Amended by Head]' : ''}</td></tr>
              <tr><td class="meta-label">TO (TARGET):</td><td>${recipientDepts}</td></tr>
              <tr><td class="meta-label">PRIORITY:</td><td>[${memo.priority}]</td></tr>
              <tr><td class="meta-label">PURPOSE:</td><td>${memo.purpose || 'N/A'}</td></tr>
              <tr><td class="meta-label">SUBJECT:</td><td><strong>${printSubject}</strong></td></tr>
            </table>
            
            ${headNoteHtml}
            
            <div class="content-box">${memo.content.replace(/\n/g, '<br>')}</div>
            
            
            
            ${attachmentNotice}
            
            ${dispatchMatrixTable}
            
            <div style="margin-top:36px;font-size:10px;text-align:center;color:#555;">-- This is a system-generated document. --</div>
            
            <script>
              window.onload = function() { window.print(); };
              window.onafterprint = function() { window.close(); };
            <\/script>
          </body>
        </html>
      `);
      printWindow.document.close();
    };

  // ---- Render helper ----
  const renderMemoCards = (memoList: Memo[], isApprovalTab = false) => {
    if (memoList.length === 0) {
      return <Text c="dimmed" ta="center" py="xl" w="100%">No documents logged.</Text>;
    }

    return (
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
        {memoList.map((memo) => {
          const rootId = memo.rootMemoId || memo.id;
          const threadCount = memos.filter((m) => m.rootMemoId === rootId || m.id === rootId).length;

          return (
            <MemoCard
              key={memo.id}
              memo={memo}
              isApprovalTab={isApprovalTab}
              currentUser={currentUser}
              activeDepartment={activeDepartment}
              isAdminOrSuper={isAdminOrSuper}
              isHeadOrOIC={isHeadOrOIC}
              processOICAllowance={processOICAllowance}
              threadCount={threadCount}
              onReply={handleReplyClick}
              onPrint={handlePrintMemo}
              onViewThread={handleViewThread}
              onExpand={handleExpandNoteOpen}
              onSuperEdit={triggerSuperEditReview}
              triggerActionPasswordCheck={triggerActionPasswordCheck}
              allMemos={memos}
              departmentStaff={departmentStaff}
              totalDepartments={departments.length}
            />
          );
        })}
      </SimpleGrid>
    );
  };

  // ---- Main render ----
  return (
    <Container fluid py="md" pos="relative">
      <LoadingOverlay visible={pageLoading} zIndex={1000} overlayProps={{ radius: 'sm', blur: 2 }} />

      <Card withBorder radius="lg" p="lg" shadow="sm" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Group justify="space-between" align="center" mb="xl">
          <Stack gap={2}>
            <Title order={2} fw={800} lts="-0.5px">
              Inter-Office Memorandum Workspace
            </Title>
            <Group gap={6}>
              <Text size="xs" c="dimmed">Active Department Code:</Text>
              <Badge color="blue" variant="light" size="sm">{activeDepartment || 'SYSTEM'}</Badge>
              <Badge color="gray" variant="light" size="sm">{userRole}</Badge>
            </Group>
          </Stack>
          <Button leftSection={<IconPlus size={16} />} onClick={() => { form.reset(); open(); }} radius="md">
            Create New Memo
          </Button>
        </Group>

        <Box style={{ flex: 1, overflow: 'hidden' }}>

          {/* Search & Sort */}
          <Card withBorder radius="md" mb="md" p="sm" bg="light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-8))">
            <Group justify="space-between" align="flex-end">
              <TextInput
                placeholder="REMINDER: This only filters the selected tab..."
                label="Search Memorandum"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.currentTarget.value)}
                style={{ flex: 1 }}
              />
              <Group gap="md">
                <Stack gap={4}>
                  <Text size="xs" fw={500}>Sort by Date Created</Text>
                  <Button
                    variant="light"
                    color={sortByDate === 'NEWEST' ? 'blue' : 'orange'}
                    onClick={() => toggleSortByDate()}
                    style={{ width: 180 }}
                  >
                    {sortByDate === 'NEWEST' ? '📅 Newest First' : '⏳ Oldest First'}
                  </Button>
                </Stack>
                <Stack gap={4}>
                  <Text size="xs" fw={500}>View</Text>
                  <SegmentedControl
                    value={viewMode}
                    onChange={(val) => setViewMode(val as 'tile' | 'kanban')}
                    data={[
                      { label: 'Tile', value: 'tile' },
                      { label: 'Kanban-Style', value: 'kanban' },
                    ]}
                    size="xs"
                  />
                </Stack>
              </Group>
            </Group>
          </Card>

          {/* Tabs */}
          <ScrollArea
            style={{
              height: 'calc(100vh - 280px)', // I-adjust depende sa taas ng header at search bar
              paddingRight: '4px', // Para hindi mag-cut ang scrollbar
            }}
            type="auto"
          >
            <Tabs value={activeTab} onChange={handleTabChange} radius="md" variant="pills">
              <Tabs.List mb="lg">
                {/* For Approval - Head only */}
                {isHeadOrOIC && (
                  <Tabs.Tab value="approval" leftSection={<IconThumbUp size={15} />}>
                    For Approval{' '}
                    <Badge size="xs" variant="light" ml={6}>{forApprovalMemos.length}</Badge>
                  </Tabs.Tab>
                )}
                
                {/* Inbound - Head only */}
                {isHeadOrOIC && (
                  <Tabs.Tab value="inbound" leftSection={<IconInbox size={15} />}>
                    Inbound{' '}
                    <Badge size="xs" variant="light" ml={6}>{inboundMemos.length}</Badge>
                  </Tabs.Tab>
                )}
                
                {/* Outbound - Everyone */}
                <Tabs.Tab value="outbound" leftSection={<IconSend size={15} />}>
                  Outbound{' '}
                  <Badge size="xs" variant="light" ml={6}>{outboundMemos.length}</Badge>
                </Tabs.Tab>
                
                {/* Action Board - Everyone (FREE MODE - lahat nakakakita, lahat pwedeng kumilos) */}
                <Tabs.Tab value="action_board" leftSection={<IconPlayerPlay size={15} />}>
                  Action Board{' '}
                  <Badge size="xs" variant="light" ml={6}>{actionBoardMemos.length}</Badge>
                </Tabs.Tab>
                
                {/* Ipakita sa lahat (except Admin? pero okay lang din) */}
                <Tabs.Tab value="assigned_to_me" leftSection={<IconUserCheck size={15} />}>
                  Assigned to Me{' '}
                  <Badge size="xs" variant="light" ml={6}>{assignedToMeMemos.length}</Badge>
                </Tabs.Tab>
                
                {/* Archived */}
                <Tabs.Tab value="archived" leftSection={<IconCircleCheck size={15} />}>
                  Archived / Resolved{' '}
                  <Badge size="xs" variant="light" ml={6}>{resolvedMemos.length}</Badge>
                </Tabs.Tab>
              

                {isAdminOrSuper && (
                  <Tabs.Tab value="all_memos_global" leftSection={<IconInfoCircle size={15} />}>
                    Global View (Admin/Super ONLY){' '}
                    <Badge size="xs" variant="light" ml={6}>{allMemosGlobal.length}</Badge>
                  </Tabs.Tab>
                )}

              </Tabs.List>

              <Tabs.Panel value="all_memos_global">
                <CollapsibleAlert  icon={<IconInfoCircle size={16} />} title="System Administrator Global Ledger View" color="blue">
                  Authorized view only. Tracks every operational transactional memorandum sequence regardless of origin status blocks.
                  <br /><br />
                  Mga otorisadong tao lamang ang maaaring makakita nito. Binabantayan nito ang lahat ng mga memorandum na pumasok sa NCST E-Forms.
                </CollapsibleAlert>

                {viewMode === 'tile' ? (
                  renderMemoCards(getFilteredMemos(allMemosGlobal))
                ) : (
                  <KanbanBoard
                    memos={getFilteredMemos(allMemosGlobal)}
                    isApprovalTab={false}
                    currentUser={currentUser}
                    activeDepartment={activeDepartment}
                    isAdminOrSuper={isAdminOrSuper}
                    isHeadOrOIC={isHeadOrOIC}
                    processOICAllowance={processOICAllowance}
                    onReply={handleReplyClick}
                    onPrint={handlePrintMemo}
                    onViewThread={handleViewThread}
                    onExpand={handleExpandNoteOpen}
                    onSuperEdit={triggerSuperEditReview}
                    triggerActionPasswordCheck={triggerActionPasswordCheck}
                    allMemos={memos}
                    departmentStaff={departmentStaff}
                    totalDepartments={departments.length}
                  />
                )}

              </Tabs.Panel>

              <Tabs.Panel value="approval">
                <CollapsibleAlert  icon={<IconInfoCircle size={16} />} title="Super Editor & Approval Command Queue" color="orange">
                  Draft memorandum formulated by department staff. As Department Head, you can click <b><i>Review & Approve</i></b> to modify mistakes or directly finalize contents.
                  <br /><br />
                  Makikita rito ang mga memorandum na ginawa ng mga staff sa iyong departamento. Maaaring mong pindutin ang <b><i>Review & Approve</i></b> para may ibahin o ayusin bago tuluyang aprubahan.
                </CollapsibleAlert>

                {viewMode === 'tile' ? (
                  renderMemoCards(getFilteredMemos(forApprovalMemos), true)
                ) : (
                  <KanbanBoard
                    memos={getFilteredMemos(forApprovalMemos)}
                    isApprovalTab={true}
                    currentUser={currentUser}
                    activeDepartment={activeDepartment}
                    isAdminOrSuper={isAdminOrSuper}
                    isHeadOrOIC={isHeadOrOIC}
                    processOICAllowance={processOICAllowance}
                    onReply={handleReplyClick}
                    onPrint={handlePrintMemo}
                    onViewThread={handleViewThread}
                    onExpand={handleExpandNoteOpen}
                    onSuperEdit={triggerSuperEditReview}
                    triggerActionPasswordCheck={triggerActionPasswordCheck}
                    allMemos={memos}
                    departmentStaff={departmentStaff}
                    totalDepartments={departments.length}
                  />
                )}

              </Tabs.Panel>

              <Tabs.Panel value="inbound">
                <CollapsibleAlert  icon={<IconInfoCircle size={16} />} title="Incoming External Inbound Queue" color="teal">
                  Incoming memorandums routed by external entities. Requires Department Head authentication to acknowledge and shift to the public Action Board.
                  <br /><br />
                  Mga memorandum na galing sa ibang mga departmento na aprubado na ng kanilang Department Head. I-<b><i>Acknowledge</i></b> para mapunta sa Action Board Workspace para aksyunan ng kahit sino sa inyong departamento.
                </CollapsibleAlert>

                {viewMode === 'tile' ? (
                  renderMemoCards(getFilteredMemos(inboundMemos))
                ) : (
                  <KanbanBoard
                    memos={getFilteredMemos(inboundMemos)}
                    isApprovalTab={false}
                    currentUser={currentUser}
                    activeDepartment={activeDepartment}
                    isAdminOrSuper={isAdminOrSuper}
                    isHeadOrOIC={isHeadOrOIC}
                    processOICAllowance={processOICAllowance}
                    onReply={handleReplyClick}
                    onPrint={handlePrintMemo}
                    onViewThread={handleViewThread}
                    onExpand={handleExpandNoteOpen}
                    onSuperEdit={triggerSuperEditReview}
                    triggerActionPasswordCheck={triggerActionPasswordCheck}
                    allMemos={memos}
                    departmentStaff={departmentStaff}
                    totalDepartments={departments.length}
                  />
                )}

              </Tabs.Panel>

              <Tabs.Panel value="action_board">
                <CollapsibleAlert  icon={<IconInfoCircle size={16} />} title="Departmental Action Board (Public Staff View)" color="indigo">
                  Memorandums acknowledged by management. <b><i>Visible to all department members</i></b> to collaborate, process, and address.
                  <br /><br />
                  Mga memorandum na tinaggap at kinilala ng Department Head. <b><i>Kita ng lahat ng mga myembro ng departamento</i></b> para ma-proseso o aksyunan.
                </CollapsibleAlert>
                {renderMemoCards(getFilteredMemos(actionBoardMemos))}

                {viewMode === 'tile' ? (
                  renderMemoCards(getFilteredMemos(actionBoardMemos))
                ) : (
                  <KanbanBoard
                    memos={getFilteredMemos(actionBoardMemos)}
                    isApprovalTab={false}
                    currentUser={currentUser}
                    activeDepartment={activeDepartment}
                    isAdminOrSuper={isAdminOrSuper}
                    isHeadOrOIC={isHeadOrOIC}
                    processOICAllowance={processOICAllowance}
                    onReply={handleReplyClick}
                    onPrint={handlePrintMemo}
                    onViewThread={handleViewThread}
                    onExpand={handleExpandNoteOpen}
                    onSuperEdit={triggerSuperEditReview}
                    triggerActionPasswordCheck={triggerActionPasswordCheck}
                    allMemos={memos}
                    departmentStaff={departmentStaff}
                    totalDepartments={departments.length}
                  />
                )}

              </Tabs.Panel>

              <Tabs.Panel value="assigned_to_me">
                <CollapsibleAlert  icon={<IconInfoCircle size={16} />} title="Assigned to Me" color="grape">
                  Memos specifically assigned to you by the Department Head.
                  <br /><br />
                  Mga memorandum na direktang na‑assign sa iyo ng Department Head.
                </CollapsibleAlert>

                {viewMode === 'tile' ? (
                  renderMemoCards(getFilteredMemos(assignedToMeMemos))
                ) : (
                  <KanbanBoard
                    memos={getFilteredMemos(assignedToMeMemos)}
                    isApprovalTab={false}
                    currentUser={currentUser}
                    activeDepartment={activeDepartment}
                    isAdminOrSuper={isAdminOrSuper}
                    isHeadOrOIC={isHeadOrOIC}
                    processOICAllowance={processOICAllowance}
                    onReply={handleReplyClick}
                    onPrint={handlePrintMemo}
                    onViewThread={handleViewThread}
                    onExpand={handleExpandNoteOpen}
                    onSuperEdit={triggerSuperEditReview}
                    triggerActionPasswordCheck={triggerActionPasswordCheck}
                    allMemos={memos}
                    departmentStaff={departmentStaff}
                    totalDepartments={departments.length}
                  />
                )}

              </Tabs.Panel>

              <Tabs.Panel value="outbound">
                <CollapsibleAlert  icon={<IconInfoCircle size={16} />} title="Outbound Memos" color="cyan">
                  Memos sent by your department to other departments.
                  <br /><br />
                  Mga memorandum na ipinadala ng inyong departamento sa ibang departamento.
                </CollapsibleAlert>

                {viewMode === 'tile' ? (
                  renderMemoCards(getFilteredMemos(outboundMemos))
                ) : (
                  <KanbanBoard
                    memos={getFilteredMemos(outboundMemos)}
                    isApprovalTab={false}
                    currentUser={currentUser}
                    activeDepartment={activeDepartment}
                    isAdminOrSuper={isAdminOrSuper}
                    isHeadOrOIC={isHeadOrOIC}
                    processOICAllowance={processOICAllowance}
                    onReply={handleReplyClick}
                    onPrint={handlePrintMemo}
                    onViewThread={handleViewThread}
                    onExpand={handleExpandNoteOpen}
                    onSuperEdit={triggerSuperEditReview}
                    triggerActionPasswordCheck={triggerActionPasswordCheck}
                    allMemos={memos}
                    departmentStaff={departmentStaff}
                    totalDepartments={departments.length}
                  />
                )}

              </Tabs.Panel>

              <Tabs.Panel value="archived">
                <CollapsibleAlert icon={<IconInfoCircle size={16} />} title="Archived Records Directory" color="green">
                  Archived historical repository containing fully responded operations or structurally denied state documents.
                  <br /><br />
                  Koleksyon ng lahat ng mga na-respondehan at tinanggihang memorandum.
                </CollapsibleAlert>

                {viewMode === 'tile' ? (
                  renderMemoCards(getFilteredMemos(resolvedMemos))
                ) : (
                  <KanbanBoard
                    memos={getFilteredMemos(resolvedMemos)}
                    isApprovalTab={false}
                    currentUser={currentUser}
                    activeDepartment={activeDepartment}
                    isAdminOrSuper={isAdminOrSuper}
                    isHeadOrOIC={isHeadOrOIC}
                    processOICAllowance={processOICAllowance}
                    onReply={handleReplyClick}
                    onPrint={handlePrintMemo}
                    onViewThread={handleViewThread}
                    onExpand={handleExpandNoteOpen}
                    onSuperEdit={triggerSuperEditReview}
                    triggerActionPasswordCheck={triggerActionPasswordCheck}
                    allMemos={memos}
                    departmentStaff={departmentStaff}
                    totalDepartments={departments.length}
                  />
                )}

              </Tabs.Panel>
            </Tabs>
          </ScrollArea>

        </Box>
      </Card>

      {/* ---- Modals ---- */}
      <CreateMemoModal
        opened={opened}
        onClose={close}
        form={form}
        departments={departments}
        submitting={submitting}
        onSubmit={(values) => triggerActionPasswordCheck('CREATE', values)}
        isReply={!!form.values.parentMemoId}
      />

      <ViewMemoModal
        opened={expandNoteOpened}
        onClose={closeExpandNoteModal}
        memo={selectedMemoForExpand}
        currentUser={currentUser}
        activeDepartment={activeDepartment}
        isAdminOrSuper={isAdminOrSuper}
        isDepartmentHead={isHeadOrOIC}
        isHeadOrOIC={isHeadOrOIC}
        processOICAllowance={processOICAllowance}
        totalDepartments={departments.length}
        isApprovalTab={activeTab === 'approval'}
        onSuperEdit={triggerSuperEditReview}
        departmentStaff={departmentStaff}
        allMemos={memos}
        onReply={handleReplyClick}
        onPrint={handlePrintMemo}
        triggerActionPasswordCheck={triggerActionPasswordCheck}
        onViewThread={handleViewThread}
      />

      <PasswordGateModal
        opened={passModalOpened}
        onClose={handleClosePassModal}
        pendingAction={pendingAction}
        confirmPassword={confirmPassword}
        setConfirmPassword={setConfirmPassword}
        passError={passError}
        feedbackNote={feedbackNote}
        setFeedbackNote={setFeedbackNote}
        actionAttachment={actionAttachment}
        setActionAttachment={setActionAttachment}
        submitting={submitting}
        onSubmit={handlePasswordGateVerificationSubmit}
        zIndex={1000}
      />

      <SuperEditModal
        opened={superEditOpened}
        onClose={closeSuperEditModal}
        mode={superEditMode}
        subject={headEditSubject}
        setSubject={setHeadEditSubject}
        content={headEditContent}
        setContent={setHeadEditContent}          // kasama kahit hindi ginagamit
        headNote={headNote}
        setHeadNote={setHeadNote}
        feedbackNote={feedbackNote}
        setFeedbackNote={setFeedbackNote}
        retainedAttachments={retainedAttachments}
        setRetainedAttachments={setRetainedAttachments}
        newAttachments={headNewAttachments}
        setNewAttachments={setHeadNewAttachments}
        confirmPassword={confirmPassword}
        setConfirmPassword={setConfirmPassword}
        passError={passError}
        submitting={submitting}
        onSubmit={handleSuperEditSubmit}
        onRevert={handleRevertAndSave}
        reverting={reverting}
      />

      {/* Thread Timeline Modal */}
      <Modal opened={threadModalOpened} onClose={closeThreadModal} title="Memorandum Thread History" size="lg" radius="md" zIndex={2000}>
        <Box p="md">
          {activeThreadMemos.length === 0 ? (
            <Loader size="sm" />
          ) : (
            <Timeline active={activeThreadMemos.length - 1} bulletSize={24} lineWidth={2}>
              {activeThreadMemos.map((tMemo) => (
                <Timeline.Item
                  key={tMemo.id}
                  title={
                    <Group justify="space-between" w="100%">
                      <Group gap="xs">
                        <Text size="sm" fw={700}>
                          {tMemo.referenceId || 'DRAFT'} - {tMemo.revisedSubject || tMemo.subject}
                        </Text>
                        {(tMemo.revisedSubject || tMemo.revisedHeadNote || tMemo.isRevisedByHead) && (
                          <Badge color="grape" size="9px" radius="xs" variant="light">
                            Amended
                          </Badge>
                        )}
                      </Group>
                      <Badge size="xs" variant="light">{tMemo.priority}</Badge>
                    </Group>
                  }
                >
                  <Text size="xs" c="dimmed" mt={2}>
                    Sent by <b>{tMemo.senderName} ({tMemo.senderDept})</b> on{' '}
                    {new Date(tMemo.createdAt).toLocaleString()}
                  </Text>
                  <UnstyledButton
                    onClick={() => handleExpandNoteOpen(tMemo)}
                    style={{ width: '100%', textAlign: 'left', marginTop: '8px' }}
                  >
                    <Card
                      withBorder
                      p="sm"
                      bg="light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-7))"
                      radius="sm"
                      style={{ cursor: 'pointer' }}
                    >
                      <Text size="xs" lineClamp={3}>
                        {tMemo.content}
                      </Text>
                      <Text size="10px" color="blue" mt={4} ta="right">
                        Click to view full content
                      </Text>
                    </Card>
                  </UnstyledButton>
                </Timeline.Item>
              ))}
            </Timeline>
          )}
        </Box>
      </Modal>
    </Container>
  );
}