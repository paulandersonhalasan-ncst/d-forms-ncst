'use client';

import { useState } from 'react';
import {
  Modal,
  TextInput,
  Button,
  Stack,
  Text,
  Alert,
  Group,
  ThemeIcon
} from '@mantine/core';
import { IconMail, IconCheck } from '@tabler/icons-react';

interface ForgotPasswordModalProps {
  opened: boolean;
  onClose: () => void;
}

export function ForgotPasswordModal({ opened, onClose }: ForgotPasswordModalProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email address');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/forgot_password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();
      
      // Always show success message (even if email not found)
      setSubmitted(true);
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <Modal
        opened={opened}
        onClose={() => {
          setSubmitted(false);
          setEmail('');
          onClose();
        }}
        title="Check Your Email"
        centered
      >
        <Stack align="center" gap="md">
          <ThemeIcon size={60} radius="xl" color="green" variant="light">
            <IconCheck size={30} />
          </ThemeIcon>
          <Text ta="center" fw={500}>
            If an account exists with the email <strong>{email}</strong>,
            you will receive a password reset link.
          </Text>
          <Text size="sm" c="dimmed" ta="center">
            Please check your inbox (and spam folder) for the reset email.
          </Text>
          <Button fullWidth onClick={() => {
            setSubmitted(false);
            setEmail('');
            onClose();
          }}>
            Close
          </Button>
        </Stack>
      </Modal>
    );
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Forgot Password"
      centered
      closeOnClickOutside={false}
    >
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Enter your registered email address and we will send you a link to reset your password.
          </Text>

          {error && (
            <Alert color="red" title="Error">
              {error}
            </Alert>
          )}

          <TextInput
            label="Email Address"
            placeholder="your.email@domain.com"
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
            required
            type="email"
            leftSection={<IconMail size={16} />}
          />

          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              Send Reset Link
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}