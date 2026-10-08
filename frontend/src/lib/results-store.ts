import { studentResultsSchema, type StudentResults } from '@xcel/shared';
import { useSyncExternalStore } from 'react';

/**
 * The student's WASSCE results, kept in sessionStorage only: they stay on the
 * device, are never sent to the server, and are cleared when the tab closes.
 * Storage can be unavailable (private mode, blocked site data), so every
 * access is guarded and the in-memory copy keeps the page working.
 */
const KEY = 'xcel:wassce-results';

let current: StudentResults | null = read();
const listeners = new Set<() => void>();

function read(): StudentResults | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = studentResultsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function write(value: StudentResults | null) {
  current = value;
  try {
    if (value) window.sessionStorage.setItem(KEY, JSON.stringify(value));
    else window.sessionStorage.removeItem(KEY);
  } catch {
    // Storage unavailable: keep the in-memory copy for this page view.
  }
  for (const listener of listeners) listener();
}

export const resultsStore = {
  get: () => current,
  set: (results: StudentResults) => write(results),
  clear: () => write(null),
  /** Re-reads storage; for tests. */
  reload: () => {
    current = read();
    for (const listener of listeners) listener();
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export function useStoredResults(): StudentResults | null {
  return useSyncExternalStore(resultsStore.subscribe, resultsStore.get, resultsStore.get);
}
