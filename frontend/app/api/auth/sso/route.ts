import { NextResponse } from 'next/server';
import { buildBackendUrl } from '@/lib/backend';

interface SsoUrlData {
  authorizationUrl: string;
  state: string;
}

interface BackendResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
}

/**
 * Starts the Microsoft (Entra) SSO flow: asks the backend for the IdP
 * authorization URL and redirects the browser to it. The IdP then returns the
 * user to /api/auth/callback.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const backendRes = await fetch(buildBackendUrl('/auth/sso'), {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    const json = (await backendRes.json().catch(() => null)) as
      | BackendResponse<SsoUrlData>
      | null;

    if (!backendRes.ok || !json?.success || !json.data?.authorizationUrl) {
      return NextResponse.redirect(new URL('/login?error=sso_unavailable', baseUrl()));
    }
    return NextResponse.redirect(json.data.authorizationUrl);
  } catch {
    return NextResponse.redirect(new URL('/login?error=sso_unavailable', baseUrl()));
  }
}

const baseUrl = (): string =>
  process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';
