import { useSearchParams } from 'react-router';

/**
 * Search, filter and page state kept in the URL, so results can be shared,
 * bookmarked and restored with the back button. Changing a filter returns
 * to page 1.
 */
export function useUrlFilters<K extends string>(keys: readonly K[]) {
  const [params, setParams] = useSearchParams();
  const values = Object.fromEntries(keys.map((k) => [k, params.get(k) ?? ''])) as Record<K, string>;
  const page = Math.max(1, Number(params.get('page')) || 1);

  const update = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (!('page' in changes)) next.delete('page');
    setParams(next);
  };

  return {
    values,
    page,
    set: (key: K, value: string) => update({ [key]: value }),
    setPage: (n: number) =>
      update({ page: n > 1 ? String(n) : '' } as Partial<Record<'page', string>>),
    clear: () => setParams(new URLSearchParams()),
    active: keys.some((k) => values[k]),
  };
}
