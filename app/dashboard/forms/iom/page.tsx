'use client';

import { useState, useEffect } from 'react';
import { useForm } from '@mantine/form';
import { useDisclosure } from '@mantine/hooks';
import { 
  IconMessageReply, 
  IconPlus, 
  IconInbox, 
  IconCircleCheck, 
  IconCheck,
  IconSend,
  IconGitBranch,
  IconFileCheck,
  IconThumbUp,
  IconPrinter,
  IconLayersIntersect,
  IconProgress,
  IconPlayerPlay,
  IconLock,
  IconInfoCircle,
  IconEdit,
  IconDownload
} from '@tabler/icons-react';
import { 
  TextInput, 
  Textarea, 
  Select, 
  MultiSelect, 
  Button, 
  Card, 
  Title, 
  Container, 
  Stack,
  Group,
  Text,
  Modal,
  SimpleGrid,
  Badge,
  Tabs,
  Loader,
  Divider,
  PasswordInput,
  Timeline,
  UnstyledButton,
  Box,
  Alert,
  FileInput
} from '@mantine/core';

export type Priority = 'ROUTINE' | 'URGENT' | 'RUSH';
export type Purpose = 'FYI' | 'SIGNATURE' | 'ACTION' | 'COMMENTS' | 'APPROVAL' | 'REQUEST';
export type MemoStatus = 'FOR_APPROVAL' | 'PENDING' | 'ACKNOWLEDGED' | 'PROCESSING' | 'DENIED' | 'RESPONDED';

export interface MemoRecipientStatus {
  id: string;
  memoId: string;
  departmentName: string;
  status: MemoStatus;
  acknowledgedBy: string | null;
  acknowledgedAt: string | Date | null;
  processedBy?: string | null;
  processedAt?: string | Date | null;
  deniedBy?: string | null;
  deniedAt?: string | Date | null;
  respondedAt: string | Date | null;
  feedbackNote?: string | null;
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
  status: 'FOR_APPROVAL' | 'APPROVED';
  createdAt: string | Date;
  deadlineAt: string | Date | null;
  parentMemoId: string | null;
  rootMemoId: string | null;
  isRevisedByHead?: boolean; 
  attachmentPath?: string | null; // 🎯 Idinagdag natin ang path field
  recipients?: MemoRecipientStatus[];
}

interface Department {
  id: string;
  code: string;
  name?: string;
}

interface UserContext {
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

export default function IOMDashboardPage() {
  const [opened, { open, close }] = useDisclosure(false);
  const [passModalOpened, { open: openPassModal, close: closePassModal }] = useDisclosure(false);
  const [threadModalOpened, { open: openThreadModal, close: closeThreadModal }] = useDisclosure(false);
  const [expandNoteOpened, { open: openExpandNoteModal, close: closeExpandNoteModal }] = useDisclosure(false);
  const [superEditOpened, { open: openSuperEditModal, close: closeSuperEditModal }] = useDisclosure(false);
  
  const [submitting, setSubmitting] = useState(false);
  const [departments, setDepartments] = useState<{ value: string; label: string }[]>([]);
  const [loadingDepts, setLoadingDepts] = useState(true);
  const [memos, setMemos] = useState<Memo[]>([]);
  const [loadingMemos, setLoadingMemos] = useState(true);
  const [currentUser, setCurrentUser] = useState<UserContext | null>(null);

  const [pendingAction, setPendingAction] = useState<{ type: 'CREATE' | 'ACKNOWLEDGE' | 'START_PROCESSING' | 'DENY' | 'RESOLVE' | 'APPROVE_MEMO'; data: Record<string, unknown> } | null>(null);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passError, setPassError] = useState('');
  const [activeThreadMemos, setActiveThreadMemos] = useState<Memo[]>([]);
  const [feedbackNote, setFeedbackNote] = useState('');
  const [selectedMemoForExpand, setSelectedMemoForExpand] = useState<Memo | null>(null);

  const [headEditSubject, setHeadEditSubject] = useState('');
  const [headEditContent, setHeadEditContent] = useState('');
  const [headSelectedMemoId, setHeadSelectedMemoId] = useState('');

  const form = useForm({
    initialValues: {
      subject: '',
      content: '',
      priority: 'ROUTINE' as Priority,
      purpose: 'FYI' as Purpose,
      targetDepts: [] as string[],
      parentMemoId: null as string | null,
      rootMemoId: null as string | null,
      memoFile: null as File | null, // 🎯 File State
    },
    validate: {
      subject: (value) => (value.length < 2 ? 'Subject header is required' : null),
      content: (value) => (value.length < 5 ? 'Content of memo is too short' : null),
      targetDepts: (value) => (value.length === 0 ? 'Select a recipient department' : null),
    },
  });

