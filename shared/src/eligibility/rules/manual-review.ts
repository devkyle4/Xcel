import { z } from 'zod';
import { defineRule } from './define';

/**
 * A condition the platform cannot check from WASSCE results, such as an
 * interview or entrance exam. Never fails a student; it makes an otherwise
 * met set of requirements "Likely Eligible" and is listed for confirmation.
 */
export const manualReviewRule = defineRule(
  'manual_review',
  z.object({ description: z.string().trim().min(1) }).strict(),
  {
    referencedCodes: () => ({ subjects: [], grades: [] }),
    evaluate: (p) => ({
      outcome: 'needs_confirmation',
      reason: null,
      explanation: { type: 'manual_review', description: p.description },
    }),
  },
);
