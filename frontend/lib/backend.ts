// Server-only helpers used by Next.js API routes to talk to the backend.

export const BACKEND_BASE_URL =
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:3000/api/v1';

export const buildBackendUrl = (path: string, query?: URLSearchParams | null): string => {
  const cleaned = path.startsWith('/') ? path : `/${path}`;
  const qs = query && query.toString() ? `?${query.toString()}` : '';
  return `${BACKEND_BASE_URL}${cleaned}${qs}`;
};
