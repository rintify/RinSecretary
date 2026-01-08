import './globals.css';
import ThemeRegistry from './ThemeRegistry';
import { GlobalJobProvider } from './context/GlobalJobContext';
import JobMonitor from './components/JobMonitor';
import type { Metadata, Viewport } from 'next';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#ffffff',
};

export const metadata: Metadata = {
  title: 'RinSecretary',
  description: 'Task & Schedule Management',
  manifest: '/manifest.json',
  icons: {
    icon: '/icons/icon-192x192.png',
    apple: '/icons/icon-192x192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'RinSecretary',
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" style={{ WebkitUserSelect: 'none', userSelect: 'none' } as React.CSSProperties}>
      <body style={{ WebkitUserSelect: 'none', userSelect: 'none' } as React.CSSProperties}>
        <ThemeRegistry>
          <GlobalJobProvider>
            {children}
            <JobMonitor />
          </GlobalJobProvider>
        </ThemeRegistry>
      </body>
    </html>
  );
}
