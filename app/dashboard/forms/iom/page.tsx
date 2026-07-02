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
  SimpleGrid
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
} from '@tabler/icons-react';

// Import shared types
import { Priority, Purpose, Memo, UserContext, Department } from './component/types';
// Import components
import MemoCard from './component/memoCard';
import CreateMemoModal from './component/createMemoModal';
import ViewMemoModal from './component/viewMemoModal';
import PasswordGateModal from './component/passwordGateModal';
import SuperEditModal from './component/superEditModal';

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
  const [memos, setMemos] = useState<Memo[]>([]);
  const [loadingMemos, setLoadingMemos] = useState(true);
  const [currentUser, setCurrentUser] = useState<UserContext | null>(null);
  const [pageLoading, setPageLoading] = useState(true);

  const [pendingAction, setPendingAction] = useState<{
    type:
      | 'CREATE'
      | 'ACKNOWLEDGE'
      | 'START_PROCESSING'
      | 'DENY'
      | 'CLOSED'
      | 'APPROVE_MEMO'
      | 'DISAPPROVE_DRAFT'
      | 'JOIN_PROCESSING';
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

  // ---- Data fetching ----
  const fetchMemos = async () => {
    try {
      const res = await fetch('../../../api/memos');
      const data = await res.json();
      setMemos(data || []);
    } catch (err) {
      console.error('Failed to load memos:', err);
    }
  };

  useEffect(() => {
    const initializeDashboard = async () => {
      try {
        const authRes = await fetch('../../../api/auth/me');
        const authData = await authRes.json();
        let userDeptCode = '';
        if (authData.success) {
          setCurrentUser(authData.data);
          userDeptCode = authData.data.departmentCode;
        }

        const deptRes = await fetch('../../../api/department/get');
        const deptData = await deptRes.json();
        if (deptData.success && Array.isArray(deptData.data)) {
          const mappedDepts = deptData.data
            .filter((dept: Department) => dept.code !== userDeptCode)
            .map((dept: Department) => ({
              value: dept.code,
              label: dept.name ? `${dept.code} - ${dept.name}` : dept.code,
            }));
          setDepartments(mappedDepts);
        }

        setPageLoading(true);
        await fetchMemos();
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

  // ---- Helper functions ----
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

  // ---- Ngayon, pwede na nating gamitin ang roles sa useState ----
  const [activeTab, setActiveTab] = useState<string | null>(() => {
    if (isAdminOrSuper) return 'all_memos';
    if (isDepartmentHead) return 'approval';
    return 'inbox';
  });

  // ---- Ref para malaman kung nag-manual change ang user ----
  const userChangedTab = useRef(false);

  // ---- Effect para i-auto-set ang tab kapag nagbago ang roles (pero hindi kung nag-manual na) ----
  useEffect(() => {
    if (!userChangedTab.current) {
      let desired: string | null = null;
      if (isAdminOrSuper) desired = 'all_memos';
      else if (isDepartmentHead) desired = 'approval';
      else desired = 'inbox';

      if (desired && activeTab !== desired) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setActiveTab(desired);
      }
    }
  }, [isAdminOrSuper, isDepartmentHead, activeTab]);

  // ---- Handler para sa pag-click ng tab ----
  const handleTabChange = (value: string | null) => {
    userChangedTab.current = true;
    setActiveTab(value);
  };


  // ---- Filter & sort ----
  const getFilteredMemos = (list: Memo[]) => {
    const filtered = list.filter((memo) => {
      const searchLower = searchTerm.toLowerCase();
      return (
        memo.subject?.toLowerCase().includes(searchLower) ||
        memo.referenceId?.toLowerCase().includes(searchLower) ||
        memo.content?.toLowerCase().includes(searchLower) ||
        memo.senderName?.toLowerCase().includes(searchLower) ||
        memo.sender?.branch.toLowerCase().includes(searchLower)
      );
    });
    return [...filtered].sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return sortByDate === 'NEWEST' ? dateB - dateA : dateA - dateB;
    });
  };

  // ---- Derived memo lists ----
  const allMemosLedgerList = isAdminOrSuper ? memos : [];
  const forApprovalMemos = memos.filter(
    (memo) => memo.senderDept === activeDepartment && memo.status === 'FOR_APPROVAL'
  );
  const incomingMemos = memos.filter((memo) => {
    if (memo.status === 'FOR_APPROVAL' || memo.status === 'CLOSED' || memo.status === 'DENIED') return false;
    return memo.recipients?.some(
      (r) => (r.departmentName === activeDepartment || processOICAllowance) && r.status === 'PENDING'
    );
  });
  const actionBoardMemos = memos.filter((memo) => {
    if (memo.status === 'FOR_APPROVAL' || memo.status === 'CLOSED' || memo.status === 'DENIED') return false;
    return memo.recipients?.some(
      (r) =>
        (r.departmentName === activeDepartment || processOICAllowance) &&
        ['ACKNOWLEDGED', 'PROCESSING'].includes(r.status)
    );
  });
  const sentMemos = memos.filter(
    (memo) => memo.senderDept === activeDepartment && memo.status === 'APPROVED'
  );
  const resolvedMemos = memos.filter((memo) => {
    if (isAdminOrSuper) {
      return memo.recipients?.some((r) => 
        ['COMPLETED', 'RESPONDED', 'DENIED', 'CLOSED'].includes(r.status)
      );
    }
    const isRecipientResolved = memo.recipients?.some(
      (r) =>
        (r.departmentName === activeDepartment || processOICAllowance) &&
        ['COMPLETED', 'RESPONDED', 'DENIED', 'CLOSED'].includes(r.status)
    );
    const isSenderResolved =
      memo.senderDept === activeDepartment &&
      memo.recipients?.every((r) => 
        ['COMPLETED', 'RESPONDED', 'DENIED', 'CLOSED'].includes(r.status)
      );
    return isRecipientResolved || isSenderResolved;
  });

  // ---- Handlers ----
  const triggerActionPasswordCheck = (
    type:
      | 'CREATE'
      | 'ACKNOWLEDGE'
      | 'START_PROCESSING'
      | 'DENY'
      | 'CLOSED'
      | 'APPROVE_MEMO'
      | 'DISAPPROVE_DRAFT'
      | 'JOIN_PROCESSING',
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
      if (feedbackNote) {
        formData.append('feedbackNote', feedbackNote);
      }
      const isSenderClosing = pendingAction?.data?.isSenderClosing ? 'true' : 'false';
      formData.append('isSenderClosing', isSenderClosing);

      if (pendingAction?.type === 'CREATE' && pendingAction?.data) {
        formData.append('subject', String(pendingAction.data.subject || ''));
        formData.append('content', String(pendingAction.data.content || ''));
        formData.append('priority', String(pendingAction.data.priority || 'ROUTINE'));
        formData.append('purpose', String(pendingAction.data.purpose || 'FYI'));
        const targetDepts = pendingAction.data.targetDepts as string[];
        if (Array.isArray(targetDepts)) {
          targetDepts.forEach((dept) => formData.append('targetDepts', dept));
        }

        // 🟢 IDAGDAG ANG MGA ATTACHMENTS
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
        }
        fetchMemos();
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

  const triggerSuperEditReview = (memo: Memo) => {
    setHeadSelectedMemoId(memo.id);
    setHeadEditSubject(memo.subject);
    setHeadEditContent(memo.content);
    setRetainedAttachments(memo.attachmentPaths || []);
    setHeadNewAttachments([]);
    setConfirmPassword('');
    setPassError('');
    openSuperEditModal();
  };

  const handleSuperEditAndApproveSubmit = async () => {
    if (!confirmPassword) {
      setPassError('Signature password is required.');
      return;
    }
    setSubmitting(true);
    setPassError('');
    try {
      const formData = new FormData();
      formData.append('memoId', headSelectedMemoId);
      formData.append('action', 'APPROVE');
      formData.append('password', confirmPassword);
      formData.append('subject', headEditSubject);
      formData.append('content', headEditContent);
      formData.append('retainedAttachments', JSON.stringify(retainedAttachments));
      headNewAttachments.forEach((file) => {
        formData.append('headNewAttachments', file);
      });

      const response = await fetch('../../../api/memos', {
        method: 'PATCH',
        body: formData,
      });
      if (response.ok) {
        alert('Memorandum reviewed, signed, and broadcasted successfully!');
        closeSuperEditModal();
        fetchMemos();
      } else {
        const resData = await response.json();
        setPassError(resData.message || 'Security verification failed.');
      }
    } catch (err) {
      console.error(err);
      setPassError('System infrastructure timeout.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReplyClick = (parentMemo: Memo) => {
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

  const handlePrintMemo = (memo: Memo) => {
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) return;
    
    const recipientDepts =
      memo.recipients?.map((r) => `${r.departmentName} [${r.status}]`).join(', ') || 'None';
    
    const revisionNotice = memo.isRevisedByHead
      ? `<div style="margin-top:15px;padding:10px;border:1px solid #70438a;background-color:#fcf8ff;font-size:12px;color:#70438a;"><strong>⚠️ AMENDMENT NOTICE:</strong> This draft was officially reviewed, modified, and finalized by the Department Head prior to system broadcast.</div>`
      : '';

    const attachmentNotice =
      memo.attachmentPaths && memo.attachmentPaths.length > 0
        ? `
          <div style="margin-top:20px;border:1px solid #000;padding:12px;page-break-inside:avoid;">
            <div style="font-weight:bold;margin-bottom:10px;text-decoration:underline;">ATTACHED DOCUMENTS</div>
            <ol style="margin:0;padding-left:20px;">
              ${memo.attachmentPaths
                .map((path) => {
                  const fileName =
                    path.split('/').pop()?.replace(/^\d+-(\d+-)?/, '') || 'Unnamed Attachment';
                  return `<li style="margin-bottom:4px;">${fileName}</li>`;
                })
                .join('')}
            </ol>
            <div style="margin-top:10px;font-size:11px;color:#555;">Total Attachments: ${memo.attachmentPaths.length}</div>
          </div>
        `
        : '';

    // 📋 Dispatch Matrix Rows with Closed By info
    const dispatchMatrixRows =
      memo.recipients && memo.recipients.length > 0
        ? memo.recipients
            .map((rec) => {
              const rawDate =
                rec.respondedAt || rec.deniedAt || rec.acknowledgedAt || rec.processedAt || rec.closedAt;
              const formattedTimestamp = rawDate ? new Date(rawDate).toLocaleString() : null;
              
              // 🆕 Closed by information
              const closedByInfo = rec.status === 'CLOSED' && rec.closedByName
                ? `<div style="font-size:10px;color:#666;margin-top:2px;border-left:2px solid #666;padding-left:5px;"><b>CLOSED BY:</b> ${rec.closedByName}</div>`
                : '';
              
              return `
              <tr style="border-bottom:1px dashed #000;page-break-inside:avoid;">
                <td style="padding:10px 4px;font-weight:bold;vertical-align:top;">${rec.departmentName}</td>
                <td style="padding:10px 4px;vertical-align:top;">
                  <span style="padding:2px 6px;border:1px solid #000;font-size:12px;font-weight:bold;display:inline-block;background-color:${rec.status === 'CLOSED' ? '#e6f7e6' : rec.status === 'DENIED' ? '#ffe6e6' : 'transparent'};">${rec.status}</span>
                </td>
                <td style="padding:10px 4px;font-size:13px;vertical-align:top;word-break:break-word;">
                  <div style="font-weight:500;margin-bottom:6px;white-space:pre-wrap;">${rec.feedbackNote || '--'}</div>
                  ${formattedTimestamp ? `<div style="font-size:11px;color:#444;margin-top:4px;border-left:2px solid #000;padding-left:5px;"><b>TIMESTAMP:</b> ${formattedTimestamp}</div>` : ''}
                  ${closedByInfo}
                </td>
              </tr>
            `;
            })
            .join('')
        : `<tr><td colspan="3" style="text-align:center;padding:15px;color:#000;border-bottom:1px dashed #000;">No recipient records found.</td></tr>`;

    const dispatchMatrixTable = `
      <div style="margin-top:40px;page-break-inside:avoid;">
        <div style="font-weight:bold;margin-bottom:10px;text-decoration:underline;font-size:14px;">DISPATCH ROUTE TRACKING MATRIX</div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;text-align:left;font-family:monospace;table-layout:fixed;">
          <thead>
            <tr style="border-bottom:2px solid #000;font-weight:bold;">
              <th style="padding:6px 4px;width:20%;">DEPARTMENT</th>
              <th style="padding:6px 4px;width:18%;">STATUS</th>
              <th style="padding:6px 4px;width:62%;">REMARKS & TRANSACTION TIMESTAMP</th>
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
            body { font-family: monospace; line-height: 1.6; padding: 40px; color: #000; font-size: 14px; }
            .header { text-align: center; margin-bottom: 30px; font-weight: bold; font-size: 18px; letter-spacing: 1px; }
            .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
            .meta-table td { padding: 6px 0; vertical-align: top; }
            .meta-label { width: 140px; font-weight: bold; }
            .content-box { border-top: 2px dashed #000; border-bottom: 2px dashed #000; padding: 25px 0; margin-bottom: 30px; white-space: pre-wrap; font-size: 15px; }
            @media print {
              tr { page-break-inside: avoid !important; }
            }
          </style>
        </head>
        <body>
          <div class="header">INTERNAL OFFICE MEMORANDUM<br>==========================</div>
          <table class="meta-table">
            <tr><td class="meta-label">REF ID:</td><td><strong>${memo.referenceId || 'DRAFT (PENDING APPROVAL)'}</strong></td></tr>
            <tr><td class="meta-label">DATE CREATED:</td><td>${new Date(memo.createdAt).toLocaleString()}</td></tr>
            <tr><td class="meta-label">FROM (SENDER):</td><td>${memo.senderName} (${memo.senderDept}) ${memo.isRevisedByHead ? '[Amended by Head]' : ''}</td></tr>
            <tr><td class="meta-label">TO (TARGET):</td><td>${recipientDepts}</td></tr>
            <tr><td class="meta-label">PRIORITY:</td><td>[${memo.priority}]</td></tr>
            <tr><td class="meta-label">PURPOSE:</td><td>${memo.purpose || 'N/A'}</td></tr>
            <tr><td class="meta-label">SUBJECT:</td><td><strong>${memo.subject}</strong></td></tr>
          </table>
          
          ${revisionNotice}
          
          <div class="content-box">${memo.content.replace(/\n/g, '<br>')}</div>
          
          ${attachmentNotice}
          
          ${dispatchMatrixTable}
          
          <div style="margin-top:60px;font-size:11px;text-align:center;color:#555;">-- System Generated Document --</div>
          
          <script>
            window.onload = function() { window.print(); };
            window.onafterprint = function() { window.close(); };
          <\/script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // ---- Render helper for memo cards ----
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
              isDepartmentHead={isDepartmentHead}
              processOICAllowance={processOICAllowance}
              threadCount={threadCount}
              onReply={handleReplyClick}
              onPrint={handlePrintMemo}
              onViewThread={handleViewThread}
              onExpand={handleExpandNoteOpen}
              onSuperEdit={triggerSuperEditReview}
              triggerActionPasswordCheck={triggerActionPasswordCheck}
              allMemos={memos}
            />
          );
        })}
      </SimpleGrid>
    );
  };

  // ---- Main render ----
  return (
    <Container size="xl" py="lg" pos="relative">
      <LoadingOverlay visible={pageLoading} zIndex={1000} overlayProps={{ radius: 'sm', blur: 2 }} />

      <Card withBorder radius="lg" p="xl" shadow="sm">
        <Group justify="space-between" align="center" mb="xl">
          <Stack gap={2}>
            <Title order={2} fw={800} lts="-0.5px">
              Inter-office Memorandum Workspace
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
          </Group>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onChange={handleTabChange} radius="md" variant="outline">
          <Tabs.List mb="lg">
            {isAdminOrSuper && (
              <Tabs.Tab value="all_memos" leftSection={<IconLayersIntersect size={15} />}>
                All System Memos Ledger{' '}
                <Badge size="xs" variant="light" ml={6}>{allMemosLedgerList.length}</Badge>
              </Tabs.Tab>
            )}
            {isDepartmentHead && (
              <Tabs.Tab value="approval" leftSection={<IconThumbUp size={15} />}>
                For Approval (Staff Drafts){' '}
                <Badge size="xs" variant="light" ml={6}>{forApprovalMemos.length}</Badge>
              </Tabs.Tab>
            )}
            {!isAdminOrSuper && (
              <>
                <Tabs.Tab value="inbox" leftSection={<IconInbox size={15} />}>
                  Incoming Memos{' '}
                  <Badge size="xs" variant="light" ml={6}>{incomingMemos.length}</Badge>
                </Tabs.Tab>
                <Tabs.Tab value="action_board" leftSection={<IconPlayerPlay size={15} />}>
                  Action Board Workspace{' '}
                  <Badge size="xs" variant="light" ml={6}>{actionBoardMemos.length}</Badge>
                </Tabs.Tab>
                <Tabs.Tab value="sent" leftSection={<IconSend size={15} />}>
                  Sent Ledger{' '}
                  <Badge size="xs" variant="light" ml={6}>{sentMemos.length}</Badge>
                </Tabs.Tab>
              </>
            )}
            <Tabs.Tab value="closed" leftSection={<IconCircleCheck size={15} />}>
              Archive / Resolved Logs{' '}
              <Badge size="xs" variant="light" ml={6}>{resolvedMemos.length}</Badge>
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="all_memos">
            <Alert icon={<IconInfoCircle size={16} />} title="System Administrator Global Ledger View" color="blue" mb="md" radius="md">
              Authorized view only. Tracks every operational transactional memorandum sequence regardless of origin status blocks.
              <br /><br />
              Mga otorisadong tao lamang ang maaaring makakita nito. Binabantayan nito ang lahat ng mga memorandum na pumasok sa NCST E-Forms.
            </Alert>
            {renderMemoCards(getFilteredMemos(allMemosLedgerList))}
          </Tabs.Panel>

          <Tabs.Panel value="approval">
            <Alert icon={<IconInfoCircle size={16} />} title="Super Editor & Approval Command Queue" color="orange" mb="md" radius="md">
              Draft memorandum formulated by department staff. As Department Head, you can click <b><i>Review & Approve</i></b> to modify mistakes or directly finalize contents.
              <br /><br />
              Makikita rito ang mga memorandum na ginawa ng mga staff sa iyong departamento. Maaaring mong pindutin ang <b><i>Review & Approve</i></b> para may ibahin o ayusin bago tuluyang aprubahan.
            </Alert>
            {renderMemoCards(getFilteredMemos(forApprovalMemos), true)}
          </Tabs.Panel>

          <Tabs.Panel value="inbox">
            <Alert icon={<IconInfoCircle size={16} />} title="Incoming External Inbound Queue" color="teal" mb="md" radius="md">
              Incoming memorandums routed by external entities. Requires Department Head authentication to acknowledge and shift to the public Action Board.
              <br /><br />
              Mga memorandum na galing sa ibang mga departmento na aprubado na ng kanilang Department Head. I-<b><i>Acknowledge</i></b> para mapunta sa Action Board Workspace para aksyunan ng kahit sino sa inyong departamento.
            </Alert>
            {renderMemoCards(getFilteredMemos(incomingMemos))}
          </Tabs.Panel>

          <Tabs.Panel value="action_board">
            <Alert icon={<IconInfoCircle size={16} />} title="Departmental Action Board (Public Staff View)" color="indigo" mb="md" radius="md">
              Memorandums acknowledged by management. <b><i>Visible to all department members</i></b> to collaborate, process, and address.
              <br /><br />
              Mga memorandum na tinaggap at kinilala ng Department Head. <b><i>Kita ng lahat ng mga myembro ng departamento</i></b> para ma-proseso o aksyunan.
            </Alert>
            {renderMemoCards(getFilteredMemos(actionBoardMemos))}
          </Tabs.Panel>

          <Tabs.Panel value="sent">
            <Alert icon={<IconInfoCircle size={16} />} title="Dispatched Ledger Log" color="gray" mb="md" radius="md">
              Historical ledger of all approved and successfully transmitted documents signed from this department node.
              <br /><br />
              Talaan ng lahat ng ipinadalang memorandum ng departamentong ito.
            </Alert>
            {renderMemoCards(getFilteredMemos(sentMemos))}
          </Tabs.Panel>

          <Tabs.Panel value="closed">
            <Alert icon={<IconInfoCircle size={16} />} title="Archived Records Directory" color="green" mb="md" radius="md">
              Archived historical repository containing fully responded operations or structurally denied state documents.
              <br /><br />
              Koleksyon ng lahat ng mga na-respondehan at tinanggihang memorandum.
            </Alert>
            {renderMemoCards(getFilteredMemos(resolvedMemos))}
          </Tabs.Panel>
        </Tabs>
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
        isDepartmentHead={isDepartmentHead}
        processOICAllowance={processOICAllowance}
        onPrint={handlePrintMemo}
        triggerActionPasswordCheck={triggerActionPasswordCheck}
      />

      <PasswordGateModal
        opened={passModalOpened}
        onClose={closePassModal}
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
        subject={headEditSubject}
        setSubject={setHeadEditSubject}
        content={headEditContent}
        setContent={setHeadEditContent}
        retainedAttachments={retainedAttachments}
        setRetainedAttachments={setRetainedAttachments}
        newAttachments={headNewAttachments}
        setNewAttachments={setHeadNewAttachments}
        confirmPassword={confirmPassword}
        setConfirmPassword={setConfirmPassword}
        passError={passError}
        submitting={submitting}
        onSubmit={handleSuperEditAndApproveSubmit}
      />

      {/* Thread Timeline Modal (kept inline) */}
      <Modal opened={threadModalOpened} onClose={closeThreadModal} title="📜 Inter-office Document Thread History" size="lg" radius="md">
        <Box p="md">
          {activeThreadMemos.length === 0 ? (
            <Loader size="sm" />
          ) : (
            <Timeline active={activeThreadMemos.length - 1} bulletSize={24} lineWidth={2}>
              {activeThreadMemos.map((tMemo) => (
                <Timeline.Item
                  key={tMemo.id}
                  bullet={<IconMessageReply size={12} />}
                  title={
                    <Group justify="space-between" w="100%">
                      <Group gap="xs">
                        <Text size="sm" fw={700}>
                          {tMemo.referenceId || 'DRAFT'} - {tMemo.subject}
                        </Text>
                        {tMemo.isRevisedByHead && (
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