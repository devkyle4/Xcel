import type { AdminProgrammeListItem, AdminUniversity } from '@xcel/shared';
import { Plus } from 'lucide-react';
import { Link } from 'react-router';
import { Pagination } from '../../components/browse/Pagination';
import { LoadError, Loading } from '../../components/LoadState';
import { ButtonLink } from '../../components/ui/Button';
import { DEGREE_LABELS } from '../../lib/format';
import { useUrlFilters } from '../../lib/url-state';
import { useAdminGet, useAdminList } from '../api';
import { AdminPage } from '../components/AdminPage';
import { ListControls } from '../components/ListControls';
import { PublishStatusBadge } from '../components/PublishStatusBadge';

const PAGE_SIZE = 20;

export function ProgrammesPage() {
  const filters = useUrlFilters(['q', 'status', 'universityId'] as const);
  const { universityId } = filters.values;
  const university = useAdminGet<AdminUniversity>(
    `/admin/universities/${universityId}`,
    undefined,
    Boolean(universityId),
  );
  const list = useAdminList<AdminProgrammeListItem>('/admin/programmes', {
    q: filters.values.q || undefined,
    status: filters.values.status || undefined,
    universityId: universityId || undefined,
    page: filters.page,
    pageSize: PAGE_SIZE,
  });

  return (
    <AdminPage
      title="Programmes"
      actions={
        <ButtonLink
          to={`/admin/programmes/new${universityId ? `?universityId=${universityId}` : ''}`}
        >
          <Plus aria-hidden="true" className="size-5" /> Add programme
        </ButtonLink>
      }
    >
      {universityId && (
        <p className="flex flex-wrap items-center gap-3">
          <span>
            Showing programmes at{' '}
            <Link to={`/admin/universities/${universityId}`} className="font-semibold">
              {university.data?.name ?? 'one university'}
            </Link>
          </span>
          <button
            type="button"
            className="font-semibold text-blue-700 underline underline-offset-4"
            onClick={() => filters.set('universityId', '')}
          >
            Show all universities
          </button>
        </p>
      )}
      <ListControls
        label="Search programmes"
        q={filters.values.q}
        onSearch={(q) => filters.set('q', q)}
        status={filters.values.status}
        onStatus={(s) => filters.set('status', s)}
      />
      {list.isPending ? (
        <Loading />
      ) : list.error ? (
        <LoadError onRetry={() => void list.refetch()} />
      ) : list.data.items.length === 0 ? (
        <p>No programmes match.</p>
      ) : (
        <>
          <p role="status">
            {list.data.total} {list.data.total === 1 ? 'programme' : 'programmes'}
          </p>
          <div className="overflow-x-auto rounded-lg border border-blue-100 bg-white">
            <table className="w-full text-left">
              <thead className="border-b border-blue-100 bg-blue-50">
                <tr>
                  <th scope="col" className="px-4 py-2">
                    Programme
                  </th>
                  <th scope="col" className="px-4 py-2">
                    University
                  </th>
                  <th scope="col" className="px-4 py-2">
                    Award
                  </th>
                  <th scope="col" className="px-4 py-2">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-100">
                {list.data.items.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-2">
                      <Link to={`/admin/programmes/${p.id}`} className="font-semibold">
                        {p.name}
                      </Link>
                      {p.field && <span className="block text-sm">{p.field}</span>}
                    </td>
                    <td className="px-4 py-2">{p.universityName}</td>
                    <td className="px-4 py-2">{DEGREE_LABELS[p.degreeType]}</td>
                    <td className="px-4 py-2">
                      <PublishStatusBadge status={p.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={list.data.page}
            pageSize={list.data.pageSize}
            total={list.data.total}
            onPage={filters.setPage}
          />
        </>
      )}
    </AdminPage>
  );
}
