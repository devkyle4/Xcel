import { Link, useParams } from 'react-router';
import { ExternalLinkButton } from '../components/ExternalLinkButton';
import { LoadError, Loading } from '../components/LoadState';
import { PageContainer } from '../components/PageContainer';
import { ProviderLogo } from '../components/ProviderLogo';
import { ReportForm } from '../components/ReportForm';
import { AvailabilityBadge } from '../components/ui/AvailabilityBadge';
import { InfoPanel } from '../components/ui/InfoPanel';
import { VerificationLine } from '../components/VerificationLine';
import { useScholarship } from '../hooks/queries';
import { ApiRequestError } from '../lib/api';
import { deadlineText, OFFICIAL_LINK_LABELS } from '../lib/deadline';
import { formatDate, STUDY_LEVEL_LABELS } from '../lib/format';
import { NotFoundPage } from './NotFoundPage';

export function ScholarshipDetailPage() {
  const { slug = '' } = useParams();
  const scholarship = useScholarship(slug);

  if (scholarship.error instanceof ApiRequestError && scholarship.error.status === 404)
    return <NotFoundPage />;
  if (scholarship.isPending)
    return (
      <PageContainer title="Scholarship">
        <Loading />
      </PageContainer>
    );
  if (scholarship.error) {
    return (
      <PageContainer title="Scholarship">
        <LoadError onRetry={() => void scholarship.refetch()} />
      </PageContainer>
    );
  }

  const s = scholarship.data;
  const closed = s.availability === 'closed';
  const facts: [string, string | null][] = [
    ['Academic year', s.academicYear],
    ['Opens', s.opensOn && formatDate(s.opensOn)],
    ['Study level', s.studyLevels.map((l) => STUDY_LEVEL_LABELS[l]).join(', ') || null],
    ['Fields', s.fields.join(', ') || null],
    ['Location', s.location],
    ['Coverage', s.coverage],
  ];

  return (
    <PageContainer title={s.name}>
      <div className="-mt-2">
        <ProviderLogo src={s.logoUrl} name={s.providerName} size="lg" />
      </div>
      <p className="text-lg">
        Offered by{' '}
        {s.providerUrl ? (
          <a href={s.providerUrl} target="_blank" rel="noopener noreferrer">
            {s.providerName} <span className="sr-only">(opens in a new tab)</span>
          </a>
        ) : (
          s.providerName
        )}
        {s.university && (
          <>
            {' · '}
            <Link to={`/universities/${s.university.slug}`}>{s.university.name}</Link>
          </>
        )}
      </p>

      <div className="flex flex-wrap items-center gap-4">
        <AvailabilityBadge availability={s.availability} />
        {deadlineText(s) && (
          <p className={`font-semibold ${closed ? 'text-red-800' : ''}`}>{deadlineText(s)}</p>
        )}
      </div>

      {s.description && <p className="max-w-prose">{s.description}</p>}

      <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
        {facts
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <div key={label}>
              <dt className="text-sm font-semibold">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
      </dl>

      {(s.requirements.length > 0 || s.eligibilityCategories.length > 0) && (
        <section aria-labelledby="eligibility-heading" className="space-y-3">
          <h2 id="eligibility-heading" className="text-2xl font-bold">
            Eligibility
          </h2>
          {s.eligibilityCategories.length > 0 && <p>For: {s.eligibilityCategories.join(', ')}</p>}
          {s.requirements.length > 0 && (
            <ul className="list-disc space-y-1 pl-6">
              {s.requirements.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
        </section>
      )}

      <VerificationLine verification={s.verification} />

      {s.officialUrl && (
        <ExternalLinkButton href={s.officialUrl}>
          {OFFICIAL_LINK_LABELS[s.availability]}
        </ExternalLinkButton>
      )}

      <InfoPanel title="Important">
        Meeting the published eligibility criteria does not mean you will receive this scholarship.
        The provider makes the final decision. Always check the details on the official website.
      </InfoPanel>

      <ReportForm target={{ entityType: 'scholarship', slug: s.slug }} />
    </PageContainer>
  );
}
