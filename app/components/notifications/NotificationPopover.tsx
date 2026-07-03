// app/components/notifications/notificationPopover.tsx

"use client";

import { useState } from 'react';
import { Popover, ScrollArea, Text, Group, Button, Divider, Box, Badge, LoadingOverlay, Avatar, ThemeIcon } from '@mantine/core';
import { useRouter } from 'next/navigation';
import { IconBell, IconFileText, IconAlertTriangle, IconCircleCheck, IconClock } from '@tabler/icons-react';
import { useNotifications } from './NotificationProvider';

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

export default function NotificationPopover({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [opened, setOpened] = useState(false);
  const [visible, setVisible] = useState(false);

  // 🟢 Kumuha ng data mula sa context - KASAMA ang unreadCount at isLoading!
  const { notifications, unreadCount, isLoading, markAsRead } = useNotifications();

  const unreadList = notifications.filter((n) => !n.isRead);

  const handleMiniCardClick = async (id: string, messageText: string, isRead: boolean) => {
    try {
      setVisible(true);
      if (!isRead) {
        await markAsRead(id);
      }

      const refMatch = messageText.match(/(?:DRAFT-)?[A-Z]+-\d{4}-\d+(?:-\d+)?/);
      if (refMatch) {
        setOpened(false);
        router.push('/dashboard/forms/iom');
      } else {
        setOpened(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setVisible(false);
    }
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
      offset={12}
      zIndex={5000}
      radius="md"
    >
      <Popover.Target>
        <div onClick={() => setOpened((o) => !o)} style={{ width: '100%', cursor: 'pointer', position: 'relative' }}>
          {children}
        </div>
      </Popover.Target>

      <Popover.Dropdown p={0} style={{ overflow: 'hidden' }}>
        <Box pos="relative">
          <LoadingOverlay visible={visible} zIndex={1000} overlayProps={{ radius: 'sm', blur: 2 }} />

          <Group justify="space-between" p="md" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
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
                    onClick={() => handleMiniCardClick(notif.id, notif.message, notif.isRead)}
                    style={{
                      borderBottom: '1px solid var(--mantine-color-default-border)',
                      backgroundColor: 'rgba(24, 100, 171, 0.08)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
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

          <Divider />
          <Button
            variant="subtle"
            fullWidth
            size="sm"
            radius={0}
            py="sm"
            onClick={() => {
              setOpened(false);
              router.push('/dashboard/notifications');
            }}
          >
            See all notifications →
          </Button>
        </Box>
      </Popover.Dropdown>
    </Popover>
  );
}