import { Search } from 'lucide-react';
import { type FormEvent, type ReactNode, useState } from 'react';
import { Button } from '../ui/Button';

const fieldClasses = 'w-full rounded-md border border-blue-300 bg-white p-2.5';

/**
 * Search box plus filter selects. Search runs on submit (not on every key,
 * to save mobile data); selects apply as soon as they change.
 */
export function SearchFilters({
  label,
  placeholder,
  query,
  onSearch,
  children,
  onClear,
  active,
}: {
  label: string;
  placeholder: string;
  query: string;
  onSearch: (q: string) => void;
  children?: ReactNode;
  onClear: () => void;
  active: boolean;
}) {
  const [text, setText] = useState(query);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSearch(text.trim());
  };
  return (
    <section aria-label="Search and filter" className="space-y-4 rounded-lg bg-off-white p-4">
      <form role="search" onSubmit={submit} className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1 basis-64">
          <label htmlFor="search-q" className="mb-1 block font-semibold">
            {label}
          </label>
          <input
            id="search-q"
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={placeholder}
            className={fieldClasses}
          />
        </div>
        <Button type="submit">
          <Search aria-hidden="true" className="size-5" /> Search
        </Button>
      </form>
      {children && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>}
      {active && (
        <button
          type="button"
          className="font-semibold text-blue-700 underline underline-offset-4"
          onClick={() => {
            setText('');
            onClear();
          }}
        >
          Clear search and filters
        </button>
      )}
    </section>
  );
}

export function FilterSelect({
  id,
  label,
  value,
  onChange,
  allLabel,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  allLabel: string;
  options: readonly (readonly [string, string])[];
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block font-semibold">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={fieldClasses}
      >
        <option value="">{allLabel}</option>
        {options.map(([v, text]) => (
          <option key={v} value={v}>
            {text}
          </option>
        ))}
      </select>
    </div>
  );
}
