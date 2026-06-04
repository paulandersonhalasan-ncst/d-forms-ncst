"use client"

//LOGIN PAGE

import { useState, type FormEvent } from "react";
import { Anchor, Group, PasswordInput, TextInput, Button, Text, Stack } from '@mantine/core';
import { useRouter } from "next/navigation";
import { modals } from "@mantine/modals";
import '@mantine/core/styles.css';

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const router = useRouter();

    async function handleSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError("");

        console.log("Attempting login with email:", email); // Debug log

        try {
            const res = await fetch("/api/auth/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email: email,
                password: password
            }),
            });
            
            const data = await res.json();

            if (!res.ok) {
                if (data.alertTriggered) {
                    modals.openConfirmModal({
                        title: "Can't log in?",
                        centered: true,
                        closeOnClickOutside: false,
                        withCloseButton: false,
                        children: (
                            <Stack gap="xs">
                                <Text size="sm" fw={700} c="red.7">
                                    You have entered an incorrect password {data.failedAttempts} times.
                                </Text>
                                <Text size="sm" c="dimmed">
                                    Due to this suspicious activity, your Department Head and the system administrator have been alerted. Please contact them immediately if you can not access your account.
                                </Text>
                            </Stack>
                        ),
                        labels: { confirm: 'Acknowledge & Close', cancel: 'Exit' },
                        confirmProps: { color: 'red' },
                        cancelProps: { variant: 'outline', color: 'gray' },
                    });

                    //clear the form after showing the modal
                    setEmail("");
                    setPassword("");

                    return; 
                }
            }

            switch (data.user?.role) {
            case "Staff":
                router.push("./dashboard/staff");
                break;
            case "OIC":
                router.push("./dashboard/oic");
                break;
            case "Admin":
                router.push("./dashboard/admin");
                break;
            case "DepartmentHead":
                router.push("./dashboard/dept_head");
                break;
            case "SuperUser":
                router.push("./dashboard/superuser");
                break;
            case undefined:
            case null:
                console.error("User role is missing for user: ", data.user);
                break;
            default:
                setError("Unknown user role");
                console.error("Unknown user role: ", data.user?.role);
            }

        } catch (err) {
            console.error("Network error occurred:", err);
            setError("Connection error. Please try again later.");
        }
        }

return (
    <main
        style={{
            minHeight: '100vh',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundImage: "url('/image.png')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
        }}
    >
        <form
            onSubmit={handleSubmit}
            style={{
                width: 360,
                padding: 24,
                borderRadius: 8,
                boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
                background: 'var(--background)',
            }}
        >
            <TextInput
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="NCST Email"
                variant="filled"
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
                variant="filled"
            />

            <Button variant="filled" style={{ width: '100%', padding: '10px 12px', marginTop: 14 }} type="submit">
                Login
            </Button>
            {error && <div style={{ color: 'red', marginTop: 8 }}>{error}</div>}
        </form>
    </main>
);
}