import type { AuditLogEntry } from '@xcel/shared';
import { Pagination } from '../../components/browse/Pagination';
import { LoadError, Loading } from '../../components/LoadState';
import { useUrlFilters } from '../../lib/url-state';
import { useAdminList } from '../api';
import { AdminPage } from '../components/AdminPage';
import { inputClasses } from '../components/fields';

const ENTITY_TYPES: Record<string, string> = {
  university: 'Universities',
  faculty_school: 'Faculties and schools',
  programme: 'Programmes',
  admission_cycle: 'Admission cycles',
  scholarship: 'Scholarships',
  scholarship_cycle: 'Scholarship cycles',
  source: 'Sources',
  programme_admission_cycle: 'Admission cycle checks',
  subject: 'Subjects',
  grade: 'Grades',
  mentor: 'Mentors',
  report: 'Error reports',
  settings: 'Settings',
  user: 'Sign-ins',
};

const time = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

/** Every admin change, newest first. The log is append-only: entries cannot be edited or removed. */
export function AuditLogPage() {
  const filters = useUrlFilters(['entityType', 'entityId'] as const);
  const list = useAdminList<AuditLogEntry>('/admin/audit-logs', {
    entityType: filters.values.entityType || undefined,
    entityId: filters.values.entityId || undefined,
    page: filters.page,
    pageSize: 25,
  });

  return (
    <AdminPage title="Audit log">
      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-blue-100 bg-white p-4">
        <div>
          <label htmlFor="audit-type" className="mb-1 block font-semibold">
            Record type
          </label>
          <select
            id="audit-type"
            value={filters.values.entityType}
            onChange={(e) => filters.set('entityType', e.target.value)}
            className={inputClasses}
          >
            <option value="">All changes</option>
            {Object.entries(ENTITY_TYPES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        {filters.values.entityId && (
          <p>
            One record only.{' '}
            <button
              type="button"
              className="font-semibold text-blue-700 underline underline-offset-4"
              onClick={() => filters.set('entityId', '')}
            >
              Show all records
            </button>
          </p>
        )}
      </div>
      {list.isPending ? (
        <Loading />
      ) : list.error ? (
        <LoadError onRetry={() => void list.refetch()} />
      ) : list.data.items.length === 0 ? (
        <p>No changes recorded.</p>
      ) : (
        <>
          <ol className="divide-y divide-blue-100 rounded-lg border border-blue-100 bg-white">
            {list.data.items.map((entry) => (
              <li key={entry.id} className="space-y-1 px-4 py-3">
                <p className="flex flex-wrap justify-between gap-2">
                  <span>
                    <span className="font-mono text-sm font-semibold">{entry.action}</span>
                    {entry.entityId && (
                      <button
                        type="button"
                        className="ml-2 text-sm text-blue-700 underline underline-offset-4"
                        onClick={() => filters.set('entityId', entry.entityId!)}
                      >
                        History of this record
                      </button>
                    )}
                  </span>
                  <span className="text-sm">
                    {time(entry.occurredAt)} · {entry.actor?.name ?? 'System'}
                  </span>
                </p>
                {(entry.before != null || entry.after != null) && (
                  <details>
                    <summary className="cursor-pointer text-sm font-semibold text-blue-700">
                      Show before and after
                    </summary>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      {(['before', 'after'] as const).map((side) => (
                        <div key={side}>
                          <p className="text-sm font-semibold capitalize">{side}</p>
                          <pre className="max-h-72 overflow-auto rounded-md bg-off-white p-2 text-xs">
                            {entry[side] == null ? '—' : JSON.stringify(entry[side], null, 2)}
                          </pre>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </li>
            ))}
          </ol>
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
