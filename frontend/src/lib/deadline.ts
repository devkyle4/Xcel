import { ghanaToday, type ScholarshipSummary } from '@xcel/shared';
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
