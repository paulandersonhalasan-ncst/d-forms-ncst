"use client";

import { useEffect, useState } from 'react';
import { useMantineColorScheme, Switch } from '@mantine/core';

export default function ThemeSwitch() {
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <Switch
      checked={mounted ? colorScheme === 'dark' : false}
      onChange={(event) => setColorScheme(event.currentTarget.checked ? 'dark' : 'light')}
      size="md"
      onLabel="DARK"
      offLabel="LIGHT"
      label="System Theme"
    />
  );
}