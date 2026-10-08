import { type AdminSource, sourceCreateSchema, sourceUpdateSchema } from '@xcel/shared';
import { ExternalLink, Plus } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Pagination } from '../../components/browse/Pagination';
import { LoadError, Loading } from '../../components/LoadState';
import { Button, ButtonLink } from '../../components/ui/Button';
import { ApiRequestError } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { useUrlFilters } from '../../lib/url-state';
import { NotFoundPage } from '../../pages/NotFoundPage';
import { requestErrors, useAdminGet, useAdminList, useAdminMutation } from '../api';
import { AdminPage, Panel } from '../components/AdminPage';
import { ErrorSummary, TextAreaField, TextField } from '../components/fields';
import { ListControls } from '../components/ListControls';
import { UnsavedChangesGuard } from '../components/UnsavedChangesGuard';
import { changedFields, orNull, SAVED, str, validate } from '../forms';

const BACK = { to: '/admin/sources', label: 'Sources' };
const PAGE_SIZE = 20;

/** Official documents and pages that records are verified against. Kept for the record; never deleted. */
export function SourcesPage() {
  const filters = useUrlFilters(['q'] as const);
  const list = useAdminList<AdminSource>('/admin/sources', {
    q: filters.values.q || undefined,
    page: filters.page,
    pageSize: PAGE_SIZE,
  });

  return (
    <AdminPage
      title="Sources"
      actions={
        <ButtonLink to="/admin/sources/new">
          <Plus aria-hidden="true" className="size-5" /> Add source
        </ButtonLink>
      }
    >
      <ListControls
        label="Search by title, publisher or link"
        q={filters.values.q}
        onSearch={(q) => filters.set('q', q)}
      />
      {list.isPending ? (
        <Loading />
      ) : list.error ? (
        <LoadError onRetry={() => void list.refetch()} />
      ) : list.data.items.length === 0 ? (
        <p>No sources match.</p>
      ) : (
        <>
          <p role="status">
            {list.data.total} {list.data.total === 1 ? 'source' : 'sources'}
          </p>
          <ul className="divide-y divide-blue-100 rounded-lg border border-blue-100 bg-white">
            {list.data.items.map((s) => (
              <li key={s.id} className="space-y-0.5 px-4 py-3">
                <Link to={`/admin/sources/${s.id}`} className="font-semibold">
                  {s.title}
                </Link>
                <p className="text-sm">
                  {[
                    s.publisher,
                    s.academicYear,
                    s.retrievedOn && `Retrieved ${formatDate(s.retrievedOn)}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {s.url && <p className="truncate text-sm">{s.url}</p>}
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
    </AdminPage>
  );
}

type Values = Record<
  'title' | 'url' | 'publisher' | 'academicYear' | 'retrievedOn' | 'notes',
  string
>;

const toValues = (s?: AdminSource): Values => ({
  title: str(s?.title),
  url: str(s?.url),
  publisher: str(s?.publisher),
  academicYear: str(s?.academicYear),
  retrievedOn: str(s?.retrievedOn),
  notes: str(s?.notes),
});

const toPayload = (v: Values) => ({
  title: v.title.trim(),
  url: orNull(v.url),
  publisher: orNull(v.publisher),
  academicYear: orNull(v.academicYear),
  retrievedOn: orNull(v.retrievedOn),
  notes: orNull(v.notes),
});

export function NewSourcePage() {
  const navigate = useNavigate();
  const create = useAdminMutation<unknown, AdminSource>('POST', '/admin/sources');
  return (
    <AdminPage title="Add source" back={BACK}>
      <Panel title="Source details">
        <SourceForm
          submitLabel="Add source"
          saving={create.isPending}
          onSubmit={(values, onError) => {
            const result = validate(sourceCreateSchema, toPayload(values));
            if (!result.data) return onError(result.errors);
            create.mutate(result.data, {
              onSuccess: (s) =>
                void navigate(`/admin/sources/${s.id}`, { replace: true, state: SAVED }),
              onError: (error) => onError(requestErrors(error)),
            });
          }}
        />
      </Panel>
    </AdminPage>
  );
}

export function EditSourcePage() {
  const { id = '' } = useParams();
  const source = useAdminGet<AdminSource>(`/admin/sources/${id}`);
  const update = useAdminMutation('PATCH', `/admin/sources/${id}`);

  if (source.error instanceof ApiRequestError && source.error.status === 404)
    return <NotFoundPage />;
  if (source.isPending || source.error) {
    return (
      <AdminPage title="Source" back={BACK}>
        {source.error ? <LoadError onRetry={() => void source.refetch()} /> : <Loading />}
      </AdminPage>
    );
  }
  const s = source.data;
  return (
    <AdminPage
      title={s.title}
      back={BACK}
      actions={
        s.url && (
          <a href={s.url} target="_blank" rel="noopener noreferrer">
            Open source <ExternalLink aria-hidden="true" className="inline size-4" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        )
      }
    >
      <Panel title="Source details">
        <SourceForm
          key={s.updatedAt}
          saved={s}
          submitLabel="Save changes"
          saving={update.isPending}
          onSubmit={(values, onError) => {
            const changes = changedFields(toPayload(toValues(s)), toPayload(values));
            if (Object.keys(changes).length === 0) return onError({ '': 'Nothing has changed.' });
            const result = validate(sourceUpdateSchema, changes);
            if (!result.data) return onError(result.errors);
            update.mutate(result.data, { onError: (error) => onError(requestErrors(error)) });
          }}
        />
      </Panel>
    </AdminPage>
  );
}

function SourceForm({
  saved,
  submitLabel,
  saving,
  onSubmit,
}: {
  saved?: AdminSource;
  submitLabel: string;
  saving: boolean;
  onSubmit: (values: Values, onError: (errors: Record<string, string>) => void) => void;
}) {
  const [values, setValues] = useState(() => toValues(saved));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const dirty = JSON.stringify(values) !== JSON.stringify(toValues(saved));
  const set = (key: keyof Values) => (value: string) => setValues({ ...values, [key]: value });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setErrors({});
    onSubmit(values, setErrors);
  };
  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <UnsavedChangesGuard when={dirty && !saving} />
      <ErrorSummary errors={errors} />
      <TextField
        label="Title"
        required
        value={values.title}
        onChange={set('title')}
        error={errors.title}
        maxLength={300}
      />
      <TextField
        label="Link"
        type="url"
        hint="The official page or document, starting https://"
        value={values.url}
        onChange={set('url')}
        error={errors.url}
      />
      <div className="grid gap-4 md:grid-cols-3">
        <TextField
          label="Publisher"
          value={values.publisher}
          onChange={set('publisher')}
          error={errors.publisher}
          maxLength={200}
        />
        <TextField
          label="Academic year"
          hint="e.g. 2026/2027"
          value={values.academicYear}
          onChange={set('academicYear')}
          error={errors.academicYear}
        />
        <TextField
          label="Retrieved on"
          type="date"
          value={values.retrievedOn}
          onChange={set('retrievedOn')}
          error={errors.retrievedOn}
        />
      </div>
      <TextAreaField
        label="Notes"
        value={values.notes}
        onChange={set('notes')}
        error={errors.notes}
        rows={3}
        maxLength={2000}
      />
      <Button type="submit" disabled={saving}>
        {saving ? 'Saving…' : submitLabel}
      </Button>
    </form>
  );
}
