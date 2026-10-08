import { PUBLISH_STATUSES } from '@xcel/shared';
import { Search } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { inputClasses } from './fields';
import { PUBLISH_STATUS_LABELS } from '../labels';

/** Search box and optional status filter for admin lists. */
export function ListControls({
  label,
  q,
  onSearch,
  status,
  onStatus,
}: {
  label: string;
  q: string;
  onSearch: (q: string) => void;
  status?: string;
  onStatus?: (status: string) => void;
}) {
  const [draft, setDraft] = useState(q);
  const [lastQ, setLastQ] = useState(q);
  if (q !== lastQ) {
    // The URL changed (e.g. back button): show its search text.
    setLastQ(q);
    setDraft(q);
  }
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSearch(draft.trim());
  };
  return (
    <div className="flex flex-wrap items-end gap-4 rounded-lg border border-blue-100 bg-white p-4">
      <form role="search" onSubmit={submit} className="flex min-w-60 flex-1 items-end gap-2">
        <div className="flex-1">
          <label htmlFor="admin-search" className="mb-1 block font-semibold">
            {label}
          </label>
          <input
            id="admin-search"
            type="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className={inputClasses}
          />
        </div>
        <Button type="submit">
          <Search aria-hidden="true" className="size-5" /> Search
        </Button>
      </form>
      {onStatus && (
        <div>
          <label htmlFor="admin-status" className="mb-1 block font-semibold">
            Status
          </label>
          <select
            id="admin-status"
            value={status}
            onChange={(e) => onStatus(e.target.value)}
            className={inputClasses}
          >
            <option value="">All statuses</option>
            {PUBLISH_STATUSES.map((s) => (
              <option key={s} value={s}>
                {PUBLISH_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
