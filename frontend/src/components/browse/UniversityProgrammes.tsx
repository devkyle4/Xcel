import type { ProgrammeSummary } from '@xcel/shared';
import { useId, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useEligibilityBundle } from '../../hooks/queries';
import { evaluateBundle } from '../../lib/eligibility';
import { useStoredResults } from '../../lib/results-store';
import { ButtonLink } from '../ui/Button';
import { ProgrammeCard } from './ProgrammeCard';
import { CHECK_ELIGIBILITY_PATH } from '../../config/navigation';

const OTHER = 'Other programmes';

/**
 * A university's published programmes, grouped by field. If the student has
 * entered results this session, each shows their status, worked out in the
 * browser; the results are never sent to the server.
 */
export function UniversityProgrammes({ programmes }: { programmes: ProgrammeSummary[] }) {
  const id = useId();
  const [filter, setFilter] = useState('');
  const results = useStoredResults();
  const bundle = useEligibilityBundle();

  const statusById = useMemo(
    () =>
      new Map(
        results && bundle.data
          ? evaluateBundle(bundle.data, results).map((e) => [e.programme.id, e.result.status])
          : [],
      ),
    [results, bundle.data],
  );

  const groups = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const byField = new Map<string, ProgrammeSummary[]>();
    for (const p of programmes) {
      if (q && !`${p.name} ${p.field ?? ''}`.toLowerCase().includes(q)) continue;
      const field = p.field ?? OTHER;
      byField.set(field, [...(byField.get(field) ?? []), p]);
    }
    return [...byField].sort(([a], [b]) =>
      a === OTHER ? 1 : b === OTHER ? -1 : a.localeCompare(b),
    );
  }, [programmes, filter]);
  const shown = groups.reduce((n, [, list]) => n + list.length, 0);

  return (
    <section aria-labelledby={`${id}-heading`} className="space-y-4">
      <h2 id={`${id}-heading`} className="text-2xl font-bold">
        Programmes ({programmes.length})
      </h2>
      {programmes.length === 0 ? (
        <p>No programmes have been published for this institution yet.</p>
      ) : (
        <>
          {results ? (
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-blue-50 p-3">
              <span>
                Each programme shows whether you appear eligible, based on the results you entered
                this session. Final admission decisions are made by the institution.
              </span>
              <Link to={CHECK_ELIGIBILITY_PATH} className="font-semibold">
                Change or clear your results
              </Link>
            </p>
          ) : (
            <p className="flex flex-wrap items-center gap-3">
              <span>Enter your WASSCE results to see which of these you appear eligible for.</span>
              <ButtonLink to={CHECK_ELIGIBILITY_PATH} variant="secondary">
                Check eligibility
              </ButtonLink>
            </p>
          )}
          <div className="max-w-md">
            <label htmlFor={`${id}-filter`} className="mb-1 block font-semibold">
              Find a programme
            </label>
            <input
              id={`${id}-filter`}
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="e.g. Nursing or Engineering"
              className="w-full rounded-md border border-blue-300 bg-white px-3 py-2"
            />
          </div>
          <p role="status">
            {filter.trim()
              ? `${shown} of ${programmes.length} programmes match “${filter.trim()}”`
              : ''}
          </p>
          {groups.map(([field, list]) => (
            <section key={field} aria-label={field} className="space-y-3">
              <h3 className="text-xl font-semibold">{field}</h3>
              <ul className="space-y-3">
                {list.map((p) => (
                  <li key={p.id}>
                    <ProgrammeCard
                      programme={p}
                      status={statusById.get(p.id)}
                      showUniversity={false}
                      headingLevel={4}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </section>
  );
}
