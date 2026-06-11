import { NextRequest, NextResponse } from 'next/server';
import { ACCESS_COOKIE } from '@/lib/utils/auth-cookies';

const PUBLIC_PATHS = [
  '/login',
  '/login/2fa',
  '/login/2fa/enroll',
  '/forgot-password',
  '/reset-password',
];

const isPublic = (pathname: string): boolean => {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  if (pathname.startsWith('/api/auth')) return true;
  if (pathname === '/' || pathname === '') return true;
  return false;
};

export function middleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;
  const accessToken = req.cookies.get(ACCESS_COOKIE)?.value;
  const hasAuth = Boolean(accessToken);

  if (pathname === '/' || pathname === '') {
    return NextResponse.redirect(
      new URL(hasAuth ? '/dashboard' : '/login', req.url),
    );
  }

  if (pathname === '/login' && hasAuth) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  if (!hasAuth && !isPublic(pathname)) {
    const next = encodeURIComponent(pathname + req.nextUrl.search);
    return NextResponse.redirect(new URL(`/login?next=${next}`, req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Skip static assets and Next internals; everything else passes through.
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
};
