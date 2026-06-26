"use client";

import { useState, useEffect } from 'react';
import { Popover, ScrollArea, Text, Group, Button, Divider, Box, Badge } from '@mantine/core';
import { useRouter } from 'next/navigation';

interface PopoverNotification {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
}

export default function NotificationPopover({
  children,
  unreadCount,
  onNotificationRead,
}: {
  children: React.ReactNode;
  unreadCount: number;
  onNotificationRead?: () => void;
}) {
  const router = useRouter();
  const [opened, setOpened] = useState(false);
  const [notifications, setNotifications] = useState<PopoverNotification[]>([]);

  // 🎯 REALTIME CONNECTION: Tuwing bubuksan, unread notifications lang ang kukunin at ipapakita
  useEffect(() => {
    if (opened) {
      async function fetchMiniNotifications() {
        try {
          const res = await fetch('../api/notifications');
          if (res.ok) {
            const data: PopoverNotification[] = await res.json();
            
            // 📑 FILTER: Kukunin lang ang mga !isRead (unread) bago i-slice sa top 5
            const unreadOnly = data.filter(n => !n.isRead);
            setNotifications(unreadOnly.slice(0, 5));
          }
        } catch (err) {
          console.error("Failed to load popover notification feeds:", err);
        }
      }
      fetchMiniNotifications();
    }
  }, [opened]);

  // Pag-click sa maliit na card sa loob ng dropdown box
  const handleMiniCardClick = async (id: string, messageText: string, isRead: boolean) => {
    try {
      if (!isRead) {
        await fetch('../api/notifications', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            notificationId: id,
          }),
        });

        setNotifications((prev) =>
          prev.filter((n) => n.id !== id)
        );

        onNotificationRead?.();
      }

      const refMatch = messageText.match(/(?:DRAFT-)?[A-Z]+-\d{4}-\d+(?:-\d+)?/);
      
      if (refMatch) {
        setOpened(false); 
        router.push(`/dashboard/forms/iom`);
      } else {
        setOpened(false); 
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <Popover 
      opened={opened} 
      onChange={setOpened} 
      width={340} 
      position="right-start" 
      withArrow 
      shadow="md" 
      trapFocus={false} 
      offset={12}
    >
      <Popover.Target>
        <div onClick={() => setOpened((o) => !o)} style={{ width: '100%', cursor: 'pointer' }}>
          {children}
        </div>
      </Popover.Target>

      <Popover.Dropdown p={0}>
        <Group justify="space-between" p="xs" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
          <Text fw={700} size="sm">Unread Notifications</Text>
          {unreadCount > 0 && <Badge color="red" size="xs">{unreadCount} new</Badge>}
        </Group>

        <ScrollArea.Autosize mah={320} mih={notifications.length === 0 ? 80 : undefined}>
           {notifications.length === 0 ? (
             <Text c="dimmed" size="xs" ta="center" py="lg">No unread notifications.</Text>
           ) : (
             notifications.map((notif) => (
               <Box
                  key={notif.id}
                  p="xs"
                  onClick={() => handleMiniCardClick(notif.id, notif.message, notif.isRead)}
                  style={{
                    borderBottom: '1px solid var(--mantine-color-default-border)',
                    // 🎯 INVERTED DEFAULT STATE: Dahil unread lang ito, makapal na agad ang background kulay nito sa simula
                    backgroundColor: 'rgba(24, 100, 171, 0.25)', 
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  // 🎯 INVERTED HOVER ENGINE: Kapag itinapat ang mouse, hihina ang kulay (papasok ang lumang unread color style)
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(24, 100, 171, 0.12)';
                  }}
                  onMouseLeave={(e) => {
                    // Balik sa solid bold notification indicator background
                    e.currentTarget.style.backgroundColor = 'rgba(24, 100, 171, 0.25)';
                  }}
                >
                  <Text size="xs" fw={700} lineClamp={1}>
                    {notif.title}
                  </Text>
                  <Text size="11px" c="dimmed" lineClamp={2}>
                    {notif.message}
                  </Text>
                </Box>
             ))
           )}
        </ScrollArea.Autosize>

        <Divider />
        <Button 
          variant="subtle" 
          fullWidth 
          size="xs" 
          radius={0}
          onClick={() => {
            setOpened(false); 
            router.push('/dashboard/notifications');
          }}
        >
          See all notifications
        </Button>
      </Popover.Dropdown>
    </Popover>
  );
}