  const fetchMemos = () => {
    fetch('../../../api/memos')
      .then((res) => res.json())
      .then((data) => setMemos(data || []))
      .catch((err) => console.error('Failed to load memos:', err))
      .finally(() => setLoadingMemos(false));
  };

  useEffect(() => {
    const initializeDashboard = async () => {
      try {
        const authRes = await fetch('../../../api/auth/me');
        const authData = await authRes.json();
        if (authData.success) {
          setCurrentUser(authData.data);
        }

        const deptRes = await fetch('../../../api/department/get');
        const deptData = await deptRes.json();
        if (deptData.success && Array.isArray(deptData.data)) {
          const mappedDepts = deptData.data.map((dept: Department) => ({
            value: dept.code,
            label: dept.name ? `${dept.code} - ${dept.name}` : dept.code
          }));
          setDepartments(mappedDepts);
        }
      } catch (err) {
        console.error('Initialization error:', err);
      } finally {
        setLoadingDepts(false);
      }
    };

    initializeDashboard();
    fetchMemos();
  }, []);

  const isCurrentlyOIC = () => {
    if (!currentUser?.oic_start || !currentUser?.oic_end) return false;
    const now = new Date().getTime();
    const start = new Date(currentUser.oic_start).getTime();
    const end = new Date(currentUser.oic_end).getTime();
    return now >= start && now <= end;
  };

  const activeDepartment = currentUser?.departmentCode || "";
  const processOICAllowance = isCurrentlyOIC();
  const userRole = currentUser?.role?.toUpperCase() || "";
  
  const isAdminOrSuper = ['ADMIN', 'SUPERUSER', 'Admin', 'SuperUser'].includes(userRole);
  const isDepartmentHead = ['DEPARTMENTHEAD', 'DepartmentHead', 'OIC'].includes(userRole);

  const handlePrintMemo = (memo: Memo) => {
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) return;
    const recipientDepts = memo.recipients?.map(r => `${r.departmentName} [${r.status}]`).join(', ') || 'None';
    
    const revisionNotice = memo.isRevisedByHead 
      ? `<div style="margin-top: 15px; padding: 10px; border: 1px solid #70438a; background-color: #fcf8ff; font-size: 12px; color: #70438a;"><strong>⚠️ AMENDMENT NOTICE:</strong> This draft was officially reviewed, modified, and finalized by the Department Head prior to system broadcast.</div>`
      : '';

