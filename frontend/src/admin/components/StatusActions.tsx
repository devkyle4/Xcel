import { PUBLISH_TRANSITIONS, type PublishStatus } from '@xcel/shared';
import { PUBLISH_STATUS_LABELS } from '../labels';
import { PublishStatusBadge } from './PublishStatusBadge';
import { WorkflowActions } from './WorkflowActions';

const ACTION_LABELS: Partial<Record<`${PublishStatus}>${PublishStatus}`, string>> = {
  'draft>needs_verification': 'Send for verification',
  'needs_verification>verified': 'Mark as verified',
  'needs_verification>draft': 'Return to draft',
  'verified>published': 'Publish',
  'verified>needs_verification': 'Send back for verification',
  'published>unpublished': 'Unpublish',
  'unpublished>published': 'Republish',
  'unpublished>needs_verification': 'Send for re-verification',
  'archived>draft': 'Restore as draft',
};

const CONFIRM: Partial<Record<PublishStatus, string>> = {
  published: 'It will appear in public search and on its public page.',
  unpublished: 'It will disappear from public search and its public page.',
  archived: 'It will be hidden everywhere. You can restore it as a draft later.',
};

const actionLabel = (from: PublishStatus, to: PublishStatus) =>
  ACTION_LABELS[`${from}>${to}`] ?? (to === 'archived' ? 'Archive' : PUBLISH_STATUS_LABELS[to]);

/** Publishing workflow steps for universities, programmes and admission cycles. */
export function StatusActions({
  status,
  path,
  name,
  allowed = () => true,
  notes = {},
}: {
  status: PublishStatus;
  path: string;
  name: string;
  /** Further limits on the workflow for this kind of record. */
  allowed?: (to: PublishStatus) => boolean;
  /** Extra explanation in the confirmation for a step, e.g. what publishing replaces. */
  notes?: Partial<Record<PublishStatus, string>>;
}) {
  const transitions = Object.fromEntries(
    Object.entries(PUBLISH_TRANSITIONS).map(([from, to]) => [from, to.filter(allowed)]),
  ) as Record<PublishStatus, PublishStatus[]>;
  const confirm = Object.fromEntries(
    Object.entries(CONFIRM).map(([to, text]) => [
      to,
      [text, notes[to as PublishStatus]].filter(Boolean).join(' '),
    ]),
  ) as Partial<Record<PublishStatus, string>>;
  return (
    <WorkflowActions
      status={status}
      badge={<PublishStatusBadge status={status} />}
      transitions={transitions}
      actionLabel={actionLabel}
      confirm={confirm}
      primary="published"
      path={path}
      name={name}
    />
  );
}
