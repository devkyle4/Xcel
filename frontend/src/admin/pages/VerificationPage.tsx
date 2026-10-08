import type {
  AdminVerificationRecord,
  Paginated,
  StaleRecord,
  StaleReport,
  VerifiableEntityType,
} from '@xcel/shared';
import { useState } from 'react';
import { Link } from 'react-router';
import { Pagination } from '../../components/browse/Pagination';
import { LoadError, Loading } from '../../components/LoadState';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { formatDate } from '../../lib/format';
import { useUrlFilters } from '../../lib/url-state';
import { useAdminGet, useAdminList } from '../api';
import { AdminPage, Panel } from '../components/AdminPage';
import { PUBLISH_STATUS_LABELS } from '../labels';
import { VerificationForm } from '../components/VerificationPanel';
import { VERIFICATION_STATUS_LABELS } from '../labels';

const ENTITY_LABELS: Record<VerifiableEntityType, string> = {
  university: 'University',
  programme_admission_cycle: 'Admission cycle',
  scholarship_cycle: 'Scholarship',
};

const statusLabel = (status: StaleRecord['status']) =>
  status in PUBLISH_STATUS_LABELS
    ? PUBLISH_STATUS_LABELS[status as keyof typeof PUBLISH_STATUS_LABELS]
    : status.charAt(0).toUpperCase() + status.slice(1);

/** Links to the admin page where the record is edited. */
function entityLink(type: VerifiableEntityType, ownerId: string, label: string) {
  if (type === 'university') return <Link to={`/admin/universities/${ownerId}`}>{label}</Link>;
  if (type === 'programme_admission_cycle') {
    return <Link to={`/admin/programmes/${ownerId}`}>{label}</Link>;
  }
  return <Link to={`/admin/scholarships/${ownerId}`}>{label}</Link>;
}

export function VerificationPage() {
  const stale = useAdminGet<StaleReport>('/admin/verification/stale');
  const filters = useUrlFilters([] as const);
  const recent = useAdminList<AdminVerificationRecord>('/admin/verification', {
    page: filters.page,
    pageSize: 20,
  });
  const [checking, setChecking] = useState<StaleRecord | null>(null);

  return (
    <AdminPage title="Verification">
      <Panel title="Needs re-verification">
        {stale.isPending ? (
          <Loading />
        ) : stale.error ? (
          <LoadError onRetry={() => void stale.refetch()} />
        ) : (
          <>
            <p>
              Verified or published records not checked against a source in the last{' '}
              {stale.data.staleAfterDays} days.
            </p>
            {stale.data.items.length === 0 ? (
              <p className="font-semibold">Everything is up to date.</p>
            ) : (
              <ul className="divide-y divide-blue-100">
                {stale.data.items.map((item) => (
                  <li
                    key={`${item.entityType}-${item.entityId}`}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <span>
                      <span className="font-semibold">
                        {entityLink(item.entityType, item.ownerId, item.label)}
                      </span>
                      <span className="block text-sm">
                        {ENTITY_LABELS[item.entityType]} · {statusLabel(item.status)} ·{' '}
                        {item.lastVerifiedAt
                          ? `Last verified ${formatDate(item.lastVerifiedAt)}`
                          : 'Never verified'}
                      </span>
                    </span>
                    <Button variant="secondary" onClick={() => setChecking(item)}>
                      Record a check <span className="sr-only">for {item.label}</span>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Panel>

      <Panel title="Recent checks">
        <RecentChecks list={recent} onPage={filters.setPage} />
      </Panel>

      {checking && (
        <Modal title={`Record a check: ${checking.label}`} onClose={() => setChecking(null)}>
          <VerificationForm
            entityType={checking.entityType}
            entityId={checking.entityId}
            onDone={() => setChecking(null)}
          />
        </Modal>
      )}
    </AdminPage>
  );
}

function RecentChecks({
  list,
  onPage,
}: {
  list: ReturnType<typeof useAdminList<AdminVerificationRecord>>;
  onPage: (page: number) => void;
}) {
  if (list.isPending) return <Loading />;
  if (list.error) return <LoadError onRetry={() => void list.refetch()} />;
  const { items, page, pageSize, total } = list.data as Paginated<AdminVerificationRecord>;
  if (items.length === 0) return <p>No checks recorded yet.</p>;
  return (
    <>
      <ul className="divide-y divide-blue-100">
        {items.map((r) => (
          <li key={r.id} className="py-3">
            <p>
              <span className="font-semibold">{VERIFICATION_STATUS_LABELS[r.status]}</span>:{' '}
              {r.ownerId
                ? entityLink(r.entityType, r.ownerId, r.entityLabel ?? ENTITY_LABELS[r.entityType])
                : (r.entityLabel ?? `${ENTITY_LABELS[r.entityType]} (deleted)`)}
            </p>
            <p className="text-sm">
              {formatDate(r.verifiedAt)}
              {r.verifiedBy && ` by ${r.verifiedBy.name}`}
              {r.source && ` · ${r.source.title}`}
            </p>
          </li>
        ))}
      </ul>
      <Pagination page={page} pageSize={pageSize} total={total} onPage={onPage} />
    </>
  );
}
