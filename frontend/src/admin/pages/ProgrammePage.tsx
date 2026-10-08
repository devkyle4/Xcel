import {
  type AdminProgramme,
  type AdminProgrammeDetail,
  type AdminUniversity,
  type AdminUniversityDetail,
  cycleCreateSchema,
  DEGREE_TYPES,
  programmeCreateSchema,
  programmeUpdateSchema,
} from '@xcel/shared';
import { ExternalLink, Plus } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { LoadError, Loading } from '../../components/LoadState';
import { Button } from '../../components/ui/Button';
import { ApiRequestError } from '../../lib/api';
import { DEGREE_LABELS, formatDate } from '../../lib/format';
import { NotFoundPage } from '../../pages/NotFoundPage';
import { requestErrors, useAdminGet, useAdminList, useAdminMutation } from '../api';
import { AdminPage, Panel } from '../components/AdminPage';
import { ErrorSummary, SelectField, TextAreaField, TextField } from '../components/fields';
import { PublishStatusBadge } from '../components/PublishStatusBadge';
import { StatusActions } from '../components/StatusActions';
import { UnsavedChangesGuard } from '../components/UnsavedChangesGuard';
import { changedFields, orNull, SAVED, str, validate } from '../forms';

const BACK = { to: '/admin/programmes', label: 'Programmes' };

type Values = Record<
  | 'name'
  | 'slug'
  | 'field'
  | 'degreeType'
  | 'durationYears'
  | 'campus'
  | 'facultySchoolId'
  | 'description',
  string
>;

const toValues = (p?: AdminProgramme): Values => ({
  name: str(p?.name),
  slug: str(p?.slug),
  field: str(p?.field),
  degreeType: p?.degreeType ?? 'bachelor',
  durationYears: str(p?.durationYears),
  campus: str(p?.campus),
  facultySchoolId: str(p?.facultySchoolId),
  description: str(p?.description),
});

const toPayload = (v: Values) => ({
  name: v.name.trim(),
  ...(v.slug.trim() && { slug: v.slug.trim() }),
  field: orNull(v.field),
  degreeType: v.degreeType,
  durationYears: v.durationYears.trim() ? Number(v.durationYears) : null,
  campus: orNull(v.campus),
  facultySchoolId: orNull(v.facultySchoolId),
  description: orNull(v.description),
});

export function NewProgrammePage() {
  const [params, setParams] = useSearchParams();
  const universityId = params.get('universityId') ?? '';
  const navigate = useNavigate();
  const create = useAdminMutation<unknown, AdminProgramme>('POST', '/admin/programmes');

  return (
    <AdminPage title="Add programme" back={BACK}>
      {universityId ? (
        <ProgrammeForm
          universityId={universityId}
          submitLabel="Create programme"
          saving={create.isPending}
          onSubmit={(values, onError) => {
            const result = validate(programmeCreateSchema, { universityId, ...toPayload(values) });
            if (!result.data) return onError(result.errors);
            create.mutate(result.data, {
              onSuccess: (p) =>
                void navigate(`/admin/programmes/${p.id}`, { replace: true, state: SAVED }),
              onError: (error) => onError(requestErrors(error)),
            });
          }}
        />
      ) : (
        <UniversityChooser onChoose={(id) => setParams({ universityId: id })} />
      )}
    </AdminPage>
  );
}

