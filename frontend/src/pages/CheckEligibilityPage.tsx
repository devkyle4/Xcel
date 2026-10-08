import type { GradeInfo, StudentResults, SubjectInfo } from '@xcel/shared';
import { Plus, Trash2 } from 'lucide-react';
import { type FormEvent, useId, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { LoadError, Loading } from '../components/LoadState';
import { PageContainer } from '../components/PageContainer';
import { Button } from '../components/ui/Button';
import { InfoPanel } from '../components/ui/InfoPanel';
import { useCatalogue } from '../hooks/queries';
import { MAX_RESULT_SUBJECTS } from '@xcel/shared';
import { resultsStore, useStoredResults } from '../lib/results-store';

interface ElectiveRow {
  key: number;
  subject: string;
  grade: string;
}

const DEFAULT_ELECTIVE_ROWS = 4;
let nextKey = 0;
const emptyRow = (): ElectiveRow => ({ key: nextKey++, subject: '', grade: '' });

const selectClasses = 'w-full rounded-md border border-blue-300 bg-white p-2.5';

function GradeSelect({
  id,
  value,
  grades,
  onChange,
  invalid,
  describedBy,
}: {
  id: string;
  value: string;
  grades: GradeInfo[];
  onChange: (grade: string) => void;
  invalid?: boolean;
  describedBy?: string;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={selectClasses}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
    >
      <option value="">Select grade</option>
      {grades.map((g) => (
        <option key={g.code} value={g.code}>
          {g.code} – {g.label}
        </option>
      ))}
    </select>
  );
}

/** Splits stored results into the fixed core rows and the elective rows. */
function initialState(stored: StudentResults | null, core: SubjectInfo[]) {
  const coreCodes = new Set(core.map((s) => s.code));
  const coreGrades = Object.fromEntries(core.map((s) => [s.code, stored?.[s.code] ?? '']));
  const electives = Object.entries(stored ?? {})
    .filter(([code]) => !coreCodes.has(code))
    .map(([subject, grade]) => ({ key: nextKey++, subject, grade }));
  while (electives.length < DEFAULT_ELECTIVE_ROWS) electives.push(emptyRow());
  return { coreGrades, electives };
}

function ResultsForm({ subjects, grades }: { subjects: SubjectInfo[]; grades: GradeInfo[] }) {
  const navigate = useNavigate();
  const stored = useStoredResults();
  const core = useMemo(
    () => subjects.filter((s) => s.isActive && s.category === 'core'),
    [subjects],
  );
  const electiveOptions = useMemo(
    () => subjects.filter((s) => s.isActive && s.category === 'elective'),
    [subjects],
  );
  const [initial] = useState(() => initialState(stored, core));
  const [coreGrades, setCoreGrades] = useState<Record<string, string>>(initial.coreGrades);
  const [electives, setElectives] = useState<ElectiveRow[]>(initial.electives);
  const [step, setStep] = useState<'edit' | 'review'>('edit');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const formId = useId();

  const nameOf = (code: string) => subjects.find((s) => s.code === code)?.name ?? code;
  const gradeLabel = (code: string) => grades.find((g) => g.code === code)?.label ?? '';

  const entered = (): StudentResults => ({
    ...Object.fromEntries(Object.entries(coreGrades).filter(([, grade]) => grade)),
    ...Object.fromEntries(
      electives.filter((r) => r.subject && r.grade).map((r) => [r.subject, r.grade]),
    ),
  });

  function validate(): Record<string, string> {
    const found: Record<string, string> = {};
    for (const row of electives) {
      if (row.subject && !row.grade)
        found[`grade-${row.key}`] = `Choose your grade for ${nameOf(row.subject)}.`;
      if (!row.subject && row.grade)
        found[`subject-${row.key}`] = 'Choose the subject for this grade.';
    }
    if (Object.keys(found).length === 0 && Object.keys(entered()).length === 0) {
      found.form = 'Enter at least one subject and grade.';
    }
    return found;
  }

  function review(event: FormEvent) {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length === 0) setStep('review');
  }

  const missingCore = core.filter((s) => !coreGrades[s.code]);
  const totalRows = core.length + electives.length;

  if (step === 'review') {
    const results = entered();
    return (
      <section aria-labelledby={`${formId}-review`} className="space-y-6">
        <h2 id={`${formId}-review`} className="text-2xl font-bold">
          Check your results
        </h2>
        <table className="w-full max-w-xl border-collapse text-left">
          <thead>
            <tr className="border-b border-blue-300">
              <th scope="col" className="py-2">
                Subject
              </th>
              <th scope="col" className="py-2">
                Grade
              </th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(results).map(([code, grade]) => (
              <tr key={code} className="border-b border-blue-100">
                <td className="py-2">{nameOf(code)}</td>
                <td className="py-2">
                  {grade} <span className="text-sm">({gradeLabel(grade)})</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {missingCore.length > 0 && (
          <InfoPanel title="Some core subjects have no grade">
            You have not entered a grade for {missingCore.map((s) => s.name).join(', ')}. Most
            programmes require core subjects, so they will show as not met. Go back to add them if
            you took them.
          </InfoPanel>
        )}
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() => {
              resultsStore.set(results);
              navigate('/check-eligibility/results');
            }}
          >
            See my results
          </Button>
          <Button variant="secondary" onClick={() => setStep('edit')}>
            Edit results
          </Button>
        </div>
      </section>
    );
  }

  const errorList = Object.values(errors);
  return (
    <form onSubmit={review} noValidate className="space-y-8" aria-describedby={`${formId}-privacy`}>
      <p id={`${formId}-privacy`}>
        Your results stay on this device. They are never sent to our server, and they are cleared
        when you close this tab.
      </p>

      {errorList.length > 0 && (
        <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4">
          <p className="font-semibold text-red-800">Please fix the following:</p>
          <ul className="mt-2 list-disc pl-5 text-red-800">
            {errorList.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <fieldset className="space-y-4">
        <legend className="text-xl font-bold">Core subjects</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          {core.map((subject) => (
            <div key={subject.code}>
              <label htmlFor={`${formId}-${subject.code}`} className="mb-1 block font-semibold">
                {subject.name}
              </label>
              <GradeSelect
                id={`${formId}-${subject.code}`}
                value={coreGrades[subject.code] ?? ''}
                grades={grades}
                onChange={(grade) => setCoreGrades((g) => ({ ...g, [subject.code]: grade }))}
              />
            </div>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-xl font-bold">Elective subjects</legend>
        <ul className="space-y-4">
          {electives.map((row, i) => {
            const chosenElsewhere = new Set(
              electives.filter((r) => r.key !== row.key).map((r) => r.subject),
            );
            const subjectError = errors[`subject-${row.key}`];
            const gradeError = errors[`grade-${row.key}`];
            const update = (patch: Partial<ElectiveRow>) =>
              setElectives((rows) => rows.map((r) => (r.key === row.key ? { ...r, ...patch } : r)));
            return (
              <li key={row.key} className="grid gap-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
                <div>
                  <label
                    htmlFor={`${formId}-subject-${row.key}`}
                    className="mb-1 block font-semibold"
                  >
                    Elective subject {i + 1}
                  </label>
                  <select
                    id={`${formId}-subject-${row.key}`}
                    value={row.subject}
                    onChange={(e) => update({ subject: e.target.value })}
                    className={selectClasses}
                    aria-invalid={subjectError ? true : undefined}
                  >
                    <option value="">Select subject</option>
                    {electiveOptions
                      .filter((s) => !chosenElsewhere.has(s.code))
                      .map((s) => (
                        <option key={s.code} value={s.code}>
                          {s.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor={`${formId}-grade-${row.key}`}
                    className="mb-1 block font-semibold"
                  >
                    Grade
                    <span className="sr-only"> for elective subject {i + 1}</span>
                  </label>
                  <GradeSelect
                    id={`${formId}-grade-${row.key}`}
                    value={row.grade}
                    grades={grades}
                    onChange={(grade) => update({ grade })}
                    invalid={Boolean(gradeError)}
                  />
                </div>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 justify-self-start rounded-md p-2.5 text-blue-700 hover:bg-blue-50"
                  onClick={() => setElectives((rows) => rows.filter((r) => r.key !== row.key))}
                >
                  <Trash2 aria-hidden="true" className="size-5" />
                  Remove<span className="sr-only"> elective subject {i + 1}</span>
                </button>
              </li>
            );
          })}
        </ul>
        {totalRows < MAX_RESULT_SUBJECTS && (
          <Button variant="secondary" onClick={() => setElectives((rows) => [...rows, emptyRow()])}>
            <Plus aria-hidden="true" className="size-5" /> Add another subject
          </Button>
        )}
      </fieldset>

      <div className="flex flex-wrap gap-3">
        <Button type="submit">Review my results</Button>
        {stored && (
          <Button
            variant="secondary"
            onClick={() => {
              resultsStore.clear();
              const fresh = initialState(null, core);
              setCoreGrades(fresh.coreGrades);
              setElectives(fresh.electives);
              setErrors({});
            }}
          >
            Clear my results
          </Button>
        )}
      </div>
    </form>
  );
}

export function CheckEligibilityPage() {
  const { catalogue, isPending, error } = useCatalogue();
  return (
    <PageContainer
      title="Check your eligibility"
      intro="Enter your WASSCE subjects and grades. You will then see which programmes’ published requirements you appear to meet, and why."
    >
      {isPending ? (
        <Loading label="Loading subjects…" />
      ) : error || !catalogue ? (
        <LoadError onRetry={() => window.location.reload()} />
      ) : (
        <ResultsForm
          subjects={[...catalogue.subjects] as SubjectInfo[]}
          grades={[...catalogue.grades] as GradeInfo[]}
        />
      )}
    </PageContainer>
  );
}
