import { ghanaToday, type ScholarshipAvailability, type ScholarshipSummary } from '@xcel/shared';
import { formatDate } from './format';

/**
 * Deadline text for a scholarship. An expired scholarship whose closing date
 * is still in the future (closed early) must not show "Closed on" a future date.
 */
export function deadlineText(
  s: Pick<ScholarshipSummary, 'availability' | 'closesOn'>,
  today = ghanaToday(),
) {
  if (s.availability === 'closed') {
    return s.closesOn && s.closesOn < today
      ? `Closed on ${formatDate(s.closesOn)}`
      : 'No longer accepting applications';
  }
  return s.closesOn ? `Application deadline: ${formatDate(s.closesOn)}` : null;
}

/**
 * Wording for the link to a scholarship's official site. The link is always
 * shown, so students can apply, check dates, or watch for the next round.
 */
export const OFFICIAL_LINK_LABELS: Record<ScholarshipAvailability, string> = {
  open: 'Apply on the official website',
  upcoming: 'See the official application page',
  unknown: 'Check dates and apply on the official website',
  closed: 'Visit the official website for the next round',
};
