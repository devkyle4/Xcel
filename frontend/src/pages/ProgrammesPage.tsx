import { DEGREE_TYPES, GHANA_REGIONS } from '@xcel/shared';
import { useMemo } from 'react';
import { Link } from 'react-router';
import { EmptyState, Pagination, ResultCount } from '../components/browse/Pagination';
import { ProgrammeCard } from '../components/browse/ProgrammeCard';
import { FilterSelect, SearchFilters } from '../components/browse/SearchFilters';
import { LoadError, Loading } from '../components/LoadState';
import { PageContainer } from '../components/PageContainer';
import { useEligibilityBundle, useProgrammeFilters, useProgrammeList } from '../hooks/queries';
import { evaluateBundle } from '../lib/eligibility';
import { DEGREE_LABELS, REGION_LABELS } from '../lib/format';
import { useStoredResults } from '../lib/results-store';
import { useUrlFilters } from '../lib/url-state';

const PAGE_SIZE = 20;
const KEYS = ['q', 'university', 'field', 'degreeType', 'region', 'eligible'] as const;

export function ProgrammesPage() {
  const { values, page, set, setPage, clear, active } = useUrlFilters(KEYS);
  const results = useStoredResults();
  const filters = useProgrammeFilters();
  const bundle = useEligibilityBundle();
  const eligibleOnly = Boolean(results) && values.eligible === '1';

  // Statuses come from evaluating the student's results in the browser.
  const evaluations = useMemo(
    () => (results && bundle.data ? evaluateBundle(bundle.data, results) : []),
    [results, bundle.data],
  );
  const statusById = useMemo(
    () => new Map(evaluations.map((e) => [e.programme.id, e.result.status])),
    [evaluations],
  );

  const list = useProgrammeList({
    q: values.q || undefined,
    university: values.university || undefined,
    field: values.field || undefined,
    degreeType: values.degreeType || undefined,
    region: values.region || undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  // "Only programmes I appear eligible for" filters the evaluated programmes locally.
  const eligible = useMemo(() => {
    const q = values.q.toLowerCase();
    return evaluations
      .filter(({ result }) => result.status === 'Eligible' || result.status === 'LikelyEligible')
      .map(({ programme }) => programme)
      .filter(
        (p) =>
          (!q || p.name.toLowerCase().includes(q) || p.university.name.toLowerCase().includes(q)) &&
          (!values.university || p.university.slug === values.university) &&
          (!values.field || p.field?.toLowerCase() === values.field.toLowerCase()) &&
          (!values.degreeType || p.degreeType === values.degreeType) &&
          (!values.region || p.university.region === values.region),
      );
  }, [evaluations, values]);

  const items = eligibleOnly
    ? eligible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
    : (list.data?.items ?? []);
  const total = eligibleOnly ? eligible.length : (list.data?.total ?? 0);
  const loading = eligibleOnly ? bundle.isPending : list.isPending;
  const error = eligibleOnly ? bundle.error : list.error;

  return (
    <PageContainer
      title="Programmes"
      intro="Search university programmes and see their admission requirements for each academic year."
    >
      <SearchFilters
        label="Search programmes"
        placeholder="e.g. nursing, computer science"
        query={values.q}
        onSearch={(q) => set('q', q)}
        onClear={clear}
        active={active}
      >
        <FilterSelect
          id="filter-university"
          label="University"
          allLabel="All universities"
          value={values.university}
          onChange={(v) => set('university', v)}
          options={(filters.data?.universities ?? []).map((u) => [u.slug, u.name] as const)}
        />
        <FilterSelect
          id="filter-field"
          label="Field"
          allLabel="All fields"
          value={values.field}
          onChange={(v) => set('field', v)}
          options={(filters.data?.fields ?? []).map((f) => [f, f] as const)}
        />
        <FilterSelect
          id="filter-degree"
          label="Qualification"
          allLabel="All qualifications"
          value={values.degreeType}
          onChange={(v) => set('degreeType', v)}
          options={DEGREE_TYPES.map((d) => [d, DEGREE_LABELS[d]] as const)}
        />
        <FilterSelect
          id="filter-region"
          label="Region"
          allLabel="All regions"
          value={values.region}
          onChange={(v) => set('region', v)}
          options={GHANA_REGIONS.map((r) => [r, REGION_LABELS[r]] as const)}
        />
      </SearchFilters>

      {results ? (
        <label className="flex items-center gap-3 font-semibold">
          <input
            type="checkbox"
            className="size-5 accent-green-700"
            checked={eligibleOnly}
            onChange={(e) => set('eligible', e.target.checked ? '1' : '')}
          />
          Only show programmes I appear eligible for
        </label>
      ) : (
        <p>
          <Link to="/check-eligibility">Enter your results</Link> to see which programmes you appear
          eligible for.
        </p>
      )}

      {loading ? (
        <Loading label="Loading programmes…" />
      ) : error ? (
        <LoadError onRetry={() => void (eligibleOnly ? bundle.refetch() : list.refetch())} />
      ) : (
        <>
          <ResultCount page={page} pageSize={PAGE_SIZE} total={total} noun="programmes" />
          {items.length === 0 ? (
            <EmptyState onClear={active ? clear : undefined}>
              {eligibleOnly
                ? 'None of the matching programmes’ requirements appear to be met by your results. Try clearing some filters.'
                : 'No programmes match your search. Try different words, or clear the filters.'}
            </EmptyState>
          ) : (
            <ul className="space-y-3">
              {items.map((programme) => (
                <li key={programme.id}>
                  <ProgrammeCard programme={programme} status={statusById.get(programme.id)} />
                </li>
              ))}
            </ul>
          )}
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />
        </>
      )}
    </PageContainer>
  );
}
