'use client';

import { Group, Text, Tooltip } from '@mantine/core';
import { IconClock } from '@tabler/icons-react';
import { getElapsed } from '../../../lib/timeElapsed';

interface ElapsedIndicatorProps {
  start: string | Date | null | undefined;
  label: string;
  size?: 'xs' | 'sm';
  withTooltip?: boolean;
}

export default function ElapsedIndicator({
  start,
  label,
  size = 'xs',
  withTooltip = true,
}: ElapsedIndicatorProps) {
  const elapsed = getElapsed(start);
  if (!elapsed) return null;

  const content = (
    <Group gap={4} wrap="nowrap" style={{ cursor: withTooltip ? 'help' : 'default' }}>
      <IconClock size={11} opacity={0.6} />
      <Text size={size} c="dimmed">
        {label} {elapsed.compact}
      </Text>
    </Group>
  );

  if (!withTooltip) return content;

  return (
    <Tooltip
      label={`${label} since ${elapsed.sinceFormatted} (${elapsed.verbose})`}
      withArrow
      openDelay={200}
      zIndex={6000}
    >
      {content}
    </Tooltip>
  );
}