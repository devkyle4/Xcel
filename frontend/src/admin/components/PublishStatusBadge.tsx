import type { PublishStatus } from '@xcel/shared';
import { PUBLISH_STATUS_LABELS } from '../labels';
import { Archive, BadgeCheck, CircleDashed, Eye, EyeOff, Search } from 'lucide-react';

// Workflow states, not outcomes: blue and green only, never red. Each has an icon and label.
const STYLES: Record<PublishStatus, { classes: string; Icon: typeof Eye }> = {
  draft: { classes: 'border-blue-300 bg-white text-blue-950', Icon: CircleDashed },
  needs_verification: { classes: 'border-blue-300 bg-blue-50 text-blue-900', Icon: Search },
  verified: { classes: 'border-green-300 bg-green-50 text-green-800', Icon: BadgeCheck },
  published: { classes: 'border-green-300 bg-green-100 text-green-900', Icon: Eye },
  unpublished: { classes: 'border-blue-300 bg-off-white text-blue-950', Icon: EyeOff },
  archived: { classes: 'border-blue-100 bg-off-white text-blue-950', Icon: Archive },
};

export function PublishStatusBadge({ status }: { status: PublishStatus }) {
  const { classes, Icon } = STYLES[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-sm font-semibold whitespace-nowrap ${classes}`}
    >
      <Icon aria-hidden="true" className="size-4" />
      {PUBLISH_STATUS_LABELS[status]}
    </span>
  );
}
