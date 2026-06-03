"use client";

import { useState } from "react";
import {
    IconGauge,
    IconUsersGroup,
    IconShieldLock,
    IconSettings,
    IconLogout,
    IconChevronRight
} from "@tabler/icons-react";
import { Code, Group, ScrollArea, Box, Text, UnstyledButton } from "@mantine/core";
import { useRouter, usePathname } from "next/navigation";

interface SidebarProps {
    role: "SuperUser" | "CoAdmin" | "DepartmentHead" | "Staff";
    email: string;
}

//menu data
const schoolMenuData = [
    { label: "Dashboard", icon: IconGauge, link: "/dashboard" },
    { label: "User Management", icon: IconUsersGroup, link: "/dashboard/users" },
    { label: "Audit Logs", icon: IconShieldLock, link: "/dashboard/logs" },
    { label: "Settings", icon: IconSettings, link: "/dashboard/settings" },

    /* REFERENCE PARA SA NESTED LINKS (NAKA-COMMENT OUT GAYA NG REQ MO)
    {
        label: 'Security',
        icon: IconLock,
        links: [
        { label: 'Enable 2FA', link: '/dashboard/security/2fa' },
        { label: 'Change password', link: '/dashboard/security/password' },
        ],
    },
    */
];

export default function Sidebar({ role, email }: SidebarProps) {
    const router = useRouter();
    const pathname = usePathname();

    // 🎨 DYNAMIC COLORS BASE SA ROLE NA PINLANO MO
    let sidebarBg = "";
    let textColor = "#fff8f2"; // Seashell text
    let hoverBg = "rgba(255, 255, 255, 0.1)";
    let activeBg = "rgba(255, 255, 255, 0.15)";

    switch (role) {
    case "SuperUser":
        sidebarBg = "var(--mantine-color-dark-8)"; // Gray/Black
        break;
    case "CoAdmin":
    case "DepartmentHead":
        sidebarBg = "var(--mantine-color-imperialBlue-6)"; // Imperial Blue
        break;
    case "Staff":
        sidebarBg = "var(--mantine-color-schoolBusYellow-5)"; // School Bus Yellow
        textColor = "#242424"; // Carbon Black text para mabasa sa dilaw
        hoverBg = "rgba(0, 0, 0, 0.05)";
        activeBg = "rgba(0, 0, 0, 0.1)";
        break;
    default:
        sidebarBg = "var(--mantine-color-gray-6)";
        break;
    }

    const handleLogout = async () => {
        try {
            const res = await fetch("/api/auth/logout", { method: "DELETE" });
            if (res.ok) {
                // Navigate to frontend login page
                router.push("/");
            } else {
                console.error("Logout failed:", await res.text());
            }
        } catch (err) {
            console.error("Logout error:", err);
        }
    };

    return (
        <nav style={{
        width: 260,
        height: "100vh",
        background: sidebarBg,
        color: textColor,
        display: "flex",
        flexDirection: "column",
        borderRight: "1px solid rgba(0,0,0,0.05)",
        position: "fixed", // Naka-steady sa kaliwa habang nag-scroscroll ang gitna
        left: 0,
        top: 0,
        transition: "background-color 0.3s ease"
        }}>
        {/* HEADER: Logo at Bersyon */}
        <div style={{ padding: 24, borderBottom: role === "Staff" ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,255,255,0.08)" }}>
            <Group justify="space-between">
            <Text fw={800} size="xl">🏫 SchoolPortal</Text>
            <Code fw={700} style={{ 
                background: role === "Staff" ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.15)",
                color: textColor 
            }}>
                v1.0.0
            </Code>
            </Group>
            <Text size="xs" fw={700} mt="xs" style={{ opacity: 0.7 }}>
            ROLE: {role.toUpperCase()}
            </Text>
        </div>

        {/* BODY: Ang mga Links / Navigation (Scrollable kung madami) */}
        <ScrollArea style={{ flex: 1, padding: "16px 0" }}>
            <div style={{ paddingLeft: 12, paddingRight: 12 }}>
            {schoolMenuData.map((item) => {
                // 🆕 1. DYNAMIC ACTIVE DETECTION
                // Gagawin nating "active" ang Dashboard link kung ang URL ay mismong '/dashboard'
                // O kung nandoon sila sa sub-dashboard ng kani-kanilang role.
                let isActive = pathname === item.link;

                if (item.label === "Dashboard") {
                    isActive = pathname === "/dashboard" || 
                            pathname === "/dashboard/staff" || 
                            pathname === "/dashboard/superuser" || 
                            pathname === "/dashboard/coadmin" || 
                            pathname === "/dashboard/dept_head";
                }

                return (
                <UnstyledButton
                    key={item.label}
                    // 🆕 2. DYNAMIC ROUTING SA ONCLICK
                    onClick={() => {
                        if (item.label === "Dashboard") {
                            // Kung Dashboard ang pinindot, itapon natin sa tamang sub-route base sa role
                            if (role === "Staff") router.push("/dashboard/staff");
                            else if (role === "SuperUser") router.push("/dashboard/superuser");
                            else if (role === "CoAdmin") router.push("/dashboard/coadmin");
                            else if (role === "DepartmentHead") router.push("/dashboard/dept_head");
                            else router.push("/dashboard"); // Fallback
                        } else {
                            router.push(item.link);
                        }
                    }}
                    style={{
                    display: "flex",
                    alignItems: "center",
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: 6,
                    marginBottom: 4,
                    color: textColor,
                    background: isActive ? activeBg : "transparent",
                    fontWeight: isActive ? 600 : 500,
                    fontSize: "14px",
                    transition: "background 0.2s ease",
                    }}
                    // Custom CSS styling sa hover
                    onMouseEnter={(e) => !isActive && (e.currentTarget.style.background = hoverBg)}
                    onMouseLeave={(e) => !isActive && (e.currentTarget.style.background = "transparent")}
                >
                    <item.icon size={18} stroke={1.5} style={{ marginRight: 12 }} />
                    <span style={{ flex: 1 }}>{item.label}</span>
                </UnstyledButton>
                );
            })}
            </div>
        </ScrollArea>

        {/* FOOTER: User ID at Logout Button */}
        <div style={{ 
            padding: 20, 
            borderTop: role === "Staff" ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            flexDirection: "column",
            gap: 12
        }}>
            <div style={{ fontSize: "13px", opacity: 0.8 }}>
            Logged in: <b>{email}</b>
            </div>
            
            <UnstyledButton 
            onClick={handleLogout}
            style={{
                display: "flex",
                alignItems: "center",
                padding: "8px 12px",
                borderRadius: 6,
                background: "rgba(255, 0, 0, 0.51)",
                color: role === "Staff" ? "#8b0000" : "#ff9b9b",
                fontSize: "14px",
                fontWeight: 600
            }}
            >
            <IconLogout size={16} stroke={2} style={{ marginRight: 8 }} />
            <span>Sign Out</span>
            </UnstyledButton>
        </div>
        </nav>
    );
}