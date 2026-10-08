import { DEGREE_TYPES, type EligibilityStatus } from '@xcel/shared';
import { useMemo, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router';
import { EligibilityDisclaimer } from '../components/Disclaimer';
import { ProgrammeResultCard } from '../components/eligibility/ProgrammeResultCard';
import { LoadError, Loading } from '../components/LoadState';
import { PageContainer } from '../components/PageContainer';
import { Button } from '../components/ui/Button';
import { STATUS_LABELS } from '../components/ui/status-labels';
import { useEligibilityBundle } from '../hooks/queries';
import { evaluateBundle, STATUS_ORDER } from '../lib/eligibility';
import { DEGREE_LABELS } from '../lib/format';
import { resultsStore, useStoredResults } from '../lib/results-store';
import { indexCatalogue } from '@xcel/shared';

const PAGE_SIZE = 20;

const HEADINGS: Record<EligibilityStatus, string> = {
  Eligible: 'Programmes you appear eligible for',
  LikelyEligible: 'Likely eligible: something to confirm',
  NeedsReview: 'Needs review: check the official requirements',
  NotEligible: 'Requirements not met',
};

export function EligibilityResultsPage() {
  const results = useStoredResults();
  const bundle = useEligibilityBundle();
  const [params, setParams] = useSearchParams();
  const [shown, setShown] = useState<Partial<Record<EligibilityStatus, number>>>({});
  // On small screens the filters are collapsed so results come first.
  const [filtersOpen, setFiltersOpen] = useState(false);

  const evaluations = useMemo(
    () => (bundle.data && results ? evaluateBundle(bundle.data, results) : []),
    [bundle.data, results],
  );
  const catalogue = useMemo(
    () => bundle.data && indexCatalogue(bundle.data.catalogue),
    [bundle.data],
  );

  if (!results) return <Navigate to="/check-eligibility" replace />;

  const filters = {
    status: params.get('status') as EligibilityStatus | null,
    university: params.get('university'),
    field: params.get('field'),
    degreeType: params.get('degreeType'),
    q: params.get('q')?.trim().toLowerCase() ?? '',
  };
  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
    setShown({});
  };

  const universities = [
    ...new Map(evaluations.map((e) => [e.programme.university.slug, e.programme.university.name])),
  ].sort((a, b) => a[1].localeCompare(b[1]));
  const fields = [
    ...new Set(evaluations.map((e) => e.programme.field).filter((f): f is string => Boolean(f))),
  ].sort();

  const visible = evaluations.filter(
    ({ programme: p }) =>
      (!filters.university || p.university.slug === filters.university) &&
      (!filters.field || p.field === filters.field) &&
      (!filters.degreeType || p.degreeType === filters.degreeType) &&
      (!filters.q ||
        p.name.toLowerCase().includes(filters.q) ||
        p.university.name.toLowerCase().includes(filters.q)),
  );
  const counts = Object.fromEntries(
    STATUS_ORDER.map((s) => [s, visible.filter((e) => e.result.status === s).length]),
  ) as Record<EligibilityStatus, number>;
  const filtersActive = [...params.keys()].length > 0;
  const selectClasses = 'w-full rounded-md border border-blue-300 bg-white p-2.5';

  return (
    <PageContainer
      title="Your eligibility results"
      intro="Based on the published requirements for the current admission cycle. Open “See why” on any programme for a requirement-by-requirement explanation."
    >
      <EligibilityDisclaimer />

      <div className="flex flex-wrap gap-3">
        <Link to="/check-eligibility" className="font-semibold">
          Edit my results
        </Link>
        <span aria-hidden="true">·</span>
        <button
          type="button"
          className="font-semibold text-blue-700 underline underline-offset-4"
          onClick={() => resultsStore.clear()}
        >
          Clear my results
        </button>
      </div>

      {bundle.isPending ? (
        <Loading label="Checking your results…" />
      ) : bundle.error || !catalogue ? (
        <LoadError onRetry={() => void bundle.refetch()} />
      ) : (
        <>
          <button
            type="button"
            className="font-semibold text-blue-700 underline underline-offset-4 md:hidden"
            aria-expanded={filtersOpen}
            aria-controls="result-filters"
            onClick={() => setFiltersOpen((v) => !v)}
          >
            {filtersOpen ? 'Hide filters' : 'Filter results'}
            {filtersActive && ` (${[...params.keys()].length} active)`}
          </button>
          <section
            id="result-filters"
            aria-label="Filter results"
            className={`rounded-lg bg-off-white p-4 md:block ${filtersOpen ? '' : 'hidden'}`}
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div>
                <label htmlFor="filter-q" className="mb-1 block font-semibold">
                  Search
                </label>
                <input
                  id="filter-q"
                  type="search"
                  defaultValue={params.get('q') ?? ''}
                  onChange={(e) => setFilter('q', e.target.value)}
                  className={selectClasses}
                  placeholder="Programme or university"
                />
              </div>
              {(
                [
                  [
                    'status',
                    'Show',
                    [['', 'All results'], ...STATUS_ORDER.map((s) => [s, STATUS_LABELS[s]])],
                  ],
                  ['university', 'University', [['', 'All universities'], ...universities]],
                  ['field', 'Field', [['', 'All fields'], ...fields.map((f) => [f, f])]],
                  [
                    'degreeType',
                    'Qualification',
                    [['', 'All qualifications'], ...DEGREE_TYPES.map((d) => [d, DEGREE_LABELS[d]])],
                  ],
                ] as [string, string, [string, string][]][]
              ).map(([key, label, options]) => (
                <div key={key}>
                  <label htmlFor={`filter-${key}`} className="mb-1 block font-semibold">
                    {label}
                  </label>
                  <select
                    id={`filter-${key}`}
                    value={params.get(key) ?? ''}
                    onChange={(e) => setFilter(key, e.target.value)}
                    className={selectClasses}
                  >
                    {options.map(([value, text]) => (
                      <option key={value} value={value}>
                        {text}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            {filtersActive && (
              <button
                type="button"
                className="mt-3 font-semibold text-blue-700 underline underline-offset-4"
                onClick={() => {
                  setParams(new URLSearchParams(), { replace: true });
                  setShown({});
                }}
              >
                Clear filters
              </button>
            )}
          </section>

          <p role="status">
            {STATUS_ORDER.map((s) => `${counts[s]} ${STATUS_LABELS[s].toLowerCase()}`).join(' · ')}
          </p>

          {visible.length === 0 ? (
            <p>No programmes match these filters. Try clearing some of them.</p>
          ) : (
            STATUS_ORDER.filter((s) => !filters.status || filters.status === s).map((status) => {
              const group = visible.filter((e) => e.result.status === status);
              if (group.length === 0) return null;
              const limit = shown[status] ?? PAGE_SIZE;
              return (
                <section key={status} aria-labelledby={`heading-${status}`} className="space-y-3">
                  <h2 id={`heading-${status}`} className="text-2xl font-bold">
                    {HEADINGS[status]} ({group.length})
                  </h2>
                  <ul className="space-y-3">
                    {group.slice(0, limit).map((evaluation) => (
                      <li key={evaluation.programme.id}>
                        <ProgrammeResultCard evaluation={evaluation} catalogue={catalogue} />
                      </li>
                    ))}
                  </ul>
                  {group.length > limit && (
                    <Button
                      variant="secondary"
                      onClick={() => setShown((s) => ({ ...s, [status]: limit + PAGE_SIZE }))}
                    >
                      Show more ({group.length - limit} remaining)
                    </Button>
                  )}
                </section>
              );
            })
          )}
        </>
      )}
    </PageContainer>
  );
}
