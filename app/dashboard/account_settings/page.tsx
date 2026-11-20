"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
  Modal,
  PinInput,
  Divider,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconCheck, IconAlertCircle, IconMail, IconLock } from "@tabler/icons-react";

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

interface UpdateProfilePayload {
  id: string;
  employee_id: string;
  password?: string;
  currentPassword?: string;
}

const ALLOWED_DOMAIN = "@ncst.edu.ph";
const PRIVILEGED_ROLES = ["SuperUser", "Admin"];

export default function AccountSettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  // Profile edit state
  const [employeeId, setEmployeeId] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Email change modal
  const [emailModalOpened, { open: openEmailModal, close: closeEmailModal }] = useDisclosure(false);
  const [emailStep, setEmailStep] = useState<"input" | "verify">("input");
  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [emailSubmitting, setEmailSubmitting] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Fetch current user
  useEffect(() => {
    const fetchUser = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();
        if (data.success) {
          setUser(data.data);
          setEmployeeId(data.data.employee_id || "");
        } else {
          setError("Failed to load user data. Please refresh.");
        }
      } catch {
        setError("Network error. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

  // Cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  const isPrivileged = user?.role && PRIVILEGED_ROLES.includes(user.role);

  // ---- Profile submit (existing behavior) ----
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setError(null);

    if (!employeeId.trim()) { setError("Employee ID cannot be empty."); return; }

    const isChangingPassword = !!(newPassword || confirmPassword || currentPassword);
    if (isChangingPassword) {
      if (!currentPassword) { setError("Current password is required to change password."); return; }
      if (!newPassword) { setError("New password is required."); return; }
      if (newPassword !== confirmPassword) { setError("Passwords do not match."); return; }
      if (newPassword.length < 8) { setError("New password must be at least 8 characters."); return; }
    }

    const payload: UpdateProfilePayload = {
      id: user!.id,
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
      } else {
        setError(json.message || "Update failed.");
      }
    } catch {
      setError("Network error.");
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Email change: request step ----
  const handleEmailRequest = async () => {
    setEmailError(null);
    setEmailSuccess(null);

    const normalized = newEmail.trim().toLowerCase();
    if (!normalized.endsWith(ALLOWED_DOMAIN)) {
      setEmailError(`Email must end with ${ALLOWED_DOMAIN}`);
      return;
    }
    if (!emailPassword) {
      setEmailError("Current password is required.");
      return;
    }
    if (normalized === user?.email.toLowerCase()) {
      setEmailError("New email is the same as your current email.");
      return;
    }

    // Privileged users: extra confirm
    if (isPrivileged) {
      const ok = window.confirm(
        `Change your login email to:\n\n${normalized}\n\nYou will be logged out immediately.\n\nProceed?`,
      );
      if (!ok) return;
    }

    setEmailSubmitting(true);
    try {
      const res = await fetch("/api/user/email-change/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newEmail: normalized,
          currentPassword: emailPassword,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setEmailError(json.message || "Failed to request change.");
        return;
      }

      if (json.data?.skipOtp) {
        // Privileged — already done
        setEmailSuccess(
          `Email changed to ${normalized}. Redirecting to login...`,
        );
        setTimeout(() => handleLogout(), 2000);
        return;
      }

      // Regular — go to verify step
      setEmailStep("verify");
      setResendCooldown(60);
    } catch {
      setEmailError("Network error.");
    } finally {
      setEmailSubmitting(false);
    }
  };

  // ---- Email change: verify step ----
  const handleEmailVerify = async () => {
    setEmailError(null);
    if (!/^\d{6}$/.test(otpCode)) {
      setEmailError("Enter the 6-digit code from your email.");
      return;
    }
    setEmailSubmitting(true);
    try {
      const res = await fetch("/api/user/email-change/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: otpCode }),
      });
      const json = await res.json();
      if (!json.success) {
        setEmailError(json.message || "Verification failed.");
        return;
      }
      setEmailSuccess("Email changed successfully. Redirecting to login...");
      setTimeout(() => handleLogout(), 1500);
    } catch {
      setEmailError("Network error.");
    } finally {
      setEmailSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setEmailError(null);
    setEmailSubmitting(true);
    try {
      const res = await fetch("/api/user/email-change/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newEmail: newEmail.trim().toLowerCase(), currentPassword: emailPassword }),
      });
      const json = await res.json();
      if (json.success) {
        setResendCooldown(60);
        setOtpCode("");
      } else {
        setEmailError(json.message || "Resend failed.");
      }
    } catch {
      setEmailError("Network error.");
    } finally {
      setEmailSubmitting(false);
    }
  };

  const handleLogout = async () => {
          try {
              const res = await fetch("/api/auth/logout", { method: "DELETE" });
              if (res.ok) window.location.replace("/");
              else console.error("Logout failed:", await res.text());
          } catch (err) {
              console.error("Logout error:", err);
          }
      };

  const resetEmailModal = () => {
    setEmailStep("input");
    setNewEmail("");
    setEmailPassword("");
    setOtpCode("");
    setEmailError(null);
    setEmailSuccess(null);
    setResendCooldown(0);
  };

  if (loading) return <LoadingOverlay visible />;

  return (
    <main style={{ padding: "16px", maxWidth: 600, margin: "0 auto", width: "100%" }}>
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

        <form onSubmit={handleProfileSubmit}>
          <Stack gap="md">
            <TextInput
              label="Email"
              value={user?.email || ""}
              readOnly
              description={
                isPrivileged
                  ? "You are a privileged user — you can change this without OTP."
                  : "Click 'Change Email' below to update your email."
              }
              rightSection={
                <Button
                  size="compact-xs"
                  variant="light"
                  leftSection={<IconMail size={14} />}
                  onClick={(e) => {
                    e.preventDefault();
                    resetEmailModal();
                    openEmailModal();
                  }}
                >
                  Change Email
                </Button>
              }
              rightSectionWidth={140}
            />

            <TextInput label="First Name" value={user?.fname || ""} readOnly />
            <TextInput label="Last Name" value={user?.lname || ""} readOnly />
            <TextInput label="Role" value={user?.role || ""} readOnly />
            <TextInput label="Department" value={user?.departmentCode || ""} readOnly />
            <TextInput label="Branch" value={user?.branch || ""} readOnly />

            <TextInput
              label="Employee ID"
              placeholder="Your employee ID"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.currentTarget.value)}
              required
              description="This is used for identification across the system. Edit with caution."
            />

            <Divider my="xs" />

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
              <Button type="submit" loading={submitting}>Save Changes</Button>
            </Group>
          </Stack>
        </form>
      </Card>

      {/* ---- Email Change Modal ---- */}
      <Modal
        opened={emailModalOpened}
        onClose={() => {
          if (emailSubmitting) return;
          closeEmailModal();
          resetEmailModal();
        }}
        title={
          emailStep === "input"
            ? "Change Email Address"
            : "Enter Verification Code"
        }
        centered
        closeOnClickOutside={false}
      >
        <Stack gap="md">
          {emailSuccess && (
            <Alert icon={<IconCheck size={16} />} color="green">
              {emailSuccess}
            </Alert>
          )}
          {emailError && (
            <Alert icon={<IconAlertCircle size={16} />} color="red">
              {emailError}
            </Alert>
          )}

          {emailStep === "input" && !emailSuccess && (
            <>
              <Text size="sm" c="dimmed">
                Your email must be a company email ending in <b>{ALLOWED_DOMAIN}</b>.
                {isPrivileged
                  ? " As a privileged user, no OTP will be required — you'll be logged out immediately."
                  : " We'll send a 6-digit code to the new email for verification."}
              </Text>

              <TextInput
                label="New Email Address"
                placeholder={`yourname${ALLOWED_DOMAIN}`}
                value={newEmail}
                onChange={(e) => setNewEmail(e.currentTarget.value)}
                leftSection={<IconMail size={16} />}
                required
              />

              <PasswordInput
                label="Current Password"
                placeholder="Confirm with your password"
                value={emailPassword}
                onChange={(e) => setEmailPassword(e.currentTarget.value)}
                leftSection={<IconLock size={16} />}
                required
              />

              <Group justify="flex-end" mt="md">
                <Button variant="light" onClick={closeEmailModal} disabled={emailSubmitting}>
                  Cancel
                </Button>
                <Button onClick={handleEmailRequest} loading={emailSubmitting}>
                  {isPrivileged ? "Change Email Now" : "Send Verification Code"}
                </Button>
              </Group>
            </>
          )}

          {emailStep === "verify" && !emailSuccess && (
            <>
              <Text size="sm" c="dimmed">
                We sent a 6-digit code to <b>{newEmail}</b>. Enter it below to
                complete the change. The code expires in 10 minutes.
              </Text>

              <Stack align="center" gap="xs" my="md">
                <PinInput
                  length={6}
                  size="lg"
                  type="number"
                  value={otpCode}
                  onChange={setOtpCode}
                  oneTimeCode
                  autoFocus
                />
              </Stack>

              <Group justify="space-between" mt="md">
                <Button
                  variant="subtle"
                  size="sm"
                  onClick={handleResend}
                  disabled={resendCooldown > 0 || emailSubmitting}
                >
                  {resendCooldown > 0
                    ? `Resend in ${resendCooldown}s`
                    : "Resend Code"}
                </Button>
                <Group gap="xs">
                  <Button
                    variant="light"
                    onClick={() => {
                      setEmailStep("input");
                      setOtpCode("");
                      setEmailError(null);
                    }}
                    disabled={emailSubmitting}
                  >
                    Back
                  </Button>
                  <Button onClick={handleEmailVerify} loading={emailSubmitting}>
                    Verify & Change
                  </Button>
                </Group>
              </Group>
            </>
          )}
        </Stack>
      </Modal>
    </main>
  );
}