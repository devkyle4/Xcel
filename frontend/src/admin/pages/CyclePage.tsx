import {
  type AdminCycle,
  cycleUpdateSchema,
  type PublishStatus,
  requirementsInputSchema,
  validateRequirementTree,
} from '@xcel/shared';
import { CopyPlus, Lock, Trash2 } from 'lucide-react';
import { type FormEvent, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { LoadError, Loading } from '../../components/LoadState';
import { Button } from '../../components/ui/Button';
import { useCatalogue, useGrades, useSubjects } from '../../hooks/queries';
import { ApiRequestError } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { NotFoundPage } from '../../pages/NotFoundPage';
import { requestErrors, useAdminGet, useAdminMutation } from '../api';
import { AdminPage, Panel } from '../components/AdminPage';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ErrorSummary, FormError, TextAreaField, TextField } from '../components/fields';
import { PublishStatusBadge } from '../components/PublishStatusBadge';
import { StatusActions } from '../components/StatusActions';
import { UnsavedChangesGuard } from '../components/UnsavedChangesGuard';
import { VerificationPanel } from '../components/VerificationPanel';
import { changedFields, orNull, SAVED, str, validate } from '../forms';
import { diffLines, requirementLines } from '../rules/diff';
import { RuleBuilder } from '../rules/RuleBuilder';
import type { Catalogue } from '../rules/RuleParamsEditor';
import { TestPanel } from '../rules/TestPanel';
import { type EditorGroup, fromSaved } from '../rules/tree';

/** Statuses a once-published cycle can never return to; it changes only through a new version. */
const PRE_PUBLICATION: readonly PublishStatus[] = ['draft', 'needs_verification', 'verified'];

export function CyclePage() {
  const { id = '' } = useParams();
  const cycle = useAdminGet<AdminCycle>(`/admin/cycles/${id}`);
  const subjects = useSubjects();
  const grades = useGrades();
  const { catalogue: academic, index } = useCatalogue();

  if (cycle.error instanceof ApiRequestError && cycle.error.status === 404) return <NotFoundPage />;
  const failed = cycle.error ?? subjects.error ?? grades.error;
  if (failed || !cycle.data || !subjects.data || !grades.data || !academic || !index) {
    return (
      <AdminPage title="Admission cycle" back={{ to: '/admin/programmes', label: 'Programmes' }}>
        {failed ? <LoadError onRetry={() => void cycle.refetch()} /> : <Loading />}
      </AdminPage>
    );
  }
  return (
    <CycleView
      cycle={cycle.data}
      catalogue={{ subjects: subjects.data, grades: grades.data }}
      academic={academic}
      index={index}
    />
  );
}

function CycleView({
  cycle: c,
  catalogue,
  academic,
  index,
}: {
  cycle: AdminCycle;
  catalogue: Catalogue;
  academic: NonNullable<ReturnType<typeof useCatalogue>['catalogue']>;
  index: NonNullable<ReturnType<typeof useCatalogue>['index']>;
}) {
  const navigate = useNavigate();
  const newVersion = useAdminMutation<undefined, AdminCycle>(
    'POST',
    `/admin/cycles/${c.id}/new-version`,
  );
  const remove = useAdminMutation('DELETE', `/admin/cycles/${c.id}`, {
    onSuccessFirst: () =>
      void navigate(`/admin/programmes/${c.programmeId}`, { replace: true, state: SAVED }),
  });
  const [deleting, setDeleting] = useState(false);
  const published = c.versions.find((v) => v.status === 'published' && v.id !== c.id);
  const previous = c.supersedesCycleId;

  return (
    <AdminPage
      title={`${c.programme.name}, ${c.academicYear}`}
      back={{ to: `/admin/programmes/${c.programmeId}`, label: c.programme.name }}
    >
      <p>
        {c.programme.universityName} · Admission cycle version {c.version}
      </p>

      {c.versions.length > 1 && (
        <nav aria-label="Versions" className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">Versions:</span>
          {c.versions.map((v) => (
            <Link
              key={v.id}
              to={`/admin/cycles/${v.id}`}
              aria-current={v.id === c.id ? 'page' : undefined}
              className={`inline-flex items-center gap-2 rounded-md border px-2 py-1 no-underline ${v.id === c.id ? 'border-blue-700 bg-blue-50' : 'border-blue-100 bg-white'}`}
            >
              Version {v.version} <PublishStatusBadge status={v.status} />
            </Link>
          ))}
        </nav>
      )}

      {!c.editable && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-300 bg-blue-50 p-4">
          <p className="flex items-start gap-2">
            <Lock aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-blue-700" />
            {c.publishedAt
              ? 'This version has been published, so it cannot change. To update the requirements, create a new version; it replaces this one when published.'
              : 'Only draft cycles can be edited. Return it to draft to make changes.'}
          </p>
          {c.publishedAt && (
            <Button
              disabled={newVersion.isPending}
              onClick={() =>
                newVersion.mutate(undefined, {
                  onSuccess: (created) =>
                    void navigate(`/admin/cycles/${created.id}`, { state: SAVED }),
                })
              }
            >
              <CopyPlus aria-hidden="true" className="size-5" /> Create new version
            </Button>
          )}
          <div className="w-full">
            <FormError message={requestErrors(newVersion.error)['']} />
          </div>
        </div>
      )}

      <Panel title="Publishing">
        <StatusActions
          status={c.status}
          path={`/admin/cycles/${c.id}`}
          name={`version ${c.version}`}
          allowed={(to) => !(c.publishedAt && PRE_PUBLICATION.includes(to))}
          notes={{
            published: published
              ? `Students will see these requirements. Version ${published.version}, published now, will be archived.`
              : 'Students will see these requirements when checking eligibility.',
          }}
        />
        {c.issues.length > 0 && (
          <div className="rounded-md border border-red-300 bg-red-50 p-3 text-red-800">
            <p className="font-semibold">Fix these before verifying or publishing:</p>
            <ul className="list-disc pl-6">
              {c.issues.map((issue, i) => (
                <li key={i}>{issue.message}</li>
              ))}
            </ul>
          </div>
        )}
      </Panel>

      <DetailsPanel cycle={c} />

      <RequirementsEditor
        key={`${c.id}:${JSON.stringify(c.requirements)}`}
        cycle={c}
        catalogue={catalogue}
        academic={academic}
        index={index}
        previousId={previous}
      />

      <VerificationPanel
        entityType="programme_admission_cycle"
        entityId={c.id}
        records={c.verifications}
      />

      {c.editable && (
        <Panel title="Delete this draft">
          <p>
            Deleting removes this draft and its requirements. Published versions are never deleted.
          </p>
          <Button variant="secondary" onClick={() => setDeleting(true)}>
            <Trash2 aria-hidden="true" className="size-5" /> Delete draft
          </Button>
          {deleting && (
            <ConfirmDialog
              title={`Delete version ${c.version}?`}
              confirmLabel="Delete draft"
              busy={remove.isPending}
              onCancel={() => {
                setDeleting(false);
                remove.reset();
              }}
              onConfirm={() => remove.mutate(undefined)}
            >
              <p>This cannot be undone.</p>
              <FormError message={requestErrors(remove.error)['']} />
            </ConfirmDialog>
          )}
        </Panel>
      )}
    </AdminPage>
  );
}

