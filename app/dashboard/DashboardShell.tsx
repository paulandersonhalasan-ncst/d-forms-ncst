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
          marginLeft: MINI_WIDTH,     // 🆕 hindi na sumasabay sa hover
          padding: 32,
          background: 'var(--background)',
          minHeight: '100vh',
          transition: 'margin-left 0.25s ease',
        }}
      >
        {children}
      
      {/* 🆕 Subtle dark overlay kapag naka-hover ang sidebar */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          background: '#000',
          opacity: 'calc(0.6 * var(--sidebar-hovered, 0))',
          transition: 'opacity 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
          pointerEvents: 'none',
          zIndex: 99,
        }}
      />
      </main>
    </div>
  );
}