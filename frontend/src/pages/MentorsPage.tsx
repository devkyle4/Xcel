import { MENTORING_TOPICS } from '@xcel/shared';
import { EmptyState, Pagination, ResultCount } from '../components/browse/Pagination';
import { FilterSelect, SearchFilters } from '../components/browse/SearchFilters';
import { MentoringDisclaimer } from '../components/Disclaimer';
import { LoadError, Loading } from '../components/LoadState';
import { MentorCard } from '../components/mentors/MentorCard';
import { PageContainer } from '../components/PageContainer';
import { useMentorList } from '../hooks/queries';
import { useUrlFilters } from '../lib/url-state';

const PAGE_SIZE = 20;
const KEYS = ['q', 'topic'] as const;

export function MentorsPage() {
  const { values, page, set, setPage, clear, active } = useUrlFilters(KEYS);
  const list = useMentorList({
    q: values.q || undefined,
    topic: values.topic || undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  return (
    <PageContainer
      title="Find a Mentor"
      intro="Ask a mentor for one-on-one guidance on choosing and applying for programmes. Send a request and the mentor will contact you to arrange a session."
    >
      <MentoringDisclaimer />
      <SearchFilters
        label="Search mentors"
        placeholder="Name, background or field"
        query={values.q}
        onSearch={(q) => set('q', q)}
        onClear={clear}
        active={active}
      >
        <FilterSelect
          id="filter-topic"
          label="Topic"
          allLabel="All topics"
          value={values.topic}
          onChange={(v) => set('topic', v)}
          options={MENTORING_TOPICS.map((t) => [t.code, t.label] as const)}
        />
      </SearchFilters>

      {list.isPending ? (
        <Loading label="Loading mentors…" />
      ) : list.error ? (
        <LoadError onRetry={() => void list.refetch()} />
      ) : (
        <>
          <ResultCount page={page} pageSize={PAGE_SIZE} total={list.data.total} noun="mentors" />
          {list.data.items.length === 0 ? (
            <EmptyState onClear={active ? clear : undefined}>
              {active
                ? 'No mentors match your search. Try clearing the filters.'
                : 'No mentors are available yet. Please check back soon.'}
            </EmptyState>
          ) : (
            <>
              {/* Cards use h3 titles; this keeps the heading outline in order. */}
              <h2 className="sr-only">Mentors</h2>
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {list.data.items.map((m) => (
                  <li key={m.slug}>
                    <MentorCard mentor={m} />
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
