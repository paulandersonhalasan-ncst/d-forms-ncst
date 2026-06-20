"use client";

import React, { useState } from "react";
import { PasswordInput, Button, Stack, Text } from "@mantine/core";

export default function AccountSettingsPage() {
	const [password, setPassword] = useState("");
	const [currentPassword, setCurrentPassword] = useState("");
	const [confirm, setConfirm] = useState("");
	const [loading, setLoading] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	async function handleChange(e?: React.FormEvent) {
		e && e.preventDefault();
		setMessage(null);
		setError(null);

		if (!currentPassword) return setError("Please provide your current password.");
		if (!password) return setError("Please provide a new password.");
		if (password !== confirm) return setError("Passwords do not match.");

			setLoading(true);
			try {
				// use server-side /api/auth/me to get authenticated user (HttpOnly cookie)
				const meRes = await fetch(`../../api/auth/me`);
				const meJson = await meRes.json();
				if (!meJson || !meJson.success) {
					setError(meJson?.message || "Not authenticated");
					setLoading(false);
					return;
				}

				const userId = meJson.data.id;

				const res = await fetch("../../api/user/edit", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ id: userId, password, currentPassword }),
				});
			const json = await res.json();
			if (json && json.success) {
				setMessage("Password updated successfully.");
				setPassword("");
				setConfirm("");
			} else {
				setError(json?.message || "Update failed");
			}
		} catch (err) {
			console.error(err);
			setError("An error occurred while updating password.");
		} finally {
			setLoading(false);
		}
	}

	return (
		<main style={{ padding: 20, maxWidth: 520 }}>
			<h1>Account Settings</h1>
			<form onSubmit={handleChange}>
				<Stack>
						<PasswordInput
							label="Current password"
							value={currentPassword}
							onChange={(e) => setCurrentPassword(e.currentTarget.value)}
							required
						/>
					<PasswordInput
						label="New password"
						value={password}
						onChange={(e) => setPassword(e.currentTarget.value)}
						required
					/>
					<PasswordInput
						label="Confirm new password"
						value={confirm}
						onChange={(e) => setConfirm(e.currentTarget.value)}
						required
					/>
					{message && <Text color="teal">{message}</Text>}
					{error && <Text color="red">{error}</Text>}
					<div style={{ display: "flex", justifyContent: "flex-end" }}>
						<Button type="submit" loading={loading}>
							Change Password
						</Button>
					</div>
				</Stack>
			</form>
		</main>
	);
}

