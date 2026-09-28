'use client';

import React, { useState, useEffect } from 'react';   // 🆕 add useEffect
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

const FULL_WIDTH = 260;
const MINI_WIDTH = 72;

export default function DashboardShell({
  role, email, fname, lname, oic_start, oic_end, children,
}: DashboardShellProps) {
  const [sidebarOpened, setSidebarOpened] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return window.innerWidth >= 768;
  });

  // 🆕 Expose sidebar width as global CSS variable
  // Modals will consume this to shift their centering.
  useEffect(() => {
    const width = sidebarOpened ? FULL_WIDTH : MINI_WIDTH;
    document.documentElement.style.setProperty('--sidebar-offset', `${width}px`);
    return () => {
      document.documentElement.style.removeProperty('--sidebar-offset');
    };
  }, [sidebarOpened]);

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar
        role={role}
        email={email}
        fname={fname}
        lname={lname}
        oic_start={oic_start}
        oic_end={oic_end}
        opened={sidebarOpened}
        onToggle={() => setSidebarOpened((o) => !o)}
      />

      <main
        style={{
          flex: 1,
          marginLeft: sidebarOpened ? FULL_WIDTH : MINI_WIDTH,
          padding: 32,
          background: 'var(--background)',
          minHeight: '100vh',
          transition: 'margin-left 0.25s ease',
        }}
      >
        {children}
      </main>
    </div>
  );
}