'use client';

import { Suspense } from 'react';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Container,
  Card,
  Title,
  Text,
  PasswordInput,
  Button,
  Stack,
  Alert,
  Group,
  ThemeIcon,
  Loader,
  Center,
} from '@mantine/core';
import { IconCheck, IconAlertCircle, IconLock } from '@tabler/icons-react';

// ✅ I‑separate ang component na may useSearchParams
function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);

  // Validate token on load
  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setTokenValid(false);
        setValidating(false);
        return;
      }

      try {
        const res = await fetch(`/api/auth/validate_reset_token?token=${token}`);
        const data = await res.json();
        setTokenValid(data.valid);
      } catch (err) {
        setTokenValid(false);
      } finally {
        setValidating(false);
      }
    };

    validateToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/reset_password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          newPassword,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setSuccess(true);
        setTimeout(() => {
          router.push('/');
        }, 3000);
      } else {
        setError(data.message || 'Failed to reset password.');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (validating) {
    return (
      <Container size="sm" py="xl">
        <Card withBorder shadow="sm" p="xl" radius="md">
          <Stack align="center" gap="md">
            <Text>Validating reset link...</Text>
          </Stack>
        </Card>
      </Container>
    );
  }

  // Invalid token
  if (!tokenValid) {
    return (
      <Container size="sm" py="xl">
        <Card withBorder shadow="sm" p="xl" radius="md">
          <Stack align="center" gap="md">
            <ThemeIcon size={60} radius="xl" color="red" variant="light">
              <IconAlertCircle size={30} />
            </ThemeIcon>
            <Title order={3}>Invalid or Expired Link</Title>
            <Text c="dimmed" ta="center">
              The password reset link is invalid or has expired.
              Please request a new password reset.
            </Text>
            <Button onClick={() => router.push('/')}>
              Back to Login
            </Button>
          </Stack>
        </Card>
      </Container>
    );
  }

  // Success
  if (success) {
    return (
      <Container size="sm" py="xl">
        <Card withBorder shadow="sm" p="xl" radius="md">
          <Stack align="center" gap="md">
            <ThemeIcon size={60} radius="xl" color="green" variant="light">
              <IconCheck size={30} />
            </ThemeIcon>
            <Title order={3}>Password Reset Successful</Title>
            <Text c="dimmed" ta="center">
              Your password has been reset successfully.
              You will be redirected to the login page.
            </Text>
            <Button onClick={() => router.push('/')}>
              Go to Login
            </Button>
          </Stack>
        </Card>
      </Container>
    );
  }

  return (
    <Container size="sm" py="xl">
      <Card withBorder shadow="sm" p="xl" radius="md">
        <form onSubmit={handleSubmit}>
          <Stack gap="lg">
            <div>
              <Title order={2}>Set New Password</Title>
              <Text size="sm" c="dimmed">
                Enter your new password below.
              </Text>
            </div>

            {error && (
              <Alert color="red" title="Error" icon={<IconAlertCircle size={16} />}>
                {error}
              </Alert>
            )}

            <PasswordInput
              label="New Password"
              placeholder="Enter your new password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.currentTarget.value)}
              required
              leftSection={<IconLock size={16} />}
              description="Password must be at least 8 characters."
            />

            <PasswordInput
              label="Confirm New Password"
              placeholder="Re-enter your new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.currentTarget.value)}
              required
            />

            <Group justify="flex-end" mt="md">
              <Button variant="subtle" onClick={() => router.push('/')}>
                Cancel
              </Button>
              <Button type="submit" loading={loading}>
                Reset Password
              </Button>
            </Group>
          </Stack>
        </form>
      </Card>
    </Container>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <Center style={{ height: '100vh' }}>
          <Loader size="lg" />
        </Center>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}