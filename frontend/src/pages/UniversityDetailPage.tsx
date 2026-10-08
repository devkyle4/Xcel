import { useParams } from 'react-router';
import { ScholarshipCard } from '../components/browse/ScholarshipCard';
import { ExternalLinkButton } from '../components/ExternalLinkButton';
import { LoadError, Loading } from '../components/LoadState';
import { PageContainer } from '../components/PageContainer';
import { ReportForm } from '../components/ReportForm';
import { VerificationLine } from '../components/VerificationLine';
import { useUniversity } from '../hooks/queries';
import { ApiRequestError } from '../lib/api';
import { INSTITUTION_LABELS, REGION_LABELS } from '../lib/format';
import { NotFoundPage } from './NotFoundPage';

export function UniversityDetailPage() {
  const { slug = '' } = useParams();
  const university = useUniversity(slug);

  if (university.error instanceof ApiRequestError && university.error.status === 404)
    return <NotFoundPage />;
  if (university.isPending)
    return (
      <PageContainer title="University">
        <Loading />
      </PageContainer>
    );
  if (university.error) {
    return (
      <PageContainer title="University">
        <LoadError onRetry={() => void university.refetch()} />
      </PageContainer>
    );
  }

  const u = university.data;
  const location = [u.town, u.region && `${REGION_LABELS[u.region]} Region`]
    .filter(Boolean)
    .join(', ');

  return (
    <PageContainer title={u.name}>
      <p className="-mt-4 text-lg">
        {[INSTITUTION_LABELS[u.institutionType], location].filter(Boolean).join(' · ')}
      </p>
      {u.description && <p className="max-w-prose">{u.description}</p>}
      <VerificationLine verification={u.verification} />
      {(u.websiteUrl || u.admissionsUrl) && (
        <div className="flex flex-wrap gap-3">
          {u.admissionsUrl && (
            <ExternalLinkButton href={u.admissionsUrl}>Admissions information</ExternalLinkButton>
          )}
          {u.websiteUrl && (
            <ExternalLinkButton href={u.websiteUrl}>Official website</ExternalLinkButton>
          )}
        </div>
      )}

      {u.scholarships.length > 0 && (
        <section aria-labelledby="scholarships-heading" className="space-y-3">
          <h2 id="scholarships-heading" className="text-2xl font-bold">
            Scholarships
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {u.scholarships.map((s) => (
              <li key={s.slug}>
                <ScholarshipCard scholarship={s} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <ReportForm target={{ entityType: 'university', slug: u.slug }} />
    </PageContainer>
  );
}
