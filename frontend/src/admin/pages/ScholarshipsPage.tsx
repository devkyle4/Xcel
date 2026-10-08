import type { AdminScholarshipListItem } from '@xcel/shared';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Pagination } from '../../components/browse/Pagination';
import { LoadError, Loading } from '../../components/LoadState';
import { Button, ButtonLink } from '../../components/ui/Button';
import { formatDate } from '../../lib/format';
import { useUrlFilters } from '../../lib/url-state';
import { requestErrors, useAdminList, useAdminMutation } from '../api';
import { AdminPage } from '../components/AdminPage';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { FormError } from '../components/fields';
import { ListControls } from '../components/ListControls';
import { ScholarshipStatusBadge } from '../components/StatusBadges';
import { SCHOLARSHIP_STATUS_LABELS } from '../labels';

const AVAILABILITY_LABELS = {
  open: 'Open',
  upcoming: 'Opening soon',
  closed: 'Closed',
  unknown: 'Dates not set',
} as const;

export function ScholarshipsPage() {
  const filters = useUrlFilters(['q', 'status'] as const);
  const list = useAdminList<AdminScholarshipListItem>('/admin/scholarships', {
    q: filters.values.q || undefined,
    status: filters.values.status || undefined,
    page: filters.page,
    pageSize: 20,
  });
  const [expiring, setExpiring] = useState(false);
  const expire = useAdminMutation<undefined, { expired: string[] }>(
    'POST',
    '/admin/scholarships/expire-overdue',
  );

  return (
    <AdminPage
      title="Scholarships"
      actions={
        <>
          <Button variant="secondary" onClick={() => setExpiring(true)}>
            Expire past deadlines
          </Button>
          <ButtonLink to="/admin/scholarships/new">
            <Plus aria-hidden="true" className="size-5" /> Add scholarship
          </ButtonLink>
        </>
      }
    >
      {expire.data && (
        <p role="status" className="rounded-lg border border-blue-300 bg-blue-50 p-3">
          {expire.data.expired.length === 0
            ? 'No published scholarships were past their closing date.'
            : `Marked ${expire.data.expired.length} as expired.`}
        </p>
      )}
      <ListControls
        label="Search scholarships or providers"
        q={filters.values.q}
        onSearch={(q) => filters.set('q', q)}
        status={filters.values.status}
        onStatus={(st) => filters.set('status', st)}
        statuses={SCHOLARSHIP_STATUS_LABELS}
      />

      {list.isPending ? (
        <Loading />
      ) : list.error ? (
        <LoadError onRetry={() => void list.refetch()} />
      ) : list.data.items.length === 0 ? (
        <p>No scholarships match.</p>
      ) : (
        <>
          <p role="status">
            {list.data.total} {list.data.total === 1 ? 'scholarship' : 'scholarships'}
          </p>
          <div className="overflow-x-auto rounded-lg border border-blue-100 bg-white">
            <table className="w-full text-left">
              <thead className="border-b border-blue-100 bg-blue-50">
                <tr>
                  <th scope="col" className="px-4 py-2">
                    Scholarship
                  </th>
                  <th scope="col" className="px-4 py-2">
                    Current cycle
                  </th>
                  <th scope="col" className="px-4 py-2">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-100">
                {list.data.items.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-2">
                      <Link to={`/admin/scholarships/${s.id}`} className="font-semibold">
                        {s.name}
                      </Link>
                      <span className="block text-sm">{s.providerName}</span>
                    </td>
                    <td className="px-4 py-2 text-sm">
                      {s.academicYear ?? 'No cycle'}
                      <span className="block">
                        {AVAILABILITY_LABELS[s.availability]}
                        {s.closesOn && ` · closes ${formatDate(s.closesOn)}`}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <ScholarshipStatusBadge status={s.status} />
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

      {expiring && (
        <ConfirmDialog
          title="Expire past-deadline scholarships?"
          confirmLabel="Mark as expired"
          busy={expire.isPending}
          onCancel={() => setExpiring(false)}
          onConfirm={() => expire.mutate(undefined, { onSuccess: () => setExpiring(false) })}
        >
          <p>
            Published scholarships whose current cycle has closed will be marked Expired. The public
            site never shows them as open either way.
          </p>
          <FormError message={requestErrors(expire.error)['']} />
        </ConfirmDialog>
      )}
    </AdminPage>
  );
}