type DetailValues = Record<
  'academicYear' | 'applicationOpensOn' | 'applicationDeadline' | 'applicationUrl' | 'notes',
  string
>;

const toValues = (c: AdminCycle): DetailValues => ({
  academicYear: c.academicYear,
  applicationOpensOn: str(c.applicationOpensOn),
  applicationDeadline: str(c.applicationDeadline),
  applicationUrl: str(c.applicationUrl),
  notes: str(c.notes),
});

const toPayload = (v: DetailValues) => ({
  academicYear: v.academicYear.trim(),
  applicationOpensOn: orNull(v.applicationOpensOn),
  applicationDeadline: orNull(v.applicationDeadline),
  applicationUrl: orNull(v.applicationUrl),
  notes: orNull(v.notes),
});

function DetailsPanel({ cycle: c }: { cycle: AdminCycle }) {
  if (!c.editable) {
    const facts: [string, string | null][] = [
      ['Academic year', c.academicYear],
      ['Applications open', c.applicationOpensOn && formatDate(c.applicationOpensOn)],
      ['Application deadline', c.applicationDeadline && formatDate(c.applicationDeadline)],
      ['Application page', c.applicationUrl],
      ['Notes for students', c.notes],
    ];
    return (
      <Panel title="Details">
        <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt className="text-sm font-semibold">{label}</dt>
              <dd className="break-words whitespace-pre-line">{value ?? '—'}</dd>
            </div>
          ))}
        </dl>
      </Panel>
    );
  }
  return (
    <Panel title="Details">
      <DetailsForm key={c.updatedAt} cycle={c} />
    </Panel>
  );
}

function DetailsForm({ cycle: c }: { cycle: AdminCycle }) {
  const update = useAdminMutation('PATCH', `/admin/cycles/${c.id}`);
  const [values, setValues] = useState(() => toValues(c));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const dirty = JSON.stringify(values) !== JSON.stringify(toValues(c));
  const set = (key: keyof DetailValues) => (v: string) => setValues({ ...values, [key]: v });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const changes = changedFields(toPayload(toValues(c)), toPayload(values));
    if (Object.keys(changes).length === 0) return setErrors({ '': 'Nothing has changed.' });
    const result = validate(cycleUpdateSchema, changes);
    setErrors(result.errors ?? {});
    if (result.data) update.mutate(result.data, { onError: (e) => setErrors(requestErrors(e)) });
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <UnsavedChangesGuard when={dirty && !update.isPending} />
      <ErrorSummary errors={errors} />
      <div className="grid gap-4 md:grid-cols-3">
        <TextField
          label="Academic year"
          required
          hint="e.g. 2026/2027"
          value={values.academicYear}
          onChange={set('academicYear')}
          error={errors.academicYear}
        />
        <TextField
          label="Applications open"
          type="date"
          value={values.applicationOpensOn}
          onChange={set('applicationOpensOn')}
          error={errors.applicationOpensOn}
        />
        <TextField
          label="Application deadline"
          type="date"
          value={values.applicationDeadline}
          onChange={set('applicationDeadline')}
          error={errors.applicationDeadline}
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
        label="Notes for students"
        hint="Shown on the programme page, e.g. how a cut-off applies."
        value={values.notes}
        onChange={set('notes')}
        error={errors.notes}
        rows={3}
        maxLength={2000}
      />
      <Button type="submit" disabled={update.isPending}>
        {update.isPending ? 'Saving…' : 'Save details'}
      </Button>
    </form>
  );
}

