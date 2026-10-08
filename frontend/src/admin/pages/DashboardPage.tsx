import type { AdminDashboard, PublishStatus, StaleReport } from '@xcel/shared';
import { PUBLISH_STATUSES } from '@xcel/shared';
import { AlertTriangle, Flag } from 'lucide-react';
import { Link } from 'react-router';
import { LoadError, Loading } from '../../components/LoadState';
import { useAdminGet } from '../api';
import { AdminPage, Panel } from '../components/AdminPage';
import { PUBLISH_STATUS_LABELS } from '../labels';

function StatusCounts({
  title,
  counts,
  to,
}: {
  title: string;
  counts: Partial<Record<PublishStatus, number>>;
  to?: string;
}) {
  const total = Object.values(counts).reduce((sum, n) => sum + (n ?? 0), 0);
  return (
    <div className="rounded-lg border border-blue-100 bg-white p-4">
      <h2 className="text-lg font-bold">{to ? <Link to={to}>{title}</Link> : title}</h2>
      <p className="text-3xl font-bold">{total}</p>
      <dl className="mt-2 space-y-0.5 text-sm">
        {PUBLISH_STATUSES.filter((s) => counts[s]).map((s) => (
          <div key={s} className="flex justify-between gap-2">
            <dt>
              {to ? (
                <Link to={`${to}?status=${s}`}>{PUBLISH_STATUS_LABELS[s]}</Link>
              ) : (
                PUBLISH_STATUS_LABELS[s]
              )}
            </dt>
            <dd className="font-semibold">{counts[s]}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function DashboardPage() {
  const dashboard = useAdminGet<AdminDashboard>('/admin/dashboard');
  const stale = useAdminGet<StaleReport>('/admin/verification/stale');

  if (dashboard.isPending) {
    return (
      <AdminPage title="Dashboard">
        <Loading />
      </AdminPage>
    );
  }
  if (dashboard.error) {
    return (
      <AdminPage title="Dashboard">
        <LoadError onRetry={() => void dashboard.refetch()} />
      </AdminPage>
    );
  }
  const d = dashboard.data;

  return (
    <AdminPage title="Dashboard">
      {(d.staleRecords > 0 || d.openReports > 0 || d.scholarships.overdue > 0) && (
        <ul className="space-y-2">
          {d.staleRecords > 0 && (
            <li className="flex items-center gap-2 rounded-lg border border-blue-300 bg-blue-50 p-3">
              <AlertTriangle aria-hidden="true" className="size-5 text-blue-700" />
              <span>
                {d.staleRecords} {d.staleRecords === 1 ? 'record needs' : 'records need'}{' '}
                re-verification. <Link to="/admin/verification">Review stale records</Link>
              </span>
            </li>
          )}
          {d.openReports > 0 && (
            <li className="flex items-center gap-2 rounded-lg border border-blue-300 bg-blue-50 p-3">
              <Flag aria-hidden="true" className="size-5 text-blue-700" />
              <span>
                {d.openReports} open error {d.openReports === 1 ? 'report' : 'reports'} from the
                public. <Link to="/admin/reports">Review reports</Link>
              </span>
            </li>
          )}
          {d.scholarships.overdue > 0 && (
            <li className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-red-800">
              <AlertTriangle aria-hidden="true" className="size-5" />
              <span>
                {d.scholarships.overdue} published{' '}
                {d.scholarships.overdue === 1 ? 'scholarship has' : 'scholarships have'} a closing
                date in the past.{' '}
                <Link to="/admin/scholarships?status=published" className="text-red-800">
                  Review scholarships
                </Link>
              </span>
            </li>
          )}
        </ul>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatusCounts title="Universities" counts={d.universities} to="/admin/universities" />
        <StatusCounts title="Programmes" counts={d.programmes} to="/admin/programmes" />
        <StatusCounts title="Admission cycles" counts={d.admissionCycles} />
        <div className="rounded-lg border border-blue-100 bg-white p-4">
          <h2 className="text-lg font-bold">
            <Link to="/admin/scholarships">Scholarships</Link>
          </h2>
          <dl className="mt-2 space-y-0.5 text-sm">
            {(['published', 'draft', 'expired', 'archived'] as const).map((s) => (
              <div key={s} className="flex justify-between gap-2">
                <dt className="capitalize">{s}</dt>
                <dd className="font-semibold">{d.scholarships[s] ?? 0}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="rounded-lg border border-blue-100 bg-white p-4">
          <h2 className="text-lg font-bold">
            <Link to="/admin/mentors">Mentors</Link>
          </h2>
          <dl className="mt-2 space-y-0.5 text-sm">
            {(['active', 'inactive', 'archived'] as const).map((s) => (
              <div key={s} className="flex justify-between gap-2">
                <dt className="capitalize">{s}</dt>
                <dd className="font-semibold">{d.mentors[s]}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {stale.data && stale.data.items.length > 0 && (
        <Panel
          title="Oldest verifications"
          actions={<Link to="/admin/verification">All stale records</Link>}
        >
          <p className="text-sm">
            Verified or published records not verified in the last {stale.data.staleAfterDays} days.
          </p>
          <ul className="divide-y divide-blue-100">
            {stale.data.items.slice(0, 5).map((item) => (
              <li key={`${item.entityType}-${item.entityId}`} className="py-2">
                {item.label}
                <span className="block text-sm">
                  {item.lastVerifiedAt
                    ? `Last verified ${new Date(item.lastVerifiedAt).toLocaleDateString('en-GB')}`
                    : 'Never verified'}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </AdminPage>
  );
}
