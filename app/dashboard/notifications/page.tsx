"use client";

import { useState } from 'react';
import { 
  Container, 
  Text, 
  Tabs, 
  Group, 
  Avatar, 
  Stack, 
  Badge, 
  Button, 
  Box, 
  LoadingOverlay,
  Paper,
  Divider,
  Title,
  ThemeIcon,
  ActionIcon,
  Tooltip,
} from '@mantine/core';
import { 
  IconBell, 
  IconMailOpened, 
  IconFileText, 
  IconAlertTriangle, 
  IconCheck, 
  IconTrash, 
  IconCircleCheck,
  IconClock,
} from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useNotifications, NotificationItem } from '../../components/notifications/NotificationProvider';

type IconComponent = React.ComponentType<{ size?: number | string; stroke?: number | string; color?: string }>;

export default function NotificationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<string | null>('all');

  const { 
    notifications, 
    unreadCount, 
    isLoading, 
    error, 
    markAsRead, 
    markAllAsRead, 
    clearAll 
  } = useNotifications();

  const handleNotifClick = async (id: string, messageText: string, currentIsRead: boolean) => {
    try {
      setLoading(true);
      if (!currentIsRead) {
        await markAsRead(id);
      }

      const refMatch = messageText.match(/(?:DRAFT-)?[A-Z]+-\d{4}-\d+(?:-\d+)?/);
      if (refMatch) {
        router.push('/dashboard/forms/iom');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getNotificationIcon = (title: string): { icon: IconComponent; color: string } => {
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

  // ✅ FIX: allow undefined
  const getTimeAgo = (dateString?: string) => {
    if (!dateString) return 'Unknown';
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const filteredNotifications: NotificationItem[] = activeTab === 'all' 
    ? notifications 
    : notifications.filter((n: NotificationItem) => !n.isRead);

  if (error) {
    return (
      <Container size="md" py="xl">
        <Paper p="xl" radius="md" withBorder bg="red.0">
          <Group gap="sm">
            <ThemeIcon color="red" size="lg" radius="xl">
              <IconAlertTriangle size={24} />
            </ThemeIcon>
            <div>
              <Text fw={700} c="red">Failed to load notifications</Text>
              <Text size="sm" c="dimmed">{error.message}</Text>
            </div>
          </Group>
        </Paper>
      </Container>
    );
  }

  return (
    <Box pos="relative" style={{ minHeight: '100vh' }}>
      <LoadingOverlay visible={loading || isLoading} zIndex={1000} overlayProps={{ blur: 2, radius: 'sm' }} />

      <Container size="lg" py="xl">
        <Paper p="xl" radius="md" withBorder mb="lg">
          <Group justify="space-between" align="flex-start">
            <Stack gap={4}>
              <Group gap="sm">
                <ThemeIcon size="lg" variant="light" color="blue" radius="md">
                  <IconBell size={24} />
                </ThemeIcon>
                <Title order={2} fw={700}>Notifications</Title>
              </Group>
              <Text size="sm" c="dimmed" ml={52}>
                Stay updated with all your memo and system notifications
              </Text>
            </Stack>

            <Group gap="xs">
              {unreadCount > 0 && (
                <Button variant="light" color="blue" size="sm" leftSection={<IconCheck size={16} />} onClick={markAllAsRead}>
                  Mark all as read
                </Button>
              )}
              {notifications.length > 0 && (
                <Button variant="light" color="red" size="sm" leftSection={<IconTrash size={16} />} onClick={clearAll}>
                  Clear all
                </Button>
              )}
            </Group>
          </Group>

          <Group gap="xl" mt="md" ml={52}>
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Total</Text>
              <Text fw={700} size="lg">{notifications.length}</Text>
            </div>
            <Divider orientation="vertical" />
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Unread</Text>
              <Text fw={700} size="lg" c={unreadCount > 0 ? 'red' : 'dimmed'}>
                {unreadCount}
              </Text>
            </div>
            <Divider orientation="vertical" />
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Read</Text>
              <Text fw={700} size="lg" c="green">
                {notifications.filter((n: NotificationItem) => n.isRead).length}
              </Text>
            </div>
          </Group>
        </Paper>

        <Tabs value={activeTab} onChange={setActiveTab} variant="outline" radius="md">
          <Tabs.List mb="lg">
            <Tabs.Tab 
              value="all" 
              leftSection={<IconBell size={16} />}
              rightSection={<Badge size="xs" variant="filled" color="gray">{notifications.length}</Badge>}
            >
              All
            </Tabs.Tab>
            <Tabs.Tab 
              value="unread" 
              leftSection={<IconMailOpened size={16} />}
              rightSection={unreadCount > 0 && <Badge size="xs" variant="filled" color="red">{unreadCount}</Badge>}
            >
              Unread
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="all" pt="sm">
            <NotificationsList 
              notifications={filteredNotifications}
              onNotifClick={handleNotifClick}
              getNotificationIcon={getNotificationIcon}
              getTimeAgo={getTimeAgo}
            />
          </Tabs.Panel>

          <Tabs.Panel value="unread" pt="sm">
            <NotificationsList 
              notifications={filteredNotifications}
              onNotifClick={handleNotifClick}
              getNotificationIcon={getNotificationIcon}
              getTimeAgo={getTimeAgo}
              showUnreadOnly
            />
          </Tabs.Panel>
        </Tabs>
      </Container>
    </Box>
  );
}

interface NotificationsListProps {
  notifications: NotificationItem[];
  onNotifClick: (id: string, message: string, isRead: boolean) => void;
  getNotificationIcon: (title: string) => { icon: IconComponent; color: string };
  getTimeAgo: (date?: string) => string; // ✅ allow undefined
  showUnreadOnly?: boolean;
}

function NotificationsList({ 
  notifications, 
  onNotifClick,
  getNotificationIcon,
  getTimeAgo,
  showUnreadOnly = false,
}: NotificationsListProps) {
  if (notifications.length === 0) {
    return (
      <Paper p="xl" radius="md" withBorder ta="center">
        <ThemeIcon size="xl" variant="light" color="gray" radius="xl" mx="auto" mb="sm">
          {showUnreadOnly ? <IconMailOpened size={32} /> : <IconBell size={32} />}
        </ThemeIcon>
        <Text fw={600} size="lg">
          {showUnreadOnly ? 'No unread notifications' : 'No notifications yet'}
        </Text>
        <Text size="sm" c="dimmed" mt={4}>
          {showUnreadOnly ? 'You have read all your notifications. Great job! 👏' : 'When you receive notifications, they will appear here.'}
        </Text>
      </Paper>
    );
  }

  return (
    <Stack gap="sm">
      {notifications.map((notif: NotificationItem) => {
        const { icon: Icon, color } = getNotificationIcon(notif.title);
        const isUnread = !notif.isRead;
        const timeAgo = getTimeAgo(notif.createdAt); // ✅ undefined allowed

        return (
          <Paper
            key={notif.id}
            p="md"
            radius="md"
            withBorder={!isUnread}
            style={{
              backgroundColor: isUnread ? 'rgba(24, 100, 171, 0.06)' : 'transparent',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              borderColor: isUnread ? 'var(--mantine-color-blue-3)' : 'var(--mantine-color-gray-3)',
              borderWidth: isUnread ? '2px' : '1px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = 'var(--mantine-shadow-md)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
            onClick={() => onNotifClick(notif.id, notif.message, notif.isRead)}
          >
            <Group gap="md" wrap="nowrap" align="flex-start">
              <Box pos="relative">
                <Avatar color={color} radius="md" size={44}>
                  <Icon size={22} />
                </Avatar>
                {isUnread && (
                  <Box
                    style={{
                      position: 'absolute',
                      top: -2,
                      right: -2,
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      backgroundColor: 'var(--mantine-color-blue-6)',
                      border: '2px solid var(--mantine-color-white)',
                    }}
                  />
                )}
              </Box>

              <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
                <Group justify="space-between" wrap="nowrap">
                  <Text size="sm" fw={isUnread ? 700 : 500} lineClamp={1}>
                    {notif.title}
                  </Text>
                  <Text size="10px" c="dimmed" style={{ whiteSpace: 'nowrap' }}>{timeAgo}</Text>
                </Group>
                <Text size="13px" c="dimmed" lineClamp={2}>{notif.message}</Text>
                {!isUnread && (
                  <Text size="10px" c="dimmed" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <IconCircleCheck size={10} /> Read
                  </Text>
                )}
              </Stack>

              <Box>
                {isUnread && <Badge color="blue" size="xs" variant="filled">New</Badge>}
                <Tooltip label={isUnread ? 'Mark as read' : 'Already read'}>
                  <ActionIcon variant="subtle" color="gray" size="sm" onClick={(e) => { e.stopPropagation(); if (isUnread) onNotifClick(notif.id, notif.message, notif.isRead); }}>
                    {isUnread ? <IconCheck size={14} /> : <IconCircleCheck size={14} />}
                  </ActionIcon>
                </Tooltip>
              </Box>
            </Group>
          </Paper>
        );
      })}
    </Stack>
  );
}