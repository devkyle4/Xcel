import { useParams } from 'react-router';
import { MentoringDisclaimer } from '../components/Disclaimer';
import { LoadError, Loading } from '../components/LoadState';
import { MentorAvatar } from '../components/mentors/MentorAvatar';
import { SessionRequestForm } from '../components/mentors/SessionRequestForm';
import { TopicChips } from '../components/mentors/TopicChips';
import { PageContainer } from '../components/PageContainer';
import { useMentor } from '../hooks/queries';
import { ApiRequestError } from '../lib/api';
import { NotFoundPage } from './NotFoundPage';

export function MentorProfilePage() {
  const { slug = '' } = useParams();
  const mentor = useMentor(slug);

  if (mentor.error instanceof ApiRequestError && mentor.error.status === 404)
    return <NotFoundPage />;
  if (mentor.isPending)
    return (
      <PageContainer title="Mentor">
        <Loading />
      </PageContainer>
    );
  if (mentor.error) {
    return (
      <PageContainer title="Mentor">
        <LoadError onRetry={() => void mentor.refetch()} />
      </PageContainer>
    );
  }

  const m = mentor.data;
  return (
    <PageContainer title={m.fullName}>
      <div className="-mt-2 flex flex-wrap items-center gap-4">
        <MentorAvatar src={m.photoUrl} name={m.fullName} size="lg" />
        {m.headline && <p className="text-lg">{m.headline}</p>}
      </div>

      <section aria-labelledby="guidance-heading" className="space-y-3">
        <h2 id="guidance-heading" className="text-xl font-bold">
          Can help with
        </h2>
        <TopicChips topics={m.topics} fields={[...m.fields, ...m.programmeAreas]} />
      </section>

      {m.bio && (
        <section aria-labelledby="about-heading" className="max-w-prose space-y-2">
          <h2 id="about-heading" className="text-xl font-bold">
            About
          </h2>
          <p className="whitespace-pre-line">{m.bio}</p>
        </section>
      )}
      {m.background && (
        <section aria-labelledby="background-heading" className="max-w-prose space-y-2">
          <h2 id="background-heading" className="text-xl font-bold">
            Academic and career background
          </h2>
          <p className="whitespace-pre-line">{m.background}</p>
        </section>
      )}

      <MentoringDisclaimer />

      <section
        aria-labelledby="request-heading"
        className="space-y-4 rounded-lg border border-blue-100 p-5"
      >
        <h2 id="request-heading" className="text-2xl font-bold">
          Request a session
        </h2>
        <SessionRequestForm mentorSlug={m.slug} mentorName={m.fullName} />
      </section>
    </PageContainer>
  );
}
