import {
  type AdminScholarship,
  type AdminScholarshipCycle,
  type AdminScholarshipDetail,
  type AdminUniversity,
  type AdminVerificationRecord,
  SCHOLARSHIP_TRANSITIONS,
  scholarshipCreateSchema,
  scholarshipCycleCreateSchema,
  scholarshipCycleUpdateSchema,
  scholarshipRequirementsInputSchema,
  type ScholarshipStatus,
  scholarshipUpdateSchema,
  STUDY_LEVELS,
  type StudyLevel,
} from '@xcel/shared';
import { ExternalLink, Plus, Trash2 } from 'lucide-react';
import { type FormEvent, useId, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { LoadError, Loading } from '../../components/LoadState';
import { Button } from '../../components/ui/Button';
import { ApiRequestError } from '../../lib/api';
import { formatDate, STUDY_LEVEL_LABELS } from '../../lib/format';
import { NotFoundPage } from '../../pages/NotFoundPage';
import { requestErrors, useAdminGet, useAdminList, useAdminMutation } from '../api';
import { AdminPage, Panel } from '../components/AdminPage';
import { ConfirmDialog } from '../components/ConfirmDialog';
import {
  ErrorSummary,
  FormError,
  SelectField,
  TextAreaField,
  TextField,
} from '../components/fields';
import { ScholarshipStatusBadge } from '../components/StatusBadges';
import { UnsavedChangesGuard } from '../components/UnsavedChangesGuard';
import { VerificationPanel } from '../components/VerificationPanel';
import { WorkflowActions } from '../components/WorkflowActions';
import { changedFields, listText, orNull, parseList, SAVED, str, validate } from '../forms';

const BACK = { to: '/admin/scholarships', label: 'Scholarships' };

// ---------- Details ----------

type Values = {
  name: string;
  slug: string;
  providerName: string;
  providerUrl: string;
  logoUrl: string;
  universityId: string;
  description: string;
  coverage: string;
  studyLevels: StudyLevel[];
  fields: string;
  eligibilityCategories: string;
  location: string;
};

const toValues = (s?: AdminScholarship): Values => ({
  name: str(s?.name),
  slug: str(s?.slug),
  providerName: str(s?.providerName),
  providerUrl: str(s?.providerUrl),
  logoUrl: str(s?.logoUrl),
  universityId: str(s?.universityId),
  description: str(s?.description),
  coverage: str(s?.coverage),
  studyLevels: s?.studyLevels ?? [],
  fields: listText(s?.fields),
  eligibilityCategories: listText(s?.eligibilityCategories),
  location: str(s?.location),
});

const toPayload = (v: Values) => ({
  name: v.name.trim(),
  ...(v.slug.trim() && { slug: v.slug.trim() }),
  providerName: v.providerName.trim(),
  providerUrl: orNull(v.providerUrl),
  logoUrl: orNull(v.logoUrl),
  universityId: orNull(v.universityId),
  description: orNull(v.description),
  coverage: orNull(v.coverage),
  studyLevels: v.studyLevels,
  fields: parseList(v.fields),
  eligibilityCategories: parseList(v.eligibilityCategories),
  location: orNull(v.location),
});

export function NewScholarshipPage() {
  const navigate = useNavigate();
  const create = useAdminMutation<unknown, AdminScholarship>('POST', '/admin/scholarships');
  return (
    <AdminPage title="Add scholarship" back={BACK}>
      <Panel title="Details">
        <ScholarshipForm
          submitLabel="Create scholarship"
          saving={create.isPending}
          onSubmit={(values, onError) => {
            const result = validate(scholarshipCreateSchema, toPayload(values));
            if (!result.data) return onError(result.errors);
            create.mutate(result.data, {
              onSuccess: (s) =>
                void navigate(`/admin/scholarships/${s.id}`, { replace: true, state: SAVED }),
              onError: (e) => onError(requestErrors(e)),
            });
          }}
        />
      </Panel>
    </AdminPage>
  );
}

const ACTION_LABELS: Record<string, string> = {
  'draft>published': 'Publish',
  'published>expired': 'Mark as expired',
  'published>draft': 'Return to draft',
  'expired>published': 'Republish',
  'archived>draft': 'Restore as draft',
};

export function EditScholarshipPage() {
  const { id = '' } = useParams();
  const scholarship = useAdminGet<AdminScholarshipDetail>(`/admin/scholarships/${id}`);
  const update = useAdminMutation('PATCH', `/admin/scholarships/${id}`);

  if (scholarship.error instanceof ApiRequestError && scholarship.error.status === 404) {
    return <NotFoundPage />;
  }
  if (scholarship.isPending || scholarship.error) {
    return (
      <AdminPage title="Scholarship" back={BACK}>
        {scholarship.error ? <LoadError onRetry={() => void scholarship.refetch()} /> : <Loading />}
      </AdminPage>
    );
  }
  const s = scholarship.data;

  return (
    <AdminPage
      title={s.name}
      back={BACK}
      actions={
        s.status === 'published' && (
          <a href={`/scholarships/${s.slug}`} target="_blank" rel="noopener noreferrer">
            View public page <ExternalLink aria-hidden="true" className="inline size-4" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        )
      }
    >
      <Panel title="Publishing">
        <WorkflowActions<ScholarshipStatus>
          status={s.status}
          badge={<ScholarshipStatusBadge status={s.status} />}
          transitions={SCHOLARSHIP_TRANSITIONS}
          actionLabel={(from, to) =>
            ACTION_LABELS[`${from}>${to}`] ?? (to === 'archived' ? 'Archive' : to)
          }
          confirm={{
            published: 'It will appear in scholarship search and on its public page.',
            archived: 'It will be hidden everywhere. You can restore it as a draft later.',
          }}
          primary="published"
          path={`/admin/scholarships/${s.id}`}
          name={s.name}
        />
        <p className="text-sm">
          To publish, the current cycle must have dates that have not passed, an application link
          (or provider website) and a verification against a source.
        </p>
      </Panel>
      <Panel title="Details">
        <ScholarshipForm
          key={s.updatedAt}
          saved={s}
          submitLabel="Save changes"
          saving={update.isPending}
          onSubmit={(values, onError) => {
            const changes = changedFields(toPayload(toValues(s)), toPayload(values));
            if (Object.keys(changes).length === 0) return onError({ '': 'Nothing has changed.' });
            const result = validate(scholarshipUpdateSchema, changes);
            if (!result.data) return onError(result.errors);
            update.mutate(result.data, { onError: (e) => onError(requestErrors(e)) });
          }}
        />
      </Panel>
      <CyclesPanel scholarship={s} />
    </AdminPage>
  );
}

function ScholarshipForm({
  saved,
  submitLabel,
  saving,
  onSubmit,
}: {
  saved?: AdminScholarship;
  submitLabel: string;
  saving: boolean;
  onSubmit: (values: Values, onError: (errors: Record<string, string>) => void) => void;
}) {
  const id = useId();
  const universities = useAdminList<AdminUniversity>('/admin/universities', { pageSize: 50 });
  const [values, setValues] = useState(() => toValues(saved));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const dirty = JSON.stringify(values) !== JSON.stringify(toValues(saved));
  const set = (key: Exclude<keyof Values, 'studyLevels'>) => (v: string) =>
    setValues({ ...values, [key]: v });
  const toggleLevel = (level: StudyLevel) =>
    setValues({
      ...values,
      studyLevels: values.studyLevels.includes(level)
        ? values.studyLevels.filter((l) => l !== level)
        : [...values.studyLevels, level],
    });

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
          label="Web address name (slug)"
          hint={
            saved
              ? 'Changing this breaks existing links to the public page.'
              : 'Leave blank to create one from the name.'
          }
          value={values.slug}
          onChange={set('slug')}
          error={errors.slug}
        />
        <TextField
          label="Provider"
          required
          value={values.providerName}
          onChange={set('providerName')}
          error={errors.providerName}
          maxLength={200}
        />
        <TextField
          label="Provider website"
          type="url"
          value={values.providerUrl}
          onChange={set('providerUrl')}
          error={errors.providerUrl}
        />
        <TextField
          label="Logo"
          hint="An https link, or a file in the site's logos folder, e.g. /logos/mastercard.png"
          value={values.logoUrl}
          onChange={set('logoUrl')}
          error={errors.logoUrl}
        />
        <SelectField
          label="University"
          hint="Only if the scholarship is tied to one university."
          placeholder="Not tied to a university"
          value={values.universityId}
          onChange={set('universityId')}
          error={errors.universityId}
          options={(universities.data?.items ?? []).map((u) => ({ value: u.id, label: u.name }))}
        />
        <TextField
          label="Location"
          hint="e.g. Ghana, or Abroad"
          value={values.location}
          onChange={set('location')}
          error={errors.location}
          maxLength={100}
        />
        <TextField
          label="Fields of study"
          hint="Separate with commas, e.g. Engineering, Health"
          value={values.fields}
          onChange={set('fields')}
          error={errors.fields}
        />
      </div>
      <fieldset>
        <legend className="mb-1 font-semibold">
          Study levels <span className="font-normal">(optional)</span>
        </legend>
        <div className="flex flex-wrap gap-x-5 gap-y-1">
          {STUDY_LEVELS.map((level) => (
            <label key={level} className="flex items-center gap-2">
              <input
                type="checkbox"
                name={`${id}-levels`}
                checked={values.studyLevels.includes(level)}
                onChange={() => toggleLevel(level)}
                className="size-4 accent-blue-700"
              />
              {STUDY_LEVEL_LABELS[level]}
            </label>
          ))}
        </div>
      </fieldset>
      <TextField
        label="Who can apply"
        hint="Separate with commas, e.g. Female students, Needy students"
        value={values.eligibilityCategories}
        onChange={set('eligibilityCategories')}
        error={errors.eligibilityCategories}
      />
      <TextAreaField
        label="Description"
        value={values.description}
        onChange={set('description')}
        error={errors.description}
        maxLength={5000}
      />
      <TextAreaField
        label="What it covers"
        hint="e.g. Full tuition, accommodation and a monthly stipend"
        value={values.coverage}
        onChange={set('coverage')}
        error={errors.coverage}
        rows={3}
        maxLength={1000}
      />
      <Button type="submit" disabled={saving}>
        {saving ? 'Saving…' : submitLabel}
      </Button>
    </form>
  );
}

