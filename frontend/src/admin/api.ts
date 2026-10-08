import type { AdminUser, Paginated } from '@xcel/shared';
import {
  keepPreviousData,
  type QueryKey,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { apiGet, ApiRequestError, apiSend } from '../lib/api';

type Params = Record<string, string | number | undefined>;

/** Every admin query key starts with "admin", so signing out can drop them all. */
export const adminKey = (path: string, params?: Params): QueryKey =>
  params ? ['admin', path, params] : ['admin', path];

export const ME_KEY = adminKey('/admin/auth/me');

/** The signed-in admin, or null when signed out. */
export function useAdminMe() {
  return useQuery({
    queryKey: ME_KEY,
    queryFn: async () => {
      try {
        return (await apiGet<{ user: AdminUser }>('/admin/auth/me')).user;
      } catch (error) {
        if (error instanceof ApiRequestError && error.status === 401) return null;
        throw error;
      }
    },
    staleTime: 5 * 60_000,
  });
}

export function useAdminGet<T>(path: string, params?: Params, enabled = true) {
  return useQuery({
    queryKey: adminKey(path, params),
    queryFn: () => apiGet<T>(path, params),
    // Admin data changes underfoot; always refetch rather than show old values.
    staleTime: 0,
    enabled,
  });
}

export function useAdminList<T>(path: string, params: Params) {
  return useQuery({
    queryKey: adminKey(path, params),
    queryFn: () => apiGet<Paginated<T>>(path, params),
    staleTime: 0,
    placeholderData: keepPreviousData,
  });
}

/**
 * A write request. On success, every admin query is refetched (the dashboard,
 * lists and details all depend on each other) and public data is marked stale.
 */
export function useAdminMutation<TBody, TResult = unknown>(
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  options: {
    /**
     * Runs before data is refetched, e.g. to leave the page of a deleted
     * record (which would otherwise refetch, fail and unmount first).
     */
    onSuccessFirst?: (result: TResult) => void;
  } = {},
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: TBody) => apiSend<TResult>(method, path, body),
    onSuccess: async (result) => {
      options.onSuccessFirst?.(result);
      await queryClient.invalidateQueries({
        predicate: (q) => q.queryKey[0] === 'admin' && q.queryKey[1] !== ME_KEY[1],
      });
      void queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'admin' });
    },
  });
}

/** Field errors from a failed request, keyed by field path ("" for the whole form). */
export function requestErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiRequestError)) {
    return error ? { '': 'The request could not be completed. Check your connection.' } : {};
  }
  const errors: Record<string, string> = {};
  for (const issue of error.body?.issues ?? []) errors[issue.path] ??= issue.message;
  if (Object.keys(errors).length === 0) errors[''] = error.message;
  return errors;
}
