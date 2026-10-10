"use client";

import React, { useState, useEffect } from "react";
import {
  PasswordInput,
  Button,
  Stack,
  Text,
  TextInput,
  Card,
  Group,
  LoadingOverlay,
  Alert,
} from "@mantine/core";
import { IconCheck, IconAlertCircle } from "@tabler/icons-react";

// --- Types ---
interface UserData {
  id: string;
  email: string;
  fname: string;
  lname: string;
  role: string;
  departmentCode: string;
  branch: string;
  employee_id?: string;
  oic_start?: string | null;
  oic_end?: string | null;
}

interface UpdatePayload {
  id: string;
  employee_id: string;
  password?: string;
  currentPassword?: string;
}

// --- Component ---
export default function AccountSettingsPage() {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  const [employeeId, setEmployeeId] = useState("");
  const [originalEmployeeId, setOriginalEmployeeId] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch current user data
  useEffect(() => {
    const fetchUser = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();
        if (data.success) {
          setUser(data.data);
          const empId = data.data.employee_id || "";
          setEmployeeId(empId);
          setOriginalEmployeeId(empId);
        } else {
          setError("Failed to load user data. Please refresh.");
        }
      } catch (err) {
        console.error(err);
        setError("Network error. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setError(null);

    if (!employeeId.trim()) {
      setError("Employee ID cannot be empty.");
      return;
    }

    // If any password field is filled, validate all
    const isChangingPassword = !!(newPassword || confirmPassword || currentPassword);
    if (isChangingPassword) {
      if (!currentPassword) {
        setError("Current password is required to change password.");
        return;
      }
      if (!newPassword) {
        setError("New password is required.");
        return;
      }
      if (newPassword !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
      if (newPassword.length < 8) {
        setError("New password must be at least 8 characters.");
        return;
      }
    }

    // Build payload with explicit type
    const payload: UpdatePayload = {
      id: user!.id, // user is guaranteed to exist here
      employee_id: employeeId.trim(),
    };

    if (isChangingPassword) {
      payload.password = newPassword;
      payload.currentPassword = currentPassword;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/user/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (json.success) {
        setMessage("Account updated successfully!");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setOriginalEmployeeId(employeeId.trim());

        // Refresh user data
        const meRes = await fetch("/api/auth/me");
        const meData = await meRes.json();
        if (meData.success) setUser(meData.data);
      } else {
        setError(json.message || "Update failed. Please try again.");
      }
    } catch (err) {
      console.error(err);
      setError("Network error. Please check your connection.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingOverlay visible />;
  }

  return (
    <main style={{ padding: '16px', maxWidth: 600, margin: "0 auto", width: '100%' }}>
      <Card withBorder shadow="sm" radius="md" p="lg">
        <h1>Account Settings</h1>

        {message && (
          <Alert icon={<IconCheck size={16} />} color="green" mb="md">
            {message}
          </Alert>
        )}
        {error && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" mb="md">
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <Stack gap="md">
            {/* Read‑only user info */}
            <TextInput
              label="Email"
              value={user?.email || ""}
              readOnly
            />
            <TextInput
              label="First Name"
              value={user?.fname || ""}
              readOnly
            />
            <TextInput
              label="Last Name"
              value={user?.lname || ""}
              readOnly
            />
            <TextInput
              label="Role"
              value={user?.role || ""}
              readOnly
            />
            <TextInput
              label="Department"
              value={user?.departmentCode || ""}
              readOnly
            />
            <TextInput
              label="Branch"
              value={user?.branch || ""}
              readOnly
            />

            <TextInput
              label="Employee ID"
              placeholder="Your employee ID"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.currentTarget.value)}
              required
              description="This is used for identification across the system. Edit with caution."
            />

            <hr style={{ margin: "12px 0" }} />

            <Text fw={600} size="sm">Change Password</Text>
            <PasswordInput
              label="Current password"
              placeholder="Enter your current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.currentTarget.value)}
            />
            <PasswordInput
              label="New password"
              placeholder="Enter new password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.currentTarget.value)}
              description="Minimum 8 characters."
            />
            <PasswordInput
              label="Confirm new password"
              placeholder="Re-enter new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.currentTarget.value)}
            />

            <Group justify="flex-end" mt="md">
              <Button type="submit" loading={submitting}>
                Save Changes
              </Button>
            </Group>
          </Stack>
        </form>
      </Card>
    </main>
  );
} 