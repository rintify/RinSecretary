import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { Session } from 'next-auth';

const publicRoutes = ['/login', '/register', '/api/health', '/api/auth/register'];

export default auth((req: NextRequest & { auth?: Session | null }) => {
  const { pathname } = req.nextUrl;

  // NextAuthのシステムAPIパスは常に許可
  if (pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  // Next.js のアセット等は許可
  if (pathname.startsWith('/_next') || pathname.match(/\.(png|jpg|jpeg|svg|gif|ico)$/)) {
    return NextResponse.next();
  }

  const isPublicRoute = publicRoutes.includes(pathname);
  const isLoggedIn = !!req.auth;

  // ログイン済みのユーザーが publicRoutes(ログイン画面等) にアクセスしようとした場合はホームに飛ばす
  if (isLoggedIn && (pathname === '/login' || pathname === '/register')) {
    return NextResponse.redirect(new URL('/', req.nextUrl));
  }

  // ログインしておらず、かつ公開ルートでない場合はログイン画面へ
  if (!isLoggedIn && !isPublicRoute) {
    return NextResponse.redirect(new URL('/login', req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
};
