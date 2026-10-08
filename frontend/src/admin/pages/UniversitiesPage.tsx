import type { AdminUniversity, Paginated, PublishStatus } from '@xcel/shared';
import { Plus } from 'lucide-react';
import { Link } from 'react-router';
import { Pagination } from '../../components/browse/Pagination';
import { LoadError, Loading } from '../../components/LoadState';
import { ButtonLink } from '../../components/ui/Button';
import { INSTITUTION_LABELS, REGION_LABELS } from '../../lib/format';
import { useUrlFilters } from '../../lib/url-state';
import { useAdminList } from '../api';
import { AdminPage } from '../components/AdminPage';
import { ListControls } from '../components/ListControls';
import { PublishStatusBadge } from '../components/PublishStatusBadge';

const PAGE_SIZE = 20;

export function UniversitiesPage() {
  const filters = useUrlFilters(['q', 'status'] as const);
  const list = useAdminList<AdminUniversity>('/admin/universities', {
    q: filters.values.q || undefined,
    status: filters.values.status || undefined,
    page: filters.page,
    pageSize: PAGE_SIZE,
  });

  return (
    <AdminPage
      title="Universities"
      actions={
        <ButtonLink to="/admin/universities/new">
          <Plus aria-hidden="true" className="size-5" /> Add university
        </ButtonLink>
      }
    >
      <ListControls
        label="Search universities"
        q={filters.values.q}
        onSearch={(q) => filters.set('q', q)}
        status={filters.values.status}
        onStatus={(s) => filters.set('status', s)}
      />
      <Results list={list} onPage={filters.setPage} />
    </AdminPage>
  );
}

function Results({
  list,
  onPage,
}: {
  list: ReturnType<typeof useAdminList<AdminUniversity>>;
  onPage: (page: number) => void;
}) {
  if (list.isPending) return <Loading />;
  if (list.error) return <LoadError onRetry={() => void list.refetch()} />;
  const { items, total, page, pageSize } = list.data as Paginated<AdminUniversity>;
  if (items.length === 0) return <p>No universities match.</p>;
  return (
    <>
      <p role="status">
        {total} {total === 1 ? 'university' : 'universities'}
      </p>
      <div className="overflow-x-auto rounded-lg border border-blue-100 bg-white">
        <table className="w-full text-left">
          <thead className="border-b border-blue-100 bg-blue-50">
            <tr>
              <th scope="col" className="px-4 py-2">
                Name
              </th>
              <th scope="col" className="px-4 py-2">
                Type
              </th>
              <th scope="col" className="px-4 py-2">
                Region
              </th>
              <th scope="col" className="px-4 py-2">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-blue-100">
            {items.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-2">
                  <Link to={`/admin/universities/${u.id}`} className="font-semibold">
                    {u.name}
                  </Link>
                  {u.shortName && <span className="block text-sm">{u.shortName}</span>}
                </td>
                <td className="px-4 py-2">{INSTITUTION_LABELS[u.institutionType]}</td>
                <td className="px-4 py-2">{u.region ? REGION_LABELS[u.region] : '—'}</td>
                <td className="px-4 py-2">
                  <PublishStatusBadge status={u.status as PublishStatus} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pageSize={pageSize} total={total} onPage={onPage} />
    </>
  );
}
