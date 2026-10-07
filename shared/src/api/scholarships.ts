import type { ScholarshipStatus } from '../domain';

export const SCHOLARSHIP_AVAILABILITIES = ['open', 'upcoming', 'closed', 'unknown'] as const;
export type ScholarshipAvailability = (typeof SCHOLARSHIP_AVAILABILITIES)[number];

/**
 * Whether a scholarship is open, derived from its current cycle's dates so an
 * expired scholarship is never shown as open, whatever its stored status.
 * Dates are ISO "YYYY-MM-DD" strings; `today` is the current date in Ghana (UTC).
 */
export function scholarshipAvailability(
  scholarship: { status: ScholarshipStatus; opensOn: string | null; closesOn: string | null },
  today: string,
): ScholarshipAvailability {
  const { status, opensOn, closesOn } = scholarship;
  if (status === 'expired' || (closesOn !== null && closesOn < today)) return 'closed';
  if (opensOn !== null && opensOn > today) return 'upcoming';
  if (opensOn === null && closesOn === null) return 'unknown';
  return 'open';
}

/** Today's date in Ghana (GMT, no daylight saving) as "YYYY-MM-DD". */
export function ghanaToday(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}
