import { type ReactNode, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { requestErrors, useAdminMutation } from '../api';
import { ConfirmDialog } from './ConfirmDialog';
import { FormError } from './fields';

/**
 * The current status of a record and the steps its workflow allows from it.
 * Steps with a confirmation message ask first. The server enforces the same
 * workflow and may still refuse; its reason is shown.
 */
export function WorkflowActions<S extends string>({
  status,
  badge,
  transitions,
  actionLabel,
  confirm = {},
  primary,
  path,
  name,
  body = (to) => ({ status: to }),
}: {
  status: S;
  badge: ReactNode;
  transitions: Readonly<Record<S, readonly S[]>>;
  actionLabel: (from: S, to: S) => string;
  /** Confirmation text for steps that need one. */
  confirm?: Partial<Record<S, string>>;
  /** The step shown as the main (green) action. */
  primary?: S;
  /** The record's admin path; the change is posted to `${path}/status`. */
  path: string;
  name: string;
  body?: (to: S) => unknown;
}) {
  const change = useAdminMutation<unknown>('POST', `${path}/status`);
  const [confirming, setConfirming] = useState<S | null>(null);
  const go = (to: S) => change.mutate(body(to), { onSuccess: () => setConfirming(null) });

  return (
    <div className="space-y-3">
      <p className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">Status:</span> {badge}
      </p>
      <div className="flex flex-wrap gap-3">
        {transitions[status].map((to) => (
          <Button
            key={to}
            variant={to === primary ? 'primary' : 'secondary'}
            disabled={change.isPending}
            onClick={() => (confirm[to] ? setConfirming(to) : go(to))}
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
          <p>{confirm[confirming]}</p>
          <FormError message={requestErrors(change.error)['']} />
        </ConfirmDialog>
      )}
    </div>
  );
}
