"use client";

import { useState, useEffect } from 'react';
import { Container, Text, Tabs, Card, Group, Avatar, Stack, Badge, Indicator, Button } from '@mantine/core';
import { IconBell, IconMailOpened, IconFileText, IconAlertTriangle, IconCheck, IconTrash } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';

interface NotificationType {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  recipientId: string;
  senderId: string;
}

export default function NotificationPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationType[]>([]);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const res = await fetch('../../api/notifications');
        if (res.ok && isMounted) {
          const data = await res.json();
          setNotifications(data);
        }
      } catch (err) {
        console.error("Error loading notifications:", err);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleNotifClick = async (id: string, messageText: string, currentIsRead: boolean) => {
    try {
      if (!currentIsRead) {
        setNotifications((prev) => 
          prev.map((n) => n.id === id ? { ...n, isRead: true } : n)
        );

        await fetch('../../api/notifications', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notificationId: id })
        });
      }

      const refMatch = messageText.match(/(?:DRAFT-)?[A-Z]+-\d{4}-\d+(?:-\d+)?/);
      if (refMatch) {
        router.push(`/dashboard/forms/iom`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAll = async () => {
    try {
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      
      await fetch('../../api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true }) 
      });
    } catch (err) {
      console.error(err);
    }
  };

  // ⚙️ BAGONG FUNCTION: Pag-clear at delete ng lahat ng notifications ng user
  const handleClearAll = async () => {
    const confirmClear = window.confirm("Are you sure you want to clear your notifications?");
    if (!confirmClear) return;

    try {
      // 1. Instant UI update para ramdam agad ng user ang bilis
      setNotifications([]);

      // 2. Fire and forget sa API para burahin na sa tables ng database niyo
      await fetch('../../api/notifications', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (err) {
      console.error("Failed to clear notifications:", err);
    }
  };

  return (
    <Container size="md" py="xl">
      <Group justify="space-between" mb="lg">
        <Stack gap={2}>
          <Text size="xl" fw={700}>Notification Center</Text>
        </Stack>
        
        <Group gap="xs">
          {/* Lalabas lang ang 'Mark all as read' kung may unread notifications */}
          {notifications.some(n => !n.isRead) && (
            <Button variant="light" color="blue" size="xs" leftSection={<IconCheck size={14} />} onClick={handleMarkAll}>
              Mark all as read
            </Button>
          )}

          {/* 🎯 BAGONG BUTTON: Lalabas lang kapag hindi zero ang notification data list */}
          {notifications.length > 0 && (
            <Button variant="light" color="red" size="xs" leftSection={<IconTrash size={14} />} onClick={handleClearAll}>
              Clear all
            </Button>
          )}
        </Group>
      </Group>

      <Tabs defaultValue="all" variant="outline" radius="md">
        <Tabs.List mb="md">
          <Tabs.Tab value="all" leftSection={<IconBell size={16} />}>All</Tabs.Tab>
          <Tabs.Tab value="unread" leftSection={<IconMailOpened size={16} />}>
            Unread <Badge size="xs" color="red" ml={4}>{notifications.filter(n => !n.isRead).length}</Badge>
          </Tabs.Tab>
        </Tabs.List>

        {/* --- TAB PANEL: ALL NOTIFICATIONS --- */}
        <Tabs.Panel value="all">
          <Stack gap="xs">
            {notifications.length === 0 ? (
              <Text c="dimmed" size="sm" ta="center" py="xl">Walang notification sa account mo ngayon.</Text>
            ) : (
              notifications.map((notif) => (
                <Card 
                  key={notif.id} 
                  withBorder 
                  p="sm"
                  radius="md"
                  onClick={() => handleNotifClick(notif.id, notif.message, notif.isRead)}
                  style={{ 
                    backgroundColor: !notif.isRead 
                      ? 'rgba(24, 100, 171, 0.12)' 
                      : 'transparent',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    const isDarkMode = document.documentElement.getAttribute('data-mantine-color-scheme') === 'dark';
                    
                    if (!notif.isRead) {
                      e.currentTarget.style.backgroundColor = isDarkMode 
                        ? 'rgba(24, 100, 171, 0.25)' 
                        : 'var(--mantine-color-blue-1)';
                    } else {
                      e.currentTarget.style.backgroundColor = isDarkMode 
                        ? 'var(--mantine-color-dark-5)' 
                        : 'var(--mantine-color-gray-0)';
                    }
                    
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = 'var(--mantine-shadow-xs)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = !notif.isRead 
                      ? 'rgba(24, 100, 171, 0.12)' 
                      : 'transparent';
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <Group justify="space-between" align="flex-start" wrap="nowrap">
                    <Group gap="sm" align="flex-start" wrap="nowrap">
                      <Indicator color="red" disabled={notif.isRead} offset={2} size={8}>
                        <Avatar color={notif.title.toLowerCase().includes('denied') || notif.title.toLowerCase().includes('disapproved') ? 'red' : 'blue'} radius="md">
                          {notif.title.toLowerCase().includes('denied') || notif.title.toLowerCase().includes('disapproved') ? <IconAlertTriangle size={18} /> : <IconFileText size={18} />}
                        </Avatar>
                      </Indicator>

                      <Stack gap={2}>
                        <Text size="sm" fw={!notif.isRead ? 700 : 500}>{notif.title}</Text>
                        <Text size="xs" c="dimmed">{notif.message}</Text>
                        <Text size="10px" c="dimmed">{new Date(notif.createdAt).toLocaleString()}</Text>
                      </Stack>
                    </Group>
                  </Group>
                </Card>
              ))
            )}
          </Stack>
        </Tabs.Panel>

        {/* --- TAB PANEL: UNREAD ONLY --- */}
        <Tabs.Panel value="unread">
          <Stack gap="xs">
            {notifications.filter(n => !n.isRead).length === 0 ? (
              <Text c="dimmed" size="sm" ta="center" py="xl">Malinis ang inbox mo! Lahat ay nabasa mo na.</Text>
            ) : (
              notifications
                .filter((n) => !n.isRead)
                .map((notif) => (
                  <Card 
                    key={notif.id} 
                    withBorder 
                    p="sm"
                    radius="md"
                    onClick={() => handleNotifClick(notif.id, notif.message, notif.isRead)}
                    style={{ 
                      backgroundColor: !notif.isRead 
                        ? 'rgba(24, 100, 171, 0.12)' 
                        : 'transparent',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      const isDarkMode = document.documentElement.getAttribute('data-mantine-color-scheme') === 'dark';
                      
                      if (!notif.isRead) {
                        e.currentTarget.style.backgroundColor = isDarkMode 
                          ? 'rgba(24, 100, 171, 0.25)' 
                          : 'var(--mantine-color-blue-1)';
                      } else {
                        e.currentTarget.style.backgroundColor = isDarkMode 
                          ? 'var(--mantine-color-dark-5)' 
                          : 'var(--mantine-color-gray-0)';
                      }
                      
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = 'var(--mantine-shadow-xs)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = !notif.isRead 
                        ? 'rgba(24, 100, 171, 0.12)' 
                        : 'transparent';
                      e.currentTarget.style.transform = 'none';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <Group justify="space-between" align="flex-start" wrap="nowrap">
                      <Group gap="sm" align="flex-start" wrap="nowrap">
                        <Indicator color="red" offset={2} size={8}>
                          <Avatar color={notif.title.toLowerCase().includes('denied') || notif.title.toLowerCase().includes('disapproved') ? 'red' : 'blue'} radius="md">
                            {notif.title.toLowerCase().includes('denied') || notif.title.toLowerCase().includes('disapproved') ? <IconAlertTriangle size={18} /> : <IconFileText size={18} />}
                          </Avatar>
                        </Indicator>

                        <Stack gap={2}>
                          <Text size="sm" fw={700}>{notif.title}</Text>
                          <Text size="xs" c="dimmed">{notif.message}</Text>
                          <Text size="10px" c="dimmed">{new Date(notif.createdAt).toLocaleString()}</Text>
                        </Stack>
                      </Group>
                    </Group>
                  </Card>
                ))
            )}
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </Container>
  );
}