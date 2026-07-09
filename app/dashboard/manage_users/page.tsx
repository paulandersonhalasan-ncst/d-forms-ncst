"use client";

import { useState, useEffect } from "react";
import UsersTable from "./UsersTable";

export default function ManageUsersPage() {
  const [currentUser, setCurrentUser] = useState<{ role?: string } | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch("/api/auth/me");
        const json = await res.json();
        if (json.success) {
          setCurrentUser(json.data);
        }
      } catch (err) {
        console.error("Failed to fetch current user", err);
      }
    };
    fetchUser();
  }, []);

  const canDelete = currentUser?.role === "SuperUser";

  return (
    <main style={{ padding: 20 }}>
      <UsersTable canDelete={canDelete} />
    </main>
  );
}