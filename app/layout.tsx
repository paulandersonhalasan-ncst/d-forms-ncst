// app/layout.tsx
import './globals.css';
import { ColorSchemeScript, MantineProvider, } from '@mantine/core';
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import './globals.css'; // Isama ang global CSS mo rito
import { theme } from './theme'; // I-import ang theme na ginawa natin sa taas
import { ModalsProvider } from '@mantine/modals'; // 🆕 I-import ito
import { NotificationProvider } from './components/notifications/NotificationProvider';


export const metadata = {
  title: 'NCST D-FORMS',
  description: 'Digital Forms System of National College of Science and Technology',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Napakahalaga nito para sa theme flash prevention bago mag-hydrate */}
        <ColorSchemeScript defaultColorScheme="auto" />
      </head>
      <body>
        <MantineProvider theme={theme} defaultColorScheme="auto">
          <ModalsProvider>
            <NotificationProvider>
              {children}
            </NotificationProvider>
          </ModalsProvider>
        </MantineProvider>
      </body>
    </html>
  );
}