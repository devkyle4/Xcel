import { STUDY_LEVELS } from '@xcel/shared';
import { EmptyState, Pagination, ResultCount } from '../components/browse/Pagination';
import { ScholarshipCard } from '../components/browse/ScholarshipCard';
import { FilterSelect, SearchFilters } from '../components/browse/SearchFilters';
import { LoadError, Loading } from '../components/LoadState';
import { PageContainer } from '../components/PageContainer';
import { useScholarshipFilters, useScholarshipList } from '../hooks/queries';
import { STUDY_LEVEL_LABELS } from '../lib/format';
import { useUrlFilters } from '../lib/url-state';

const PAGE_SIZE = 20;
const KEYS = ['q', 'availability', 'studyLevel', 'category', 'location'] as const;

const AVAILABILITY_OPTIONS = [
  ['open,upcoming', 'Open or opening soon'],
  ['open', 'Open now'],
  ['upcoming', 'Opening soon'],
  ['closed', 'Closed'],
] as const;

export function ScholarshipsPage() {
  const { values, page, set, setPage, clear, active } = useUrlFilters(KEYS);
  const options = useScholarshipFilters();
  const list = useScholarshipList({
    q: values.q || undefined,
    availability: values.availability || undefined,
    studyLevel: values.studyLevel || undefined,
    category: values.category || undefined,
    location: values.location || undefined,
    page,
    pageSize: PAGE_SIZE,
  });
  const toOptions = (values?: string[]) => (values ?? []).map((v) => [v, v] as const);

  return (
    <PageContainer
      title="Scholarships"
      intro="Find scholarships with their deadlines and official application links. Meeting a scholarship’s criteria does not guarantee an award."
    >
      <SearchFilters
        label="Search scholarships"
        placeholder="Scholarship or provider name"
        query={values.q}
        onSearch={(q) => set('q', q)}
        onClear={clear}
        active={active}
      >
        <FilterSelect
          id="filter-availability"
          label="Status"
          allLabel="Any status"
          value={values.availability}
          onChange={(v) => set('availability', v)}
          options={AVAILABILITY_OPTIONS}
        />
        <FilterSelect
          id="filter-level"
          label="Study level"
          allLabel="All levels"
          value={values.studyLevel}
          onChange={(v) => set('studyLevel', v)}
          options={STUDY_LEVELS.map((l) => [l, STUDY_LEVEL_LABELS[l]] as const)}
        />
        <FilterSelect
          id="filter-category"
          label="Eligibility"
          allLabel="All categories"
          value={values.category}
          onChange={(v) => set('category', v)}
          options={toOptions(options.data?.eligibilityCategories)}
        />
        <FilterSelect
          id="filter-location"
          label="Location"
          allLabel="All locations"
          value={values.location}
          onChange={(v) => set('location', v)}
          options={toOptions(options.data?.locations)}
        />
      </SearchFilters>

      {list.isPending ? (
        <Loading label="Loading scholarships…" />
      ) : list.error ? (
        <LoadError onRetry={() => void list.refetch()} />
      ) : (
        <>
          <ResultCount
            page={page}
            pageSize={PAGE_SIZE}
            total={list.data.total}
            noun="scholarships"
          />
          {list.data.items.length === 0 ? (
            <EmptyState onClear={active ? clear : undefined}>
              No scholarships match your search. Try different words, or clear the filters.
            </EmptyState>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {list.data.items.map((s) => (
                <li key={s.slug}>
                  <ScholarshipCard scholarship={s} />
                </li>
              ))}
            </ul>
          )}
          <Pagination page={page} pageSize={PAGE_SIZE} total={list.data.total} onPage={setPage} />
        </>
      )}
    </PageContainer>
  );
}