function RequirementsEditor({
  cycle: c,
  catalogue,
  academic,
  index,
  previousId,
}: {
  cycle: AdminCycle;
  catalogue: Catalogue;
  academic: NonNullable<ReturnType<typeof useCatalogue>['catalogue']>;
  index: NonNullable<ReturnType<typeof useCatalogue>['index']>;
  previousId: string | null;
}) {
  const saved = useMemo(
    () => (c.requirements ? fromSaved(c.requirements) : null),
    [c.requirements],
  );
  const [tree, setTree] = useState<EditorGroup | null>(saved);
  const [error, setError] = useState<string>();
  const save = useAdminMutation('PUT', `/admin/cycles/${c.id}/requirements`);
  const dirty = JSON.stringify(tree) !== JSON.stringify(saved);
  const issues = useMemo(() => validateRequirementTree(tree, academic), [tree, academic]);
  const treeIssues = issues.filter((i) => i.nodeId === null && (tree || !c.editable));

  const submit = () => {
    const result = validate(requirementsInputSchema, { requirements: tree });
    if (!result.data) return setError(Object.values(result.errors)[0]);
    setError(undefined);
    save.mutate(result.data, { onError: (e) => setError(Object.values(requestErrors(e))[0]) });
  };

  return (
    <>
      <Panel title="Requirements">
        <UnsavedChangesGuard when={dirty && !save.isPending} />
        {c.editable && (
          <p className="text-sm">
            Changes are checked as you go. You can save incomplete requirements and come back later;
            problems must be fixed before the cycle is verified or published.
          </p>
        )}
        {treeIssues.length > 0 && (
          <ul className="space-y-0.5 font-semibold text-red-800">
            {treeIssues.map((i) => (
              <li key={i.code}>{i.message}</li>
            ))}
          </ul>
        )}
        <RuleBuilder
          value={tree}
          onChange={setTree}
          catalogue={catalogue}
          academic={academic}
          index={index}
          issues={issues}
          readOnly={!c.editable}
        />
        {c.editable && (
          <div className="flex flex-wrap items-center gap-3 border-t border-blue-100 pt-4">
            <Button onClick={submit} disabled={!dirty || save.isPending}>
              {save.isPending ? 'Saving…' : 'Save requirements'}
            </Button>
            <Button variant="secondary" disabled={!dirty} onClick={() => setTree(saved)}>
              Discard changes
            </Button>
            {tree && (
              <Button variant="secondary" onClick={() => setTree(null)}>
                Remove all requirements
              </Button>
            )}
            <span role="status" className="text-sm">
              {dirty ? 'Unsaved changes' : save.isSuccess ? 'Saved' : ''}
            </span>
          </div>
        )}
        <FormError message={error} />
      </Panel>

      <Panel title="Try with sample results">
        <TestPanel tree={tree} catalogue={catalogue} academic={academic} index={index} />
      </Panel>

      {previousId && <ChangesPanel previousId={previousId} tree={tree} academic={academic} />}
    </>
  );
}

/** What this version changes compared with the version it was copied from. */
function ChangesPanel({
  previousId,
  tree,
  academic,
}: {
  previousId: string;
  tree: EditorGroup | null;
  academic: NonNullable<ReturnType<typeof useCatalogue>['catalogue']>;
}) {
  const previous = useAdminGet<AdminCycle>(`/admin/cycles/${previousId}`);
  const changes = useMemo(
    () =>
      previous.data
        ? diffLines(
            requirementLines(previous.data.requirements, academic),
            requirementLines(tree, academic),
          )
        : [],
    [previous.data, tree, academic],
  );
  if (!previous.data) return null;
  return (
    <Panel title={`Changes from version ${previous.data.version}`}>
      {changes.length === 0 ? (
        <p>The requirements are the same as version {previous.data.version}.</p>
      ) : (
        <ul className="space-y-1 font-mono text-sm">
          {changes.map((change, i) => (
            <li
              key={i}
              className={`rounded px-2 py-1 whitespace-pre-wrap ${change.kind === 'added' ? 'bg-green-50 text-green-900' : 'bg-off-white text-blue-950 line-through'}`}
            >
              <span className="sr-only">{change.kind === 'added' ? 'Added: ' : 'Removed: '}</span>
              <span aria-hidden="true">{change.kind === 'added' ? '+ ' : '− '}</span>
              {change.line}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
