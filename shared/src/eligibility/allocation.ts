import type { SubjectAllocation } from './rules/define';

/**
 * Assigns distinct subjects to every request, so no subject counts towards two
 * requirements. Returns the subjects counted by each request, or null if they
 * cannot all be met at once. Bipartite matching (augmenting paths); inputs are
 * small (a handful of rules, at most a few dozen subjects).
 */
export function allocateSubjects(requests: readonly SubjectAllocation[]): string[][] | null {
  const slotOwner: number[] = requests.flatMap((r, i) => Array<number>(r.required).fill(i));
  const subjectSlot = new Map<string, number>();

  const assign = (slot: number, visited: Set<string>): boolean => {
    for (const subject of requests[slotOwner[slot]!]!.candidates) {
      if (visited.has(subject)) continue;
      visited.add(subject);
      const holder = subjectSlot.get(subject);
      if (holder === undefined || assign(holder, visited)) {
        subjectSlot.set(subject, slot);
        return true;
      }
    }
    return false;
  };

  for (let slot = 0; slot < slotOwner.length; slot++) {
    if (!assign(slot, new Set())) return null;
  }

  const counted = requests.map(() => [] as string[]);
  for (const [subject, slot] of subjectSlot) counted[slotOwner[slot]!]!.push(subject);
  // Report subjects in each request's preference order (best grade first).
  return counted.map((subjects, i) => {
    const order = requests[i]!.candidates;
    return subjects.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  });
}

export const MAX_SHARED_REQUESTS = 16;

/**
 * Finds the largest set of requests that can be met together, preferring
 * earlier requests on ties. Returns null if there are too many to search.
 */
export function largestCompatibleSubset(
  requests: readonly SubjectAllocation[],
): { indices: number[]; counted: string[][] } | null {
  if (requests.length > MAX_SHARED_REQUESTS) return null;

  for (let size = requests.length; size > 0; size--) {
    for (const indices of combinations(requests.length, size)) {
      const counted = allocateSubjects(indices.map((i) => requests[i]!));
      if (counted) return { indices, counted };
    }
  }
  return { indices: [], counted: [] };
}

/** k-element subsets of 0..n-1 in lexicographic order. */
function* combinations(n: number, k: number): Generator<number[]> {
  const current = Array.from({ length: k }, (_, i) => i);
  while (true) {
    yield [...current];
    let i = k - 1;
    while (i >= 0 && current[i] === n - k + i) i--;
    if (i < 0) return;
    current[i]!++;
    for (let j = i + 1; j < k; j++) current[j] = current[j - 1]! + 1;
  }
}
