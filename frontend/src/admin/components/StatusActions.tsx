import { PUBLISH_TRANSITIONS, type PublishStatus } from '@xcel/shared';
import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { requestErrors, useAdminMutation } from '../api';
import { ConfirmDialog } from './ConfirmDialog';
import { FormError } from './fields';
import { PUBLISH_STATUS_LABELS } from '../labels';
import { PublishStatusBadge } from './PublishStatusBadge';

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

/**
 * Current status and the workflow steps allowed from it. The server enforces
 * the same workflow and may still refuse (e.g. no verification record yet).
 */
export function StatusActions({
  status,
  path,
  name,
  allowed = () => true,
  notes = {},
}: {
  status: PublishStatus;
  /** Further limits on the workflow for this kind of record. */
  allowed?: (to: PublishStatus) => boolean;
  /** Extra explanation in the confirmation for a step, e.g. what publishing replaces. */
  notes?: Partial<Record<PublishStatus, string>>;
  /** The record's admin path; the change is posted to `${path}/status`. */
  path: string;
  name: string;
}) {
  const change = useAdminMutation<{ status: PublishStatus }>('POST', `${path}/status`);
  const [confirming, setConfirming] = useState<PublishStatus | null>(null);

  const go = (to: PublishStatus) => {
    change.mutate({ status: to }, { onSuccess: () => setConfirming(null) });
  };

  return (
    <div className="space-y-3">
      <p className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">Status:</span> <PublishStatusBadge status={status} />
      </p>
      <div className="flex flex-wrap gap-3">
        {PUBLISH_TRANSITIONS[status].filter(allowed).map((to) => (
          <Button
            key={to}
            variant={to === 'published' ? 'primary' : 'secondary'}
            disabled={change.isPending}
            onClick={() => (CONFIRM[to] ? setConfirming(to) : go(to))}
          >
            {actionLabel(status, to)}
          </Button>
        ))}
      </div>
      {!confirming && <FormError message={requestErrors(change.error)['']} />}
      {confirming && (
        <ConfirmDialog
          title={`${actionLabel(status, confirming)} ${name}?`}
          confirmLabel={actionLabel(status, confirming)}
          busy={change.isPending}
          onConfirm={() => go(confirming)}
          onCancel={() => {
            setConfirming(null);
            change.reset();
          }}
        >
          <p>{CONFIRM[confirming]}</p>
          {notes[confirming] && <p>{notes[confirming]}</p>}
          <FormError message={requestErrors(change.error)['']} />
        </ConfirmDialog>
      )}
    </div>
  );
}
