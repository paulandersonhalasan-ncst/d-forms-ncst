"use client";

import {
    IconGauge,
    IconCategory2,
    IconLogout,
    IconUserCog,
    IconUserCircle,
    IconSun,
    IconMoon,  
    IconLogs,
    IconUser,
    IconBellRinging
} from "@tabler/icons-react";
import { Code, Group, ScrollArea, Text, UnstyledButton, NavLink, useMantineColorScheme, Image, Switch, Badge } from "@mantine/core";

import React, { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { TablerIcon } from "@tabler/icons-react";
import { useNotifications } from './notifications/NotificationProvider';
import NotificationPopover from './notifications/NotificationPopover';
import Clock from "./clock";

interface SidebarProps {
    role: "SuperUser" | "OIC" | "DepartmentHead" | "Staff" | "Admin" | "Faculty";
    email: string;
    fname: string;
    lname: string;
    oic_start?: string | null;
    oic_end?: string | null;
}

interface MenuItem {
    label: string;
    icon: TablerIcon;
    link?: string;
    isPopover?: boolean;
    allowedRoles?: ("SuperUser" | "OIC" | "DepartmentHead" | "Staff" | "Admin" | "Faculty")[];
    links?: { 
        label: string; 
        link: string;
        allowedRoles?: ("SuperUser" | "OIC" | "DepartmentHead" | "Staff" | "Admin" | "Faculty")[];
    }[];
}

const schoolMenuData: MenuItem[] = [
    {
        label: "Notifications",
        icon: IconBellRinging,
        link: "/dashboard/notifications",
        isPopover: true
    },
    { 
        label: "Dashboard", 
        icon: IconGauge, 
        link: "/dashboard/analytics" 
    },
    {
        label: "Forms",
        icon: IconCategory2,
        links: [
            { label: "Inter-Office Memorandum", link: "/dashboard/forms/iom" }
        ]
    },
    { 
        label: "Manage Users", 
        icon: IconUserCog, 
        link: "/dashboard/manage_users",
        allowedRoles: ["Admin", "SuperUser"]
    },
    { 
        label: "Account Settings", 
        icon: IconUserCircle, 
        link: "/dashboard/account_settings" 
    },
    { 
        label: "Activity Logs", 
        icon: IconLogs, 
        link: "/dashboard/activity_logs",
        allowedRoles: ["SuperUser"]
    },
    { 
        label: "Manage Staff", 
        icon: IconUser, 
        link: "/dashboard/manage_staff",
        allowedRoles: ["OIC", "DepartmentHead"]
    }
];

export default function Sidebar({ role, email, fname, lname, oic_start, oic_end }: SidebarProps) {
    const [isCurrentlyOIC, setIsCurrentlyOIC] = useState<boolean>(false);
    const { colorScheme, setColorScheme } = useMantineColorScheme({ keepTransitions: true });

    const router = useRouter();
    const pathname = usePathname();
    const [hoverKey, setHoverKey] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);

    // 🟢 Kunin ang unread count mula sa context
    const { unreadCount } = useNotifications();

    // 🎯 OIC CHECK
    useEffect(() => {
        const id = window.setTimeout(() => setMounted(true), 0);

        const updateTimeAndStatus = () => {
            if (oic_start && oic_end && oic_start !== "null" && oic_end !== "null") {
                const ngayon = new Date();
                const simula = new Date(oic_start);
                simula.setHours(0, 0, 0, 0);

                const tapos = new Date(oic_end);
                tapos.setHours(23, 59, 59, 999);

                const checkCondition = ngayon >= simula && ngayon <= tapos;

                setIsCurrentlyOIC(prev => prev === checkCondition ? prev : checkCondition);
            } else {
                setIsCurrentlyOIC(false);
            }
        };

        updateTimeAndStatus();
        const timer = setInterval(updateTimeAndStatus, 300000);

        return () => {
            window.clearTimeout(id);
            clearInterval(timer);
        };
    }, [oic_start, oic_end, email]);

    const effectiveRole = (role === "Staff" && isCurrentlyOIC) ? "OIC" : role;

    let sidebarBg = "";
    const textColor = effectiveRole === "Staff" || effectiveRole === "Faculty" ? "#242424" : "#ffffff"; 

    const hoverBg = "rgba(0, 0, 0, 0.1)";
    const activeBg = "rgba(0, 0, 0, 0.2)";

    switch (effectiveRole) {
        case "SuperUser":
            sidebarBg = "var(--mantine-color-dark-8)";
            break;
        case "Admin":
            sidebarBg = "var(--mantine-color-dark-6)";
            break;
        case "OIC":
        case "DepartmentHead":
            sidebarBg = "var(--mantine-color-regalNavy-9)";
            break;
        case "Faculty":
        case "Staff":
            sidebarBg = "var(--mantine-color-customCreamYellow-2)";
            break;
        default:
            sidebarBg = "var(--mantine-color-gray-6)";
            break;
    }

    const handleLogout = async () => {
        try {
            const res = await fetch("/api/auth/logout", { method: "DELETE" });
            if (res.ok) {
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
            position: "fixed",
            left: 0,
            top: 0,
            transition: "background-color 0.3s ease"
        }}>
            {/* HEADER: Logo at Bersyon */}
            <div style={{ padding: 24, borderBottom: effectiveRole === "Staff" ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,255,255,0.08)" }}>
                <Group justify="space-between">
                    <Group align="center" gap="sm">
                        <Image src="/favicon.ico" alt="NCST logo" style={{ width: 24, height: 24, borderRadius: 4 }} />
                        <Text fw={800} size="xl">NCST D-FORMS</Text>
                    </Group>
                    {mounted && (
                    <Clock
                        background={effectiveRole === "Staff" ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.15)"}
                        color={textColor}
                    />
                    )}
                </Group>

                <Group justify="space-between" align="center" mt="xs">
                    <Text size="xs" fw={700} style={{ opacity: 0.7 }}>
                        ROLE: {role.toUpperCase()}
                    </Text>

                    {isCurrentlyOIC && (
                        <Code 
                            fw={800} 
                            style={{ 
                                background: "#2f9e44", 
                                color: "#ffffff", 
                                fontSize: "10px", 
                                padding: "2px 6px",
                                borderRadius: "4px",
                                boxShadow: "0 0 8px rgba(47, 158, 68, 0.5)"
                            }}
                        >
                            ACTIVE OIC ACCESS
                        </Code>
                    )}
                </Group>
            </div>

            {/* BODY: Mantine NavLink Engine */}
            <ScrollArea style={{ flex: 1, padding: "16px 0" }}>
                <div style={{ paddingLeft: 12, paddingRight: 12 }}>
                    {schoolMenuData
                        .filter((item) => {
                            if (!item.allowedRoles) return true;
                            return item.allowedRoles.includes(effectiveRole);
                        })
                        .map((item) => {
                            let isMainActive = false;
                            if (item.label === "Dashboard") {
                                isMainActive = pathname === "/dashboard/analytics";
                            } else if (item.link) {
                                isMainActive = pathname === item.link;
                            }

                            const customNavLinkStyles = {
                                label: { color: textColor, fontWeight: isMainActive ? 600 : 500 },
                                description: { color: textColor },
                                children: { paddingLeft: 16 },
                                root: {
                                    borderRadius: 6,
                                    marginBottom: 4,
                                    backgroundColor: isMainActive ? activeBg : "transparent",
                                    "&:hover": { backgroundColor: `${hoverBg} !important` }
                                }
                            };

                            const handleMainClick = () => {
                                if (item.label === "Dashboard") {
                                    // ✅ Lahat ng users, iisa lang ang dashboard
                                    router.push("/dashboard/analytics");
                                } else if (item.link) {
                                    router.push(item.link);
                                }
                            };

                            // 🎯 BADGE - gamit ang unreadCount mula sa context
                            const badge = item.isPopover && unreadCount > 0 ? (
                                <Badge color="red" variant="filled" size="sm" circle>
                                    {unreadCount > 99 ? '99+' : unreadCount}
                                </Badge>
                            ) : undefined;

                            return (
                                item.isPopover ? (
                                    <NotificationPopover key={item.label}>
                                        <NavLink
                                            label={item.label}
                                            leftSection={<item.icon size={18} stroke={1.5} color={textColor} />}
                                            active={isMainActive}
                                            styles={customNavLinkStyles}
                                            onMouseEnter={() => setHoverKey(item.label)}
                                            onMouseLeave={() => setHoverKey((k) => (k === item.label ? null : k))}
                                            style={{ 
                                                color: textColor, 
                                                backgroundColor: hoverKey === item.label ? hoverBg : (isMainActive ? activeBg : "transparent"),
                                                cursor: 'pointer',
                                            }}
                                            rightSection={badge}
                                        />
                                    </NotificationPopover>
                                ) : (
                                    <NavLink
                                        key={item.label}
                                        label={item.label}
                                        leftSection={<item.icon size={18} stroke={1.5} color={textColor} />}
                                        active={isMainActive}
                                        onClick={item.links ? undefined : handleMainClick}
                                        styles={customNavLinkStyles}
                                        onMouseEnter={() => setHoverKey(item.label)}
                                        onMouseLeave={() => setHoverKey((k) => (k === item.label ? null : k))}
                                        style={{ color: textColor, transition: "background-color 0.15s ease", backgroundColor: hoverKey === item.label ? hoverBg : (isMainActive ? activeBg : "transparent") }}
                                    >
                                        {item.links
                                            ?.filter((subItem) => {
                                                if (!subItem.allowedRoles) return true;
                                                return subItem.allowedRoles.includes(effectiveRole);
                                            })
                                            .map((subItem) => {
                                                const isSubActive = pathname === subItem.link;
                                                const subKey = `${item.label}::${subItem.label}`;
                                                return (
                                                    <NavLink
                                                        key={subItem.label}
                                                        label={subItem.label}
                                                        active={isSubActive}
                                                        onClick={() => router.push(subItem.link)}
                                                        onMouseEnter={() => setHoverKey(subKey)}
                                                        onMouseLeave={() => setHoverKey((k) => (k === subKey ? null : k))}
                                                        style={{ backgroundColor: hoverKey === subKey ? hoverBg : (isSubActive ? activeBg : "transparent") }}
                                                        styles={{
                                                            root: { borderRadius: 6, marginBottom: 2 },
                                                            label: { color: textColor, fontSize: "13px", fontWeight: isSubActive ? 600 : 400 }
                                                        }}
                                                    />
                                                );
                                            })}
                                    </NavLink>
                                )
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
                    Logged in: <b>{email} | {lname}, {fname}</b>
                </div>

                <UnstyledButton
                    onClick={() => setColorScheme(colorScheme === 'dark' ? 'light' : 'dark')}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "8px 12px",
                        borderRadius: 6,
                        background: "rgba(0, 0, 0, 0.2)",
                        color: textColor,
                        width: "100%"
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(0, 0, 0, 0.1)"}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "rgba(0, 0, 0, 0.2)"}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {mounted ? (
                            colorScheme === 'dark' ? (
                                <IconMoon size={16} stroke={2} color={textColor} />
                            ) : (
                                <IconSun size={16} stroke={2} color={textColor} />
                            )
                        ) : (
                            <IconSun size={16} stroke={2} color={textColor} />
                        )}
                        <span style={{ fontSize: "14px", fontWeight: 500 }}>
                            {mounted ? (colorScheme === 'dark' ? 'Dark Mode' : 'Light Mode') : 'Toggle Theme'}
                        </span>
                    </div>

                    <Switch
                        checked={mounted ? colorScheme === 'dark' : false}
                        onChange={() => setColorScheme(colorScheme === 'dark' ? 'light' : 'dark')}
                        size="sm"
                        color="violet"
                        style={{ pointerEvents: 'none' }}
                    />
                </UnstyledButton>

                <UnstyledButton
                    onClick={handleLogout}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        padding: "8px 12px",
                        borderRadius: 6,
                        backgroundColor: "var(--mantine-color-red-5)", 
                        color: "var(--mantine-color-red-9)",
                        fontSize: "14px",
                        fontWeight: 600,
                        transition: "background-color 0.15s ease",
                        width: "100%"
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "var(--mantine-color-red-4)";
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "var(--mantine-color-red-5)";
                    }}
                >
                    <IconLogout size={16} stroke={2} style={{ marginRight: 8 }} />
                    <span>Sign Out</span>
                </UnstyledButton>
            </div>
        </nav>
    );
}