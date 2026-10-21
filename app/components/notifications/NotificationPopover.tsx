// app/components/notifications/notificationPopover.tsx

"use client";

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Popover,
  ScrollArea,
  Text,
  Group,
  Button,
  Box,
  Badge,
  Avatar,
} from '@mantine/core';
import { IconBell, IconFileText, IconAlertTriangle, IconCircleCheck, IconClock } from '@tabler/icons-react';
import { useNotifications, NotificationItem } from './NotificationProvider';

const getNotificationIcon = (title: string) => {
  const lowerTitle = title.toLowerCase();
  if (lowerTitle.includes('denied') || lowerTitle.includes('disapproved')) {
    return { icon: IconAlertTriangle, color: 'red' };
  }
  if (lowerTitle.includes('approved') || lowerTitle.includes('acknowledged')) {
    return { icon: IconCircleCheck, color: 'green' };
  }
  if (lowerTitle.includes('draft') || lowerTitle.includes('review')) {
    return { icon: IconClock, color: 'orange' };
  }
  return { icon: IconFileText, color: 'blue' };
};

export function resolveNotificationRoute(notif: NotificationItem): string | null {
  if (notif.linkUrl) return notif.linkUrl;

  if (notif.entityType === 'FRF' && notif.entityId) {
    return `/dashboard/forms/frf?focus=${notif.entityId}`;
  }
  if ((notif.entityType === 'IOM' || notif.entityType === 'MEMO') && notif.entityId) {
    return `/dashboard/forms/iom?focus=${notif.entityId}`;
  }

  const refMatch = notif.message.match(/(?:DRAFT-)?[A-Z]+-\d{4}-\d+(?:-\d+)?/);
  if (refMatch) return '/dashboard/forms/iom';
  return null;
}

interface NotificationPopoverProps {
  children: React.ReactNode;
  // 🆕 Fired right before any navigation — parent uses this to collapse its own hover state
  onNavigate?: () => void;
}

export default function NotificationPopover({ children, onNavigate }: NotificationPopoverProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [opened, setOpened] = useState(false);

  // Force-close on any route change
  const [prevPath, setPrevPath] = useState(pathname);
  if (pathname !== prevPath) {
    setPrevPath(pathname);
    if (opened) setOpened(false);
  }

  const { notifications, unreadCount, isLoading, markAsRead } = useNotifications();

  const unreadList = notifications.filter((n) => !n.isRead);

  const handleMiniCardClick = (notif: NotificationItem) => {
    setOpened(false);
    onNavigate?.();     // 🆕 collapse navbar BEFORE navigation
    if (!notif.isRead) {
      markAsRead(notif.id).catch((err) =>
        console.error('markAsRead failed:', err)
      );
    }
    const route = resolveNotificationRoute(notif);
    if (route) router.push(route);
  };

  const handleSeeAll = () => {
    setOpened(false);
    onNavigate?.();     // 🆕 collapse navbar BEFORE navigation
    router.push('/dashboard/notifications');
  };

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      width={360}
      position="right-start"
      withArrow
      shadow="lg"
      trapFocus={false}
      withinPortal
      returnFocus={false}
      closeOnClickOutside
      closeOnEscape
      offset={12}
      zIndex={5000}
      radius="md"
      transitionProps={{ duration: 0 }}
    >
      <Popover.Target>
        <div
          onClick={() => setOpened((o) => !o)}
          style={{ width: '100%', cursor: 'pointer', position: 'relative' }}
        >
          {children}
        </div>
      </Popover.Target>

      <Popover.Dropdown p={0}>
        <Group
          justify="space-between"
          p="md"
          style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}
        >
          <Group gap="xs">
            <IconBell size={18} />
            <Text fw={700} size="sm">Notifications</Text>
          </Group>
          <Badge color={unreadCount > 0 ? 'red' : 'gray'} size="sm">
            {unreadCount} new
          </Badge>
        </Group>

        <ScrollArea.Autosize mah={380} mih={unreadList.length === 0 ? 80 : undefined}>
          {isLoading && unreadList.length === 0 ? (
            <Text c="dimmed" size="xs" ta="center" py="lg">Loading...</Text>
          ) : unreadList.length === 0 ? (
            <Box ta="center" py="xl">
              <Text c="dimmed" size="sm">No unread notifications</Text>
            </Box>
          ) : (
            unreadList.map((notif) => {
              const { icon: Icon, color } = getNotificationIcon(notif.title);
              return (
                <Box
                  key={notif.id}
                  p="sm"
                  onClick={() => handleMiniCardClick(notif)}
                  style={{
                    borderBottom: '1px solid var(--mantine-color-default-border)',
                    backgroundColor: 'rgba(24, 100, 171, 0.08)',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(24, 100, 171, 0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(24, 100, 171, 0.08)';
                  }}
                >
                  <Group gap="sm" wrap="nowrap" align="flex-start">
                    <Avatar color={color} radius="md" size={32}>
                      <Icon size={14} />
                    </Avatar>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text size="xs" fw={700} lineClamp={1}>
                        {notif.title}
                      </Text>
                      <Text size="11px" c="dimmed" lineClamp={2}>
                        {notif.message}
                      </Text>
                    </div>
                    <Badge color="blue" size="xs" variant="filled" circle style={{ flexShrink: 0 }} />
                  </Group>
                </Box>
              );
            })
          )}
        </ScrollArea.Autosize>

        <Box p="xs" style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}>
          <Button
            variant="subtle"
            fullWidth
            size="sm"
            radius="md"
            onClick={handleSeeAll}
          >
            See all notifications
          </Button>
        </Box>
      </Popover.Dropdown>
    </Popover>
  );
}