import { NextRequest, NextResponse } from 'next/server';
import { BACKEND_BASE_URL } from '@/lib/backend';
import { ACCESS_COOKIE } from '@/lib/utils/auth-cookies';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
  'host',
  'cookie',
  'accept-encoding',
  'content-length',
]);

const buildTargetUrl = (req: NextRequest, segments: string[]): string => {
  const path = segments.length ? `/${segments.join('/')}` : '';
  const search = req.nextUrl.search;
  return `${BACKEND_BASE_URL}${path}${search}`;
};

const proxy = async (
  req: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> },
): Promise<Response> => {
  const params = await ctx.params;
  const segments = params.path ?? [];
  const target = buildTargetUrl(req, segments);

  const accessToken = req.cookies.get(ACCESS_COOKIE)?.value;

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const init: RequestInit = {
    method: req.method,
    headers,
    redirect: 'manual',
  };

  if (!['GET', 'HEAD'].includes(req.method)) {
    const buf = await req.arrayBuffer();
    if (buf.byteLength) init.body = buf;
  }

  let backendRes: Response;
  try {
    backendRes = await fetch(target, init);
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        message:
          err instanceof Error
            ? `Cannot reach backend: ${err.message}`
            : 'Cannot reach backend',
        timestamp: new Date().toISOString(),
      },
      { status: 502 },
    );
  }

  // Headers that must NOT be forwarded because Node.js fetch() auto-decompresses
  // the response body. Forwarding content-encoding would make the browser try
  // to decompress an already-decompressed body → ERR_CONTENT_DECODING_FAILED.
  const STRIP_RESPONSE_HEADERS = new Set([
    'content-encoding',
    'content-length',   // length is wrong after decompression
    'set-cookie',
  ]);

  const respHeaders = new Headers();
  backendRes.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (!HOP_BY_HOP.has(lower) && !STRIP_RESPONSE_HEADERS.has(lower)) {
      respHeaders.set(key, value);
    }
  });

  return new NextResponse(backendRes.body, {
    status: backendRes.status,
    headers: respHeaders,
  });
};

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
