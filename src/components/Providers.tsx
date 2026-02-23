'use client';

import { SessionProvider } from 'next-auth/react';

export default function RootClientProviders({ children }: { children: React.ReactNode }) {
  // ※ローカルファースト設定なので通信を抑制するか、通常の5分ごとのポーリングを保つかは要件による
  // 一旦標準設定のSessionProviderでラップする
  return <SessionProvider>{children}</SessionProvider>;
}
