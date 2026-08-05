"use client"

//LOGIN PAGE

import { useState, type FormEvent } from "react";
import { Anchor, Group, PasswordInput, TextInput, Button, Text, Stack, Alert } from '@mantine/core';
import { useRouter } from "next/navigation";
import { modals } from "@mantine/modals";
import { IconAlertCircle } from "@tabler/icons-react";
import '@mantine/core/styles.css';
import { ForgotPasswordModal } from "./components/forgotpasswordmodal";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false); // Para iwas double submit habang nagpoproseso
    const router = useRouter();

    const [forgotModalOpened, setForgotModalOpened] = useState(false);

    async function handleSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError("");
        setLoading(true);

        //console.log("Attempting login with email:", email); // Debug log

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

            // 🛠️ ERROR CATCHING NG MALING EMAIL O PASSWORD
            if (!res.ok) {
                setLoading(false);

                // Check kung ito yung multiple wrong password lock triggers
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

                // 🎯 DITO SASALUHIN ANG STANDARD ERRORS (e.g., "Invalid credentials", "User not found")
                setError(data.message || data.error || "Maling email o password. Pakisuri muli.");
                return;
            }

            router.push("/dashboard/analytics");

        } catch (err) {
            console.error("Network error occurred:", err);
            setError("Connection error. Please try again later.");
            setLoading(false);
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
                <Stack gap="md">
                    {/* 🎯 MANTINE ALERT BOX PARA SA LOGIN ERRORS */}
                    {error && (
                        <Alert variant="light" color="red" title="Login Failed" icon={<IconAlertCircle size={16} />}>
                            {error}
                        </Alert>
                    )}
                    <div>
                        <TextInput
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="NCST Email"
                            variant="filled"
                            required
                        />
                        <Group justify="space-between" mb={5}>
                            <Text size="sm" fw={500} style={{ visibility: 'hidden' }}>Password</Text>
                        </Group>
                        <PasswordInput
                            placeholder="Your password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            variant="filled"
                            required
                        />
                        <Anchor 
                            href="#" 
                            onClick={(event) => {
                                event.preventDefault();
                                setForgotModalOpened(true); // ✅ open modal
                            }} 
                            fw={500} 
                            fz="xs"
                        >
                            Forgot your password?
                        </Anchor>
                    </div>

                    <Button 
                        variant="filled" 
                        style={{ width: '100%', padding: '5px' }}
                        type="submit"
                        loading={loading}
                    >
                        Login
                    </Button>
                </Stack>
            </form>

            {/* ✅ Forgot Password Modal */}
            <ForgotPasswordModal
                opened={forgotModalOpened}
                onClose={() => setForgotModalOpened(false)}
            />
        </main>
    );
}