import type { EligibilityStatus } from '@xcel/shared';
import { CircleCheck, CircleHelp, CircleX } from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';
import { DashedCircleCheck } from './StatusIcons';

interface StatusStyle {
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  className: string;
}

/** SRS 11.6: every status has a colour, an icon and a text label. */
const STATUS_STYLES: Record<EligibilityStatus, StatusStyle> = {
  Eligible: { label: 'Eligible', Icon: CircleCheck, className: 'bg-green-100 text-green-900' },
  LikelyEligible: {
    label: 'Likely eligible',
    Icon: DashedCircleCheck,
    className: 'border border-green-300 bg-green-50 text-green-800',
  },
  NeedsReview: { label: 'Needs review', Icon: CircleHelp, className: 'bg-blue-100 text-blue-900' },
  NotEligible: { label: 'Not eligible', Icon: CircleX, className: 'bg-red-100 text-red-800' },
};

/**
 * Eligibility status badge. `strong` gives the solid Not Eligible variant
 * (white on red-700). The badge is never itself a button: put a separate,
 * clearly labelled "See why" control next to it.
 */
export function StatusBadge({
  status,
  strong = false,
}: {
  status: EligibilityStatus;
  strong?: boolean;
}) {
  const { label, Icon, className } = STATUS_STYLES[status];
  const colours = strong && status === 'NotEligible' ? 'bg-red-700 text-white' : className;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${colours}`}
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      {label}
    </span>
  );
}
