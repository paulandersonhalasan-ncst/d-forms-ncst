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
    IconUser
} from "@tabler/icons-react";
import { Code, Group, ScrollArea, Text, UnstyledButton, NavLink, useMantineColorScheme, Image } from "@mantine/core";
import React, { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { TablerIcon } from "@tabler/icons-react";


interface SidebarProps {
    role: "SuperUser" | "OIC" | "DepartmentHead" | "Staff" | "Admin";
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
    allowedRoles?: ("SuperUser" | "OIC" | "DepartmentHead" | "Staff" | "Admin")[];
    links?: { 
        label: string; 
        link: string;
        allowedRoles?: ("SuperUser" | "OIC" | "DepartmentHead" | "Staff" | "Admin")[];
    }[];
}

const schoolMenuData: MenuItem[] = [
    { 
        label: "Dashboard", 
        icon: IconGauge, 
        link: "/dashboard" 
        // Walang allowedRoles = Makikita ng kahit sinong naka-login
    },
    {
        label: "Forms",
        icon: IconCategory2,
        links: [
            { label: "Inter-Office Memorandum", link: "/dashboard/forms/iom" },
            { label: "PLACEHOLDER", link: "/dashboard/forms/placeholder" },
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
        allowedRoles: ["Admin", "SuperUser"]
    },
    { 
        label: "Manage Staff", 
        icon: IconUser, 
        link: "/dashboard/manage_staff",
        allowedRoles: ["OIC", "DepartmentHead"]
    }
];

export default function Sidebar({ role, email, fname, lname, oic_start, oic_end }: SidebarProps) {
    const [currentTime, setCurrentTime] = useState<string>("Loading...");
    const [isCurrentlyOIC, setIsCurrentlyOIC] = useState<boolean>(false);
    const { colorScheme, setColorScheme } = useMantineColorScheme();

    const router = useRouter();
    const pathname = usePathname();
    const [hoverKey, setHoverKey] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);

    // 🎯 TIMEOUT/MOUNT ENGINE AT RUNTIME OIC CHECK INTERVAL
    useEffect(() => {
    const id = window.setTimeout(() => setMounted(true), 0);

    const updateTimeAndStatus = () => {
        const options: Intl.DateTimeFormatOptions = {
            timeZone: "Asia/Manila",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: true
        };
        
        const timeString = new Date().toLocaleTimeString("en-US", options);
        setCurrentTime(timeString);

        // 🎯 STAGE 1: Siguraduhing may valid na data talaga
        if (oic_start && oic_end && oic_start !== "null" && oic_end !== "null") {
            
            // Kunin ang kasalukuyang petsa at oras sa Pilipinas
            const ngayon = new Date();

            // I-parse ang simula at tapos na petsa (Tanggalin ang timezone bias sa pamamagitan ng pag-set ng oras)
            const simula = new Date(oic_start);
            simula.setHours(0, 0, 0, 0); // Unang segundo ng araw ng simula

            const tapos = new Date(oic_end);
            tapos.setHours(23, 59, 59, 999); // Huling segundo ng araw ng pagtatapos

            const checkCondition = ngayon >= simula && ngayon <= tapos;

            setIsCurrentlyOIC(checkCondition);
        } else {
            // Kung walang oic_start o oic_end, siguradong hinde sya OIC
            setIsCurrentlyOIC(false);
        }
        };

        updateTimeAndStatus();
        const timer = setInterval(updateTimeAndStatus, 1000);

        return () => {
            window.clearTimeout(id);
            clearInterval(timer);
        };
    }, [oic_start, oic_end, email]);

    // DYNAMIC COLORS BASE SA ROLE
    let sidebarBg = "";
    const textColor = "#fff8f2";
    const hoverBg = "rgba(0, 0, 0, 0.1)";
    const activeBg = "rgba(70, 70, 70, 0.15)";

    // 🔄 Epektibong Role para sa Rendering at Permissions
    // Kung ang DB role ay Staff pero aktibong OIC ngayon, ituring siyang "OIC"
    const effectiveRole = (role === "Staff" && isCurrentlyOIC) ? "OIC" : role;

    // Palitan ang 'role' ng 'effectiveRole' dito para mag-iba ang kulay ng bar kung OIC siya
    switch (effectiveRole) {
        case "SuperUser":
            sidebarBg = "var(--mantine-color-dark-8)";
            break;
        case "Admin":
            sidebarBg = "var(--mantine-color-dark-6)";
            break;
        case "OIC":
        case "DepartmentHead":
            sidebarBg = "var(--mantine-color-imperialBlue-6)"; // Magiging kulay Blue na rin ang Staff kapag aktibong OIC!
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
            <div style={{ padding: 24, borderBottom: effectiveRole === "Staff" ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,255,255,0.08)" }}>
                <Group justify="space-between">
                    <Group align="center" gap="sm">
                        <Image src="/favicon.ico" alt="NCST logo" style={{ width: 24, height: 24, borderRadius: 4 }} />
                        <Text fw={800} size="xl">NCST E-FORMS</Text>
                    </Group>
                    <Code fw={700} style={{ 
                        background: effectiveRole === "Staff" ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.15)",
                        color: textColor 
                    }}>
                        {currentTime}
                    </Code>
                </Group>
                
                <Group justify="space-between" align="center" mt="xs">
                    <Text size="xs" fw={700} style={{ opacity: 0.7 }}>
                        ROLE: {role.toUpperCase()}
                    </Text>

                    {/* ANG GRAPHICAL INDICATOR / TAG */}
                    {isCurrentlyOIC && (
                        <Code 
                            fw={800} 
                            style={{ 
                                background: "#2f9e44", // Magandang Berde (Success Color)
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
                        // 🛡️ HAKBANG A: I-filter ang mga MAIN MENU items base sa epektibong role ng user
                        .filter((item) => {
                            if (!item.allowedRoles) return true; // Kung walang limitasyon, ipakita sa lahat
                            return item.allowedRoles.includes(effectiveRole); // Ipakita lang kung kasama ang role ng user
                        })
                        .map((item) => {
                            // DYNAMIC ACTIVE DETECTION
                            let isMainActive = false;
                            if (item.label === "Dashboard") {
                                if (pathname && pathname !== "/") {
                                    isMainActive = [
                                        "/dashboard", "/dashboard/staff", "/dashboard/superuser",
                                        "/dashboard/oic", "/dashboard/dept_head", "/dashboard/admin"
                                    ].includes(pathname);
                                }
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
                                    if (effectiveRole === "Staff") router.push("/dashboard/staff");
                                    else if (effectiveRole === "SuperUser") router.push("/dashboard/superuser");
                                    else if (effectiveRole === "Admin") router.push("/dashboard/admin");
                                    else if (effectiveRole === "OIC") router.push("/dashboard/oic");
                                    else if (effectiveRole === "DepartmentHead") router.push("/dashboard/dept_head");
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
                                    onClick={item.links ? undefined : handleMainClick}
                                    styles={customNavLinkStyles}
                                    onMouseEnter={() => setHoverKey(item.label)}
                                    onMouseLeave={() => setHoverKey((k) => (k === item.label ? null : k))}
                                    style={{ color: textColor, backgroundColor: hoverKey === item.label ? hoverBg : (isMainActive ? activeBg : "transparent") }}
                                >
                                    {/* 🛡️ HAKBANG B: I-filter din ang mga SUB-LINKS gamit ang effectiveRole */}
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