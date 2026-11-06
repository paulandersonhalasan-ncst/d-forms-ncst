// app/components/landing-footer.tsx
'use client';

import { Container, Group, Text, Anchor, Box, Badge } from '@mantine/core';
import { IconShieldCheck } from '@tabler/icons-react';
import Link from 'next/link';
import useSWR from 'swr';
import classes from './landing-footer.module.css';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function LandingFooter() {
  const { data } = useSWR<{ success: boolean; data: { dpoRegistrationNo: string | null } }>(
    '/api/super/privacy/setting',
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );

  const currentYear = new Date().getFullYear();

  return (
    <Box component="footer" className={classes.footer}>
      <Container fluid py="md">
        <Group
          justify="center"
          wrap="wrap"
          gap="md"
          style={{ paddingLeft: 16, paddingRight: 16 , color: 'white'}}
        >
          <Text
            size="xs"
            ta="center"
            style={{
              color: 'rgba(255, 255, 255, 0.75)',
              lineHeight: 1.5,
            }}
          >
            © {currentYear} National College of Science and Technology. All rights reserved. Developed by Paul Anderson R. Halasan of NCST ITO Department.
          </Text>
            |
          {data?.data?.dpoRegistrationNo && (
            <Text
              size="xs"
              variant="filled"
              color="customCreamYellow"
              styles={{ root: { color: 'rgba(255, 255, 255, 0.75)', flexShrink: 0 } }}
            >
              NPC Registration Number: {data.data.dpoRegistrationNo}
            </Text>
          )}
            |
          <Anchor
            component={Link}
            href="/privacy"
            size="xs"
            fw={600}
            style={{
              color: 'var(--mantine-color-customCreamYellow-4)',
              flexShrink: 0,
              whiteSpace: 'nowrap',
            }}
            underline="hover"
          >
            Data Privacy Notice
          </Anchor>
        </Group>
      </Container>
    </Box>
  );
}