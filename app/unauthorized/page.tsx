"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Container, Group, Paper, Stack, Text, Title, useMantineColorScheme, useMantineTheme } from "@mantine/core";
import { IconLock, IconShieldLock } from "@tabler/icons-react";

const roleToDashboard: Record<string, string> = {
  SuperUser: "/dashboard/superuser",
  DepartmentHead: "/dashboard/dept_head",
  Staff: "/dashboard/staff",
  Admin: "/dashboard/admin",
  OIC: "/dashboard/oic",
};

export default function AccessDeniedPage() {
  const [dashboardHref, setDashboardHref] = useState("/");
  const [loggingOut, setLoggingOut] = useState(false);
  const [mounted, setMounted] = useState(false); 
  const router = useRouter();
  const theme = useMantineTheme();
  const { colorScheme } = useMantineColorScheme();

 useEffect(() => {
    const timeoutId = setTimeout(() => {
      setMounted(true);
    }, 0);

    let isMounted = true;
    document.title = "404 | Access Denied";

    async function loadUserRole() {
      try {
        const res = await fetch("/api/auth/me", {
          credentials: "include",
        });
        const json = await res.json();
        const role = json?.data?.role;

        if (!isMounted) return;

        if (role && typeof role === "string" && roleToDashboard[role]) {
          setDashboardHref(roleToDashboard[role]);
        } else {
          setDashboardHref("/");
        }
      } catch {
        if (isMounted) setDashboardHref("/");
      }
    }

    loadUserRole();

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, []);

  if (!mounted) {
    return <main style={{ minHeight: "100vh", backgroundColor: "var(--background)" }} />;
  }

  const accent = theme.colors.regalNavy[6];
  const paperBackground = colorScheme === "dark" ? "rgba(24, 24, 24, 0.92)" : "rgba(255, 255, 255, 0.94)";
  const paperBorder = colorScheme === "dark" ? "rgba(255, 248, 242, 0.14)" : "rgba(36, 36, 36, 0.10)";
  const titleColor = colorScheme === "dark" ? theme.colors.customCreamYellow[4] : theme.colors.regalNavy[6];
  const backgroundGlow =
    colorScheme === "dark"
      ? "radial-gradient(circle at top left, rgba(255, 196, 69, 0.12), transparent 30%), radial-gradient(circle at bottom right, rgba(14, 39, 105, 0.30), transparent 26%)"
      : "radial-gradient(circle at top left, rgba(14, 39, 105, 0.12), transparent 30%), radial-gradient(circle at bottom right, rgba(254, 196, 53, 0.18), transparent 26%)";

  async function handleLogoutAndLogin() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", {
        method: "DELETE",
        credentials: "include",
      });
    } catch {
    } finally {
      setLoggingOut(false);
      router.push("/");
      router.refresh();
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        backgroundColor: "var(--background)",
        backgroundImage: backgroundGlow,
        color: "var(--foreground)",
      }}
    >
      <Container size="sm" w="100%">
        <Paper
          radius="32px"
          p="xl"
          shadow="xl"
          style={{
            border: `1px solid ${paperBorder}`,
            backdropFilter: "blur(8px)",
            backgroundColor: paperBackground,
            color: "var(--foreground)",
          }}
        >
          <Stack gap="lg" align="center" ta="center" py="md">
            <div
              style={{
                width: 92,
                height: 92,
                borderRadius: 28,
                display: "grid",
                placeItems: "center",
                background:
                  colorScheme === "dark"
                    ? `linear-gradient(180deg, rgba(254, 196, 53, 0.16), rgba(254, 196, 53, 0.08))`
                    : `linear-gradient(180deg, rgba(14, 39, 105, 0.16), rgba(14, 39, 105, 0.06))`,
                border: `1px solid ${colorScheme === "dark" ? "rgba(254, 196, 53, 0.22)" : "rgba(14, 39, 105, 0.18)"}`,
              }}
            >
              <IconShieldLock size={42} stroke={1.7} color={colorScheme === "dark" ? theme.colors.customCreamYellow[4] : accent} />
            </div>

            <Stack gap={4} align="center">
              <Text fw={800} fz={{ base: 64, sm: 84 }} lh={1} c={titleColor}>
                404
              </Text>
              <Title order={2} ta="center">
                Access Denied
              </Title>
              <Text c="dimmed" size="md" maw={560} lh={1.6}>
                You do not have permission to open this page with your current role.
                If you think this is incorrect, contact the system administrator or return to your dashboard.
              </Text>
            </Stack>

            <Group justify="center" gap="sm" wrap="wrap">
              <Button 
                onClick={() => router.push(dashboardHref)} 
                size="md" 
                leftSection={<IconLock size={16} />} 
                color="regalNavy"
              >
                Go to dashboard
              </Button>
              <Button variant="light" size="md" color="customCreamYellow" onClick={handleLogoutAndLogin} loading={loggingOut}>
                Back to login
              </Button>
            </Group>
          </Stack>
        </Paper>
      </Container>
    </main>
  );
}