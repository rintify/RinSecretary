// 開発モード認証スキップ用ユーティリティ

import { auth as nextAuth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

/**
 * 開発モード認証スキップの設定
 * ログイン画面でスキップを選択した場合のみ有効
 */
const DEV_USER_EMAIL = 'dev@example.com';
const DEV_USER_NAME = 'Development User';

/**
 * 開発モードスキップが有効かどうかをチェック
 * Cookieベースで判定
 */
export async function isAuthSkipEnabled() {
  if (process.env.NODE_ENV !== 'development') {
    return false;
  }
  const cookieStore = await cookies();
  return cookieStore.get('dev-auth-skip')?.value === 'true';
}

/**
 * 開発用ユーザーを取得または作成
 */
async function getOrCreateDevUser() {
  let user = await prisma.user.findUnique({
    where: { email: DEV_USER_EMAIL },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: DEV_USER_EMAIL,
        name: DEV_USER_NAME,
      },
    });
    console.log('Development user created:', user.id);
  }

  return user;
}

/**
 * 開発モード対応の認証関数
 * Cookieでスキップが有効な場合はモックセッションを返す
 */
export async function devAuth() {
  if (await isAuthSkipEnabled()) {
    const devUser = await getOrCreateDevUser();
    return {
      user: {
        id: devUser.id,
        email: devUser.email,
        name: devUser.name,
      },
      expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
    };
  }

  return await nextAuth();
}
