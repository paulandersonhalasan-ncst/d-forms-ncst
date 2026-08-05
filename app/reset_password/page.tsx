'use client';

import { Suspense, useState, useEffect } from 'react';
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
import { IconCheck, IconX, IconAlertCircle, IconLock } from '@tabler/icons-react';

// Helper: validate password against all rules
function validatePassword(password: string) {
  const rules = {
    length: password.length > 8,
    symbol: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/.test(password),
    uppercase: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    noNcst: !/ncst/i.test(password),
  };
  const allValid = Object.values(rules).every(Boolean);
  return { rules, allValid };
}

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

  // Live validation state
  const { rules, allValid } = validatePassword(newPassword);
  const passwordsMatch = confirmPassword === '' || newPassword === confirmPassword;

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
      } catch {
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

    // Final validation (should already be prevented by button disable, but double‑check)
    if (!allValid) {
      setError('Please meet all password requirements.');
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
    } catch {
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
            />

            {/* Live validation summary */}
            <Stack gap="xs" ml="sm">
              <Group gap="xs">
                <ThemeIcon size="xs" color={rules.length ? 'green' : 'gray'} variant="light" radius="xl">
                  {rules.length ? <IconCheck size={12} /> : <IconX size={12} />}
                </ThemeIcon>
                <Text size="sm" c={rules.length ? 'green' : 'dimmed'}>
                  More than 8 characters
                </Text>
              </Group>
              <Group gap="xs">
                <ThemeIcon size="xs" color={rules.symbol ? 'green' : 'gray'} variant="light" radius="xl">
                  {rules.symbol ? <IconCheck size={12} /> : <IconX size={12} />}
                </ThemeIcon>
                <Text size="sm" c={rules.symbol ? 'green' : 'dimmed'}>
                  At least one symbol
                </Text>
              </Group>
              <Group gap="xs">
                <ThemeIcon size="xs" color={rules.uppercase ? 'green' : 'gray'} variant="light" radius="xl">
                  {rules.uppercase ? <IconCheck size={12} /> : <IconX size={12} />}
                </ThemeIcon>
                <Text size="sm" c={rules.uppercase ? 'green' : 'dimmed'}>
                  At least one uppercase letter
                </Text>
              </Group>
              <Group gap="xs">
                <ThemeIcon size="xs" color={rules.number ? 'green' : 'gray'} variant="light" radius="xl">
                  {rules.number ? <IconCheck size={12} /> : <IconX size={12} />}
                </ThemeIcon>
                <Text size="sm" c={rules.number ? 'green' : 'dimmed'}>
                  At least one number (0–9)
                </Text>
              </Group>
              <Group gap="xs">
                <ThemeIcon size="xs" color={rules.noNcst ? 'green' : 'gray'} variant="light" radius="xl">
                  {rules.noNcst ? <IconCheck size={12} /> : <IconX size={12} />}
                </ThemeIcon>
                <Text size="sm" c={rules.noNcst ? 'green' : 'dimmed'}>
                  Must not contain &rdquo;NCST&rdquo; (case‑insensitive)
                </Text>
              </Group>
            </Stack>

            <PasswordInput
              label="Confirm New Password"
              placeholder="Re-enter your new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.currentTarget.value)}
              required
              error={confirmPassword && !passwordsMatch ? 'Passwords do not match' : undefined}
            />

            <Group justify="flex-end" mt="md">
              <Button variant="subtle" onClick={() => router.push('/')}>
                Cancel
              </Button>
              <Button
                type="submit"
                loading={loading}
                disabled={!allValid || !passwordsMatch || loading}
              >
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