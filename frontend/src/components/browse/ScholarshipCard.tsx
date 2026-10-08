import type { ScholarshipSummary } from '@xcel/shared';
import { Link } from 'react-router';
import { deadlineText } from '../../lib/deadline';
import { AvailabilityBadge } from '../ui/AvailabilityBadge';

export function ScholarshipCard({ scholarship: s }: { scholarship: ScholarshipSummary }) {
  return (
    <article className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-blue-100 bg-white p-4">
      <div>
        <h3 className="text-lg font-semibold">
          <Link to={`/scholarships/${s.slug}`}>{s.name}</Link>
        </h3>
        <p>{s.providerName}</p>
        {deadlineText(s) && (
          <p
            className={`text-sm font-semibold ${s.availability === 'closed' ? 'text-red-800' : ''}`}
          >
            {deadlineText(s)}
          </p>
        )}
        {s.coverage && <p className="text-sm">{s.coverage}</p>}
      </div>
      <AvailabilityBadge availability={s.availability} />
    </article>
  );
}
