import {
  type AdminGrade,
  type AdminSubject,
  gradeCreateSchema,
  gradeUpdateSchema,
  SUBJECT_CATEGORIES,
  type SubjectCategory,
  subjectCreateSchema,
  subjectUpdateSchema,
} from '@xcel/shared';
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { LoadError, Loading } from '../../components/LoadState';
import { Button } from '../../components/ui/Button';
import { InfoPanel } from '../../components/ui/InfoPanel';
import { Modal } from '../../components/ui/Modal';
import { requestErrors, useAdminGet, useAdminMutation } from '../api';
import { AdminPage, Panel } from '../components/AdminPage';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ErrorSummary, FormError, SelectField, TextField } from '../components/fields';
import { changedFields, listText, parseList, str, validate } from '../forms';

const CATEGORY_LABELS: Record<SubjectCategory, string> = { core: 'Core', elective: 'Elective' };
const usedBy = (n: number) => (n === 0 ? 'Not used' : `Used by ${n} ${n === 1 ? 'rule' : 'rules'}`);

/** The WASSCE subject list and grade scale that every requirement rule refers to. */
export function AcademicPage() {
  return (
    <AdminPage title="Subjects and grades">
      <InfoPanel title="Changes apply everywhere">
        Requirement rules refer to subjects and grades by code, so changes here affect every
        programme’s eligibility results, including published ones. Anything used by a rule cannot be
        deleted; mark a subject inactive instead.
      </InfoPanel>
      <SubjectsPanel />
      <GradesPanel />
    </AdminPage>
  );
}

// ---------- Subjects ----------

