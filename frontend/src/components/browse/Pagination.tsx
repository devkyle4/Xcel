import { Button } from '../ui/Button';

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pages" className="flex flex-wrap items-center gap-3">
      <Button variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Previous <span className="sr-only">page</span>
      </Button>
      <span>
        Page {page} of {pages}
      </span>
      <Button variant="secondary" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Next <span className="sr-only">page</span>
      </Button>
    </nav>
  );
}

/** "Showing 21–40 of 95 programmes". */
export function ResultCount({
  page,
  pageSize,
  total,
  noun,
}: {
  page: number;
  pageSize: number;
  total: number;
  noun: string;
}) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <p role="status">
      {total === 0 ? `No ${noun} found` : `Showing ${from}–${to} of ${total} ${noun}`}
    </p>
  );
}

export function EmptyState({ children, onClear }: { children: string; onClear?: () => void }) {
  return (
    <div className="space-y-3 rounded-lg border border-blue-100 p-6">
      <p>{children}</p>
      {onClear && (
        <Button variant="secondary" onClick={onClear}>
          Clear search and filters
        </Button>
      )}
    </div>
  );
}
