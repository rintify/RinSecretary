'use server';

import { signIn } from '@/auth';

export async function authenticate() {
  await signIn('google', { redirectTo: '/' });
}


// Register function removed as we only use Google Auth

import { signOut } from '@/auth';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function logout() {
  // 開発モードスキップCookieも削除
  const cookieStore = await cookies();
  cookieStore.delete('dev-auth-skip');
  await signOut({ redirectTo: '/login' });
}

/**
 * 開発モード認証スキップ
 * NODE_ENV=development の場合のみ有効
 */
export async function skipAuth() {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error('Skip auth is only available in development mode');
  }
  
  const cookieStore = await cookies();
  cookieStore.set('dev-auth-skip', 'true', {
    httpOnly: true,
    secure: false, // 開発環境なので false
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  
  redirect('/');
}

/**
 * 開発モードスキップが有効かどうかをチェック
 */
export async function isDevModeSkipped() {
  if (process.env.NODE_ENV !== 'development') {
    return false;
  }
  const cookieStore = await cookies();
  return cookieStore.get('dev-auth-skip')?.value === 'true';
}
