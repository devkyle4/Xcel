import type { GradeInfo, SubjectCategory, SubjectInfo } from '@xcel/shared';
import { X } from 'lucide-react';
import { useId } from 'react';
import { Button } from '../../components/ui/Button';
import { inputClasses } from '../components/fields';
import type { EditorRule } from './tree';

export interface Catalogue {
  subjects: SubjectInfo[];
  grades: GradeInfo[];
}

type Params = Record<string, unknown>;

// Saved params may be malformed; read them defensively and let validation report problems.
const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
const string = (v: unknown) => (typeof v === 'string' ? v : '');
const numberText = (v: unknown) => (typeof v === 'number' && !Number.isNaN(v) ? String(v) : '');
const toNumber = (text: string) => (text.trim() === '' ? undefined : Number(text));

/** Sets or (for undefined, empty lists and empty objects) removes a parameter. */
function withParam(params: Params, key: string, value: unknown): Params {
  const next = { ...params };
  const empty =
    value === undefined ||
    value === '' ||
    (Array.isArray(value) && value.length === 0) ||
    (typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      Object.keys(value).length === 0);
  if (empty) delete next[key];
  else next[key] = value;
  return next;
}

/** Settings for one rule, with a form suited to its type. */
export function RuleParamsEditor({
  rule,
  catalogue,
  onChange,
}: {
  rule: EditorRule;
  catalogue: Catalogue;
  onChange: (params: Params) => void;
}) {
  const p = rule.params;
  const set = (key: string, value: unknown) => onChange(withParam(p, key, value));

  switch (rule.ruleType) {
    case 'subject_grade':
      return (
        <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
          <SubjectListPicker
            label="Subject"
            hint="Add more than one for alternatives: any one of them counts."
            value={strings(p.subjectCodes)}
            onChange={(v) => set('subjectCodes', v)}
            subjects={catalogue.subjects}
          />
          <GradeSelect
            label="Minimum grade"
            value={string(p.minGrade)}
            onChange={(v) => set('minGrade', v)}
            grades={catalogue.grades}
          />
        </div>
      );

    case 'subject_count':
      return (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberInput
              label="How many subjects"
              value={numberText(p.count)}
              onChange={(v) => set('count', toNumber(v))}
            />
            <GradeSelect
              label="Minimum grade"
              value={string(p.minGrade)}
              onChange={(v) => set('minGrade', v)}
              grades={catalogue.grades}
            />
          </div>
          <PoolEditor
            params={p}
            onChange={onChange}
            subjects={catalogue.subjects}
            anyLabel="Any subject"
          />
          <SubjectListPicker
            label="Not counting"
            hint="Subjects that do not count towards this requirement, if any."
            optional
            value={strings(p.excludeSubjectCodes)}
            onChange={(v) => set('excludeSubjectCodes', v)}
            subjects={catalogue.subjects}
          />
        </div>
      );

    case 'aggregate_max':
      return <AggregateEditor params={p} onChange={onChange} catalogue={catalogue} />;

    case 'manual_review':
      return (
        <TextArea
          label="What must be confirmed"
          hint="Shown to students as something to confirm with the institution, e.g. “Pass the entrance interview”."
          value={string(p.description)}
          onChange={(v) => set('description', v)}
        />
      );

    default:
      return (
        <div className="space-y-1">
          <p>This rule type is not supported by the editor. Its settings are shown as stored.</p>
          <pre className="overflow-x-auto rounded-md bg-off-white p-3 text-sm">
            {JSON.stringify(p, null, 2)}
          </pre>
        </div>
      );
  }
}

