import ThemeRegistry from './ThemeRegistry';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'RinSecretary',
  description: 'Task & Schedule Management',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=false',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>
        <ThemeRegistry>
          {children}
        </ThemeRegistry>
      </body>
    </html>
  );
}
