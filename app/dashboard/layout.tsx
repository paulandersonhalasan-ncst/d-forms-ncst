// app/dashboard/layout.tsx
import React from "react";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import DashboardShell from "./DashboardShell";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "your-secret-key");

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session_token")?.value;

    let email = "UNKNOWN";
    let fname = "UNKNOWN";
    let lname = "UNKNOWN";
    let oic_start = "UNKNOWN";
    let oic_end = "UNKNOWN";

    const VALID_ROLES = ["SuperUser", "OIC", "DepartmentHead", "Staff", "Admin", "Faculty"] as const;
    type RoleType = typeof VALID_ROLES[number];
    let userRole: RoleType = "Staff";

    if (sessionToken) {
        try {
            const { payload } = await jwtVerify(sessionToken, JWT_SECRET);
            email = (payload.email as string) || "UNKNOWN";
            fname = (payload.fname as string) || "UNKNOWN";
            lname = (payload.lname as string) || "UNKNOWN";
            oic_start = (payload.oic_start as string) || "UNKNOWN";
            oic_end = (payload.oic_end as string) || "UNKNOWN";
            const roleClaim = payload.role;
            if (typeof roleClaim === 'string' && VALID_ROLES.includes(roleClaim as RoleType)) {
                userRole = roleClaim as RoleType;
            }
        } catch (error) {
            console.error("Layout Token Decryption Failed:", error);
        }
    }

    return (
        <DashboardShell
            role={userRole}
            email={email}
            fname={fname}
            lname={lname}
            oic_start={oic_start}
            oic_end={oic_end}
        >
            {children}
        </DashboardShell>
    );
}