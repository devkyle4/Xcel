import type { EligibilityStatus, ProgrammeSummary } from '@xcel/shared';
import { Link } from 'react-router';
import { DEGREE_LABELS } from '../../lib/format';
import { StatusBadge } from '../ui/StatusBadge';

export function ProgrammeCard({
  programme,
  status,
}: {
  programme: Pick<
    ProgrammeSummary,
    'id' | 'name' | 'field' | 'degreeType' | 'university' | 'academicYear'
  >;
  /** The student's status, when they have entered results. */
  status?: EligibilityStatus;
}) {
  return (
    <article className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-blue-100 bg-white p-4">
      <div>
        <h3 className="text-lg font-semibold">
          <Link to={`/programmes/${programme.id}`}>{programme.name}</Link>
        </h3>
        <p>
          <Link to={`/universities/${programme.university.slug}`} className="text-blue-950">
            {programme.university.name}
          </Link>
        </p>
        <p className="text-sm">
          {[DEGREE_LABELS[programme.degreeType], programme.field].filter(Boolean).join(' · ')}
          {' · '}
          {programme.academicYear
            ? `${programme.academicYear} admission cycle`
            : 'Requirements not yet published'}
        </p>
      </div>
      {status && <StatusBadge status={status} />}
    </article>
  );
}