    const attachmentNotice = memo.attachmentPath
      ? `<div style="margin-top: 10px; font-size: 12px; color: #555;"><em>* This document contains a digital attachment in the system.</em></div>`
      : '';

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
          <div style="margin-top: 60px; font-size: 11px; text-align: center; color: #555;">-- System Generated Document --</div>
          <script>
            window.onload = function() { window.print(); };
            window.onafterprint = function() { window.close(); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const allMemosLedgerList = isAdminOrSuper ? memos : [];
  const forApprovalMemos = memos.filter((memo) => memo.senderDept === activeDepartment && memo.status === 'FOR_APPROVAL');
  const incomingMemos = memos.filter((memo) => {
    if (memo.status === 'FOR_APPROVAL') return false; 
    return memo.recipients?.some((r) => (r.departmentName === activeDepartment || processOICAllowance) && r.status === 'PENDING');
  });
  const actionBoardMemos = memos.filter((memo) => {
    if (memo.status === 'FOR_APPROVAL') return false;
    return memo.recipients?.some((r) => (r.departmentName === activeDepartment || processOICAllowance) && ['ACKNOWLEDGED', 'PROCESSING'].includes(r.status));
  });
  const sentMemos = memos.filter((memo) => memo.senderDept === activeDepartment && memo.status === 'APPROVED');
  const resolvedMemos = memos.filter((memo) => {
    if (isAdminOrSuper) {
      return memo.recipients?.some((r) => ['RESPONDED', 'DENIED'].includes(r.status));
    }
    const isRecipientResolved = memo.recipients?.some((r) => 
      (r.departmentName === activeDepartment || processOICAllowance) && ['RESPONDED', 'DENIED'].includes(r.status)
    );
    const isSenderResolved = memo.senderDept === activeDepartment && 
      memo.recipients?.every((r) => ['RESPONDED', 'DENIED'].includes(r.status));
    return isRecipientResolved || isSenderResolved;
  });

  const triggerActionPasswordCheck = (type: 'CREATE' | 'ACKNOWLEDGE' | 'START_PROCESSING' | 'DENY' | 'RESOLVE' | 'APPROVE_MEMO', data: Record<string, unknown>) => {
    setConfirmPassword('');
    setPassError('');
    setFeedbackNote('');
    setPendingAction({ type, data });
    openPassModal();
  };

  const triggerSuperEditReview = (memo: Memo) => {
    setHeadSelectedMemoId(memo.id);
    setHeadEditSubject(memo.subject);
    setHeadEditContent(memo.content);
    setConfirmPassword('');
    setPassError('');
    openSuperEditModal();
  };

  const handlePasswordGateVerificationSubmit = async () => {
    if (!confirmPassword) {
      setPassError('Password is required.');
      return;
    }
    if (pendingAction?.type === 'DENY' && (!feedbackNote || feedbackNote.trim() === "")) {
      setPassError('Please include a reason of rejection.');
      return;
    }

    setSubmitting(true);
    setPassError('');

    try {
      if (pendingAction?.type === 'CREATE') {
        const formData = new FormData();
        
        Object.entries(pendingAction.data).forEach(([key, value]) => {
          if (key !== 'memoFile' && value !== null && value !== undefined) {
            if (Array.isArray(value)) {
              value.forEach(v => formData.append(key, v));
            } else {
              formData.append(key, String(value));
            }
          }
        });

        formData.append('password', confirmPassword);

        // 📂 Optional Attachment
        const fileToUpload = form.values.memoFile;
        if (fileToUpload) {
          formData.append('memoAttachment', fileToUpload);
        }

        const response = await fetch('../../../api/memos', {
          method: 'POST',
          body: formData, 
        });

        if (response.ok) {
          alert(isDepartmentHead || isAdminOrSuper ? 'Memo generated and dispatched to recipients!' : 'Draft memorandum passed to Department Head for approval!');
          form.reset(); close(); closePassModal(); fetchMemos();
        } else {
          const resData = await response.json(); 
          setPassError(resData.message || 'Incorrect credentials.');
        }
      } else {
        const actionMap: Record<string, string> = {
          'ACKNOWLEDGE': 'ACKNOWLEDGE',
          'START_PROCESSING': 'START_PROCESSING',
          'RESOLVE': 'RESOLVE',
          'DENY': 'DENY',
          'APPROVE_MEMO': 'APPROVE'
        };

        const response = await fetch('../../../api/memos', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            memoId: pendingAction?.data?.memoId, 
            departmentName: pendingAction?.data?.departmentName || null,
            action: actionMap[pendingAction?.type || ''], 
            password: confirmPassword, 
            feedbackNote,
            isSenderClosing: pendingAction?.data?.isSenderClosing || false
          }),
        });

        if (response.ok) { 
          alert('State Transition Document Saved!'); 
          closePassModal(); 
          fetchMemos(); 
        } else { 
          const resData = await response.json();
          setPassError(resData.message || 'Security signature failed.'); 
        }
      }
    } catch (err) {
      console.error(err);
      setPassError('System infrastructure timeout.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSuperEditAndApproveSubmit = async () => {
    if (!confirmPassword) {
      setPassError('Signature password is required.');
      return;
    }
    setSubmitting(true);
    setPassError('');

    try {
      const response = await fetch('../../../api/memos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memoId: headSelectedMemoId,
          action: 'APPROVE',
          password: confirmPassword,
          subject: headEditSubject,
          content: headEditContent
        }),
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
      memoFile: null
    });
    open();
  };

  const handleViewThread = (selectedMemo: Memo) => {
    const rootId = selectedMemo.rootMemoId || selectedMemo.id;
    const filtered = memos.filter(m => m.rootMemoId === rootId || m.id === rootId);
    const sortedThread = [...filtered].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    setActiveThreadMemos(sortedThread);
    openThreadModal();
  };

  const handleExpandNoteOpen = (memo: Memo) => {
    setSelectedMemoForExpand(memo);
    openExpandNoteModal();
  };

  const renderMemoCards = (memoList: Memo[], isApprovalTab = false) => {
    if (memoList.length === 0) {
      return <Text c="dimmed" ta="center" py="xl" w="100%">No documents logged.</Text>;
    }

    return (
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
        {memoList.map((memo: Memo) => {
          const amISender = memo.senderId === currentUser?.id;
          const myRecipientInfo = memo.recipients?.find(r => r.departmentName === activeDepartment);
          
          const processingRecipients = memo.recipients?.filter(r => r.status === 'PROCESSING') || [];
          const isBeingProcessed = processingRecipients.length > 0; 
          
          const isMemoResolvedForMe = ['RESPONDED', 'DENIED'].includes(myRecipientInfo?.status || '');
          const isAllResolved = memo.senderId === currentUser?.id && memo.recipients?.every(r => ['RESPONDED', 'DENIED'].includes(r.status));
          const disableReply = !isAdminOrSuper && (isMemoResolvedForMe || isAllResolved || memo.status === 'FOR_APPROVAL');
          
          let badgeText: string = memo.priority;
          let badgeColor = 'blue';
          if (memo.priority === 'RUSH' && memo.deadlineAt && !isMemoResolvedForMe && !isAllResolved) {
            const diffTime = new Date(memo.deadlineAt).getTime() - Date.now();
            const MathCeilDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            badgeText = MathCeilDays < 0 ? 'OVERDUE' : `${MathCeilDays} days left`;
            badgeColor = MathCeilDays < 0 ? 'red' : 'orange';
          } else if (memo.priority === 'RUSH') { badgeText = 'RUSH'; badgeColor = 'gray'; }
          else if (memo.priority === 'URGENT') { badgeColor = (isMemoResolvedForMe || isAllResolved) ? 'gray' : 'pink'; }

          const rootIdForThread = memo.rootMemoId || memo.id;
          const threadCount = memos.filter(m => m.rootMemoId === rootIdForThread || m.id === rootIdForThread).length;
          const hasThread = threadCount > 1; // Lalabas lang kapag may 2 or more memos na sa thread

          return (
            <Card 
              key={memo.id} 
              withBorder={!isBeingProcessed} 
              radius="md" 
              shadow={isBeingProcessed ? "md" : "sm"}
              style={{
                border: isBeingProcessed 
                  ? '2px solid var(--mantine-color-orange-filled)' 
                  : '1px solid light-dark(var(--mantine-color-gray-3), var(--mantine-color-dark-4))',
                boxShadow: isBeingProcessed 
                  ? '0 0 12px rgba(255, 165, 0, 0.4)' 
                  : undefined,
                display: 'flex',
                flexDirection: 'column',
                minHeight: '420px',
                padding: 0,
                transition: 'all 0.2s ease',
              }}
            >
              <UnstyledButton 
                onClick={() => handleExpandNoteOpen(memo)} 
                style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '20px', textAlign: 'left' }}
              >
                <Group justify="space-between" w="100%" mb="xs">
                  <Group gap="xs" onClick={(e) => e.stopPropagation()}> 
                    <Text ff="monospace" fw={700} c="blue" size="sm">
                      {memo.referenceId || 'DRAFT-DPT'}
                    </Text>

                    {memo.attachmentPath && (
                      <Badge color="indigo" variant="filled" size="xs" leftSection={<IconDownload size={12} />}>
                        FILE ATTACHED
                      </Badge>
                    )}

                    {amISender && <Badge color="gray" variant="light" size="xs">Ours</Badge>}
                    {memo.status === 'FOR_APPROVAL' && <Badge color="orange" variant="filled" size="xs">Draft/For Review</Badge>}
                    
                    {/* Tago ang "In Thread" badge kapag mag-isa lang ang memo */}
                    {hasThread && (
                      <Badge 
                        color="teal" variant="outline" size="xs" leftSection={<IconGitBranch size={10} />} style={{ cursor: 'pointer' }}
                        onClick={(e) => { e.stopPropagation(); handleViewThread(memo); }}
                      >
                        In Thread
                      </Badge>
                    )}
                  </Group>
                  <Group gap="xs">
                    <Badge color="cyan" variant="light" size="xs">{memo.purpose}</Badge>
                    <Badge color={badgeColor} variant="filled" size="xs">{badgeText}</Badge>
                  </Group>
                </Group>

                <Stack gap={4} my="xs" p="xs" w="100%" bg="light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-7))" style={{ borderRadius: '6px' }}>
                  <Text size="xs"><b>TO:</b> {memo.recipients?.map(r => r.departmentName).join(', ')}</Text>
                  <Group gap={6} align="center">
                    <Text size="xs"><b>FROM:</b> {memo.senderName} ({memo.senderDept})</Text>
                    {memo.isRevisedByHead && (
                      <Badge color="grape" variant="light" size="9px" radius="sm">Amended by Head</Badge>
                    )}
                  </Group>
                  <Text size="10px" c="dimmed"><b>DATE:</b> {new Date(memo.createdAt).toLocaleString()}</Text>

                  {isBeingProcessed && processingRecipients.map((pr) => pr.processedBy && (
                    <Group gap={4} mt={2} key={pr.id}>
                      <Badge color="orange" variant="light" size="xs" style={{ textTransform: 'none', letterSpacing: 0 }}>
                        ⚙️ {pr.departmentName} processing by: <b>{pr.processedBy}</b>
                      </Badge>
                    </Group>
                  ))}
                </Stack>

                <Text fz="sm" fw={700} mt="xs" w="100%" lineClamp={1}>
                  SUBJECT: {memo.subject}
                </Text>
                
                <Divider my="xs" w="100%" style={{ opacity: 0.5 }} />
                <Text fz="sm" c="dimmed" lineClamp={4} style={{ whiteSpace: 'pre-wrap' }}>
                  {memo.content}
                </Text>
              </UnstyledButton>

              <Group 
                justify="space-between" p="md" 
                style={{ 
                  borderTop: '1px solid light-dark(var(--mantine-color-gray-2), var(--mantine-color-dark-5))',
                  backgroundColor: 'light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-8))',
                  marginTop: 'auto'
                }}
              >
                <Group gap="xs">
                  {/* Tago rin ang button na 'History Thread' kapag wala pang karugtong */}
                  {hasThread && (
                    <Button size="xs" variant="outline" color="teal" leftSection={<IconGitBranch size={13} />} onClick={() => handleViewThread(memo)}>
                      History Thread
                    </Button>
                  )}
                  <Button size="xs" variant="outline" color="gray" leftSection={<IconPrinter size={13} />} onClick={() => handlePrintMemo(memo)}>
                    Print
                  </Button>
                </Group>

                <Group gap="xs">
                  {isApprovalTab && (isDepartmentHead || isAdminOrSuper) && (
                    <Button size="xs" color="indigo" leftSection={<IconEdit size={13} />} onClick={() => triggerSuperEditReview(memo)}>
                      Review & Approve
                    </Button>
                  )}
                  
                  {isDepartmentHead && myRecipientInfo?.status === 'PENDING' && !isApprovalTab && (
                    <Group gap={4}>
                      <Button size="xs" color="green" leftSection={<IconCheck size={13} />} onClick={() => triggerActionPasswordCheck('ACKNOWLEDGE', { memoId: memo.id, departmentName: activeDepartment })}>
                        Acknowledge
                      </Button>
                      <Button size="xs" color="red" onClick={() => triggerActionPasswordCheck('DENY', { memoId: memo.id, departmentName: activeDepartment })}>
                        Deny Inbound
                      </Button>
                    </Group>
                  )}
                  {myRecipientInfo?.status === 'ACKNOWLEDGED' && (
                    <Button size="xs" color="orange" leftSection={<IconPlayerPlay size={13} />} onClick={() => triggerActionPasswordCheck('START_PROCESSING', { memoId: memo.id, departmentName: activeDepartment })}>
                      Process
                    </Button>
                  )}

                  {amISender && !isAllResolved && memo.status !== 'FOR_APPROVAL' && (
                    <Button size="xs" color="teal" leftSection={<IconFileCheck size={13} />} onClick={() => triggerActionPasswordCheck('RESOLVE', { memoId: memo.id, isSenderClosing: true })}>
                      Resolve & Close
                    </Button>
                  )}
                  
                  {(() => {
                    const currentUserName = `${currentUser?.fname} ${currentUser?.lname}`;
                    const isAcknowledged = myRecipientInfo?.status === 'ACKNOWLEDGED';
                    const isMismongNagProcess = myRecipientInfo?.status === 'PROCESSING' && myRecipientInfo?.processedBy === currentUserName;

                    if (isAcknowledged || isMismongNagProcess) {
                      return (
                        <Group gap={4}>
                          <Button size="xs" color="green" onClick={() => triggerActionPasswordCheck('RESOLVE', { memoId: memo.id, departmentName: activeDepartment })}>
                            Complete
                          </Button>
                          <Button size="xs" color="red" variant="light" onClick={() => triggerActionPasswordCheck('DENY', { memoId: memo.id, departmentName: activeDepartment })}>
                            Deny
                          </Button>
                        </Group>
                      );
                    }
                    return null;
                  })()}
                  
                  <Button 
                    size="xs" variant={disableReply ? "subtle" : "light"} color={disableReply ? "gray" : "blue"} disabled={disableReply}
                    leftSection={<IconMessageReply size={13} />} onClick={() => handleReplyClick(memo)}
                  >
                    Reply
                  </Button>
                </Group>
              </Group>
            </Card>
          );
        })}
      </SimpleGrid>
    );
  };

  return (
    <Container size="xl" py="lg">
      <Card withBorder radius="lg" p="xl" shadow="sm">
        <Group justify="space-between" align="center" mb="xl">
          <Stack gap={2}>
            <Title order={2} fw={800} lts="-0.5px">Inter-office Memorandum Workspace</Title>
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

        <Tabs defaultValue={isAdminOrSuper ? "all_memos" : (isDepartmentHead ? "approval" : "inbox")} radius="md" variant="outline">
          <Tabs.List mb="lg">
            {isAdminOrSuper && (
              <Tabs.Tab value="all_memos" leftSection={<IconLayersIntersect size={15} />}>
                All System Memos Ledger <Badge size="xs" variant="light" ml={6}>{allMemosLedgerList.length}</Badge>
              </Tabs.Tab>
            )}

            {isDepartmentHead && (
              <Tabs.Tab value="approval" leftSection={<IconThumbUp size={15} />}>
                For Approval (Staff Drafts) <Badge size="xs" variant="light" ml={6}>{forApprovalMemos.length}</Badge>
              </Tabs.Tab>
            )}

            {!isAdminOrSuper && (
              <>
                <Tabs.Tab value="inbox" leftSection={<IconInbox size={15} />}>
                  Incoming Memos <Badge size="xs" variant="light" ml={6}>{incomingMemos.length}</Badge>
                </Tabs.Tab>
                <Tabs.Tab value="action_board" leftSection={<IconPlayerPlay size={15} />}>
                  Action Board Workspace <Badge size="xs" variant="light" ml={6}>{actionBoardMemos.length}</Badge>
                </Tabs.Tab>
                <Tabs.Tab value="sent" leftSection={<IconSend size={15} />}>
                  Sent Ledger <Badge size="xs" variant="light" ml={6}>{sentMemos.length}</Badge>
                </Tabs.Tab>
              </>
            )}

            <Tabs.Tab value="resolved" leftSection={<IconCircleCheck size={15} />}>
              Archive / Resolved Logs <Badge size="xs" variant="light" ml={6}>{resolvedMemos.length}</Badge>
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="all_memos">
            <Alert icon={<IconInfoCircle size={16} />} title="System Administrator Global Ledger View" color="blue" mb="md" radius="md">
              Authorized view only. Tracks every operational transactional memorandum sequence regardless of origin status blocks.
            </Alert>
            {renderMemoCards(allMemosLedgerList)}
          </Tabs.Panel>

          <Tabs.Panel value="approval">
            <Alert icon={<IconInfoCircle size={16} />} title="Super Editor & Approval Command Queue" color="orange" mb="md" radius="md">
              Draft documents formulated by department staff. As Department Head, you can click <b><i>Review & Approve</i></b> to modify mistakes or directly finalize contents.
            </Alert>
            {renderMemoCards(forApprovalMemos, true)}
          </Tabs.Panel>

          <Tabs.Panel value="inbox">
            <Alert icon={<IconInfoCircle size={16} />} title="Incoming External Inbound Queue" color="teal" mb="md" radius="md">
              Incoming memos routed by external entities. Requires Department Head authentication to acknowledge and shift to the public Action Board.
            </Alert>
            {renderMemoCards(incomingMemos)}
          </Tabs.Panel>

          <Tabs.Panel value="action_board">
            <Alert icon={<IconInfoCircle size={16} />} title="Departmental Action Board (Public Staff View)" color="indigo" mb="md" radius="md">
              Documents acknowledged by management. <b><i>Visible to all department members</i></b> to collaborate, process, and address.
            </Alert>
            {renderMemoCards(actionBoardMemos)}
          </Tabs.Panel>

          <Tabs.Panel value="sent">
            <Alert icon={<IconInfoCircle size={16} />} title="Dispatched Ledger Log" color="gray" mb="md" radius="md">
              Historical ledger of all approved and successfully transmitted documents signed from this department node.
            </Alert>
            {renderMemoCards(sentMemos)}
          </Tabs.Panel>

          <Tabs.Panel value="resolved">
            <Alert icon={<IconInfoCircle size={16} />} title="Archived Records Directory" color="green" mb="md" radius="md">
              Archived historical repository containing fully responded operations or structurally denied state documents.
            </Alert>
            {renderMemoCards(resolvedMemos)}
          </Tabs.Panel>
        </Tabs>
      </Card>

      {/* CREATE MEMO MODAL */}
      <Modal opened={opened} onClose={close} title={form.values.parentMemoId ? "📝 Write Response Memo" : "📝 Construct New Memorandum"} size="lg" radius="md">
        <form onSubmit={form.onSubmit((values) => triggerActionPasswordCheck('CREATE', values))}>
          <Stack gap="md">
            <TextInput label="Subject Reference Header" placeholder="e.g., Request for IT Support Assessment" required {...form.getInputProps('subject')} />
            <SimpleGrid cols={2}>
              <Select label="Priority Level Flags" data={['ROUTINE', 'URGENT', 'RUSH']} {...form.getInputProps('priority')} />
              <Select label="Routing Core Purpose" data={['FYI', 'SIGNATURE', 'ACTION', 'COMMENTS', 'APPROVAL', 'REQUEST']} {...form.getInputProps('purpose')} />
            </SimpleGrid>
            <MultiSelect label="Target Recipient Departments" data={departments} placeholder="Select one or more departments" required disabled={!!form.values.parentMemoId} {...form.getInputProps('targetDepts')} />
            <Textarea label="Memorandum Body Content" placeholder="Type the core message here..." minRows={6} autosize required {...form.getInputProps('content')} />
            
            {/* 🎯 TAMA AT DIRETSAHANG FILE INPUT (WALANG DYNAMIC IMPORT) */}
            <FileInput 
              label="Optional Attachment Document (Memo/PDF/Image)" 
              placeholder="Choose file to upload (Optional)" 
              clearable
              accept="application/pdf,image/*"
              {...form.getInputProps('memoFile')}
            />

            <Group justify="flex-end" mt="md">
              <Button variant="light" color="gray" onClick={close}>Cancel</Button>
              <Button type="submit" loading={submitting} leftSection={<IconSend size={16} />}>Authorize & Transmit</Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* OPTION B: SUPER EDITOR MODAL FOR DEPT HEAD */}
      <Modal opened={superEditOpened} onClose={closeSuperEditModal} title={<Group gap="xs"><IconEdit size={18} color="indigo" /><Text fw={700}>Review, Edit & Authorize Dispatch</Text></Group>} size="lg" radius="md">
        <Stack gap="md">
          <Alert icon={<IconInfoCircle size={16} />} title="Super Editor System Control" color="indigo" radius="md">
            As Department Head, any inline edits made to the original subject or text below will flag the finalized memo as <Badge color="grape" size="xs" variant="filled">Amended by Head</Badge> across recipient trackers.
          </Alert>
          
          <TextInput label="Subject Reference Header" value={headEditSubject} onChange={(e) => setHeadEditSubject(e.currentTarget.value)} required />
          <Textarea label="Memorandum Body Content" value={headEditContent} onChange={(e) => setHeadEditContent(e.currentTarget.value)} minRows={6} autosize required />
          
          <Divider my="xs" label="Digital Verification Signature" labelPosition="center" />
          
          <PasswordInput label="Your Signature Security Password" placeholder="••••••••" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.currentTarget.value)} error={passError} />
          
          <Group justify="flex-end" mt="md">
            <Button variant="light" color="gray" onClick={closeSuperEditModal}>Cancel</Button>
            <Button color="indigo" loading={submitting} leftSection={<IconThumbUp size={16} />} onClick={handleSuperEditAndApproveSubmit}>
              Approve, Sign & Dispatch
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* PASSWORD INTEGRITY SIGNATURE GATE MODAL */}
      <Modal opened={passModalOpened} onClose={closePassModal} title={<Group gap="xs"><IconLock size={18} color="red" /><Text fw={700}>Security Signature Verification</Text></Group>} centered size="sm" radius="md">
        <Stack gap="sm">
          <Text size="xs" c="dimmed">Confirm transaction authorization status using your cryptography signing phrase key.</Text>
          {pendingAction?.type === 'DENY' && (
            <Textarea label="Return Reason (Required)" placeholder="Provide details on why this memo is being returned/denied..." required value={feedbackNote} onChange={(e) => setFeedbackNote(e.currentTarget.value)} />
          )}
          {pendingAction?.type === 'RESOLVE' && (
            <Textarea label="Resolution Notes / Remarks (Optional)" placeholder="Add closure details or comments..." value={feedbackNote} onChange={(e) => setFeedbackNote(e.currentTarget.value)} />
          )}
          <PasswordInput label="Signature Security Password" placeholder="••••••••" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.currentTarget.value)} error={passError} />
          <Button fullWidth color="red" loading={submitting} onClick={handlePasswordGateVerificationSubmit} mt="xs">
            Confirm Signature Authorization
          </Button>
        </Stack>
      </Modal>

      {/* HISTORICAL THREAD TIMELINE MODAL */}
      <Modal opened={threadModalOpened} onClose={closeThreadModal} title="📜 Inter-office Document Thread History" size="lg" radius="md">
        <Box p="md">
          {activeThreadMemos.length === 0 ? (
            <Loader size="sm" />
          ) : (
            <Timeline active={activeThreadMemos.length - 1} bulletSize={24} lineWidth={2}>
              {activeThreadMemos.map((tMemo: Memo) => (
                <Timeline.Item key={tMemo.id} bullet={<IconMessageReply size={12} />} title={
                  <Group justify="space-between" w="100%">
                    <Group gap="xs">
                      <Text size="sm" fw={700}>{tMemo.referenceId || "DRAFT"} - {tMemo.subject}</Text>
                      {tMemo.isRevisedByHead && <Badge color="grape" size="9px" radius="xs" variant="light">Amended</Badge>}
                    </Group>
                    <Badge size="xs" variant="light">{tMemo.priority}</Badge>
                  </Group>
                }>
                  <Text size="xs" c="dimmed" mt={2}>Sent by <b>{tMemo.senderName} ({tMemo.senderDept})</b> on {new Date(tMemo.createdAt).toLocaleString()}</Text>
                  
                  <UnstyledButton onClick={() => handleExpandNoteOpen(tMemo)} style={{ width: '100%', textAlign: 'left', marginTop: '8px' }}>
                    <Card withBorder p="sm" bg="light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-7))" radius="sm" style={{ cursor: 'pointer' }}>
                      <Text size="xs" lineClamp={3}>
                        {tMemo.content}
                      </Text>
                      <Text size="10px" color="blue" mt={4} ta="right">Click to view full content</Text>
                    </Card>
                  </UnstyledButton>
                </Timeline.Item>
              ))}
            </Timeline>
          )}
        </Box>
      </Modal>

      {/* EXPAND MEMO CONTENT DETAILS MODAL */}
      <Modal opened={expandNoteOpened} onClose={closeExpandNoteModal} title="📄 Full Memorandum Document Viewer" size="lg" radius="md">
        {selectedMemoForExpand && (
          <Stack gap="md">
            <Card withBorder p="md" bg="light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-8))">
              <SimpleGrid cols={2} spacing="xs">
                <Text size="xs"><b>Reference ID:</b> {selectedMemoForExpand.referenceId || 'DRAFT (Review Queue)'}</Text>
                <Text size="xs"><b>Date:</b> {new Date(selectedMemoForExpand.createdAt).toLocaleString()}</Text>
                <Group gap={6} align="center">
                  <Text size="xs"><b>From:</b> {selectedMemoForExpand.senderName} ({selectedMemoForExpand.senderDept})</Text>
                  {selectedMemoForExpand.isRevisedByHead && (
                    <Badge color="grape" size="xs" variant="light">Amended by Head</Badge>
                  )}
                </Group>
                <Text size="xs"><b>Purpose:</b> {selectedMemoForExpand.purpose}</Text>
              </SimpleGrid>
              
              {selectedMemoForExpand.isRevisedByHead && (
                <Alert color="grape" p="xs" mt="sm" icon={<IconInfoCircle size={14} />}>
                  Note: This operational document was modified and fine-tuned directly by the Department Head before final signing.
                </Alert>
              )}
              
              <Divider my="sm" />
              <Text size="sm" fw={700} mb="xs">SUBJECT: {selectedMemoForExpand.subject}</Text>
              <Text size="sm" style={{ whiteSpace: 'pre-wrap' }} c="dimmed">
                {selectedMemoForExpand.content}
              </Text>

              {/* 🎯 KUNG MAY ATTACHMENT YUNG MEMO, LILITAW ITONG DOWNLOAD BUTTON */}
              {selectedMemoForExpand.attachmentPath && (
                <>
                  <Divider my="md" />
                  <Text size="sm" fw={700} mb="xs">ATTACHED FILE:</Text>
                  <Button 
                    component="a" 
                    href={selectedMemoForExpand.attachmentPath} 
                    target="_blank" 
                    download
                    variant="light" 
                    color="blue" 
                    leftSection={<IconDownload size={16} />}
                  >
                    {/* Kukunin nito yung dulo ng path. Ex: /memos/file.pdf -> file.pdf */}
                    {selectedMemoForExpand.attachmentPath.split('/').pop()}
                  </Button>
                </>
              )}
            </Card>

            <Text size="xs" fw={700}>Route Recipients Dispatch Logs Matrix:</Text>
            <Stack gap={6}>
              {selectedMemoForExpand.recipients?.map((rec) => (
                <Group key={rec.id} justify="space-between" p="xs" style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: '6px' }}>
                  <Stack gap={2}>
                    <Text size="xs" fw={700}>{rec.departmentName}</Text>
                    {rec.feedbackNote && <Text size="11px" c="orange">Remarks: {rec.feedbackNote}</Text>}
                  </Stack>
                  <Badge 
                    color={rec.status === 'RESPONDED' ? 'green' : rec.status === 'DENIED' ? 'red' : rec.status === 'PROCESSING' ? 'orange' : 'gray'} 
                    variant="filled" 
                    size="xs"
                  >
                    {rec.status}
                  </Badge>
                </Group>
              ))}
            </Stack>

            <Group justify="flex-end" mt="md">
              <Button size="xs" variant="outline" color="gray" leftSection={<IconPrinter size={13} />} onClick={() => handlePrintMemo(selectedMemoForExpand)}>Print Document</Button>
              <Button size="xs" onClick={closeExpandNoteModal}>Close Window</Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Container>
  );
}