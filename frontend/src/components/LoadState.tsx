import { Button } from './ui/Button';

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <p role="status" className="py-8">
      {label}
    </p>
  );
}

export function LoadError({ onRetry }: { onRetry?: () => void }) {
  return (
    <div role="alert" className="space-y-3 rounded-lg border border-red-300 bg-red-50 p-4">
      <p className="text-red-800">This information could not be loaded. Check your connection.</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