/** Where a count or aggregate component draws its subjects from. */
function PoolEditor({
  params,
  onChange,
  subjects,
  anyLabel,
}: {
  params: Params;
  onChange: (params: Params) => void;
  subjects: SubjectInfo[];
  anyLabel?: string;
}) {
  const name = useId();
  const pool = params.subjectCodes !== undefined ? 'listed' : params.category ? 'category' : 'any';
  const choose = (next: string) => {
    const { subjectCodes: _s, category: _c, ...rest } = params;
    if (next === 'listed') onChange({ ...rest, subjectCodes: [] });
    else if (next === 'category') onChange({ ...rest, category: 'elective' });
    else onChange(rest);
  };
  const options = [
    ...(anyLabel ? [['any', anyLabel]] : []),
    ['category', 'All core or all elective subjects'],
    ['listed', 'Only these subjects'],
  ];
  return (
    <fieldset className="space-y-2">
      <legend className="font-semibold">Counting from</legend>
      <div className="flex flex-wrap gap-x-5 gap-y-1">
        {options.map(([value, label]) => (
          <label key={value} className="flex items-center gap-2">
            <input
              type="radio"
              name={name}
              value={value}
              checked={pool === value}
              onChange={() => choose(value!)}
              className="size-4 accent-blue-700"
            />
            {label}
          </label>
        ))}
      </div>
      {pool === 'category' && (
        <div className="max-w-xs">
          <Select
            label="Category"
            value={string(params.category)}
            onChange={(v) => onChange(withParam(params, 'category', v as SubjectCategory))}
            options={[
              ['core', 'Core subjects'],
              ['elective', 'Elective subjects'],
            ]}
          />
        </div>
      )}
      {pool === 'listed' && (
        <SubjectListPicker
          label="Subjects"
          value={strings(params.subjectCodes)}
          onChange={(v) => onChange({ ...params, subjectCodes: v })}
          subjects={subjects}
        />
      )}
    </fieldset>
  );
}

function AggregateEditor({
  params,
  onChange,
  catalogue,
}: {
  params: Params;
  onChange: (params: Params) => void;
  catalogue: Catalogue;
}) {
  const components = Array.isArray(params.components) ? (params.components as Params[]) : [];
  const gradePoints = (
    params.gradePoints && typeof params.gradePoints === 'object' ? params.gradePoints : {}
  ) as Record<string, number>;
  const set = (key: string, value: unknown) => onChange(withParam(params, key, value));
  const setComponent = (index: number, component: Params) =>
    set(
      'components',
      components.map((c, i) => (i === index ? component : c)),
    );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberInput
          label="Maximum aggregate"
          hint="Lower is better: the student's aggregate must be this or lower."
          value={numberText(params.maxAggregate)}
          onChange={(v) => set('maxAggregate', toNumber(v))}
        />
        <Select
          label="This maximum is"
          value={string(params.basis) || 'requirement'}
          onChange={(v) => set('basis', v === 'requirement' ? undefined : v)}
          options={[
            ['requirement', 'A fixed requirement'],
            ['cutoff', 'A published cut-off (can change each year)'],
          ]}
        />
      </div>

      <fieldset className="space-y-3">
        <legend className="font-semibold">Subjects counted, in order</legend>
        <p className="text-sm">
          Each part counts the student’s best grades from its subjects. A subject counts only once,
          in the first part that uses it.
        </p>
        <ol className="space-y-3">
          {components.map((component, index) => (
            <li
              key={index}
              className="space-y-3 rounded-md border border-blue-100 bg-off-white p-3"
            >
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="w-40">
                  <NumberInput
                    label={`Part ${index + 1}: best how many`}
                    value={numberText(component.count)}
                    onChange={(v) =>
                      setComponent(index, withParam(component, 'count', toNumber(v)))
                    }
                  />
                </div>
                <Button
                  variant="secondary"
                  onClick={() =>
                    set(
                      'components',
                      components.filter((_, i) => i !== index),
                    )
                  }
                >
                  Remove part {index + 1}
                </Button>
              </div>
              <PoolEditor
                params={component}
                onChange={(c) => setComponent(index, c)}
                subjects={catalogue.subjects}
              />
            </li>
          ))}
        </ol>
        <Button
          variant="secondary"
          onClick={() => set('components', [...components, { count: 1, subjectCodes: [] }])}
        >
          Add a part
        </Button>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="font-semibold">Grade points (optional)</legend>
        <p className="text-sm">
          Only for institutions that score grades differently. Leave blank to use the standard
          points.
        </p>
        <div className="flex flex-wrap gap-3">
          {catalogue.grades
            .filter((g) => g.points !== null)
            .map((g) => (
              <div key={g.code} className="w-20">
                <NumberInput
                  label={g.code}
                  placeholder={String(g.points)}
                  value={numberText(gradePoints[g.code])}
                  onChange={(v) => set('gradePoints', withParam(gradePoints, g.code, toNumber(v)))}
                />
              </div>
            ))}
        </div>
      </fieldset>
    </div>
  );
}

