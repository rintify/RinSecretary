
import type { Metadata, Viewport } from 'next';

export const viewport: Viewport = {
  themeColor: '#ab47bc',
};

export const metadata: Metadata = {
  title: 'Rin Memos',
  manifest: '/manifest-memos.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Rin Memos',
  },
};

export default function MemosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
