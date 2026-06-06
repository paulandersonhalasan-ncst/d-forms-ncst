"use client";

import { useMantineColorScheme, Switch, useMantineTheme } from '@mantine/core';

export default function ThemeSwitch() {
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const theme = useMantineTheme();

  return (
    <Switch
      checked={colorScheme === 'dark'}
      onChange={(event) => setColorScheme(event.currentTarget.checked ? 'dark' : 'light')}
      size="md"
      onLabel="DARK"
      offLabel="LIGHT"
      label="System Theme"
    />
  );
}