// ---------- Small controls ----------

function SubjectListPicker({
  label,
  hint,
  optional,
  value,
  onChange,
  subjects,
}: {
  label: string;
  hint?: string;
  optional?: boolean;
  value: string[];
  onChange: (codes: string[]) => void;
  subjects: SubjectInfo[];
}) {
  const id = useId();
  const name = (code: string) =>
    subjects.find((s) => s.code === code)?.name ?? `Unknown subject ${code}`;
  const available = subjects.filter((s) => !value.includes(s.code));
  const group = (category: SubjectCategory) =>
    available
      .filter((s) => s.category === category)
      .map((s) => (
        <option key={s.code} value={s.code}>
          {s.name}
          {s.isActive ? '' : ' (inactive)'}
        </option>
      ));
  return (
    <div>
      <label htmlFor={id} className="mb-1 block font-semibold">
        {label}
        {optional && <span className="font-normal"> (optional)</span>}
      </label>
      {hint && <p className="mb-1 text-sm">{hint}</p>}
      {value.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-2" aria-label={`${label}: chosen`}>
          {value.map((code) => (
            <li
              key={code}
              className="inline-flex items-center gap-1 rounded-full border border-blue-300 bg-blue-50 py-0.5 pr-1 pl-3 text-sm"
            >
              {name(code)}
              <button
                type="button"
                onClick={() => onChange(value.filter((c) => c !== code))}
                className="rounded-full p-0.5 hover:bg-blue-100"
              >
                <X aria-hidden="true" className="size-4" />
                <span className="sr-only">Remove {name(code)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <select
        id={id}
        value=""
        onChange={(e) => e.target.value && onChange([...value, e.target.value])}
        className={inputClasses}
      >
        <option value="">{value.length ? 'Add another subject…' : 'Choose a subject…'}</option>
        <optgroup label="Core subjects">{group('core')}</optgroup>
        <optgroup label="Elective subjects">{group('elective')}</optgroup>
      </select>
    </div>
  );
}

function GradeSelect({
  label,
  value,
  onChange,
  grades,
}: {
  label: string;
  value: string;
  onChange: (code: string) => void;
  grades: GradeInfo[];
}) {
  return (
    <Select
      label={label}
      value={value}
      onChange={onChange}
      placeholder="Choose a grade"
      options={[...grades]
        .sort((a, b) => a.rank - b.rank)
        .map((g) => [g.code, `${g.code} or better`] as const)}
    />
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly (readonly [string, string])[];
  placeholder?: string;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1 block font-semibold">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputClasses}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </div>
  );
}

function NumberInput({
  label,
  hint,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1 block font-semibold">
        {label}
      </label>
      {hint && <p className="mb-1 text-sm">{hint}</p>}
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={inputClasses}
      />
    </div>
  );
}

function TextArea({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1 block font-semibold">
        {label}
      </label>
      {hint && <p className="mb-1 text-sm">{hint}</p>}
      <textarea
        id={id}
        rows={2}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputClasses}
      />
    </div>
  );
}
