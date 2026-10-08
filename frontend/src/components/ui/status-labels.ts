import type { EligibilityStatus } from '@xcel/shared';

/** Text labels for eligibility statuses (SRS 11.6). */
export const STATUS_LABELS: Record<EligibilityStatus, string> = {
  Eligible: 'Eligible',
  LikelyEligible: 'Likely eligible',
  NeedsReview: 'Needs review',
  NotEligible: 'Not eligible',
};
