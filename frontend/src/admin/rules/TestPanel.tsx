import {
  type AcademicCatalogue,
  type CatalogueIndex,
  type EligibilityResult,
  evaluateEligibility,
} from '@xcel/shared';
import { Plus, Trash2 } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { RequirementList } from '../../components/eligibility/RequirementList';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { inputClasses } from '../components/fields';
import type { Catalogue } from './RuleParamsEditor';
import type { EditorGroup } from './tree';

interface Row {
  key: number;
  subject: string;
  grade: string;
}

let rowKey = 0;

/**
 * Tries the requirements being edited against sample WASSCE results, using
 * the same engine as students. Runs in the browser; nothing is saved or sent.
 */
export function TestPanel({
  tree,
  catalogue,
  academic,
  index,
}: {
  tree: EditorGroup | null;
  catalogue: Catalogue;
  academic: AcademicCatalogue;
  index: CatalogueIndex;
}) {
  const id = useId();
  const [rows, setRows] = useState<Row[]>(() =>
    catalogue.subjects
      .filter((s) => s.category === 'core' && s.isActive)
      .map((s) => ({ key: ++rowKey, subject: s.code, grade: '' })),
  );
  const grades = useMemo(
    () => [...catalogue.grades].sort((a, b) => a.rank - b.rank),
    [catalogue.grades],
  );
  const result: EligibilityResult | null = useMemo(() => {
    const results = Object.fromEntries(
      rows.filter((r) => r.subject && r.grade).map((r) => [r.subject, r.grade]),
    );
    try {
      return evaluateEligibility(tree, results, academic);
    } catch {
      return null;
    }
  }, [tree, rows, academic]);
  const update = (key: number, change: Partial<Row>) =>
    setRows(rows.map((r) => (r.key === key ? { ...r, ...change } : r)));
  const chosen = new Set(rows.map((r) => r.subject));

  return (
    <div className="space-y-4">
      <p className="text-sm">
        Sample results stay on this page. They are not saved or sent anywhere.
      </p>
      <table className="w-full max-w-xl text-left">
        <caption className="sr-only">Sample results</caption>
        <thead>
          <tr>
            <th scope="col" className="pb-1">
              Subject
            </th>
            <th scope="col" className="pb-1">
              Grade
            </th>
            <th scope="col">
              <span className="sr-only">Remove</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const subjectName =
              catalogue.subjects.find((s) => s.code === row.subject)?.name ?? `row ${i + 1}`;
            return (
              <tr key={row.key}>
                <td className="py-1 pr-2">
                  <label htmlFor={`${id}-s${row.key}`} className="sr-only">
                    Subject, row {i + 1}
                  </label>
                  <select
                    id={`${id}-s${row.key}`}
                    value={row.subject}
                    onChange={(e) => update(row.key, { subject: e.target.value })}
                    className={inputClasses}
                  >
                    <option value="">Choose a subject</option>
                    {catalogue.subjects
                      .filter((s) => s.code === row.subject || !chosen.has(s.code))
                      .map((s) => (
                        <option key={s.code} value={s.code}>
                          {s.name}
                        </option>
                      ))}
                  </select>
                </td>
                <td className="w-28 py-1 pr-2">
                  <label htmlFor={`${id}-g${row.key}`} className="sr-only">
                    Grade in {subjectName}
                  </label>
                  <select
                    id={`${id}-g${row.key}`}
                    value={row.grade}
                    onChange={(e) => update(row.key, { grade: e.target.value })}
                    className={inputClasses}
                  >
                    <option value="">—</option>
                    {grades.map((g) => (
                      <option key={g.code} value={g.code}>
                        {g.code}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="w-10 py-1">
                  <button
                    type="button"
                    onClick={() => setRows(rows.filter((r) => r.key !== row.key))}
                    className="rounded-md p-1.5 text-blue-700 hover:bg-blue-50"
                  >
                    <Trash2 aria-hidden="true" className="size-5" />
                    <span className="sr-only">Remove {subjectName}</span>
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <Button
        variant="secondary"
        onClick={() => setRows([...rows, { key: ++rowKey, subject: '', grade: '' }])}
      >
        <Plus aria-hidden="true" className="size-5" /> Add a subject
      </Button>

      <div aria-live="polite" className="space-y-3">
        {result && (
          <>
            <p className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">Result with these grades:</span>{' '}
              <StatusBadge status={result.status} />
            </p>
            {result.root && <RequirementList root={result.root} catalogue={index} showOutcomes />}
          </>
        )}
      </div>
    </div>
  );
}
