"use client";

import React, { useEffect, useState } from "react";
import {
  Table,
  Button,
  Group,
  Modal,
  ScrollArea,
  Text,
  Stack,
  Badge,
  Card,
  UnstyledButton,
  TextInput,
  Alert
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import {
  IconChevronDown,
  IconChevronUp,
  IconSearch,
  IconSelector,
  IconUserPlus,
  IconUserX,
  IconCalendarTime,
  IconInfoCircle
} from "@tabler/icons-react";

interface User {
  id: string;
  employee_id: string;
  email: string;
  fname: string;
  lname: string;
  role: string;
  departmentCode: string;
  branch: string;
  oic_start: string | null;
  oic_end: string | null;
}

type SortField = "employee_id" | "email" | "fname" | "lname" | "oic_start" | "oic_end";

// Helper helper function para laging "YYYY-MM-DD" ang format sa Philippine Time
const toManilaString = (
  dateInput: Date | string | null | undefined
): string => {
  if (!dateInput || dateInput === "null") return "";

  const d = new Date(dateInput);

  if (isNaN(d.getTime())) return "";

  return d.toLocaleDateString("en-CA", {
    timeZone: "Asia/Manila",
  });
};

function SortableHeader({
  children,
  sorted,
  reversed,
  onSort,
}: {
  children: React.ReactNode;
  sorted: boolean;
  reversed: boolean;
  onSort: () => void;
}) {
  const Icon = sorted ? (reversed ? IconChevronUp : IconChevronDown) : IconSelector;
  return (
    <UnstyledButton onClick={onSort} style={{ width: "100%" }}>
      <Group justify="space-between" wrap="nowrap" gap={4}>
        <Text fw={600} size="sm">{children}</Text>
        <Icon size={14} />
      </Group>
    </UnstyledButton>
  );
}

export default function OicManagementTable() {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  
  // Session at Alert States
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isOicActive, setIsOicActive] = useState<boolean>(false);

  // Modals States
  const [assignOpen, setAssignOpen] = useState(false);
  const [extendOpen, setExtendOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  
  // Form Date States (Kailangang laging YYYY-MM-DD para walang timezone bug)
  const [stringRange, setStringRange] = useState<[string, string]>(["", ""]);
  const [stringEndDate, setStringEndDate] = useState<string>("");

  // Sorting States
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [reverseSortDirection, setReverseSortDirection] = useState(false);

  // Ito ang benchmark string ng kasalukuyang araw ("YYYY-MM-DD")
  const todayStr = toManilaString(new Date());

  const refreshStaffList = async () => {
    try {
      const res = await fetch("../../api/user/get?sameDepartment=true");
      const json = await res.json();
      if (json && json.success) setUsers(json.data || json.users || []);
    } catch (e) {
      console.error("Error refreshing staff:", e);
    }
  };

	useEffect(() => {
	async function initPageData() {
		try {
		// 1. Refresh ang staff list
		await refreshStaffList();

		// 2. Kunin ang session ng kasalukuyang naka-login
		const userRes = await fetch("../../api/auth/me"); 
		const userJson = await userRes.json();
		
		// 🎯 DIRETSO SA userJson.data DAHIL ITO ANG STRUCT NG API MO
		if (userJson && userJson.success && userJson.data) {
			const user = userJson.data; // <--- Dito binago mula sa '.user' patungong '.data'
			setCurrentUser(user);

			// Kunin ang mga gagamiting strings para sa comparison
			const userStartStr = toManilaString(user.oic_start);
			const userEndStr = toManilaString(user.oic_end);

			// UNIFIED STRING EVALUATION
			if (
			user.role === "Staff" && 
			user.oic_start && 
			user.oic_end && 
			user.oic_start !== "null" && 
			user.oic_end !== "null"
			) {
			const checkCondition = todayStr >= userStartStr && todayStr <= userEndStr;
			setIsOicActive(checkCondition); 
			} else {
			setIsOicActive(false); 
			}
		}
		} catch (e) {
		console.error("Initialization Error:", e);
		}
	}

	initPageData();
	}, [todayStr]);

  // --- API HANDLERS ---
  async function handleAssignSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUser || !stringRange[0] || !stringRange[1]) return;
    try {
      const res = await fetch("../../api/user/edit", { 
        method: "POST", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedUser.id, oic_start: stringRange[0], oic_end: stringRange[1] }),
      });
      const json = await res.json();
      if (json.success) { 
        setAssignOpen(false); 
        setStringRange(["", ""]); 
        refreshStaffList(); 
      }
    } catch (e) { console.error(e); }
  }

  async function handleRevokeClick(userId: string) {
    if (!confirm("Are you sure you want to revoke this user's OIC status?")) return;
    try {
      const res = await fetch("../../api/user/edit", { 
        method: "POST", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: userId, oic_start: null, oic_end: null }),
      });
      const json = await res.json();
      if (json.success) refreshStaffList();
    } catch (e) { console.error(e); }
  }

  async function handleExtendSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUser || !stringEndDate) return;
    try {
      const res = await fetch("../../api/user/edit", { 
        method: "POST", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedUser.id, oic_end: stringEndDate }),
      });
      const json = await res.json();
      if (json.success) { 
        setExtendOpen(false); 
        setStringEndDate(""); 
        refreshStaffList(); 
      }
    } catch (e) { console.error(e); }
  }

  function setSorting(field: SortField) {
    const reversed = field === sortField ? !reverseSortDirection : false;
    setReverseSortDirection(reversed);
    setSortField(field);
  }

  const filteredUsers = users.filter((user) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return [user.employee_id, user.email, user.fname, user.lname].some((v) =>
      String(v || "").toLowerCase().includes(term)
    );
  });

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    if (!sortField) return 0;
    const left = String(a[sortField] || "").toLowerCase();
    const right = String(b[sortField] || "").toLowerCase();
    return reverseSortDirection ? right.localeCompare(left) : left.localeCompare(right);
  });

  const rows = sortedUsers.map((user) => {
    const startStr = toManilaString(user.oic_start);
    const endStr = toManilaString(user.oic_end);
    const hasDates = startStr && endStr;

    const isActiveOIC = hasDates && todayStr >= startStr && todayStr <= endStr;
    const isFutureOIC = hasDates && todayStr < startStr;

    return (
      <Table.Tr key={user.id}>
        <Table.Td><Text size="sm" fw={500}>{user.employee_id}</Text></Table.Td>
        <Table.Td>{user.fname} {user.lname}</Table.Td>
        <Table.Td c="dimmed">{user.email}</Table.Td>
        <Table.Td>
          {isActiveOIC && <Badge color="green" variant="light" radius="sm">Active OIC ({startStr} until {endStr})</Badge>}
          {isFutureOIC && <Badge color="blue" variant="light" radius="sm">Assigned OIC ({startStr} until {endStr})</Badge>}
          {!isActiveOIC && !isFutureOIC && <Badge color="gray" variant="light" radius="sm">Not OIC</Badge>}
        </Table.Td>
        <Table.Td>
          <Group gap={8}>
            {isActiveOIC || isFutureOIC ? (
              <>
                <Button size="xs" variant="light" color="blue" leftSection={<IconCalendarTime size={14} />} onClick={() => { setSelectedUser(user); setStringEndDate(endStr); setExtendOpen(true); }}>Extend</Button>
                <Button size="xs" variant="light" color="red" leftSection={<IconUserX size={14} />} onClick={() => handleRevokeClick(user.id)}>Revoke</Button>
              </>
            ) : (
              <Button size="xs" variant="outline" color="green" leftSection={<IconUserPlus size={14} />} onClick={() => { setSelectedUser(user); setStringRange(["", ""]); setAssignOpen(true); }}>Assign OIC</Button>
            )}
          </Group>
        </Table.Td>
      </Table.Tr>
    );
  });

  return (
    <Card withBorder shadow="sm" radius="md" p="md">
      <Stack gap="md">
        
        {/* Banner Alert Warning */}
        {isOicActive && (
          <Alert 
            variant="light" 
            color="blue" 
            title="Temporary OIC Access Active" 
            icon={<IconInfoCircle size={18} />}
            radius="md"
            styles={{
              title: { fontWeight: 700, fontSize: "15px" },
              body: { fontSize: "14px", lineHeight: "1.5" }
            }}
          >
            Reminder: You are now currently assigned as a <b>Officer-in-Charge (OIC)</b>. You have a temporary access and identical privilege as your respective Department Head in order to manage the people within this department. Please use this privilege responsibly and with carefulness.<br></br><br></br>Paalala: Kasalukuyan kang naka-talaga bilang <b>Officer-in-Charge (OIC)</b>. Mayroon kang pansamantalang akses at kaparehong pribilehiyo gaya ng inyong Department Head para sa pamamahala ng mga tao sa departamentong ito. Mangyaring gamitin ang pribilehiyong ito nang responsable at may pag-iingat.
          </Alert>
        )}

        <Group justify="space-between" align="center">
          <div>
            <Text size="xl" fw={700}>Department OIC Management</Text>
            <Text size="xs" c="dimmed">Assign, revoke, or extend OIC status of Department Staff</Text>
          </div>
          <TextInput
            placeholder="Find user using employee ID, email, or name ..."
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            leftSection={<IconSearch size={16} />}
            w={350}
          />
        </Group>

        <ScrollArea h={isOicActive ? "calc(100vh - 380px)" : "calc(100vh - 280px)"}>
          <Table highlightOnHover striped withColumnBorders verticalSpacing="sm" stickyHeader horizontalSpacing="md" withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={{ width: "15%" }}><SortableHeader sorted={sortField === "employee_id"} reversed={reverseSortDirection} onSort={() => setSorting("employee_id")}>Employee ID</SortableHeader></Table.Th>
                <Table.Th style={{ width: "25%" }}><SortableHeader sorted={sortField === "fname"} reversed={reverseSortDirection} onSort={() => setSorting("fname")}>Full Name</SortableHeader></Table.Th>
                <Table.Th style={{ width: "25%" }}><SortableHeader sorted={sortField === "email"} reversed={reverseSortDirection} onSort={() => setSorting("email")}>Email Address</SortableHeader></Table.Th>
                <Table.Th style={{ width: "20%" }}><SortableHeader sorted={sortField === "oic_start"} reversed={reverseSortDirection} onSort={() => setSorting("oic_start")}>OIC Duration Status</SortableHeader></Table.Th>
                <Table.Th style={{ width: "15%" }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>{rows.length > 0 ? rows : <Table.Tr><Table.Td colSpan={5} style={{ textAlign: "center" }}><Text c="dimmed" size="sm" my="md">Walang nahanap na staff sa departamentong ito.</Text></Table.Td></Table.Tr>}</Table.Tbody>
          </Table>
        </ScrollArea>
      </Stack>

      {/* --- MODAL ASSIGN --- */}
      <Modal opened={assignOpen} onClose={() => setAssignOpen(false)} title={<Text fw={700}>Assign {selectedUser?.fname} {selectedUser?.lname} as OIC </Text>} centered radius="md">
        <form onSubmit={handleAssignSubmit}>
          <Stack gap="md" pt="xs">
            <DatePickerInput
              type="range" label="Select a date range" placeholder="Start Date → End Date"
              value={[stringRange[0] ? new Date(stringRange[0]) : null, stringRange[1] ? new Date(stringRange[1]) : null]}
              onChange={(dates) => {
                if (!dates) { setStringRange(["", ""]); return; }
                setStringRange([toManilaString(dates[0]), toManilaString(dates[1])]);
              }}
              minDate={new Date()} clearable required
            />
            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={() => setAssignOpen(false)}>Cancel</Button>
              <Button type="submit" color="green" disabled={!stringRange[0] || !stringRange[1]}>Assign as OIC</Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* --- MODAL EXTEND --- */}
      <Modal opened={extendOpen} onClose={() => setExtendOpen(false)} title={<Text fw={700}>I-extend ang Termino ni {selectedUser?.fname}</Text>} centered radius="md">
        <form onSubmit={handleExtendSubmit}>
          <Stack gap="md" pt="xs">
            <Text size="sm">Current End Date: <Badge color="gray">{toManilaString(selectedUser?.oic_end)}</Badge></Text>
            <DatePickerInput
              label="Extended End Date" placeholder="Select a Date"
              value={stringEndDate ? new Date(stringEndDate) : null}
              onChange={(date) => setStringEndDate(toManilaString(date))}
              minDate={selectedUser?.oic_end ? new Date(selectedUser.oic_end) : new Date()} clearable required
            />
            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={() => setExtendOpen(false)}>Cancel</Button>
              <Button type="submit" color="blue" disabled={!stringEndDate}>I-update Extension</Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Card>
  );
}