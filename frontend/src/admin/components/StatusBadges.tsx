import type { MentorStatus, ReportStatus, ScholarshipStatus } from '@xcel/shared';
import {
  Archive,
  CircleCheck,
  CircleDashed,
  CirclePause,
  CircleX,
  Clock,
  Eye,
  Inbox,
  Search,
} from 'lucide-react';
import { MENTOR_STATUS_LABELS, REPORT_STATUS_LABELS, SCHOLARSHIP_STATUS_LABELS } from '../labels';
import { StatusPill } from './StatusPill';

export function ScholarshipStatusBadge({ status }: { status: ScholarshipStatus }) {
  const style = {
    draft: { Icon: CircleDashed, tone: 'neutral' },
    published: { Icon: Eye, tone: 'good' },
    expired: { Icon: Clock, tone: 'negative' },
    archived: { Icon: Archive, tone: 'muted' },
  } as const;
  return <StatusPill label={SCHOLARSHIP_STATUS_LABELS[status]} {...style[status]} />;
}

export function MentorStatusBadge({ status }: { status: MentorStatus }) {
  const style = {
    active: { Icon: CircleCheck, tone: 'good' },
    inactive: { Icon: CirclePause, tone: 'neutral' },
    archived: { Icon: Archive, tone: 'muted' },
  } as const;
  return <StatusPill label={MENTOR_STATUS_LABELS[status]} {...style[status]} />;
}

export function ReportStatusBadge({ status }: { status: ReportStatus }) {
  const style = {
    open: { Icon: Inbox, tone: 'info' },
    under_review: { Icon: Search, tone: 'info' },
    resolved: { Icon: CircleCheck, tone: 'good' },
    dismissed: { Icon: CircleX, tone: 'muted' },
  } as const;
  return <StatusPill label={REPORT_STATUS_LABELS[status]} {...style[status]} />;
}
