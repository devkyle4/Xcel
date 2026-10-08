import type { ReactNode } from 'react';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';

export function ConfirmDialog({
  title,
  confirmLabel,
  onConfirm,
  onCancel,
  busy,
  children,
}: {
  title: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
  children: ReactNode;
}) {
  return (
    <Modal title={title} onClose={onCancel}>
      <div className="space-y-5">
        <div className="space-y-2">{children}</div>
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={busy}>
            {busy ? 'Working…' : confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
