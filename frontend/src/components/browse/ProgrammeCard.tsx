import type { EligibilityStatus, ProgrammeSummary } from '@xcel/shared';
import { Link } from 'react-router';
import { DEGREE_LABELS } from '../../lib/format';
import { StatusBadge } from '../ui/StatusBadge';

export function ProgrammeCard({
  programme,
  status,
  showUniversity = true,
  headingLevel = 3,
}: {
  programme: Pick<
    ProgrammeSummary,
    | 'id'
    | 'name'
    | 'field'
    | 'degreeType'
    | 'durationYears'
    | 'campus'
    | 'university'
    | 'academicYear'
  >;
  /** Off on a university's own page, where it would repeat the page title. */
  showUniversity?: boolean;
  /** 4 when listed under field headings. */
  headingLevel?: 3 | 4;
  /** The student's status, when they have entered results. */
  status?: EligibilityStatus;
}) {
  const Heading = headingLevel === 4 ? 'h4' : 'h3';
  return (
    <article className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-blue-100 bg-white p-4">
      <div>
        <Heading className="text-lg font-semibold">
          <Link to={`/programmes/${programme.id}`}>{programme.name}</Link>
        </Heading>
        {showUniversity && (
          <p>
            <Link to={`/universities/${programme.university.slug}`} className="text-blue-950">
              {programme.university.name}
            </Link>
          </p>
        )}
        <p className="text-sm">
          {[
            DEGREE_LABELS[programme.degreeType],
            programme.durationYears &&
              `${programme.durationYears} ${programme.durationYears === 1 ? 'year' : 'years'}`,
            showUniversity && programme.field,
            programme.campus,
          ]
            .filter(Boolean)
            .join(' · ')}
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
