import {
  type AdminReport,
  REPORT_STATUSES,
  REPORT_TRANSITIONS,
  REPORTABLE_ENTITY_TYPES,
  type ReportableEntityType,
  type ReportStatus,
  reportStatusChangeSchema,
} from '@xcel/shared';
import { type FormEvent, useState } from 'react';
import { Link } from 'react-router';
import { Pagination } from '../../components/browse/Pagination';
import { LoadError, Loading } from '../../components/LoadState';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { formatDate } from '../../lib/format';
import { useUrlFilters } from '../../lib/url-state';
import { requestErrors, useAdminList, useAdminMutation } from '../api';
import { AdminPage } from '../components/AdminPage';
import { ErrorSummary, inputClasses, SelectField, TextAreaField } from '../components/fields';
import { ReportStatusBadge } from '../components/StatusBadges';
import { orNull, str, validate } from '../forms';
import { REPORT_STATUS_LABELS } from '../labels';

const ENTITY_LABELS: Record<ReportableEntityType, string> = {
  university: 'University',
  programme: 'Programme',
  scholarship: 'Scholarship',
};
const ADMIN_PATHS: Record<ReportableEntityType, string> = {
  university: '/admin/universities',
  programme: '/admin/programmes',
  scholarship: '/admin/scholarships',
};

/** Reports of incorrect information sent by the public. They contain no contact details. */
export function ReportsPage() {
  const filters = useUrlFilters(['status', 'entityType'] as const);
  // Open reports first: the default view is the work still to do.
  const status = filters.values.status || 'open';
  const list = useAdminList<AdminReport>('/admin/reports', {
    status: status === 'all' ? undefined : status,
    entityType: filters.values.entityType || undefined,
    page: filters.page,
    pageSize: 20,
  });
  const [handling, setHandling] = useState<AdminReport | null>(null);

  return (
    <AdminPage title="Error reports">
      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-blue-100 bg-white p-4">
        <div>
          <label htmlFor="report-status" className="mb-1 block font-semibold">
            Status
          </label>
          <select
            id="report-status"
            value={status}
            onChange={(e) => filters.set('status', e.target.value)}
            className={inputClasses}
          >
            {REPORT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {REPORT_STATUS_LABELS[s]}
              </option>
            ))}
            <option value="all">All statuses</option>
          </select>
        </div>
        <div>
          <label htmlFor="report-type" className="mb-1 block font-semibold">
            About
          </label>
          <select
            id="report-type"
            value={filters.values.entityType}
            onChange={(e) => filters.set('entityType', e.target.value)}
            className={inputClasses}
          >
            <option value="">Anything</option>
            {REPORTABLE_ENTITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {ENTITY_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {list.isPending ? (
        <Loading />
      ) : list.error ? (
        <LoadError onRetry={() => void list.refetch()} />
      ) : list.data.items.length === 0 ? (
        <p>No reports here.</p>
      ) : (
        <>
          <p role="status">
            {list.data.total} {list.data.total === 1 ? 'report' : 'reports'}
          </p>
          <ul className="space-y-3">
            {list.data.items.map((r) => (
              <li key={r.id} className="space-y-2 rounded-lg border border-blue-100 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p>
                    <span className="text-sm font-semibold">{ENTITY_LABELS[r.entityType]}: </span>
                    {r.entityLabel ? (
                      <Link
                        to={`${ADMIN_PATHS[r.entityType]}/${r.entityId}`}
                        className="font-semibold"
                      >
                        {r.entityLabel}
                      </Link>
                    ) : (
                      'Record no longer exists'
                    )}
                    <span className="block text-sm">Reported {formatDate(r.createdAt)}</span>
                  </p>
                  <ReportStatusBadge status={r.status} />
                </div>
                <blockquote className="border-l-4 border-blue-300 pl-3 whitespace-pre-line">
                  {r.message}
                </blockquote>
                {r.adminNotes && (
                  <p className="text-sm">
                    <span className="font-semibold">Notes: </span>
                    {r.adminNotes}
                  </p>
                )}
                {r.resolvedBy && r.resolvedAt && (
                  <p className="text-sm">
                    {REPORT_STATUS_LABELS[r.status]} by {r.resolvedBy.name} on{' '}
                    {formatDate(r.resolvedAt)}
                  </p>
                )}
                <Button variant="secondary" onClick={() => setHandling(r)}>
                  Update status{' '}
                  <span className="sr-only">
                    of report about {r.entityLabel ?? 'a deleted record'}
                  </span>
                </Button>
              </li>
            ))}
          </ul>
          <Pagination
            page={list.data.page}
            pageSize={list.data.pageSize}
            total={list.data.total}
            onPage={filters.setPage}
          />
        </>
      )}

      {handling && (
        <Modal title="Update report" onClose={() => setHandling(null)}>
          <ReportForm report={handling} onDone={() => setHandling(null)} />
        </Modal>
      )}
    </AdminPage>
  );
}

function ReportForm({ report, onDone }: { report: AdminReport; onDone: () => void }) {
  const next = REPORT_TRANSITIONS[report.status];
  const [status, setStatus] = useState<ReportStatus>(next[0]!);
  const [notes, setNotes] = useState(str(report.adminNotes));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const change = useAdminMutation('POST', `/admin/reports/${report.id}/status`);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const result = validate(reportStatusChangeSchema, { status, adminNotes: orNull(notes) });
    setErrors(result.errors ?? {});
    if (result.data)
      change.mutate(result.data, {
        onSuccess: onDone,
        onError: (e) => setErrors(requestErrors(e)),
      });
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <ErrorSummary errors={errors} />
      <p>
        Currently: <ReportStatusBadge status={report.status} />
      </p>
      <SelectField
        label="New status"
        required
        value={status}
        onChange={(v) => setStatus(v as ReportStatus)}
        options={next.map((s) => ({ value: s, label: REPORT_STATUS_LABELS[s] }))}
      />
      <TextAreaField
        label="Notes"
        hint="What you checked or changed. Only admins see this."
        value={notes}
        onChange={setNotes}
        error={errors.adminNotes}
        rows={3}
        maxLength={2000}
      />
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={change.isPending}>
          Save
        </Button>
      </div>
    </form>
  );
}
