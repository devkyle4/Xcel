import type { ScholarshipSummary } from '@xcel/shared';
import { ExternalLink } from 'lucide-react';
import { Link } from 'react-router';
import { deadlineText } from '../../lib/deadline';
import { ProviderLogo } from '../ProviderLogo';
import { AvailabilityBadge } from '../ui/AvailabilityBadge';

/** Scholarship card for the grid: logo, status, name, provider, deadline and official link. */
export function ScholarshipCard({ scholarship: s }: { scholarship: ScholarshipSummary }) {
  const deadline = deadlineText(s);
  return (
    <article className="flex h-full flex-col rounded-lg border border-blue-100 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <ProviderLogo src={s.logoUrl} name={s.providerName} />
        <AvailabilityBadge availability={s.availability} />
      </div>
      <h3 className="mt-4 text-lg leading-snug font-semibold">
        <Link to={`/scholarships/${s.slug}`}>{s.name}</Link>
      </h3>
      <p className="mt-1 text-sm">{s.providerName}</p>
      {deadline && (
        <p
          className={`mt-2 text-sm font-semibold ${s.availability === 'closed' ? 'text-red-800' : ''}`}
        >
          {deadline}
        </p>
      )}
      {s.coverage && <p className="mt-1 text-sm">{s.coverage}</p>}
      {s.officialUrl && (
        // Pushed to the bottom so links line up across the grid.
        <a
          href={s.officialUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-semibold"
        >
          {s.availability === 'open' ? 'Apply on the official website' : 'Official website'}
          <ExternalLink aria-hidden="true" className="size-4" />{' '}
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      )}
    </article>
  );
}
