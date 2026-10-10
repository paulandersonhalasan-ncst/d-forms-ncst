'use client';

import React, { useState, useEffect } from 'react';
import { useMediaQuery } from '@mantine/hooks';
import { Burger } from '@mantine/core';
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

  const isMobile = useMediaQuery('(max-width: 768px)');
  const [mobileOpened, setMobileOpened] = useState(false);

  const [prevIsMobile, setPrevIsMobile] = useState(isMobile);
  if (isMobile !== prevIsMobile) {
    setPrevIsMobile(isMobile);
    if (!isMobile && mobileOpened) {
      setMobileOpened(false);
    }
  }

  // Expose sidebar offset to modals
  useEffect(() => {
    const offset = isMobile ? 0 : MINI_WIDTH;
    document.documentElement.style.setProperty('--sidebar-offset', `${offset}px`);
    return () => {
      document.documentElement.style.removeProperty('--sidebar-offset');
    };
  }, [isMobile]);
  // Close drawer on route-change navigation is handled inside Sidebar

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Mobile hamburger — floating top-left */}
      {isMobile && (
        <div
          style={{
            position: 'fixed',
            top: 12,
            left: 12,
            zIndex: 220,
            width: 44,
            height: 44,
            background: 'var(--mantine-color-body)',
            borderRadius: 8,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
          onClick={() => setMobileOpened((o) => !o)}
          role="button"
          aria-label="Toggle navigation"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setMobileOpened((o) => !o);
            }
          }}
        >
          <Burger
            opened={mobileOpened}
            size="sm"
            aria-label="Toggle navigation"
            style={{ pointerEvents: 'none' }}
          />
        </div>
      )}

      <Sidebar
        role={role}
        email={email}
        fname={fname}
        lname={lname}
        oic_start={oic_start}
        oic_end={oic_end}
        isMobile={isMobile}
        mobileOpened={mobileOpened}
        onMobileClose={() => setMobileOpened(false)}
      />

      <main
        style={{
          marginLeft: isMobile ? 0 : MINI_WIDTH,
          padding: isMobile ? 16 : 32,
          paddingTop: isMobile ? 72 : 32,
          background: 'var(--background)',
          minHeight: '100vh',
          overflowX: 'hidden',
          filter: isMobile ? 'none' : 'blur(calc(16px * var(--sidebar-hovered, 0)))',
          transition:
            'filter 0.3s cubic-bezier(0.4, 0, 0.2, 1), margin-left 0.25s ease, padding 0.25s ease',
          willChange: 'filter',
          pointerEvents: isMobile
            ? 'auto'
            : ('var(--sidebar-hovered-pointer, auto)' as React.CSSProperties['pointerEvents']),
        }}
      >
        {children}
      </main>
    </div>
  );
}