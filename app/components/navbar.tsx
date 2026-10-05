// app/components/navbar.tsx
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
    IconBellRinging,
    IconDatabaseExport,
} from "@tabler/icons-react";
import {
    Code,
    Group,
    ScrollArea,
    Text,
    UnstyledButton,
    NavLink,
    useMantineColorScheme,
    Image,
    Badge,
    SegmentedControl,
    Tooltip,
    Stack,
    Popover,
    Box,
} from "@mantine/core";

import React, { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { TablerIcon } from "@tabler/icons-react";
import { useNotifications } from './notifications/NotificationProvider';
import NotificationPopover from './notifications/NotificationPopover';
import Clock from "./clock";

// ============================================================
// TYPES & MENU DATA
// ============================================================
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
        isPopover: true,
    },
    {
        label: "Dashboard",
        icon: IconGauge,
        link: "/dashboard/analytics",
    },
    {
        label: "Forms",
        icon: IconCategory2,
        links: [
            { label: "Inter-Office Memorandum", link: "/dashboard/forms/iom" },
            { label: "Facility Reservation Form", link: "/dashboard/forms/frf" },
        ],
    },
    {
        label: "Manage Users",
        icon: IconUserCog,
        link: "/dashboard/manage_users",
        allowedRoles: ["Admin", "SuperUser"],
    },
    {
        label: "Account Settings",
        icon: IconUserCircle,
        link: "/dashboard/account_settings",
    },
    {
        label: "Activity Logs",
        icon: IconLogs,
        link: "/dashboard/activity_logs",
        allowedRoles: ["SuperUser"],
    },
    {
        label: "Manage Staff",
        icon: IconUser,
        link: "/dashboard/manage_staff",
        allowedRoles: ["OIC", "DepartmentHead"],
    },
    {
        label: "Backup Data",
        icon: IconDatabaseExport,
        link: "/dashboard/super/backup",
        allowedRoles: ["SuperUser"],
    },
];

const FULL_WIDTH = 260;
const MINI_WIDTH = 72;

