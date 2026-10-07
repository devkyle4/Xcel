import { ELIGIBILITY_DISCLAIMER, MENTORING_DISCLAIMER } from '../components/Disclaimer';
import { PageContainer } from '../components/PageContainer';
import { BRAND } from '../config/brand';

export function AboutPage() {
  return (
    <PageContainer
      title={`About ${BRAND.name}`}
      intro={`${BRAND.name} helps SHS graduates in Ghana understand which university programmes they may be eligible for, find scholarships, and get guidance from mentors.`}
    >
      <div className="max-w-prose space-y-4">
        <p>
          Admission requirements are spread across many university websites and brochures. We
          collect them in one place, record which academic year they apply to, and link to the
          official source so you can check them yourself.
        </p>
        <p>
          When you enter your WASSCE results, we show you which requirements you meet and which you
          do not, so you can make your own informed decisions. We suggest options to explore; we
          never claim to know which programme or career is best for you.
        </p>
        <p>You do not need an account, and we do not store your results.</p>
      </div>
    </PageContainer>
  );
}

export function DisclaimerPage() {
  return (
    <PageContainer title="Disclaimer">
      <div className="max-w-prose space-y-4">
        <p>{ELIGIBILITY_DISCLAIMER}</p>
        <p>
          We work to keep requirements, deadlines and scholarship details accurate, but they can
          change. Always confirm with the official institution or scholarship provider before you
          apply. Each page shows when its information was last verified and links to the source.
        </p>
        <p>
          Meeting a scholarship’s published eligibility criteria does not mean you will receive the
          award.
        </p>
        <p>{MENTORING_DISCLAIMER}</p>
      </div>
    </PageContainer>
  );
}

export function ContactPage() {
  return (
    <PageContainer title="Contact">
      <div className="max-w-prose space-y-4">
        {/* TODO: add the platform's contact details once decided. */}
        <p>Contact details will be added here.</p>
        <p>
          To report incorrect information, use the “Report incorrect information” link on the
          programme or scholarship page concerned.
        </p>
      </div>
    </PageContainer>
  );
}