// ---------- Cycles ----------

function CyclesPanel({ scholarship: s }: { scholarship: AdminScholarshipDetail }) {
  const [year, setYear] = useState('');
  const [error, setError] = useState<string>();
  const create = useAdminMutation('POST', `/admin/scholarships/${s.id}/cycles`);

  const add = (event: FormEvent) => {
    event.preventDefault();
    const result = validate(scholarshipCycleCreateSchema, { academicYear: year.trim() });
    if (!result.data) return setError(Object.values(result.errors)[0]);
    setError(undefined);
    create.mutate(result.data, {
      onSuccess: () => setYear(''),
      onError: (e) => setError(Object.values(requestErrors(e))[0]),
    });
  };

  return (
    <Panel title="Application cycles">
      <p className="text-sm">
        One cycle per academic year, newest first. The newest cycle decides whether the scholarship
        shows as open: it never shows as open after its closing date.
      </p>
      {s.cycles.length === 0 && (
        <p>No cycles yet. Add one to set dates and the application link.</p>
      )}
      <ol className="space-y-4">
        {s.cycles.map((cycle, index) => (
          <li key={cycle.id}>
            <CycleEditor cycle={cycle} current={index === 0} canDelete={s.status === 'draft'} />
          </li>
        ))}
      </ol>
      <form onSubmit={add} noValidate className="flex flex-wrap items-end gap-2">
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

type CycleValues = Record<'academicYear' | 'opensOn' | 'closesOn' | 'applicationUrl', string>;
const cycleValues = (c: AdminScholarshipCycle): CycleValues => ({
  academicYear: c.academicYear,
  opensOn: str(c.opensOn),
  closesOn: str(c.closesOn),
  applicationUrl: str(c.applicationUrl),
});
const cyclePayload = (v: CycleValues) => ({
  academicYear: v.academicYear.trim(),
  opensOn: orNull(v.opensOn),
  closesOn: orNull(v.closesOn),
  applicationUrl: orNull(v.applicationUrl),
});

function CycleEditor({
  cycle,
  current,
  canDelete,
}: {
  cycle: AdminScholarshipCycle;
  current: boolean;
  canDelete: boolean;
}) {
  const update = useAdminMutation('PATCH', `/admin/scholarship-cycles/${cycle.id}`);
  const saveRequirements = useAdminMutation(
    'PUT',
    `/admin/scholarship-cycles/${cycle.id}/requirements`,
  );
  const remove = useAdminMutation('DELETE', `/admin/scholarship-cycles/${cycle.id}`);
  const verifications = useAdminList<AdminVerificationRecord>('/admin/verification', {
    entityType: 'scholarship_cycle',
    entityId: cycle.id,
    pageSize: 10,
  });
  const [values, setValues] = useState(() => cycleValues(cycle));
  const [requirements, setRequirements] = useState(cycle.requirements.join('\n'));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleting, setDeleting] = useState(false);
  const dirty =
    JSON.stringify(values) !== JSON.stringify(cycleValues(cycle)) ||
    requirements.trim() !== cycle.requirements.join('\n');
  const set = (key: keyof CycleValues) => (v: string) => setValues({ ...values, [key]: v });

  const save = (event: FormEvent) => {
    event.preventDefault();
    setErrors({});
    const changes = changedFields(cyclePayload(cycleValues(cycle)), cyclePayload(values));
    const lines = requirements
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const requirementsChanged = lines.join('\n') !== cycle.requirements.join('\n');
    if (Object.keys(changes).length === 0 && !requirementsChanged) {
      return setErrors({ '': 'Nothing has changed.' });
    }
    const dates = Object.keys(changes).length
      ? validate(scholarshipCycleUpdateSchema, changes)
      : null;
    const reqs = validate(scholarshipRequirementsInputSchema, {
      requirements: lines.map((description) => ({ description })),
    });
    if (dates?.errors || reqs.errors) {
      return setErrors({
        ...dates?.errors,
        ...(reqs.errors && {
          requirements: 'Each requirement needs 2 to 1,000 characters (up to 50).',
        }),
      });
    }
    if (dates?.data) update.mutate(dates.data, { onError: (e) => setErrors(requestErrors(e)) });
    if (requirementsChanged) {
      saveRequirements.mutate(reqs.data, { onError: (e) => setErrors(requestErrors(e)) });
    }
  };

  return (
    <article className="space-y-4 rounded-lg border border-blue-100 bg-off-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">
          {cycle.academicYear}
          {current && <span className="ml-2 text-sm font-normal">(current cycle)</span>}
        </h3>
        <span className="text-sm">
          {cycle.lastVerifiedAt ? `Verified ${formatDate(cycle.lastVerifiedAt)}` : 'Not verified'}
        </span>
      </div>
      <form onSubmit={save} noValidate className="space-y-4">
        <UnsavedChangesGuard when={dirty && !update.isPending && !saveRequirements.isPending} />
        <ErrorSummary errors={errors} />
        <div className="grid gap-4 md:grid-cols-3">
          <TextField
            label="Academic year"
            required
            value={values.academicYear}
            onChange={set('academicYear')}
            error={errors.academicYear}
          />
          <TextField
            label="Opens"
            type="date"
            value={values.opensOn}
            onChange={set('opensOn')}
            error={errors.opensOn}
          />
          <TextField
            label="Closes"
            type="date"
            value={values.closesOn}
            onChange={set('closesOn')}
            error={errors.closesOn}
          />
        </div>
        <TextField
          label="Application page"
          type="url"
          value={values.applicationUrl}
          onChange={set('applicationUrl')}
          error={errors.applicationUrl}
        />
        <TextAreaField
          label="Eligibility requirements"
          hint="One per line, as published by the provider."
          value={requirements}
          onChange={setRequirements}
          error={errors.requirements}
          rows={4}
        />
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={update.isPending || saveRequirements.isPending}>
            Save {cycle.academicYear} cycle
          </Button>
          {canDelete && (
            <Button variant="secondary" onClick={() => setDeleting(true)}>
              <Trash2 aria-hidden="true" className="size-5" /> Delete cycle
            </Button>
          )}
        </div>
      </form>
      <VerificationPanel
        entityType="scholarship_cycle"
        entityId={cycle.id}
        records={verifications.data?.items ?? []}
        level={4}
      />
      {deleting && (
        <ConfirmDialog
          title={`Delete the ${cycle.academicYear} cycle?`}
          confirmLabel="Delete cycle"
          busy={remove.isPending}
          onConfirm={() => remove.mutate(undefined, { onSuccess: () => setDeleting(false) })}
          onCancel={() => {
            setDeleting(false);
            remove.reset();
          }}
        >
          <p>This cannot be undone. Cycles can only be deleted while the scholarship is a draft.</p>
          <FormError message={requestErrors(remove.error)['']} />
        </ConfirmDialog>
      )}
    </article>
  );
}
