// app/dashboard/layout.tsx
import React from "react";
import { cookies } from "next/headers";
import Sidebar from "../components/navbar";
import { jwtVerify } from "jose"; // O kung ano mang ginamit mong jwt wrapper sa middleware mo

// Ang iyong JWT Secret Key (Dapat nandoon ito sa iyong .env file)
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "your-secret-key");

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
    const cookieStore = await cookies();
    
    // 1. Kunin ang session token mula sa cookies
    const sessionToken = cookieStore.get("session_token")?.value;

    // Mag-set tayo ng defaults sakaling magkaproblema sa pag-decode habang nagde-demo
    let email = "UNKNOWN";
    let fname = "UNKNOWN;"
    let lname = "UNKNOWN;"

    const VALID_ROLES = ["SuperUser", "OIC", "DepartmentHead", "Staff", "Admin"] as const;
    type RoleType = typeof VALID_ROLES[number];
    let userRole: RoleType = "Staff";

    // 2. I-decode ang token kung ito ay may laman
    if (sessionToken) {
        try {
        // Dekryptahin ang token gamit ang iyong secret key gaya ng ginagawa sa middleware
        const { payload } = await jwtVerify(sessionToken, JWT_SECRET);
        
        // Kunin ang mga claims/data na ibinaon mo nung nag-login
        email = (payload.email as string) || "UNKNOWN";
        fname = (payload.fname as string) || "UNKNOWN";
        lname = (payload.lname as string) || "UNKNOWN";
        const roleClaim = payload.role;
        if (typeof roleClaim === 'string' && VALID_ROLES.includes(roleClaim as RoleType)) {
            userRole = roleClaim as RoleType;
        }
        
        } catch (error) {
        console.error("Layout Token Decryption Failed:", error);
        // Pwedeng i-redirect sa login dito kung expired ang token, 
        // pero dahil dumaan na sa middleware, ligtas na ito rito.
        }
    }

    return (
        <div style={{ display: "flex", minHeight: "100vh" }}>
        {/* 🎯 TOTOONG DATA GALING SA DECODED JWT SESSION TOKEN */}
        <Sidebar role={userRole} email={email} fname={fname} lname={lname}/>

        {/* CONTENT PROPER */}
        <main style={{ 
            flex: 1, 
            marginLeft: 260, 
            padding: 32, 
            background: "var(--background)",
            minHeight: "100vh"
        }}>
            {children}
        </main>
        </div>
    );
}