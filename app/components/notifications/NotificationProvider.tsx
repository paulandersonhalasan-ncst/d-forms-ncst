// app/components/notifications/notificationProvider.tsx

"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import useSWR from 'swr';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt?: string;
  recipientId?: string;
  senderId?: string;
  // Routing metadata
  linkUrl?: string | null;
  entityType?: string | null;
  entityId?: string | null;
}

interface NotificationsResponse {
  notifications: NotificationItem[];
  count: number;
}

interface NotificationContextType {
  notifications: NotificationItem[];
  unreadCount: number;
  isLoading: boolean;
  error: Error | null;
  mutate: () => void;
  refresh: () => void;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  clearAll: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const fetcher = (url: string) => fetch(url).then(res => res.json());

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(false);

  const { data, mutate, error } = useSWR<NotificationsResponse>(
    '/api/notifications',
    fetcher,
    {
      refreshInterval: 15000,
      revalidateOnFocus: true,
      shouldRetryOnError: false,
    }
  );

  const notifications = data?.notifications || [];
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  useEffect(() => {
    const handleRefresh = () => mutate();
    window.addEventListener('refresh-notifications', handleRefresh);
    return () => window.removeEventListener('refresh-notifications', handleRefresh);
  }, [mutate]);

  const markAsRead = useCallback(async (id: string) => {
    try {
      mutate(
        {
          ...data,
          notifications: notifications.map((n) =>
            n.id === id ? { ...n, isRead: true } : n
          ),
          count: (data?.count || 0) - 1,
        },
        false
      );

      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId: id }),
      });

      mutate();
    } catch (err) {
      console.error('Failed to mark as read:', err);
      mutate();
    }
  }, [data, notifications, mutate]);

  const markAllAsRead = useCallback(async () => {
    try {
      mutate(
        {
          ...data,
          notifications: notifications.map((n) => ({ ...n, isRead: true })),
          count: 0,
        },
        false
      );

      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true }),
      });

      mutate();
    } catch (err) {
      console.error('Failed to mark all as read:', err);
      mutate();
    }
  }, [data, notifications, mutate]);

  const clearAll = useCallback(async () => {
    const confirmClear = window.confirm('Are you sure you want to clear your notifications?');
    if (!confirmClear) return;

    try {
      mutate({ ...data, notifications: [], count: 0 }, false);

      await fetch('/api/notifications', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });

      mutate();
    } catch (err) {
      console.error('Failed to clear notifications:', err);
      mutate();
    }
  }, [data, mutate]);

  const refresh = useCallback(() => {
    mutate();
  }, [mutate]);

  const value: NotificationContextType = {
    notifications,
    unreadCount,
    isLoading,
    error: error || null,
    mutate,
    refresh,
    markAsRead,
    markAllAsRead,
    clearAll,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}