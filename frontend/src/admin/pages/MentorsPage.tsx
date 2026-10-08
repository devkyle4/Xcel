import {
  type AdminMentor,
  MENTOR_STATUSES,
  type MentorStatus,
  MENTORING_TOPICS,
  mentorCreateSchema,
  mentorExpertiseSchema,
  type MentoringTopicCode,
  mentorUpdateSchema,
} from '@xcel/shared';
import { Mail, Plus } from 'lucide-react';
import { type FormEvent, useId, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { LoadError, Loading } from '../../components/LoadState';
import { Button, ButtonLink } from '../../components/ui/Button';
import { NotFoundPage } from '../../pages/NotFoundPage';
import { requestErrors, useAdminGet, useAdminMutation } from '../api';
import { AdminPage, Panel } from '../components/AdminPage';
import {
  ErrorSummary,
  FormError,
  inputClasses,
  TextAreaField,
  TextField,
} from '../components/fields';
import { MentorStatusBadge } from '../components/StatusBadges';
import { UnsavedChangesGuard } from '../components/UnsavedChangesGuard';
import { WorkflowActions } from '../components/WorkflowActions';
import { changedFields, listText, orNull, parseList, SAVED, str, validate } from '../forms';
import { MENTOR_STATUS_LABELS } from '../labels';
import { ApiRequestError } from '../../lib/api';

const BACK = { to: '/admin/mentors', label: 'Mentors' };

/** Mentors the administrator added directly (no verification step). */
export function MentorsPage() {
  const mentors = useAdminGet<AdminMentor[]>('/admin/mentors');
  const [status, setStatus] = useState<MentorStatus | ''>('');
  const [q, setQ] = useState('');
  const shown = (mentors.data ?? []).filter(
    (m) =>
      (!status || m.status === status) &&
      (!q.trim() ||
        `${m.fullName} ${m.headline ?? ''}`.toLowerCase().includes(q.trim().toLowerCase())),
  );

  return (
    <AdminPage
      title="Mentors"
      actions={
        <ButtonLink to="/admin/mentors/new">
          <Plus aria-hidden="true" className="size-5" /> Add mentor
        </ButtonLink>
      }
    >
      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-blue-100 bg-white p-4">
        <div className="min-w-60 flex-1">
          <label htmlFor="mentor-search" className="mb-1 block font-semibold">
            Search mentors
          </label>
          <input
            id="mentor-search"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className={inputClasses}
          />
        </div>
        <div>
          <label htmlFor="mentor-status" className="mb-1 block font-semibold">
            Status
          </label>
          <select
            id="mentor-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as MentorStatus | '')}
            className={inputClasses}
          >
            <option value="">All statuses</option>
            {MENTOR_STATUSES.map((s) => (
              <option key={s} value={s}>
                {MENTOR_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      </div>
      {mentors.isPending ? (
        <Loading />
      ) : mentors.error ? (
        <LoadError onRetry={() => void mentors.refetch()} />
      ) : shown.length === 0 ? (
        <p>No mentors match.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-blue-100 bg-white">
          <table className="w-full text-left">
            <thead className="border-b border-blue-100 bg-blue-50">
              <tr>
                <th scope="col" className="px-4 py-2">
                  Mentor
                </th>
                <th scope="col" className="px-4 py-2">
                  Contact email (private)
                </th>
                <th scope="col" className="px-4 py-2">
                  Requests, last 12 months
                </th>
                <th scope="col" className="px-4 py-2">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-100">
              {shown.map((m) => (
                <tr key={m.id}>
                  <td className="px-4 py-2">
                    <Link to={`/admin/mentors/${m.id}`} className="font-semibold">
                      {m.fullName}
                    </Link>
                    {m.headline && <span className="block text-sm">{m.headline}</span>}
                  </td>
                  <td className="px-4 py-2 break-all">{m.contactEmail}</td>
                  <td className="px-4 py-2">{m.requestsSent}</td>
                  <td className="px-4 py-2">
                    <MentorStatusBadge status={m.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminPage>
  );
}

type Values = Record<
  'fullName' | 'slug' | 'headline' | 'contactEmail' | 'photoUrl' | 'bio' | 'background',
  string
>;

const toValues = (m?: AdminMentor): Values => ({
  fullName: str(m?.fullName),
  slug: str(m?.slug),
  headline: str(m?.headline),
  contactEmail: str(m?.contactEmail),
  photoUrl: str(m?.photoUrl),
  bio: str(m?.bio),
  background: str(m?.background),
});

const toPayload = (v: Values) => ({
  fullName: v.fullName.trim(),
  ...(v.slug.trim() && { slug: v.slug.trim() }),
  headline: orNull(v.headline),
  contactEmail: v.contactEmail.trim(),
  photoUrl: orNull(v.photoUrl),
  bio: orNull(v.bio),
  background: orNull(v.background),
});

export function NewMentorPage() {
  const navigate = useNavigate();
  const create = useAdminMutation<unknown, AdminMentor>('POST', '/admin/mentors');
  return (
    <AdminPage title="Add mentor" back={BACK}>
      <Panel title="Details">
        <p className="text-sm">
          New mentors start as inactive. Add their topics, then activate them to list them publicly.
        </p>
        <MentorForm
          submitLabel="Create mentor"
          saving={create.isPending}
          onSubmit={(values, onError) => {
            const result = validate(mentorCreateSchema, toPayload(values));
            if (!result.data) return onError(result.errors);
            create.mutate(result.data, {
              onSuccess: (m) =>
                void navigate(`/admin/mentors/${m.id}`, { replace: true, state: SAVED }),
              onError: (e) => onError(requestErrors(e)),
            });
          }}
        />
      </Panel>
    </AdminPage>
  );
}

const MENTOR_TRANSITIONS: Record<MentorStatus, MentorStatus[]> = {
  active: ['inactive', 'archived'],
  inactive: ['active', 'archived'],
  archived: ['inactive'],
};
const MENTOR_ACTIONS: Record<string, string> = {
  'active>inactive': 'Deactivate',
  'inactive>active': 'Activate',
  'archived>inactive': 'Restore (inactive)',
};

export function EditMentorPage() {
  const { id = '' } = useParams();
  const mentor = useAdminGet<AdminMentor>(`/admin/mentors/${id}`);
  const update = useAdminMutation('PATCH', `/admin/mentors/${id}`);

  if (mentor.error instanceof ApiRequestError && mentor.error.status === 404)
    return <NotFoundPage />;
  if (mentor.isPending || mentor.error) {
    return (
      <AdminPage title="Mentor" back={BACK}>
        {mentor.error ? <LoadError onRetry={() => void mentor.refetch()} /> : <Loading />}
      </AdminPage>
    );
  }
  const m = mentor.data;

  return (
    <AdminPage
      title={m.fullName}
      back={BACK}
      actions={
        m.status === 'active' && (
          <a href={`/mentors/${m.slug}`} target="_blank" rel="noopener noreferrer">
            View public profile <span className="sr-only">(opens in a new tab)</span>
          </a>
        )
      }
    >
      <Panel title="Status">
        <WorkflowActions<MentorStatus>
          status={m.status}
          badge={<MentorStatusBadge status={m.status} />}
          transitions={MENTOR_TRANSITIONS}
          actionLabel={(from, to) =>
            MENTOR_ACTIONS[`${from}>${to}`] ??
            (to === 'archived' ? 'Archive' : MENTOR_STATUS_LABELS[to])
          }
          confirm={{
            active: 'They will be listed publicly and students can send them session requests.',
            inactive: 'They will be hidden from the mentor directory and cannot receive requests.',
            archived:
              'They will be hidden and cannot receive requests. You can restore them later.',
          }}
          primary="active"
          path={`/admin/mentors/${m.id}`}
          name={m.fullName}
        />
        <p className="flex items-center gap-2 text-sm">
          <Mail aria-hidden="true" className="size-4" />
          {m.requestsSent} session {m.requestsSent === 1 ? 'request' : 'requests'} sent in the last
          12 months. Request contents are never stored.
        </p>
      </Panel>
      <Panel title="Details">
        <MentorForm
          key={m.updatedAt}
          saved={m}
          submitLabel="Save changes"
          saving={update.isPending}
          onSubmit={(values, onError) => {
            const changes = changedFields(toPayload(toValues(m)), toPayload(values));
            if (Object.keys(changes).length === 0) return onError({ '': 'Nothing has changed.' });
            const result = validate(mentorUpdateSchema, changes);
            if (!result.data) return onError(result.errors);
            update.mutate(result.data, { onError: (e) => onError(requestErrors(e)) });
          }}
        />
      </Panel>
      <ExpertisePanel
        key={`${m.id}:${m.updatedAt}:${m.topics.join()}:${m.fields.join()}:${m.programmeAreas.join()}`}
        mentor={m}
      />
    </AdminPage>
  );
}

function MentorForm({
  saved,
  submitLabel,
  saving,
  onSubmit,
}: {
  saved?: AdminMentor;
  submitLabel: string;
  saving: boolean;
  onSubmit: (values: Values, onError: (errors: Record<string, string>) => void) => void;
}) {
  const [values, setValues] = useState(() => toValues(saved));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const dirty = JSON.stringify(values) !== JSON.stringify(toValues(saved));
  const set = (key: keyof Values) => (v: string) => setValues({ ...values, [key]: v });
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
          label="Full name"
          required
          value={values.fullName}
          onChange={set('fullName')}
          error={errors.fullName}
          maxLength={100}
        />
        <TextField
          label="Contact email (private)"
          type="email"
          required
          hint="Session requests are emailed here. It is never shown on the public site."
          value={values.contactEmail}
          onChange={set('contactEmail')}
          error={errors.contactEmail}
        />
        <TextField
          label="Headline"
          hint="e.g. Medical student, University of Ghana"
          value={values.headline}
          onChange={set('headline')}
          error={errors.headline}
          maxLength={150}
        />
        <TextField
          label="Photo"
          type="url"
          hint="Link to an image, starting https://"
          value={values.photoUrl}
          onChange={set('photoUrl')}
          error={errors.photoUrl}
        />
        <TextField
          label="Web address name (slug)"
          hint={
            saved
              ? 'Changing this breaks existing links to the profile.'
              : 'Leave blank to create one from the name.'
          }
          value={values.slug}
          onChange={set('slug')}
          error={errors.slug}
        />
      </div>
      <TextAreaField
        label="About"
        value={values.bio}
        onChange={set('bio')}
        error={errors.bio}
        maxLength={3000}
      />
      <TextAreaField
        label="Background"
        hint="Education and experience."
        value={values.background}
        onChange={set('background')}
        error={errors.background}
        maxLength={3000}
      />
      <Button type="submit" disabled={saving}>
        {saving ? 'Saving…' : submitLabel}
      </Button>
    </form>
  );
}

function ExpertisePanel({ mentor: m }: { mentor: AdminMentor }) {
  const id = useId();
  const save = useAdminMutation('PUT', `/admin/mentors/${m.id}/expertise`);
  const [topics, setTopics] = useState<MentoringTopicCode[]>(m.topics);
  const [fields, setFields] = useState(listText(m.fields));
  const [areas, setAreas] = useState(listText(m.programmeAreas));
  const [error, setError] = useState<string>();
  const payload = { topics, fields: parseList(fields), programmeAreas: parseList(areas) };
  const dirty =
    JSON.stringify(payload) !==
    JSON.stringify({ topics: m.topics, fields: m.fields, programmeAreas: m.programmeAreas });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const result = validate(mentorExpertiseSchema, payload);
    if (!result.data) return setError(Object.values(result.errors)[0]);
    setError(undefined);
    save.mutate(result.data, { onError: (e) => setError(Object.values(requestErrors(e))[0]) });
  };

  return (
    <Panel title="Topics and expertise">
      <form onSubmit={submit} noValidate className="space-y-4">
        <UnsavedChangesGuard when={dirty && !save.isPending} />
        <FormError message={error} />
        <fieldset>
          <legend className="mb-1 font-semibold">Mentoring topics</legend>
          <p className="mb-2 text-sm">Students choose one of these when sending a request.</p>
          <div className="grid gap-1 sm:grid-cols-2">
            {MENTORING_TOPICS.map((t) => (
              <label key={t.code} className="flex items-start gap-2">
                <input
                  type="checkbox"
                  name={`${id}-topics`}
                  checked={topics.includes(t.code)}
                  onChange={() =>
                    setTopics(
                      topics.includes(t.code)
                        ? topics.filter((c) => c !== t.code)
                        : [...topics, t.code],
                    )
                  }
                  className="mt-1 size-4 accent-blue-700"
                />
                {t.label}
              </label>
            ))}
          </div>
        </fieldset>
        <TextField
          label="Fields"
          hint="Separate with commas, e.g. Health, Engineering"
          value={fields}
          onChange={setFields}
        />
        <TextField
          label="Programme areas"
          hint="Separate with commas, e.g. Medicine, Nursing"
          value={areas}
          onChange={setAreas}
        />
        <Button type="submit" disabled={!dirty || save.isPending}>
          {save.isPending ? 'Saving…' : 'Save topics and expertise'}
        </Button>
      </form>
    </Panel>
  );
}
