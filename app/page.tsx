"use client"

//LOGIN PAGE

import { useState, type FormEvent } from "react";
import { Anchor, Group, PasswordInput, TextInput, useMantineColorScheme, Button } from '@mantine/core';
import { useRouter } from "next/navigation";
import '@mantine/core/styles.css';

export default function LoginPage() {
    const [employee_id, setEmployee_id] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [role, setRole] = useState("");
    const router = useRouter();

    async function handleSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError("");
        const res = await fetch("./api/auth/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                employee_id: employee_id,
                password: password
            }),
        });
        
        const data = await res.json();

        switch (data.user.role){
            case "Staff":
                router.push("./dashboard/staff");
                break;
            case "CoAdmin":
                router.push("./dashboard/coadmin");
                break;
            case "DepartmentHead":
                router.push("./dashboard/dept_head");
                break;
            case "SuperUser":
                router.push("./dashboard/superuser");
                break;
            default:
                setError("Unknown user role");
        }
        
        if (!res.ok) return setError(data.message || "Login failed");
            // Option A: server sets HttpOnly cookie — redirect or update UI
            // Option B: store token/user in localStorage (less secure)
            // Example: redirect on success
    }

return (
    <main style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <form
            onSubmit={handleSubmit}
            style={{ width: 360, padding: 24, borderRadius: 8, boxShadow: '0 2px 10px rgba(0,0,0,0.08)', background:' }}var(--background)' }}>
            <TextInput
                value={employee_id}
                onChange={(e) => setEmployee_id(e.target.value)}
                placeholder="Employee ID"
            />

            {/* Password input */}
            <Group justify="space-between" mb={5}>

                <Anchor href="#" onClick={(event) => event.preventDefault()} pt={2} fw={500} fz="xs">
                    Forgot your password?
                </Anchor>
            </Group>
            <PasswordInput
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
            />

            <Button variant="filled" style={{ width: '100%', padding: '10px 12px', marginTop: 14 }} type="submit">
                Login
            </Button>
            {error && <div style={{ color: 'red', marginTop: 8 }}>{error}</div>}
        </form>
    </main>
);
}