import { type CatalogueIndex, describeRequirement, type RuleResult } from '@xcel/shared';
import { useId, useState } from 'react';
import { Link } from 'react-router';
import type { ProgrammeEvaluation } from '../../lib/eligibility';
import { StatusBadge } from '../ui/StatusBadge';
import { RequirementList } from './RequirementList';

const SUMMARY_PREFIX = {
  NotEligible: 'Not met',
  LikelyEligible: 'To confirm with the institution',
  NeedsReview: 'Could not be checked automatically',
} as const;

export function ProgrammeResultCard({
  evaluation,
  catalogue,
}: {
  evaluation: ProgrammeEvaluation;
  catalogue: CatalogueIndex;
}) {
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  const { programme, result } = evaluation;
  const causes = result.causes
    .filter((c): c is RuleResult => c.kind === 'rule')
    .map((c) => describeRequirement(c, catalogue));

  return (
    <article
      className={`rounded-lg border p-4 md:p-5 ${
        result.status === 'NotEligible' ? 'border-red-300 bg-red-50' : 'border-blue-100 bg-white'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">
            <Link to={`/programmes/${programme.id}`}>{programme.name}</Link>
          </h3>
          <p>
            {programme.university.name} · {programme.academicYear} admission cycle
          </p>
        </div>
        <StatusBadge status={result.status} />
      </div>

      {result.status !== 'Eligible' && causes.length > 0 && (
        <p className="mt-3">
          <span className="font-semibold">{SUMMARY_PREFIX[result.status]}:</span>{' '}
          {causes.slice(0, 2).join('; ')}
          {causes.length > 2 && ` and ${causes.length - 2} more`}
        </p>
      )}

      {result.root ? (
        <>
          <button
            type="button"
            className="mt-3 font-semibold text-blue-700 underline underline-offset-4"
            aria-expanded={open}
            aria-controls={detailsId}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? 'Hide details' : 'See why'}
          </button>
          {open && (
            <div id={detailsId} className="mt-3">
              <RequirementList root={result.root} catalogue={catalogue} showOutcomes />
            </div>
          )}
        </>
      ) : (
        <p className="mt-3">Requirements for this programme have not been published yet.</p>
      )}
    </article>
  );
}
