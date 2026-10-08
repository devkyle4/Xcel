import { GHANA_REGIONS, INSTITUTION_TYPES } from '@xcel/shared';
import { Link } from 'react-router';
import { EmptyState, Pagination, ResultCount } from '../components/browse/Pagination';
import { FilterSelect, SearchFilters } from '../components/browse/SearchFilters';
import { LoadError, Loading } from '../components/LoadState';
import { PageContainer } from '../components/PageContainer';
import { useUniversityList } from '../hooks/queries';
import { INSTITUTION_LABELS, REGION_LABELS } from '../lib/format';
import { useUrlFilters } from '../lib/url-state';

const PAGE_SIZE = 20;
const KEYS = ['q', 'region', 'type'] as const;

export function UniversitiesPage() {
  const { values, page, set, setPage, clear, active } = useUrlFilters(KEYS);
  const list = useUniversityList({
    q: values.q || undefined,
    region: values.region || undefined,
    type: values.type || undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  return (
    <PageContainer
      title="Universities"
      intro="Browse universities and other tertiary institutions in Ghana."
    >
      <SearchFilters
        label="Search universities"
        placeholder="Name or short name, e.g. KNUST"
        query={values.q}
        onSearch={(q) => set('q', q)}
        onClear={clear}
        active={active}
      >
        <FilterSelect
          id="filter-region"
          label="Region"
          allLabel="All regions"
          value={values.region}
          onChange={(v) => set('region', v)}
          options={GHANA_REGIONS.map((r) => [r, REGION_LABELS[r]] as const)}
        />
        <FilterSelect
          id="filter-type"
          label="Type"
          allLabel="All types"
          value={values.type}
          onChange={(v) => set('type', v)}
          options={INSTITUTION_TYPES.map((t) => [t, INSTITUTION_LABELS[t]] as const)}
        />
      </SearchFilters>

      {list.isPending ? (
        <Loading label="Loading universities…" />
      ) : list.error ? (
        <LoadError onRetry={() => void list.refetch()} />
      ) : (
        <>
          <ResultCount
            page={page}
            pageSize={PAGE_SIZE}
            total={list.data.total}
            noun="universities"
          />
          {list.data.items.length === 0 ? (
            <EmptyState onClear={active ? clear : undefined}>
              No universities match your search. Try different words, or clear the filters.
            </EmptyState>
          ) : (
            <>
              {/* Cards use h3 titles; this keeps the heading outline in order. */}
              <h2 className="sr-only">Universities found</h2>
              <ul className="space-y-5">
                {list.data.items.map((u) => (
                  <li key={u.slug}>
                    <article>
                      <h3 className="text-lg font-semibold">
                        <Link to={`/universities/${u.slug}`}>{u.name}</Link>
                      </h3>
                      <p className="text-sm">
                        {[
                          INSTITUTION_LABELS[u.institutionType],
                          [u.town, u.region && REGION_LABELS[u.region]].filter(Boolean).join(', '),
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </article>
                  </li>
                ))}
              </ul>
            </>
          )}
          <Pagination page={page} pageSize={PAGE_SIZE} total={list.data.total} onPage={setPage} />
        </>
      )}
    </PageContainer>
  );
}
