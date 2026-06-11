"use client";

import {
    IconGauge,
    IconCategory2,
    IconLogout,
    IconUserCog,
    IconUserCircle,
    IconSun,
    IconMoon,  
    IconLogs
} from "@tabler/icons-react";
import { Code, Group, ScrollArea, Text, UnstyledButton, NavLink, useMantineColorScheme } from "@mantine/core";
import React, { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { TablerIcon } from "@tabler/icons-react";


interface SidebarProps {
    role: "SuperUser" | "OIC" | "DepartmentHead" | "Staff" | "Admin";
    email: string;
}

// 🆕 Nilagyan natin ng pormal na interface ang array para maintindihan ni TypeScript ang hugis ng menu mo
interface MenuItem {
    label: string;
    icon: TablerIcon; // 🎯 Eksaktong type ng Tabler Icons, burado ang 'any'!
    link?: string;
    links?: { label: string; link: string }[];
}

const schoolMenuData: MenuItem[] = [
    { label: "Dashboard", icon: IconGauge, link: "/dashboard" },
    {
        label: "Forms",
        icon: IconCategory2,
        links: [
            { label: "Inter-Office Memorandum", link: "/dashboard/forms/iom" },
            { label: "PLACEHOLDER", link: "/dashboard/forms/placeholder" },
        ]
    },
    { label: "Manage Users", icon: IconUserCog, link: "/dashboard/admin/manage_users" },
    { label: "Account Settings", icon: IconUserCircle, link: "/dashboard/account_settings" },
    { label: "Activity Logs", icon: IconLogs, link: "superuser/activity_logs" },
];

export default function Sidebar({ role, email }: SidebarProps) {
    const [currentTime, setCurrentTime] = useState<string>("Loading...");

    const { colorScheme, setColorScheme } = useMantineColorScheme();

    useEffect(() => {
        //Philippine Standard Time (PST)
        const updateTime = () => {
            const options: Intl.DateTimeFormatOptions = {
                timeZone: "Asia/Manila",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: true
            };
            
            // Format: "HH:MM:SS AM/PM"
            const timeString = new Date().toLocaleTimeString("en-US", options);
            setCurrentTime(timeString);
        };

        // Patakbuhin agad pag-load ng page
        updateTime();

        // I-update ang oras bawat segundo (1000ms)
        const timer = setInterval(updateTime, 1000);

        // Linisin ang memory kapag umalis sa page ang user
        return () => clearInterval(timer);
    }, []);

    const router = useRouter();
    const pathname = usePathname();
    const [hoverKey, setHoverKey] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        const id = window.setTimeout(() => setMounted(true), 0);
        return () => window.clearTimeout(id);
    }, []);

    // DYNAMIC COLORS BASE SA ROLE
    let sidebarBg = "";
    const textColor = "#fff8f2";
    const hoverBg = "rgba(0, 0, 0, 0.1)";
    const activeBg = "rgba(70, 70, 70, 0.15)";

    switch (role) {
        case "SuperUser":
            sidebarBg = "var(--mantine-color-dark-8)";
            break;
        case "Admin":
            sidebarBg = "var(--mantine-color-dark-6)";
            break;
        case "OIC":
        case "DepartmentHead":
            sidebarBg = "var(--mantine-color-imperialBlue-6)";
            break;
        case "Staff":
            sidebarBg = "var(--mantine-color-schoolBusYellow-5)";
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
            <div style={{ padding: 24, borderBottom: role === "Staff" ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,255,255,0.08)" }}>
                <Group justify="space-between">
                    <Text fw={800} size="xl">NCST E-FORMS</Text>
                    <Code fw={700} style={{ 
                        background: role === "Staff" ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.15)",
                        color: textColor 
                    }}>
                        {currentTime}
                    </Code>
                </Group>
                <Text size="xs" fw={700} mt="xs" style={{ opacity: 0.7 }}>
                    ROLE: {role.toUpperCase()}
                </Text>
            </div>

            {/* BODY: Mantine NavLink Engine */}
            <ScrollArea style={{ flex: 1, padding: "16px 0" }}>
                <div style={{ paddingLeft: 12, paddingRight: 12 }}>
                    {schoolMenuData.map((item) => {
                        // DYNAMIC ACTIVE DETECTION FOR DASHBOARD OR ROLE-SPECIFIC DASHBOARDS
                        let isMainActive = false;
                        if (item.label === "Dashboard") {
                            // Don't mark Dashboard active on the initial root path ('/').
                            // Only consider it active when pathname exists and is one of the dashboard routes.
                            if (pathname && pathname !== "/") {
                                isMainActive = [
                                    "/dashboard",
                                    "/dashboard/staff",
                                    "/dashboard/superuser",
                                    "/dashboard/oic",
                                    "/dashboard/dept_head",
                                    "/dashboard/admin"
                                ].includes(pathname);
                            } else {
                                isMainActive = false;
                            }
                        } else if (item.link) {
                            isMainActive = pathname === item.link;
                        }

                        // 🆕 DYNAMIC INLINE STYLES PARA KAY MANTINE NAVLINK (Tugma sa roles colors mo)
                        const customNavLinkStyles = {
                            label: { color: textColor, fontWeight: isMainActive ? 600 : 500 },
                            description: { color: textColor },
                            children: { paddingLeft: 16 }, // Indentation ng sub-menus
                            root: {
                                borderRadius: 6,
                                marginBottom: 4,
                                backgroundColor: isMainActive ? activeBg : "transparent",
                                "&:hover": {
                                    // Force hover to take precedence over active styles
                                    backgroundColor: `${hoverBg} !important`,
                                }
                            }
                        };

                        // DYNAMIC ROUTING PARA SA MISMONG MGA SUB-ROUTES
                        const handleMainClick = () => {
                            if (item.label === "Dashboard") {
                                if (role === "Staff") router.push("/dashboard/staff");
                                else if (role === "SuperUser") router.push("/dashboard/superuser");
                                else if (role === "Admin") router.push("/dashboard/admin");
                                else if (role === "OIC") router.push("/dashboard/oic");
                                else if (role === "DepartmentHead") router.push("/dashboard/dept_head");
                                else router.push("/dashboard");
                            } else if (item.link) {
                                router.push(item.link);
                            }
                        };

                        return (
                            <NavLink
                                key={item.label}
                                label={item.label}
                                leftSection={<item.icon size={18} stroke={1.5} color={textColor} />}
                                active={isMainActive}
                                onClick={item.links ? undefined : handleMainClick} // Kung may sub-links, hayaan lang si Mantine magbuka ng dropdown, wag mag-navigate
                                styles={customNavLinkStyles}
                                onMouseEnter={() => setHoverKey(item.label)}
                                onMouseLeave={() => setHoverKey((k) => (k === item.label ? null : k))}
                                style={{ color: textColor, backgroundColor: hoverKey === item.label ? hoverBg : (isMainActive ? activeBg : "transparent") }}
                            >
                                {/* 🆕 DROPDOWN RENDERER: Dito awtomatikong ilalatag ni Mantine yung mga anak kapag pinindot ang 'Forms' */}
                                {item.links?.map((subItem) => {
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
                                                    root: {
                                                        borderRadius: 6,
                                                        marginBottom: 2,
                                                    },
                                                    label: { color: textColor, fontSize: "13px", fontWeight: isSubActive ? 600 : 400 }
                                                }}
                                            />
                                        );
                                })}
                            </NavLink>
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
                    onClick={() => setColorScheme(colorScheme === 'dark' ? 'light' : 'dark')}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        padding: "8px 12px",
                        borderRadius: 6,
                        background: "rgba(255, 255, 255, 0.1)",
                        color: textColor,
                        fontSize: "14px",
                        fontWeight: 500,
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = hoverBg}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.1)"}
                >
                    {mounted ? (
                        colorScheme === 'dark' ? (
                            <>
                                <IconSun size={16} stroke={2} style={{ marginRight: 8 }} color={textColor} />
                                <span>Light Mode</span>
                            </>
                        ) : (
                            <>
                                <IconMoon size={16} stroke={2} style={{ marginRight: 8 }} color={textColor} />
                                <span>Dark Mode</span>
                            </>
                        )
                    ) : (
                        <>
                            <IconSun size={16} stroke={2} style={{ marginRight: 8 }} color={textColor} />
                            <span>Toggle Theme</span>
                        </>
                    )}
                </UnstyledButton>

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