/** A programme belongs to one university for good, so it is chosen first. */
function UniversityChooser({ onChoose }: { onChoose: (id: string) => void }) {
  const [q, setQ] = useState('');
  const list = useAdminList<AdminUniversity>('/admin/universities', {
    q: q.trim() || undefined,
    pageSize: 10,
  });
  return (
    <Panel title="Choose the university">
      <TextField label="Search universities" required value={q} onChange={setQ} />
      {list.data && (
        <ul className="divide-y divide-blue-100 rounded-md border border-blue-100">
          {list.data.items.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left hover:bg-blue-50"
                onClick={() => onChoose(u.id)}
              >
                {u.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function EditProgrammePage() {
  const { id = '' } = useParams();
  const programme = useAdminGet<AdminProgrammeDetail>(`/admin/programmes/${id}`);
  const update = useAdminMutation('PATCH', `/admin/programmes/${id}`);

  if (programme.error instanceof ApiRequestError && programme.error.status === 404) {
    return <NotFoundPage />;
  }
  if (programme.isPending || programme.error) {
    return (
      <AdminPage title="Programme" back={BACK}>
        {programme.error ? <LoadError onRetry={() => void programme.refetch()} /> : <Loading />}
      </AdminPage>
    );
  }
  const p = programme.data;

  return (
    <AdminPage
      title={p.name}
      back={BACK}
      actions={
        p.status === 'published' && (
          <a href={`/programmes/${p.id}`} target="_blank" rel="noopener noreferrer">
            View public page <ExternalLink aria-hidden="true" className="inline size-4" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        )
      }
    >
      <p>
        At <Link to={`/admin/universities/${p.university.id}`}>{p.university.name}</Link>
      </p>
      <Panel title="Publishing">
        <StatusActions status={p.status} path={`/admin/programmes/${p.id}`} name={p.name} />
        <p className="text-sm">
          A programme appears publicly only when it, its university and an admission cycle are all
          published.
        </p>
      </Panel>
      <Panel title="Details">
        <ProgrammeForm
          key={p.updatedAt}
          saved={p}
          universityId={p.universityId}
          submitLabel="Save changes"
          saving={update.isPending}
          onSubmit={(values, onError) => {
            const changes = changedFields(toPayload(toValues(p)), toPayload(values));
            if (Object.keys(changes).length === 0) return onError({ '': 'Nothing has changed.' });
            const result = validate(programmeUpdateSchema, changes);
            if (!result.data) return onError(result.errors);
            update.mutate(result.data, { onError: (error) => onError(requestErrors(error)) });
          }}
        />
      </Panel>
      <CyclesPanel programme={p} />
    </AdminPage>
  );
}

function ProgrammeForm({
  saved,
  universityId,
  submitLabel,
  saving,
  onSubmit,
}: {
  saved?: AdminProgramme;
  universityId: string;
  submitLabel: string;
  saving: boolean;
  onSubmit: (values: Values, onError: (errors: Record<string, string>) => void) => void;
}) {
  const university = useAdminGet<AdminUniversityDetail>(`/admin/universities/${universityId}`);
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
      {!saved && university.data && (
        <p>
          University: <span className="font-semibold">{university.data.name}</span>
        </p>
      )}
      <ErrorSummary errors={errors} />
      <div className="grid gap-4 md:grid-cols-2">
        <TextField
          label="Name"
          required
          hint="e.g. BSc. Computer Science"
          value={values.name}
          onChange={set('name')}
          error={errors.name}
          maxLength={200}
        />
        <SelectField
          label="Award"
          required
          value={values.degreeType}
          onChange={set('degreeType')}
          error={errors.degreeType}
          options={DEGREE_TYPES.map((d) => ({ value: d, label: DEGREE_LABELS[d] }))}
        />
        <TextField
          label="Field of study"
          hint="Used for browsing and filters, e.g. Engineering"
          value={values.field}
          onChange={set('field')}
          error={errors.field}
          maxLength={100}
        />
        <SelectField
          label="Faculty or school"
          placeholder="None"
          value={values.facultySchoolId}
          onChange={set('facultySchoolId')}
          error={errors.facultySchoolId}
          options={(university.data?.facultySchools ?? []).map((f) => ({
            value: f.id,
            label: f.name,
          }))}
        />
        <TextField
          label="Duration in years"
          type="number"
          inputMode="numeric"
          value={values.durationYears}
          onChange={set('durationYears')}
          error={errors.durationYears}
        />
        <TextField
          label="Campus"
          value={values.campus}
          onChange={set('campus')}
          error={errors.campus}
          maxLength={100}
        />
        <TextField
          label="Web address name (slug)"
          hint={
            saved ? 'Unique within the university.' : 'Leave blank to create one from the name.'
          }
          value={values.slug}
          onChange={set('slug')}
          error={errors.slug}
          maxLength={100}
        />
      </div>
      <TextAreaField
        label="Description"
        value={values.description}
        onChange={set('description')}
        error={errors.description}
        maxLength={5000}
      />
      <Button type="submit" disabled={saving}>
        {saving ? 'Saving…' : submitLabel}
      </Button>
    </form>
  );
}

/** The programme's admission cycles, newest first, and a form to start a new one. */
function CyclesPanel({ programme: p }: { programme: AdminProgrammeDetail }) {
  const navigate = useNavigate();
  const [year, setYear] = useState('');
  const [error, setError] = useState<string>();
  const create = useAdminMutation<unknown, { id: string }>(
    'POST',
    `/admin/programmes/${p.id}/cycles`,
  );

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const result = validate(cycleCreateSchema, { academicYear: year.trim() });
    if (!result.data) return setError(Object.values(result.errors)[0]);
    setError(undefined);
    create.mutate(result.data, {
      onSuccess: (cycle) => void navigate(`/admin/cycles/${cycle.id}`, { state: SAVED }),
      onError: (e) => setError(Object.values(requestErrors(e))[0]),
    });
  };

  return (
    <Panel title="Admission cycles">
      <p className="text-sm">
        Requirements belong to an admission cycle (an academic year). Published cycles never change;
        updates are made in a new version.
      </p>
      {p.admissionCycles.length === 0 ? (
        <p>No admission cycles yet.</p>
      ) : (
        <ul className="divide-y divide-blue-100">
          {p.admissionCycles.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                <Link to={`/admin/cycles/${c.id}`} className="font-semibold">
                  {c.academicYear}, version {c.version}
                </Link>
                {c.publishedAt && (
                  <span className="block text-sm">Published {formatDate(c.publishedAt)}</span>
                )}
              </span>
              <PublishStatusBadge status={c.status} />
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={submit} noValidate className="flex flex-wrap items-end gap-2">
        <div className="w-56">
          <TextField
            label="New cycle for academic year"
            required
            hint="e.g. 2027/2028"
            value={year}
            onChange={setYear}
            error={error}
          />
        </div>
        <Button type="submit" variant="secondary" disabled={create.isPending}>
          <Plus aria-hidden="true" className="size-5" /> Add cycle
        </Button>
      </form>
    </Panel>
  );
}
