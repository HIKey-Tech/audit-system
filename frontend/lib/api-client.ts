import type { ApiResponse, PaginatedResult, PaginationMeta } from './types/api';

export class NetworkError extends Error {
  constructor(message = 'Network request failed') {
    super(message);
    this.name = 'NetworkError';
  }
}

export class ApiError extends Error {
  public readonly status: number;
  public readonly errors?: unknown;
  public readonly requestId?: string;

  constructor(message: string, status: number, errors?: unknown, requestId?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
    this.requestId = requestId;
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface RequestOptions {
  method?: Method;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  formData?: FormData;
  signal?: AbortSignal;
  // When true, skip the proxy refresh dance (used by /api/auth routes only)
  skipRefresh?: boolean;
}

const DEFAULT_BASE_URL =
  (typeof window !== 'undefined'
    ? '/api/proxy'
    : process.env.INTERNAL_API_URL || 'http://localhost:3000/api/v1');

const buildQueryString = (
  query?: Record<string, string | number | boolean | undefined | null>,
): string => {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.append(key, String(value));
  }
  const out = params.toString();
  return out ? `?${out}` : '';
};

let refreshPromise: Promise<boolean> | null = null;

const refreshAccessToken = async (): Promise<boolean> => {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      });
      return res.ok;
    } catch {
      return false;
    } finally {
      // Allow new refresh attempts after this one settles
      setTimeout(() => {
        refreshPromise = null;
      }, 0);
    }
  })();
  return refreshPromise;
};

const redirectToLogin = (): void => {
  if (typeof window === 'undefined') return;
  if (window.location.pathname === '/login') return;
  const next = encodeURIComponent(window.location.pathname + window.location.search);
  window.location.href = `/login?next=${next}`;
};

interface RawResponse {
  status: number;
  json: ApiResponse<unknown> | null;
  text: string;
}

const sendRequest = async (
  path: string,
  opts: RequestOptions,
): Promise<RawResponse> => {
  const url = `${DEFAULT_BASE_URL}${path}${buildQueryString(opts.query)}`;
  const init: RequestInit = {
    method: opts.method ?? 'GET',
    credentials: 'include',
    signal: opts.signal,
  };

  if (opts.formData) {
    init.body = opts.formData;
  } else if (opts.body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(opts.body);
  }

  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (err) {
    throw new NetworkError(
      err instanceof Error ? err.message : 'Network request failed',
    );
  }

  const text = await response.text();
  let json: ApiResponse<unknown> | null = null;
  if (text.length > 0) {
    try {
      json = JSON.parse(text) as ApiResponse<unknown>;
    } catch {
      json = null;
    }
  }
  return { status: response.status, json, text };
};

const handleApiResponse = <T>(raw: RawResponse): { data: T; meta?: PaginationMeta } => {
  const { status, json, text } = raw;

  if (status === 204) {
    return { data: undefined as unknown as T };
  }

  if (!json) {
    throw new ApiError(`Unexpected response (status ${status})`, status);
  }

  if (status >= 200 && status < 300 && json.success !== false) {
    return { data: json.data as T, meta: json.meta };
  }

  throw new ApiError(
    json.message || text || `Request failed with status ${status}`,
    status,
    json.errors,
    json.requestId,
  );
};

export const apiRequest = async <T>(
  path: string,
  opts: RequestOptions = {},
): Promise<{ data: T; meta?: PaginationMeta }> => {
  const raw = await sendRequest(path, opts);

  if (raw.status === 401 && !opts.skipRefresh) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      const retry = await sendRequest(path, opts);
      return handleApiResponse<T>(retry);
    }
    redirectToLogin();
    throw new ApiError('Session expired', 401);
  }

  return handleApiResponse<T>(raw);
};

export const api = {
  async get<T>(
    path: string,
    query?: RequestOptions['query'],
    opts?: Omit<RequestOptions, 'method' | 'body' | 'query'>,
  ): Promise<T> {
    const { data } = await apiRequest<T>(path, { method: 'GET', query, ...opts });
    return data;
  },
  async getPaginated<T>(
    path: string,
    query?: RequestOptions['query'],
    opts?: Omit<RequestOptions, 'method' | 'body' | 'query'>,
  ): Promise<PaginatedResult<T>> {
    const { data, meta } = await apiRequest<T[]>(path, { method: 'GET', query, ...opts });
    return {
      items: data ?? [],
      meta: meta ?? {
        page: 1,
        pageSize: data?.length ?? 0,
        total: data?.length ?? 0,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      },
    };
  },
  async post<T>(
    path: string,
    body?: unknown,
    opts?: Omit<RequestOptions, 'method' | 'body'>,
  ): Promise<T> {
    const { data } = await apiRequest<T>(path, { method: 'POST', body, ...opts });
    return data;
  },
  async put<T>(
    path: string,
    body?: unknown,
    opts?: Omit<RequestOptions, 'method' | 'body'>,
  ): Promise<T> {
    const { data } = await apiRequest<T>(path, { method: 'PUT', body, ...opts });
    return data;
  },
  async patch<T>(
    path: string,
    body?: unknown,
    opts?: Omit<RequestOptions, 'method' | 'body'>,
  ): Promise<T> {
    const { data } = await apiRequest<T>(path, { method: 'PATCH', body, ...opts });
    return data;
  },
  async delete<T = void>(
    path: string,
    opts?: Omit<RequestOptions, 'method' | 'body'>,
  ): Promise<T> {
    const { data } = await apiRequest<T>(path, { method: 'DELETE', ...opts });
    return data;
  },
  async upload<T>(
    path: string,
    formData: FormData,
    opts?: Omit<RequestOptions, 'method' | 'body' | 'formData'>,
  ): Promise<T> {
    const { data } = await apiRequest<T>(path, { method: 'POST', formData, ...opts });
    return data;
  },
};
