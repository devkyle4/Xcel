import type { ApiError } from '@xcel/shared';
import { QueryClient } from '@tanstack/react-query';

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ApiError | null,
  ) {
    super(body?.error ?? `Request failed (${status})`);
  }
}

type Params = Record<string, string | number | readonly string[] | undefined | null>;

/** Builds "/api/path?a=1&b=x,y", leaving out empty parameters. */
export function apiUrl(path: string, params: Params = {}): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, Array.isArray(value) ? value.join(',') : String(value));
  }
  const query = search.toString();
  return `/api${path}${query ? `?${query}` : ''}`;
}

export async function apiGet<T>(path: string, params?: Params): Promise<T> {
  const res = await fetch(apiUrl(path, params), { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    throw new ApiRequestError(res.status, (await res.json().catch(() => null)) as ApiError | null);
  }
  return (await res.json()) as T;
}

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        // Retry network trouble, but not "not found" or bad requests.
        retry: (count, error) =>
          count < 2 && !(error instanceof ApiRequestError && error.status < 500),
      },
    },
  });
}

/** Sends a JSON write request. Resolves to undefined for "204 No Content". */
export async function apiSend<T>(
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(apiUrl(path), {
    method,
    headers: {
      Accept: 'application/json',
      ...(body !== undefined && { 'Content-Type': 'application/json' }),
    },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
  if (!res.ok) {
    throw new ApiRequestError(res.status, (await res.json().catch(() => null)) as ApiError | null);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export const apiPost = <T>(path: string, body: unknown) => apiSend<T>('POST', path, body);
