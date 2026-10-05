'use client';

import React, { useState, useEffect } from 'react';
import Sidebar from '../components/navbar';

interface DashboardShellProps {
  role: "SuperUser" | "OIC" | "DepartmentHead" | "Staff" | "Admin" | "Faculty";
  email: string;
  fname: string;
  lname: string;
  oic_start?: string | null;
  oic_end?: string | null;
  children: React.ReactNode;
}

const MINI_WIDTH = 72;

export default function DashboardShell({
  role, email, fname, lname, oic_start, oic_end, children,
}: DashboardShellProps) {
  // 🆕 Always expose the MINI width to modals — hover should not shift them
  useEffect(() => {
    document.documentElement.style.setProperty('--sidebar-offset', `${MINI_WIDTH}px`);
    return () => {
      document.documentElement.style.removeProperty('--sidebar-offset');
    };
  }, []);

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Sidebar is self-managed: mini by default, expands on hover */}
      <Sidebar
        role={role}
        email={email}
        fname={fname}
        lname={lname}
        oic_start={oic_start}
        oic_end={oic_end}
      />

      <main
        style={{
          marginLeft: MINI_WIDTH,
          padding: 32,
          background: 'var(--background)',
          minHeight: '100vh',

          filter: 'blur(calc(16px * var(--sidebar-hovered, 0)))',
          transition: 'filter 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          willChange: 'filter',

          pointerEvents: 'var(--sidebar-hovered-pointer, auto)' as React.CSSProperties['pointerEvents'],
        }}
      >
        {children}
      </main>
    </div>
  );
}