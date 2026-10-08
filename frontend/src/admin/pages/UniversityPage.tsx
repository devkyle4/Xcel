import {
  type AdminFacultySchool,
  type AdminUniversity,
  type AdminUniversityDetail,
  facultySchoolInputSchema,
  GHANA_REGIONS,
  INSTITUTION_TYPES,
  universityCreateSchema,
  universityUpdateSchema,
} from '@xcel/shared';
import { ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { LoadError, Loading } from '../../components/LoadState';
import { Button, ButtonLink } from '../../components/ui/Button';
import { INSTITUTION_LABELS, REGION_LABELS } from '../../lib/format';
import { NotFoundPage } from '../../pages/NotFoundPage';
import { ApiRequestError } from '../../lib/api';
import { requestErrors, useAdminGet, useAdminMutation } from '../api';
import { AdminPage, Panel } from '../components/AdminPage';
import { ConfirmDialog } from '../components/ConfirmDialog';
import {
  ErrorSummary,
  FormError,
  inputClasses,
  SelectField,
  TextAreaField,
  TextField,
} from '../components/fields';
import { StatusActions } from '../components/StatusActions';
import { UnsavedChangesGuard } from '../components/UnsavedChangesGuard';
import { VerificationPanel } from '../components/VerificationPanel';
import { changedFields, orNull, SAVED, str, validate } from '../forms';

const BACK = { to: '/admin/universities', label: 'Universities' };

type Values = Record<
  | 'name'
  | 'shortName'
  | 'slug'
  | 'institutionType'
  | 'region'
  | 'town'
  | 'websiteUrl'
  | 'admissionsUrl'
  | 'logoUrl'
  | 'description',
  string
>;

const toValues = (u?: AdminUniversity): Values => ({
  name: str(u?.name),
  shortName: str(u?.shortName),
  slug: str(u?.slug),
  institutionType: u?.institutionType ?? 'public_university',
  region: str(u?.region),
  town: str(u?.town),
  websiteUrl: str(u?.websiteUrl),
  admissionsUrl: str(u?.admissionsUrl),
  logoUrl: str(u?.logoUrl),
  description: str(u?.description),
});

const toPayload = (v: Values) => ({
  name: v.name.trim(),
  shortName: orNull(v.shortName),
  ...(v.slug.trim() && { slug: v.slug.trim() }),
  institutionType: v.institutionType,
  region: orNull(v.region),
  town: orNull(v.town),
  websiteUrl: orNull(v.websiteUrl),
  admissionsUrl: orNull(v.admissionsUrl),
  logoUrl: orNull(v.logoUrl),
  description: orNull(v.description),
});

export function NewUniversityPage() {
  const navigate = useNavigate();
  const create = useAdminMutation<unknown, AdminUniversity>('POST', '/admin/universities');
  return (
    <AdminPage title="Add university" back={BACK}>
      <UniversityForm
        submitLabel="Create university"
        saving={create.isPending}
        onSubmit={(values, onError) => {
          const result = validate(universityCreateSchema, toPayload(values));
          if (!result.data) return onError(result.errors);
          create.mutate(result.data, {
            onSuccess: (u) =>
              void navigate(`/admin/universities/${u.id}`, { replace: true, state: SAVED }),
            onError: (error) => onError(requestErrors(error)),
          });
        }}
      />
    </AdminPage>
  );
}

export function EditUniversityPage() {
  const { id = '' } = useParams();
  const university = useAdminGet<AdminUniversityDetail>(`/admin/universities/${id}`);
  const update = useAdminMutation('PATCH', `/admin/universities/${id}`);

  if (university.error instanceof ApiRequestError && university.error.status === 404) {
    return <NotFoundPage />;
  }
  if (university.isPending || university.error) {
    return (
      <AdminPage title="University" back={BACK}>
        {university.error ? <LoadError onRetry={() => void university.refetch()} /> : <Loading />}
      </AdminPage>
    );
  }
  const u = university.data;

  return (
    <AdminPage
      title={u.name}
      back={BACK}
      actions={
        u.status === 'published' && (
          <a href={`/universities/${u.slug}`} target="_blank" rel="noopener noreferrer">
            View public page <ExternalLink aria-hidden="true" className="inline size-4" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        )
      }
    >
      <Panel title="Publishing">
        <StatusActions status={u.status} path={`/admin/universities/${u.id}`} name={u.name} />
      </Panel>
      <Panel title="Details">
        <UniversityForm
          // Re-mount with fresh values after each save.
          key={u.updatedAt}
          saved={u}
          submitLabel="Save changes"
          saving={update.isPending}
          onSubmit={(values, onError) => {
            const changes = changedFields(toPayload(toValues(u)), toPayload(values));
            if (Object.keys(changes).length === 0) return onError({ '': 'Nothing has changed.' });
            const result = validate(universityUpdateSchema, changes);
            if (!result.data) return onError(result.errors);
            update.mutate(result.data, { onError: (error) => onError(requestErrors(error)) });
          }}
        />
      </Panel>
      <FacultiesPanel universityId={u.id} faculties={u.facultySchools} />
      <Panel
        title="Programmes"
        actions={
          <ButtonLink variant="secondary" to={`/admin/programmes/new?universityId=${u.id}`}>
            <Plus aria-hidden="true" className="size-5" /> Add programme
          </ButtonLink>
        }
      >
        <Link to={`/admin/programmes?universityId=${u.id}`}>
          See all programmes at {u.shortName ?? u.name}
        </Link>
      </Panel>
      <VerificationPanel entityType="university" entityId={u.id} records={u.verifications} />
    </AdminPage>
  );
}

function UniversityForm({
  saved,
  submitLabel,
  saving,
  onSubmit,
}: {
  saved?: AdminUniversity;
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
      <div className="grid gap-4 md:grid-cols-2">
        <TextField
          label="Name"
          required
          value={values.name}
          onChange={set('name')}
          error={errors.name}
          maxLength={200}
        />
        <TextField
          label="Short name"
          hint="e.g. KNUST"
          value={values.shortName}
          onChange={set('shortName')}
          error={errors.shortName}
          maxLength={50}
        />
        <SelectField
          label="Institution type"
          required
          value={values.institutionType}
          onChange={set('institutionType')}
          error={errors.institutionType}
          options={INSTITUTION_TYPES.map((t) => ({ value: t, label: INSTITUTION_LABELS[t] }))}
        />
        <TextField
          label="Web address name (slug)"
          hint={
            saved
              ? 'Changing this breaks existing links to the public page.'
              : 'Leave blank to create one from the name.'
          }
          value={values.slug}
          onChange={set('slug')}
          error={errors.slug}
          maxLength={100}
        />
        <SelectField
          label="Region"
          placeholder="Not set"
          value={values.region}
          onChange={set('region')}
          error={errors.region}
          options={GHANA_REGIONS.map((r) => ({ value: r, label: REGION_LABELS[r] }))}
        />
        <TextField
          label="Town"
          value={values.town}
          onChange={set('town')}
          error={errors.town}
          maxLength={100}
        />
        <TextField
          label="Website"
          type="url"
          value={values.websiteUrl}
          onChange={set('websiteUrl')}
          error={errors.websiteUrl}
        />
        <TextField
          label="Admissions page"
          type="url"
          value={values.admissionsUrl}
          onChange={set('admissionsUrl')}
          error={errors.admissionsUrl}
        />
        <TextField
          label="Logo"
          type="url"
          hint="Link to an image, starting https://"
          value={values.logoUrl}
          onChange={set('logoUrl')}
          error={errors.logoUrl}
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

function FacultiesPanel({
  universityId,
  faculties,
}: {
  universityId: string;
  faculties: AdminFacultySchool[];
}) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string>();
  const add = useAdminMutation('POST', `/admin/universities/${universityId}/faculty-schools`);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const result = validate(facultySchoolInputSchema, { name });
    if (!result.data) return setError(result.errors.name ?? result.errors['']);
    setError(undefined);
    add.mutate(result.data, {
      onSuccess: () => setName(''),
      onError: (e) => setError(Object.values(requestErrors(e))[0]),
    });
  };

  return (
    <Panel title="Faculties and schools">
      {faculties.length === 0 ? (
        <p>None added yet.</p>
      ) : (
        <ul className="divide-y divide-blue-100">
          {faculties.map((f) => (
            <FacultyRow key={f.id} faculty={f} />
          ))}
        </ul>
      )}
      <form onSubmit={submit} noValidate className="flex flex-wrap items-end gap-2">
        <div className="min-w-60 flex-1">
          <TextField
            label="New faculty or school"
            required
            value={name}
            onChange={setName}
            error={error}
            maxLength={200}
          />
        </div>
        <Button type="submit" variant="secondary" disabled={add.isPending}>
          <Plus aria-hidden="true" className="size-5" /> Add
        </Button>
      </form>
    </Panel>
  );
}

function FacultyRow({ faculty }: { faculty: AdminFacultySchool }) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [name, setName] = useState(faculty.name);
  const rename = useAdminMutation('PATCH', `/admin/faculty-schools/${faculty.id}`);
  const remove = useAdminMutation('DELETE', `/admin/faculty-schools/${faculty.id}`);

  if (editing) {
    return (
      <li className="py-2">
        <form
          noValidate
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            rename.mutate({ name: name.trim() }, { onSuccess: () => setEditing(false) });
          }}
        >
          <label htmlFor={`faculty-${faculty.id}`} className="sr-only">
            Name of {faculty.name}
          </label>
          <input
            id={`faculty-${faculty.id}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={200}
            className={`${inputClasses} min-w-60 flex-1`}
          />
          <Button type="submit" disabled={rename.isPending}>
            Save
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setEditing(false);
              setName(faculty.name);
              rename.reset();
            }}
          >
            Cancel
          </Button>
        </form>
        <FormError message={Object.values(requestErrors(rename.error))[0]} />
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2">
      <span>{faculty.name}</span>
      <span className="flex gap-2">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-md p-1.5 text-blue-700 hover:bg-blue-50"
        >
          <Pencil aria-hidden="true" className="size-5" />
          <span className="sr-only">Rename {faculty.name}</span>
        </button>
        <button
          type="button"
          onClick={() => setDeleting(true)}
          className="rounded-md p-1.5 text-blue-700 hover:bg-blue-50"
        >
          <Trash2 aria-hidden="true" className="size-5" />
          <span className="sr-only">Delete {faculty.name}</span>
        </button>
      </span>
      {deleting && (
        <ConfirmDialog
          title={`Delete ${faculty.name}?`}
          confirmLabel="Delete"
          busy={remove.isPending}
          onConfirm={() => remove.mutate(undefined, { onSuccess: () => setDeleting(false) })}
          onCancel={() => {
            setDeleting(false);
            remove.reset();
          }}
        >
          <p>This cannot be undone. Faculties with programmes cannot be deleted.</p>
          <FormError message={Object.values(requestErrors(remove.error))[0]} />
        </ConfirmDialog>
      )}
    </li>
  );
}
