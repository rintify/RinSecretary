import './globals.css';
import ThemeRegistry from './ThemeRegistry';
import { GlobalJobProvider } from './context/GlobalJobContext';
import { ToastProvider } from './context/ToastContext';
import { ConfirmProvider } from './context/ConfirmContext';
import { DeviceProvider } from './context/DeviceContext';
import JobMonitor from './components/JobMonitor';
import SyncInitializer from './components/SyncInitializer';
import { ConflictProvider } from './context/ConflictContext';
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
            <DeviceProvider>
              <ToastProvider>
                  <ConfirmProvider>
                    <ConflictProvider>
                      <SyncInitializer />
                      {children}
                      <JobMonitor />
                    </ConflictProvider>
                  </ConfirmProvider>
              </ToastProvider>
            </DeviceProvider>
          </GlobalJobProvider>
        </ThemeRegistry>
      </body>
    </html>
  );
}
