import { NextResponse, type NextRequest } from 'next/server';

/** 認証不要のパスパターン */
const PUBLIC_PATHS = ['/login', '/register', '/api/auth/', '/api/e2e/'];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname.startsWith(path));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 静的ファイルとAPIの一部はスキップ
  if (pathname.startsWith('/_next/') || pathname.startsWith('/favicon.ico') || pathname.includes('.')) {
    return NextResponse.next();
  }

  // 認証不要のパスはスキップ
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // セッションCookieの存在を確認
  const sessionCookie = request.cookies.get('rimini-session');
  if (!sessionCookie?.value) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
