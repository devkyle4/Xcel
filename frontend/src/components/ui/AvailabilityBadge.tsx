import type { ScholarshipAvailability } from '@xcel/shared';
import { CircleCheck, CircleHelp, CircleX, Clock } from 'lucide-react';

/** Scholarship availability. Red only for closed, which is a negative outcome. */
const STYLES = {
  open: { label: 'Open', Icon: CircleCheck, className: 'bg-green-100 text-green-900' },
  upcoming: { label: 'Opening soon', Icon: Clock, className: 'bg-blue-100 text-blue-900' },
  closed: { label: 'Closed', Icon: CircleX, className: 'bg-red-100 text-red-800' },
  unknown: {
    label: 'Dates not announced',
    Icon: CircleHelp,
    className: 'bg-blue-50 text-blue-950',
  },
} as const;

export function AvailabilityBadge({ availability }: { availability: ScholarshipAvailability }) {
  const { label, Icon, className } = STYLES[availability];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${className}`}
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      {label}
    </span>
  );
}
