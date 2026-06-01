// app/layout.tsx
import './globals.css';
import { ColorSchemeScript, MantineProvider, } from '@mantine/core';
import '@mantine/core/styles.css';
import './globals.css'; // Isama ang global CSS mo rito
import { theme } from './theme'; // I-import ang theme na ginawa natin sa taas

export const metadata = {
  title: 'NCST | E-IOM',
  description: 'Digital Inter-Office Memorandum System of National College of Science and Technology - Main',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <ColorSchemeScript defaultColorScheme="auto" />
      </head>
      <body>
        <MantineProvider theme={theme} defaultColorScheme="auto">
          {children}
        </MantineProvider>
      </body>
    </html>
  );
}