// ============================================================
// COMPONENT
// ============================================================
export default function Sidebar({
    role,
    email,
    fname,
    lname,
    oic_start,
    oic_end,
}: SidebarProps) {
    const [isCurrentlyOIC, setIsCurrentlyOIC] = useState<boolean>(false);
    const [isHovered, setIsHovered] = useState(false);
    const [hoverKey, setHoverKey] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);

    // 🆕 Delay para hindi agad mag-collapse pag lumabas ng konti ang mouse
    const leaveTimerRef = useRef<NodeJS.Timeout | null>(null);

    const router = useRouter();
    const pathname = usePathname();

    const { colorScheme, setColorScheme, clearColorScheme } = useMantineColorScheme({ keepTransitions: true });

    const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'system'>(() => {
        if (typeof window === 'undefined') return 'light';
        return (localStorage.getItem('theme-preference') as 'light' | 'dark' | null) ?? 'light';
    });

    useEffect(() => {
        if (themeMode === 'system') clearColorScheme();
        else setColorScheme(themeMode);
    }, [themeMode]);

    const handleThemeChange = (value: string) => {
        const mode = value as 'light' | 'dark' | 'system';
        setThemeMode(mode);
        if (mode === 'system') {
            localStorage.removeItem('theme-preference');
            clearColorScheme();
        } else {
            localStorage.setItem('theme-preference', mode);
            setColorScheme(mode);
        }
    };

    const resolvedTheme = themeMode === 'system' ? colorScheme : themeMode;

    const { unreadCount } = useNotifications();

    // OIC check
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
                setIsCurrentlyOIC(prev => (prev === checkCondition ? prev : checkCondition));
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

    const effectiveRole = role === "Staff" && isCurrentlyOIC ? "OIC" : role;

    let sidebarBg = "";
    const textColor = effectiveRole === "Staff" || effectiveRole === "Faculty" ? "#242424" : "#ffffff";
    const hoverBg = "rgba(0, 0, 0, 0.1)";
    const activeBg = "rgba(0, 0, 0, 0.2)";

    switch (effectiveRole) {
        case "SuperUser": sidebarBg = "var(--mantine-color-dark-8)"; break;
        case "Admin": sidebarBg = "var(--mantine-color-dark-6)"; break;
        case "OIC":
        case "DepartmentHead": sidebarBg = "var(--mantine-color-regalNavy-9)"; break;
        case "Faculty":
        case "Staff": sidebarBg = "var(--mantine-color-customCreamYellow-2)"; break;
        default: sidebarBg = "var(--mantine-color-gray-6)"; break;
    }

    const visibleMenu = schoolMenuData.filter((item) => {
        if (!item.allowedRoles) return true;
        return item.allowedRoles.includes(effectiveRole);
    });

    const handleLogout = async () => {
        try {
            const res = await fetch("/api/auth/logout", { method: "DELETE" });
            if (res.ok) window.location.replace("/");
            else console.error("Logout failed:", await res.text());
        } catch (err) {
            console.error("Logout error:", err);
        }
    };

    // 🆕 Hover handlers with small close delay
    const handleMouseEnter = () => {
        if (leaveTimerRef.current) {
            clearTimeout(leaveTimerRef.current);
            leaveTimerRef.current = null;
        }
        setIsHovered(true);
    };

    const handleMouseLeave = () => {
        leaveTimerRef.current = setTimeout(() => {
            setIsHovered(false);
        }, 120);
    };

    const isExpanded = isHovered;
    const borderColor =
        effectiveRole === "Staff" || effectiveRole === "Faculty"
            ? "1px solid rgba(0,0,0,0.08)"
            : "1px solid rgba(255,255,255,0.08)";
    
    useEffect(() => {
    document.documentElement.style.setProperty(
        '--sidebar-hovered',
        isExpanded ? '1' : '0'
    );
    document.documentElement.style.setProperty(
        '--sidebar-hovered-pointer',
        isExpanded ? 'none' : 'auto'
    );
    }, [isExpanded]);

    // ============================================================
    // RENDER
    // ============================================================
    
    return (
        <nav
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            style={{
                width: isExpanded ? FULL_WIDTH : MINI_WIDTH,
                height: "100vh",
                background: sidebarBg,
                color: textColor,
                display: "flex",
                flexDirection: "column",
                borderRight: "1px solid rgba(0,0,0,0.05)",
                position: "fixed",
                left: 0,
                top: 0,
                zIndex: 100,
                overflow: "hidden",
                transition:
                    "width 0.25s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.3s ease",
                boxShadow: isExpanded ? "4px 0 16px rgba(0,0,0,0.15)" : "none",
                willChange: "width",
            }}
        >
            {/* ================= MINI CONTENT ================= */}
            <div
                aria-hidden={isExpanded}
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: MINI_WIDTH,
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    opacity: isExpanded ? 0 : 1,
                    visibility: isExpanded ? "hidden" : "visible",
                    pointerEvents: isExpanded ? "none" : "auto",
                    transition: `opacity 0.15s ease, visibility 0s linear ${isExpanded ? "0.15s" : "0s"}`,
                }}
            >
                {/* Header */}
                <div
                    style={{
                        padding: "20px 0",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderBottom: borderColor,
                    }}
                >
                    <Tooltip label="Hover to expand" position="right" withArrow zIndex={1100}>
                        <UnstyledButton
                            aria-label="NCST logo"
                            style={{
                                width: 44,
                                height: 44,
                                borderRadius: 8,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: textColor,
                            }}
                        >
                            <Image
                                src="/favicon.ico"
                                alt="NCST logo"
                                style={{ width: 28, height: 28, borderRadius: 6 }}
                            />
                        </UnstyledButton>
                    </Tooltip>
                </div>

                {/* Body: icon-only menu */}
                <ScrollArea style={{ flex: 1 }} type="never">
                    <Stack gap={6} style={{ padding: "12px 0", alignItems: "center" }}>
                        {visibleMenu.map((item) => {
                            const Icon = item.icon;
                            const isMainActive =
                                item.label === "Dashboard"
                                    ? pathname === "/dashboard/analytics"
                                    : item.link
                                    ? pathname === item.link
                                    : item.links?.some((s) => pathname === s.link) || false;

                            const handleClick = () => {
                                if (item.label === "Dashboard") router.push("/dashboard/analytics");
                                else if (item.link) router.push(item.link);
                            };

                            const iconButton = (
                                <UnstyledButton
                                    onClick={item.links ? undefined : handleClick}
                                    onMouseEnter={() => setHoverKey(item.label)}
                                    onMouseLeave={() => setHoverKey(null)}
                                    aria-label={item.label}
                                    style={{
                                        width: 46,
                                        height: 46,
                                        borderRadius: 10,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        position: "relative",
                                        backgroundColor: isMainActive
                                            ? activeBg
                                            : hoverKey === item.label
                                            ? hoverBg
                                            : "transparent",
                                        color: textColor,
                                        transition: "background-color 0.15s ease",
                                        flexShrink: 0,
                                    }}
                                >
                                    <Icon size={22} stroke={1.6} color={textColor} />
                                    {item.isPopover && unreadCount > 0 && (
                                        <Badge
                                            color="red"
                                            variant="filled"
                                            size="xs"
                                            circle
                                            style={{
                                                position: "absolute",
                                                top: 4,
                                                right: 4,
                                                fontSize: 9,
                                                minWidth: 16,
                                                height: 16,
                                                padding: 0,
                                            }}
                                        >
                                            {unreadCount > 99 ? "99" : unreadCount}
                                        </Badge>
                                    )}
                                </UnstyledButton>
                            );

                            if (item.isPopover) {
                                return (
                                    <Box
                                        key={item.label}
                                        style={{
                                            width: 46,
                                            height: 46,
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                        }}
                                    >
                                        <NotificationPopover>
                                            <Tooltip label={item.label} position="right" withArrow zIndex={1100}>
                                                {iconButton}
                                            </Tooltip>
                                        </NotificationPopover>
                                    </Box>
                                );
                            }

                            if (item.links && item.links.length > 0) {
                                return (
                                    <Popover
                                        key={item.label}
                                        position="right"
                                        withArrow
                                        shadow="md"
                                        withinPortal
                                        zIndex={1100}
                                        width={240}
                                        offset={12}
                                    >
                                        <Popover.Target>
                                            <Tooltip label={item.label} position="right" withArrow zIndex={1100}>
                                                {iconButton}
                                            </Tooltip>
                                        </Popover.Target>
                                        <Popover.Dropdown p="xs">
                                            <Stack gap={2}>
                                                <Text size="xs" fw={700} c="dimmed" px="xs" pb={4}>
                                                    {item.label}
                                                </Text>
                                                {item.links
                                                    .filter((subItem) => {
                                                        if (!subItem.allowedRoles) return true;
                                                        return subItem.allowedRoles.includes(effectiveRole);
                                                    })
                                                    .map((subItem) => {
                                                        const isSubActive = pathname === subItem.link;
                                                        return (
                                                            <NavLink
                                                                key={subItem.label}
                                                                label={subItem.label}
                                                                active={isSubActive}
                                                                onClick={() => router.push(subItem.link)}
                                                                styles={{
                                                                    root: { borderRadius: 6, padding: "6px 10px" },
                                                                    label: { fontSize: 13, fontWeight: isSubActive ? 600 : 500 },
                                                                }}
                                                            />
                                                        );
                                                    })}
                                            </Stack>
                                        </Popover.Dropdown>
                                    </Popover>
                                );
                            }

                            return (
                                <Tooltip key={item.label} label={item.label} position="right" withArrow zIndex={1100}>
                                    {iconButton}
                                </Tooltip>
                            );
                        })}
                    </Stack>
                </ScrollArea>

                {/* Footer */}
                <div
                    style={{
                        padding: "12px 0",
                        borderTop: borderColor,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 10,
                    }}
                >
                    {isCurrentlyOIC && (
                        <Tooltip label="Active OIC Access" position="right" withArrow zIndex={1100}>
                            <Code
                                style={{
                                    background: "#2f9e44",
                                    color: "#ffffff",
                                    fontSize: 9,
                                    fontWeight: 800,
                                    padding: "2px 4px",
                                    borderRadius: 4,
                                    boxShadow: "0 0 8px rgba(47, 158, 68, 0.5)",
                                }}
                            >
                                OIC
                            </Code>
                        </Tooltip>
                    )}

                    {mounted && (
                        <Tooltip
                            label={resolvedTheme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
                            position="right"
                            withArrow
                            zIndex={1100}
                        >
                            <UnstyledButton
                                onClick={() => handleThemeChange(resolvedTheme === "dark" ? "light" : "dark")}
                                aria-label="Toggle theme"
                                style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: 8,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    color: textColor,
                                    transition: "background-color 0.15s ease",
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = hoverBg)}
                                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                            >
                                {resolvedTheme === "dark" ? (
                                    <IconSun size={20} stroke={1.8} />
                                ) : (
                                    <IconMoon size={20} stroke={1.8} />
                                )}
                            </UnstyledButton>
                        </Tooltip>
                    )}

                    <Tooltip label="Sign Out" position="right" withArrow zIndex={1100}>
                        <UnstyledButton
                            onClick={handleLogout}
                            aria-label="Sign Out"
                            style={{
                                width: 40,
                                height: 40,
                                borderRadius: 8,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "var(--mantine-color-red-4)",
                                transition: "background-color 0.15s ease",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(220, 38, 38, 0.15)")}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                        >
                            <IconLogout size={20} stroke={1.8} />
                        </UnstyledButton>
                    </Tooltip>
                </div>
            </div>

            {/* ================= FULL CONTENT ================= */}
            <div
                aria-hidden={!isExpanded}
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: FULL_WIDTH,
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    opacity: isExpanded ? 1 : 0,
                    visibility: isExpanded ? "visible" : "hidden",
                    pointerEvents: isExpanded ? "auto" : "none",
                    transition: `opacity 0.2s ease 0.05s, visibility 0s linear ${isExpanded ? "0s" : "0.25s"}`,
                }}
            >
                {/* HEADER: Logo, Clock, Role */}
                <div style={{ padding: 24, borderBottom: borderColor }}>
                    <Group justify="space-between">
                        <UnstyledButton
                            aria-label="NCST D-Forms"
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                padding: "4px 8px",
                                borderRadius: 6,
                                color: textColor,
                            }}
                        >
                            <Image
                                src="/favicon.ico"
                                alt="NCST logo"
                                style={{ width: 24, height: 24, borderRadius: 4 }}
                            />
                            <Text fw={800} size="xl" style={{ whiteSpace: "nowrap" }}>
                                NCST D-FORMS
                            </Text>
                        </UnstyledButton>
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
                                    boxShadow: "0 0 8px rgba(47, 158, 68, 0.5)",
                                }}
                            >
                                ACTIVE OIC ACCESS
                            </Code>
                        )}
                    </Group>
                </div>

                {/* BODY: NavLinks */}
                <ScrollArea style={{ flex: 1, padding: "16px 0" }}>
                    <div style={{ paddingLeft: 12, paddingRight: 12 }}>
                        {visibleMenu.map((item) => {
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
                                    "&:hover": { backgroundColor: `${hoverBg} !important` },
                                },
                            };

                            const handleMainClick = () => {
                                if (item.label === "Dashboard") router.push("/dashboard/analytics");
                                else if (item.link) router.push(item.link);
                            };

                            const badge =
                                item.isPopover && unreadCount > 0 ? (
                                    <Badge color="red" variant="filled" size="sm" circle>
                                        {unreadCount > 99 ? "99+" : unreadCount}
                                    </Badge>
                                ) : undefined;

                            return item.isPopover ? (
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
                                            backgroundColor:
                                                hoverKey === item.label
                                                    ? hoverBg
                                                    : isMainActive
                                                    ? activeBg
                                                    : "transparent",
                                            cursor: "pointer",
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
                                    style={{
                                        color: textColor,
                                        transition: "background-color 0.15s ease",
                                        backgroundColor:
                                            hoverKey === item.label
                                                ? hoverBg
                                                : isMainActive
                                                ? activeBg
                                                : "transparent",
                                    }}
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
                                                    style={{
                                                        backgroundColor:
                                                            hoverKey === subKey
                                                                ? hoverBg
                                                                : isSubActive
                                                                ? activeBg
                                                                : "transparent",
                                                    }}
                                                    styles={{
                                                        root: { borderRadius: 6, marginBottom: 2 },
                                                        label: {
                                                            color: textColor,
                                                            fontSize: "13px",
                                                            fontWeight: isSubActive ? 600 : 400,
                                                        },
                                                    }}
                                                />
                                            );
                                        })}
                                </NavLink>
                            );
                        })}
                    </div>
                </ScrollArea>

                {/* FOOTER */}
                <div
                    style={{
                        padding: 20,
                        borderTop: role === "Staff" ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,255,255,0.08)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 12,
                    }}
                >
                    <div style={{ fontSize: "13px", opacity: 0.8 }}>
                        Logged in:{" "}
                        <b>
                            {email} | {lname}, {fname}
                        </b>
                    </div>

                    {mounted && (
                        <div
                            style={{
                                padding: "6px 10px",
                                borderRadius: 6,
                                background: resolvedTheme === "dark" ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                            }}
                        >
                            <Group gap="xs">
                                {resolvedTheme === "dark" ? (
                                    <IconMoon size={16} stroke={2} color={textColor} />
                                ) : (
                                    <IconSun size={16} stroke={2} color={textColor} />
                                )}
                            </Group>

                            <SegmentedControl
                                size="xs"
                                radius="md"
                                value={themeMode}
                                onChange={handleThemeChange}
                                data={[
                                    { label: "☀️", value: "light" },
                                    { label: "🌙", value: "dark" },
                                ]}
                                color="violet"
                                style={{
                                    background:
                                        resolvedTheme === "light"
                                            ? "rgba(255,255,255,0.15)"
                                            : "rgba(0,0,0,0.15)",
                                    border:
                                        resolvedTheme === "dark"
                                            ? "1px solid rgba(255,255,255,0.15)"
                                            : "1px solid rgba(0,0,0,0.08)",
                                    flex: 1,
                                    marginLeft: 8,
                                }}
                                styles={{
                                    label: { fontWeight: 500, fontSize: "11px", padding: "2px 8px" },
                                    control: { border: "none", background: "transparent" },
                                }}
                            />
                        </div>
                    )}

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
                            width: "100%",
                        }}
                        onMouseEnter={(e) =>
                            (e.currentTarget.style.backgroundColor = "var(--mantine-color-red-4)")
                        }
                        onMouseLeave={(e) =>
                            (e.currentTarget.style.backgroundColor = "var(--mantine-color-red-5)")
                        }
                    >
                        <IconLogout size={16} stroke={2} style={{ marginRight: 8 }} />
                        <span>Sign Out</span>
                    </UnstyledButton>
                </div>
            </div>
        </nav>
    );
}