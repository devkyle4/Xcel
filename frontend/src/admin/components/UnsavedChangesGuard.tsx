import { useEffect } from 'react';
import { useBlocker } from 'react-router';
import type { SAVED } from '../forms';
import { ConfirmDialog } from './ConfirmDialog';

/**
 * Asks before leaving a form with unsaved changes, in the app or by closing
 * the tab. Navigating with `state: SAVED` (after a successful save) is allowed.
 */
export function UnsavedChangesGuard({ when }: { when: boolean }) {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      when &&
      currentLocation.pathname !== nextLocation.pathname &&
      !(nextLocation.state as typeof SAVED | null)?.saved,
  );

  useEffect(() => {
    if (!when) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [when]);

  if (blocker.state !== 'blocked') return null;
  return (
    <ConfirmDialog
      title="Leave without saving?"
      confirmLabel="Leave without saving"
      onConfirm={() => blocker.proceed()}
      onCancel={() => blocker.reset()}
    >
      <p>Your changes on this page have not been saved.</p>
    </ConfirmDialog>
  );
}
