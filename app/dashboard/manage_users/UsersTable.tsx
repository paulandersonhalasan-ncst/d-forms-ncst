"use client";

import React, { useEffect, useState, useRef } from "react";
import {
  Table,
  Checkbox,
  Button,
  Group,
  Modal,
  TextInput,
  Select,
  ScrollArea,
  Text,
  Stack,
  PasswordInput,
  UnstyledButton,
  Card
} from "@mantine/core";
import { IconChevronDown, IconChevronUp, IconSearch, IconSelector } from "@tabler/icons-react";

interface User {
  id: string;
  employee_id?: string;
  email?: string;
  fname?: string;
  lname?: string;
  role?: string;
  departmentCode?: string;
  branch?: string;
  last_login: string;
}

interface Department {
    id: string;
    code: string;
}

type SortField =
  | "employee_id"
  | "email"
  | "fname"
  | "lname"
  | "role"
  | "departmentCode"
  | "branch"
  | "last_login";

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
        <Text fw={500} size="sm">
          {children}
        </Text>
        <Icon size={14} />
      </Group>
    </UnstyledButton>
  );
}

export default function UsersTable() {
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [deptAddOpen, setDeptAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [deptCode, setDeptCode] = useState<string>("");
  const [bulkRoleOpen, setBulkRoleOpen] = useState(false);
  const [bulkDeptOpen, setBulkDeptOpen] = useState(false);
  const [bulkBranchOpen, setBulkBranchOpen] = useState(false);
  const [bulkRoleValue, setBulkRoleValue] = useState<string>("Staff");
  const [bulkDeptValue, setBulkDeptValue] = useState<string>("");
  const [bulkBranchValue, setBulkBranchValue] = useState<string>("MAIN");
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [reverseSortDirection, setReverseSortDirection] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const initialForm = {
    employee_id: "",
    email: "",
    password: "",
    fname: "",
    lname: "",
    role: "Staff",
    departmentCode: "",
    branch: "MAIN",
  };

  const [form, setForm] = useState(initialForm);
  useEffect(() => {
    fetchAll();
    fetchDept();
  }, []);

  async function fetchAll() {
    try {
      const res = await fetch("../../../api/user/get");
      const json = await res.json();
      if (json && json.success) setUsers(json.data || json.users || json.data);
    } catch (e) {
      console.error(e);
    }
  }

  async function fetchDept() {
    try {
      const res = await fetch("../../../api/department/get");
      const json = await res.json();
      if (json && json.success) setDepartments(json.data || json.department || json.data);

      console.log(json.data);
    } catch (e) {
      console.error(e);
    }
  }

  function toggleSelect(id: string) {
    const s = new Set(selected);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    setSelected(s);
  }

  function toggleSelectAll() {
    const visibleIds = filteredUsers.map((user) => user.id);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));

    if (allVisibleSelected) {
      setSelected((current) => {
        const next = new Set(current);
        visibleIds.forEach((id) => next.delete(id));
        return next;
      });
      return;
    }

    setSelected((current) => new Set([...current, ...visibleIds]));
  }

  function openEdit(user: User) {
    setEditing(user);
    setForm({
      employee_id: user.employee_id || "",
      email: user.email || "",
      password: "",
      fname: user.fname || "",
      lname: user.lname || "",
      role: user.role || "Staff",
      departmentCode: user.departmentCode || "",
      branch: user.branch || "MAIN",
    });
    setEditOpen(true);
  }

  async function handleDelete(singleId?: string) {
    const toDelete = singleId ? users.filter((u) => u.id === singleId) : users.filter((u) => selected.has(u.id));
    if (toDelete.length === 0) return alert("No users selected to delete");

    if (!confirm(`Delete ${toDelete.length} user(s)?`)) return;

    try {
      const body = toDelete.map((u) => ({ id: u.id }));
      const res = await fetch("../../../api/user/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json && json.success) {
        setSelected(new Set());
        fetchAll();
      } else {
        alert(json.message || "Delete failed");
      }
    } catch (e) {
      console.error(e);
      alert("Delete request failed");
    }
  }

  async function handleAdd(e?: React.FormEvent) {
    if (e) e.preventDefault();
    try {
      const res = await fetch("../../../api/user/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (json && json.success) {
        setAddOpen(false);
        setForm({
          employee_id: "",
          email: "",
          password: "",
          fname: "",
          lname: "",
          role: "Staff",
          departmentCode: "",
          branch: "MAIN",
        });
        fetchAll();
      } else {
        alert(json.message || "Add failed");
      }
    } catch (e) {
      console.error(e);
      alert("Add request failed");
    }
  }

  async function handleEdit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!editing) return;
    try {
      const payload = { id: editing.id, ...form };
      const res = await fetch("../../../api/user/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json && json.success) {
        setEditOpen(false);
        setEditing(null);
        fetchAll();
      } else {
        alert(json.message || "Edit failed");
      }
    } catch (e) {
      console.error(e);
      alert("Edit request failed");
    }
  }

  function formatToPHT(value?: string | null) {
    if (!value) return "-";
    try {
      const d = new Date(value);
      if (isNaN(d.getTime())) return value;
      return new Intl.DateTimeFormat("en-PH", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
        timeZone: "Asia/Manila",
      }).format(d);
    } catch {
      return value;
    }
  }

  function setSorting(field: SortField) {
    const reversed = field === sortField ? !reverseSortDirection : false;
    setReverseSortDirection(reversed);
    setSortField(field);
  }

  const normalizedSearch = search.trim().toLowerCase();
  const filteredUsers = users.filter((user) => {
    if (!normalizedSearch) return true;

    return [user.employee_id, user.email, user.fname, user.lname].some((value) =>
      String(value || "").toLowerCase().includes(normalizedSearch)
    );
  });

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    if (!sortField) return 0;

    if (sortField === "last_login") {
      const left = a.last_login ? new Date(a.last_login).getTime() : 0;
      const right = b.last_login ? new Date(b.last_login).getTime() : 0;
      return reverseSortDirection ? right - left : left - right;
    }

    const left = String(a[sortField] || "").toLowerCase();
    const right = String(b[sortField] || "").toLowerCase();

    return reverseSortDirection ? right.localeCompare(left) : left.localeCompare(right);
  });

  // 🎯 Palitan ang rendering ng rows gamit ang Mantine Table primitives:
    const rows = sortedUsers.map((user: User) => (
    <Table.Tr key={user.id} style={{ background: selected.has(user.id) ? "var(--mantine-color-gray-1)" : undefined }}>
        <Table.Td>
        <Checkbox
            checked={selected.has(user.id)}
            onChange={() => toggleSelect(user.id)}
            aria-label="select user"
        />
        </Table.Td>
        <Table.Td>{user.employee_id}</Table.Td>
        <Table.Td>{user.email}</Table.Td>
        <Table.Td>{user.fname}</Table.Td>
        <Table.Td>{user.lname}</Table.Td>
        <Table.Td>{user.role}</Table.Td>
        <Table.Td>{user.departmentCode}</Table.Td>
        <Table.Td>{user.branch}</Table.Td>
        <Table.Td>{formatToPHT(user.last_login)}</Table.Td>
        <Table.Td>
        <Group gap={4}>
            <Button size="xs" variant="default" onClick={() => openEdit(user)}>
            Edit
            </Button>
            <Button size="xs" color="red" variant="outline" onClick={() => handleDelete(user.id)}>
            Delete
            </Button>
        </Group>
        </Table.Td>
    </Table.Tr>
    ));

  return (
    <div>
      <Card withBorder shadow="sm" radius="md" p="md">
      <Group style={{ justifyContent: "space-between", marginBottom: 16 }} justify="flex-end" mb="md">
          <Group>
            <Button onClick={() => { fetchDept(); setForm(initialForm); setAddOpen(true); }}>Add User</Button>
            <Button onClick={() => { fetchDept(); setDeptAddOpen(true); }}>Manage Departments</Button>
            <Button disabled={selected.size === 0} color="red" onClick={() => handleDelete()}>Delete Selected</Button>
            <Select
              placeholder="Bulk actions"
              data={[
                { value: "", label: "Actions" },
                { value: "delete", label: "Delete selected" },
                { value: "role", label: "Change role" },
                { value: "dept", label: "Change department" },
                { value: "branch", label: "Change branch" },
              ]}
              disabled={selected.size === 0}
              onChange={(val) => {
                if (!val) return;
                if (val === "delete") return handleDelete();
                if (val === "role") return setBulkRoleOpen(true);
                if (val === "dept") {
                  setBulkDeptOpen(true);
                  fetchDept();
                  return;
                }
                if (val === "branch") {
                  setBulkBranchOpen(true);
                  return;
                }
              }}
              style={{ width: 200 }}
            />
          </Group>
        {/* <Text>{filteredUsers.length} users</Text> saka ko nalang lagay pag kailangan ko*/}
        <TextInput
          placeholder="Search by employee ID, email, first name, or last name"
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
          leftSection={<IconSearch size={16} />}
          w={400}
        />
      </Group>

      <ScrollArea h="calc(100vh - 260px)">
        <Table highlightOnHover striped withColumnBorders verticalSpacing="sm" stickyHeader horizontalSpacing="md" withTableBorder >
            <Table.Thead>
                <Table.Tr>
                <Table.Th style={{ width: 40 }}>
                    <Checkbox
                    onChange={toggleSelectAll}
                    checked={filteredUsers.length > 0 && filteredUsers.every((user) => selected.has(user.id))}
                    indeterminate={filteredUsers.some((user) => selected.has(user.id)) && !filteredUsers.every((user) => selected.has(user.id))}
                    aria-label="select all"
                    />
                </Table.Th>
                <Table.Th>
                  <SortableHeader sorted={sortField === "employee_id"} reversed={reverseSortDirection} onSort={() => setSorting("employee_id")}>
                    Employee ID
                  </SortableHeader>
                </Table.Th>
                <Table.Th>
                  <SortableHeader sorted={sortField === "email"} reversed={reverseSortDirection} onSort={() => setSorting("email")}>
                    Email
                  </SortableHeader>
                </Table.Th>
                <Table.Th>
                  <SortableHeader sorted={sortField === "fname"} reversed={reverseSortDirection} onSort={() => setSorting("fname")}>
                    First Name
                  </SortableHeader>
                </Table.Th>
                <Table.Th>
                  <SortableHeader sorted={sortField === "lname"} reversed={reverseSortDirection} onSort={() => setSorting("lname")}>
                    Last Name
                  </SortableHeader>
                </Table.Th>
                <Table.Th>
                  <SortableHeader sorted={sortField === "role"} reversed={reverseSortDirection} onSort={() => setSorting("role")}>
                    Role
                  </SortableHeader>
                </Table.Th>
                <Table.Th>
                  <SortableHeader sorted={sortField === "departmentCode"} reversed={reverseSortDirection} onSort={() => setSorting("departmentCode")}>
                    Department
                  </SortableHeader>
                </Table.Th>
                <Table.Th>
                  <SortableHeader sorted={sortField === "branch"} reversed={reverseSortDirection} onSort={() => setSorting("branch")}>
                    System
                  </SortableHeader>
                </Table.Th>
                <Table.Th>
                  <SortableHeader sorted={sortField === "last_login"} reversed={reverseSortDirection} onSort={() => setSorting("last_login")}>
                    Last Log In
                  </SortableHeader>
                </Table.Th>
                <Table.Th>Actions</Table.Th>
                </Table.Tr>
            </Table.Thead>
            <Table.Tbody>{rows}</Table.Tbody>
            </Table>
      </ScrollArea>

      <Modal opened={addOpen} onClose={() => { setAddOpen(false); setForm(initialForm); }} title="Add User">
        <form onSubmit={handleAdd}>
          <Stack>
            <TextInput
              label="Employee ID"
              value={form.employee_id}
              onChange={(e) => setForm({ ...form, employee_id: e.currentTarget.value })}
              required
            />
            <TextInput
              label="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.currentTarget.value })}
              required
            />
            <PasswordInput
              label="Password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.currentTarget.value })}
              required
            />
            <TextInput label="First name" value={form.fname} onChange={(e) => setForm({ ...form, fname: e.currentTarget.value })} />
            <TextInput label="Last name" value={form.lname} onChange={(e) => setForm({ ...form, lname: e.currentTarget.value })} />
              <Select
                label="Department"
                data={departments.map((d) => ({ value: d.code, label: d.code }))}
                value={form.departmentCode}
                onChange={(val) => setForm({ ...form, departmentCode: val || "" })}
                required
                placeholder={departments.length === 0 ? "No departments" : "Select department"}
              />
            <Select
              label="Role"
              data={["Staff", "OIC", "DepartmentHead", "SuperUser", "Admin"]}
              value={form.role}
              onChange={(val) => setForm({ ...form, role: val || "Staff" })}
            />
            <Group style={{ justifyContent: "flex-end" }}>
              <Button type="submit">Create</Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* Bulk action modals (moved outside Manage Departments modal) */}
      <Modal opened={bulkRoleOpen} onClose={() => setBulkRoleOpen(false)} title="Change Role for Selected Users">
        <Stack>
          <Select
            label="Role"
            data={["Staff", "OIC", "DepartmentHead", "SuperUser", "Admin"]}
            value={bulkRoleValue}
            onChange={(val) => setBulkRoleValue(val || "Staff")}
          />
          <Group style={{ justifyContent: "flex-end" }}>
            <Button
              onClick={async () => {
                if (selected.size === 0) return alert("No users selected");
                const ids = Array.from(selected);
                try {
                  await Promise.all(ids.map((id) =>
                    fetch("../../../api/user/edit", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ id, role: bulkRoleValue }),
                    })
                  ));
                  setBulkRoleOpen(false);
                  setSelected(new Set());
                  fetchAll();
                } catch (err) {
                  console.error(err);
                  alert("Bulk role update failed");
                }
              }}
            >
              Apply
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={bulkDeptOpen} onClose={() => setBulkDeptOpen(false)} title="Change Department for Selected Users">
        <Stack>
          <Select
            label="Department"
            data={departments.map((d) => ({ value: d.code, label: d.code }))}
            value={bulkDeptValue}
            onChange={(val) => setBulkDeptValue(val || "")}
            placeholder={departments.length === 0 ? "No departments" : "Select department"}
          />
          <Group style={{ justifyContent: "flex-end" }}>
            <Button
              onClick={async () => {
                if (selected.size === 0) return alert("No users selected");
                if (!bulkDeptValue) return alert("Please choose a department");
                const ids = Array.from(selected);
                try {
                  await Promise.all(ids.map((id) =>
                    fetch("../../../api/user/edit", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ id, departmentCode: bulkDeptValue }),
                    })
                  ));
                  setBulkDeptOpen(false);
                  setSelected(new Set());
                  fetchAll();
                } catch (err) {
                  console.error(err);
                  alert("Bulk department update failed");
                }
              }}
            >
              Apply
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={bulkBranchOpen} onClose={() => setBulkBranchOpen(false)} title="Change Branch for Selected Users">
        <Stack>
          <Select
            label="Branch"
            data={["MAIN", "IMUS", "NASTECH", "SHS"]}
            value={bulkBranchValue}
            onChange={(val) => setBulkBranchValue(val || "MAIN")}
          />
          <Group style={{ justifyContent: "flex-end" }}>
            <Button
              onClick={async () => {
                if (selected.size === 0) return alert("No users selected");
                if (!bulkBranchValue) return alert("Please choose a branch");
                const ids = Array.from(selected);
                try {
                  await Promise.all(ids.map((id) =>
                    fetch("../../../api/user/edit", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ id, branch: bulkBranchValue }),
                    })
                  ));
                  setBulkBranchOpen(false);
                  setSelected(new Set());
                  fetchAll();
                } catch (err) {
                  console.error(err);
                  alert("Bulk branch update failed");
                }
              }}
            >
              Apply
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Group style={{ marginTop: 12, gap: 8 }}>
          <Button
            onClick={async () => {
              try {
                const XLSX = await import("xlsx");
                const toExport = filteredUsers.map((u) => ({
                  employee_id: u.employee_id || "",
                  email: u.email || "",
                  fname: u.fname || "",
                  lname: u.lname || "",
                  role: u.role || "",
                  departmentCode: u.departmentCode || "",
                  branch: u.branch || "",
                  last_login: u.last_login || "",
                }));
                const ws = XLSX.utils.json_to_sheet(toExport);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "Users");
                XLSX.writeFile(wb, `users_${new Date().toISOString().slice(0,10)}.xlsx`);
              } catch (err) {
                console.error(err);
                alert("XLSX export failed. Install 'xlsx' or check the console for details.");
              }
            }}
          >
            Export XLSX
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            style={{ display: "none" }}
            onChange={async (e) => {
              const f = e.currentTarget.files && e.currentTarget.files[0];
              if (!f) return;
              try {
                const arrayBuffer = await f.arrayBuffer();
                
                const XLSX = await import("xlsx");
                const workbook = XLSX.read(arrayBuffer, { type: "array" });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const data: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet);
                if (!data || data.length === 0) return alert("No rows found in the uploaded file.");
                const proceed = confirm(`Parsed ${data.length} rows. Upload to server as users?`);
                if (!proceed) return console.log(data);
                // attempt to add each row (best-effort) - use safe extractor for unknown-typed rows
                const getVal = (r: Record<string, unknown>, ...keys: string[]) => {
                  for (const k of keys) {
                    const v = r[k];
                    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v);
                  }
                  return "";
                };

                const results = { success: 0, fail: 0 };
                for (const row of data) {
                  const payload = {
                    employee_id: getVal(row, "employee_id", "Employee ID", "employee_id"),
                    email: getVal(row, "email", "Email"),
                    password: "123",
                    fname: getVal(row, "fname", "FIRST_NAME", "first_name", "FirstName"),
                    lname: getVal(row, "lname", "LAST_NAME", "last_name", "LastName"),
                    role: getVal(row, "role", "Role") || "Staff",
                    departmentCode: getVal(row, "departmentCode", "Department"),
                    branch: getVal(row, "branch", "Branch") || "MAIN",
                  };

                  try {
                    const res = await fetch("../../../api/user/add", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(payload),
                    });
                    const json = await res.json();
                    if (json && json.success) results.success += 1;
                    else results.fail += 1;
                  } catch (err) {
                    console.error(err);
                    results.fail += 1;
                  }
                }
                alert(`Import finished. Success: ${results.success}, Fail: ${results.fail}`);
                fetchAll();
              } catch (err) {
                console.error(err);
                alert("Failed to parse XLSX file. See console for details.");
              } finally {
                // reset input
                if (fileInputRef.current) fileInputRef.current.value = "";
              }
            }}
          />

          <Button onClick={() => fileInputRef.current && fileInputRef.current.click()}>Import XLSX</Button>
        </Group>
      </Card>

      <Modal opened={deptAddOpen} onClose={() => setDeptAddOpen(false)} title="Manage Departments" size="lg">
        <Stack>
          <div style={{ display: "flex", gap: 8 }}>
            <TextInput placeholder="New department code" value={deptCode} onChange={(e) => setDeptCode(e.currentTarget.value)} />
            <Button
              onClick={async () => {
                const code = String(deptCode || "").toUpperCase().trim();
                if (!code) return alert("Please provide a department code.");
                try {
                  const res = await fetch("../../../api/department/add", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ code }),
                  });
                  const json = await res.json();
                  if (json && json.success) {
                    setDeptCode("");
                    fetchDept();
                  } else {
                    alert(json.message || "Add department failed");
                  }
                } catch (err) {
                  console.error(err);
                  alert("Add department request failed");
                }
              }}
            >
              Add
            </Button>
          </div>

          <ScrollArea style={{ height: 320 }}>
            <Table highlightOnHover striped withColumnBorders verticalSpacing="sm" stickyHeader>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Code</Table.Th>
                  <Table.Th style={{ width: 200 }}>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {departments.map((d) => (
                  <Table.Tr key={d.id}>
                    <Table.Td><b>{d.code}</b></Table.Td>
                    <Table.Td>
                      <Group>
                        <Button size="xs" onClick={async () => {
                          const newCode = String(prompt(`New code for ${d.code}:`, d.code) || "").toUpperCase().trim();
                          if (!newCode) return;
                          if (newCode === d.code) return;
                          try {
                            const res = await fetch(`../../../api/department/edit`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ id: d.id, code: d.code, newCode: newCode }),
                            });
                            const json = await res.json();
                            if (json && json.success) {
                              // refresh departments and users so renamed department shows immediately
                              await fetchDept();
                              await fetchAll();
                            } else {
                              alert(json.message || "Edit department failed");
                            }
                          } catch (err) {
                            console.error(err);
                            alert("Edit department request failed");
                          }
                        }}>Edit</Button>
                        <Button size="xs" color="red" variant="outline" onClick={async () => {
                          if (!confirm(`Delete department ${d.code}? This will fail if users are assigned.`)) return;
                          try {
                            const res = await fetch(`../../../api/department/delete`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ id: d.id }),
                            });
                            const json = await res.json();
                            if (json && json.success) {
                              fetchDept();
                              fetchAll();
                            } else {
                              alert(json.message || "Delete department failed");
                            }
                          } catch (err) {
                            console.error(err);
                            alert("Delete department request failed");
                          }
                        }}>Delete</Button>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Stack>
      </Modal>

      <Modal opened={editOpen} onClose={() => setEditOpen(false)} title="Edit User">
        <form onSubmit={handleEdit}>
          <Stack>
            <TextInput
              label="Employee ID"
              value={form.employee_id}
              onChange={(e) => setForm({ ...form, employee_id: e.currentTarget.value })}
              required
            />
            <TextInput label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.currentTarget.value })} required />
            <PasswordInput label="Password (leave blank to keep)" value={form.password} onChange={(e) => setForm({ ...form, password: e.currentTarget.value })} />
            <TextInput label="First name" value={form.fname} onChange={(e) => setForm({ ...form, fname: e.currentTarget.value })} />
            <TextInput label="Last name" value={form.lname} onChange={(e) => setForm({ ...form, lname: e.currentTarget.value })} />
            <Select
              label="Department"
              data={departments.map((d) => ({ value: d.code, label: d.code }))}
              value={form.departmentCode}
              onChange={(val) => setForm({ ...form, departmentCode: val || "" })}
              required
              placeholder={departments.length === 0 ? "No departments" : "Select department"}
            />
            <Select
              label="Role"
              data={["Staff", "OIC", "DepartmentHead", "SuperUser", "Admin"]}
              value={form.role}
              onChange={(val) => setForm({ ...form, role: val || "Staff" })}
            />
            <Select
                label="Branch"
                data={["MAIN", "IMUS", "NASTECH", "SHS"]}
                value={form.branch}
                onChange={(val) => setForm({ ...form, branch: val || "MAIN" })}
            />
            <Group style={{ justifyContent: "flex-end" }}>
              <Button type="submit">Save</Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </div>
  );
}