function SubjectsPanel() {
  const subjects = useAdminGet<AdminSubject[]>('/admin/subjects');
  const [editing, setEditing] = useState<AdminSubject | 'new' | null>(null);
  const [deleting, setDeleting] = useState<AdminSubject | null>(null);

  return (
    <Panel
      title="Subjects"
      actions={
        <Button variant="secondary" onClick={() => setEditing('new')}>
          <Plus aria-hidden="true" className="size-5" /> Add subject
        </Button>
      }
    >
      {subjects.isPending ? (
        <Loading />
      ) : subjects.error ? (
        <LoadError onRetry={() => void subjects.refetch()} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="border-b border-blue-100 bg-blue-50">
              <tr>
                <th scope="col" className="px-3 py-2">
                  Subject
                </th>
                <th scope="col" className="px-3 py-2">
                  Category
                </th>
                <th scope="col" className="px-3 py-2">
                  In use
                </th>
                <th scope="col" className="px-3 py-2">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-100">
              {subjects.data.map((s) => (
                <tr key={s.code}>
                  <td className="px-3 py-2">
                    <span className="font-semibold">{s.name}</span>
                    {!s.isActive && <span className="ml-2 text-sm">(inactive)</span>}
                    <span className="block font-mono text-sm">{s.code}</span>
                    {s.aliases.length > 0 && (
                      <span className="block text-sm">Also: {s.aliases.join(', ')}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">{CATEGORY_LABELS[s.category]}</td>
                  <td className="px-3 py-2 text-sm">{usedBy(s.usedByRules)}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <IconButton
                      label={`Edit ${s.name}`}
                      Icon={Pencil}
                      onClick={() => setEditing(s)}
                    />
                    {s.usedByRules === 0 && (
                      <IconButton
                        label={`Delete ${s.name}`}
                        Icon={Trash2}
                        onClick={() => setDeleting(s)}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <Modal
          title={editing === 'new' ? 'Add subject' : `Edit ${editing.name}`}
          onClose={() => setEditing(null)}
        >
          <SubjectForm
            subject={editing === 'new' ? null : editing}
            onDone={() => setEditing(null)}
          />
        </Modal>
      )}
      {deleting && (
        <DeleteDialog
          what={deleting.name}
          path={`/admin/subjects/${deleting.code}`}
          onDone={() => setDeleting(null)}
        />
      )}
    </Panel>
  );
}

function SubjectForm({ subject, onDone }: { subject: AdminSubject | null; onDone: () => void }) {
  const [code, setCode] = useState('');
  const [name, setName] = useState(str(subject?.name));
  const [category, setCategory] = useState<SubjectCategory>(subject?.category ?? 'elective');
  const [aliases, setAliases] = useState(listText(subject?.aliases));
  const [isActive, setIsActive] = useState(subject?.isActive ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useAdminMutation(
    subject ? 'PATCH' : 'POST',
    subject ? `/admin/subjects/${subject.code}` : '/admin/subjects',
  );

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const values = { name: name.trim(), category, aliases: parseList(aliases) };
    const result = subject
      ? validate(
          subjectUpdateSchema,
          changedFields(
            {
              name: subject.name,
              category: subject.category,
              aliases: subject.aliases,
              isActive: subject.isActive,
            },
            { ...values, isActive },
          ),
        )
      : validate(subjectCreateSchema, { code: code.trim().toUpperCase(), ...values });
    setErrors(result.errors ?? {});
    if (result.data)
      save.mutate(result.data, { onSuccess: onDone, onError: (e) => setErrors(requestErrors(e)) });
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <ErrorSummary errors={errors} />
      {!subject && (
        <TextField
          label="Code"
          required
          hint="Permanent: requirement rules refer to it. Capitals and underscores, e.g. FOOD_AND_NUTRITION"
          value={code}
          onChange={setCode}
          error={errors.code}
          maxLength={40}
        />
      )}
      <TextField
        label="Name"
        required
        value={name}
        onChange={setName}
        error={errors.name}
        maxLength={100}
      />
      <SelectField
        label="Category"
        required
        value={category}
        onChange={(v) => setCategory(v as SubjectCategory)}
        options={SUBJECT_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] }))}
      />
      <TextField
        label="Other names"
        hint="Separate with commas; used when students search, e.g. Maths, Core Maths"
        value={aliases}
        onChange={setAliases}
        error={errors.aliases}
      />
      {subject && (
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="mt-1 size-4 accent-blue-700"
          />
          <span>
            Offered for results entry
            <span className="block text-sm">
              Inactive subjects stay in existing requirements but students cannot enter them.
            </span>
          </span>
        </label>
      )}
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {subject ? 'Save subject' : 'Add subject'}
        </Button>
      </div>
    </form>
  );
}

// ---------- Grades ----------

function GradesPanel() {
  const grades = useAdminGet<AdminGrade[]>('/admin/grades');
  const saved = (grades.data ?? [])
    .slice()
    .sort((a, b) => a.rank - b.rank)
    .map((g) => g.code);
  const [order, setOrder] = useState<string[] | null>(null);
  const [editing, setEditing] = useState<AdminGrade | 'new' | null>(null);
  const [deleting, setDeleting] = useState<AdminGrade | null>(null);
  const saveOrder = useAdminMutation('PUT', '/admin/grades/order');
  const current = order ?? saved;
  const byCode = new Map((grades.data ?? []).map((g) => [g.code, g]));
  const reordered = order !== null && order.join() !== saved.join();

  const move = (index: number, direction: -1 | 1) => {
    const next = [...current];
    [next[index], next[index + direction]] = [next[index + direction]!, next[index]!];
    setOrder(next);
  };

  return (
    <Panel
      title="Grades"
      actions={
        <Button variant="secondary" onClick={() => setEditing('new')}>
          <Plus aria-hidden="true" className="size-5" /> Add grade
        </Button>
      }
    >
      <p className="text-sm">
        Best grade first. The order decides what “C6 or better” means; points are used for
        aggregates.
      </p>
      {grades.isPending ? (
        <Loading />
      ) : grades.error ? (
        <LoadError onRetry={() => void grades.refetch()} />
      ) : (
        <>
          <ol className="divide-y divide-blue-100">
            {current.map((code, index) => {
              const g = byCode.get(code);
              if (!g) return null;
              return (
                <li key={code} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    <span className="font-semibold">
                      {index + 1}. {g.code}
                    </span>{' '}
                    {g.label}
                    <span className="block text-sm">
                      {g.points === null
                        ? 'No points'
                        : `${g.points} ${g.points === 1 ? 'point' : 'points'}`}{' '}
                      · {g.isPass ? 'Pass' : 'Fail'} · {usedBy(g.usedByRules)}
                    </span>
                  </span>
                  <span className="whitespace-nowrap">
                    <IconButton
                      label={`Move ${g.code} up`}
                      Icon={ArrowUp}
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                    />
                    <IconButton
                      label={`Move ${g.code} down`}
                      Icon={ArrowDown}
                      disabled={index === current.length - 1}
                      onClick={() => move(index, 1)}
                    />
                    <IconButton
                      label={`Edit ${g.code}`}
                      Icon={Pencil}
                      onClick={() => setEditing(g)}
                    />
                    {g.usedByRules === 0 && (
                      <IconButton
                        label={`Delete ${g.code}`}
                        Icon={Trash2}
                        onClick={() => setDeleting(g)}
                      />
                    )}
                  </span>
                </li>
              );
            })}
          </ol>
          {reordered && (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                disabled={saveOrder.isPending}
                onClick={() =>
                  saveOrder.mutate({ codes: current }, { onSuccess: () => setOrder(null) })
                }
              >
                Save grade order
              </Button>
              <Button variant="secondary" onClick={() => setOrder(null)}>
                Discard
              </Button>
              <span className="text-sm">This changes eligibility results for every programme.</span>
            </div>
          )}
          <FormError message={requestErrors(saveOrder.error)['']} />
        </>
      )}
      {editing && (
        <Modal
          title={editing === 'new' ? 'Add grade' : `Edit ${editing.code}`}
          onClose={() => setEditing(null)}
        >
          <GradeForm grade={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />
        </Modal>
      )}
      {deleting && (
        <DeleteDialog
          what={deleting.code}
          path={`/admin/grades/${deleting.code}`}
          onDone={() => setDeleting(null)}
        />
      )}
    </Panel>
  );
}

function GradeForm({ grade, onDone }: { grade: AdminGrade | null; onDone: () => void }) {
  const [code, setCode] = useState('');
  const [label, setLabel] = useState(str(grade?.label));
  const [points, setPoints] = useState(str(grade?.points));
  const [isPass, setIsPass] = useState(grade?.isPass ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useAdminMutation(
    grade ? 'PATCH' : 'POST',
    grade ? `/admin/grades/${grade.code}` : '/admin/grades',
  );

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const values = { label: label.trim(), points: points.trim() ? Number(points) : null, isPass };
    const result = grade
      ? validate(
          gradeUpdateSchema,
          changedFields({ label: grade.label, points: grade.points, isPass: grade.isPass }, values),
        )
      : validate(gradeCreateSchema, { code: code.trim().toUpperCase(), ...values });
    setErrors(result.errors ?? {});
    if (result.data)
      save.mutate(result.data, { onSuccess: onDone, onError: (e) => setErrors(requestErrors(e)) });
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <ErrorSummary errors={errors} />
      {!grade && (
        <TextField
          label="Code"
          required
          hint="e.g. C6. New grades are added at the end; reorder them afterwards."
          value={code}
          onChange={setCode}
          error={errors.code}
          maxLength={8}
        />
      )}
      <TextField
        label="Label"
        required
        hint="e.g. Credit"
        value={label}
        onChange={setLabel}
        error={errors.label}
        maxLength={40}
      />
      <TextField
        label="Points"
        type="number"
        inputMode="numeric"
        hint="Used in aggregates. Leave blank for none."
        value={points}
        onChange={setPoints}
        error={errors.points}
      />
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={isPass}
          onChange={(e) => setIsPass(e.target.checked)}
          className="size-4 accent-blue-700"
        />
        Counts as a pass
      </label>
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {grade ? 'Save grade' : 'Add grade'}
        </Button>
      </div>
    </form>
  );
}

// ---------- Shared ----------

function DeleteDialog({ what, path, onDone }: { what: string; path: string; onDone: () => void }) {
  const remove = useAdminMutation('DELETE', path);
  return (
    <ConfirmDialog
      title={`Delete ${what}?`}
      confirmLabel="Delete"
      busy={remove.isPending}
      onConfirm={() => remove.mutate(undefined, { onSuccess: onDone })}
      onCancel={onDone}
    >
      <p>This cannot be undone.</p>
      <FormError message={requestErrors(remove.error)['']} />
    </ConfirmDialog>
  );
}

function IconButton({
  label,
  Icon,
  onClick,
  disabled,
}: {
  label: string;
  Icon: typeof Pencil;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-md p-1.5 text-blue-700 hover:bg-blue-50 disabled:opacity-40"
    >
      <Icon aria-hidden="true" className="size-5" />
      <span className="sr-only">{label}</span>
    </button>
  );
}
