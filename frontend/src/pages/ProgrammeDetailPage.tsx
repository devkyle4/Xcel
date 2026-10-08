import { useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { EligibilityDisclaimer } from '../components/Disclaimer';
import { RequirementList } from '../components/eligibility/RequirementList';
import { LoadError, Loading } from '../components/LoadState';
import { PageContainer } from '../components/PageContainer';
import { ExternalLinkButton } from '../components/ExternalLinkButton';
import { ReportForm } from '../components/ReportForm';
import { VerificationLine } from '../components/VerificationLine';
import { ButtonLink } from '../components/ui/Button';
import { StatusBadge } from '../components/ui/StatusBadge';
import { CHECK_ELIGIBILITY_PATH } from '../config/navigation';
import { useCatalogue, useEligibilityBundle, useProgramme } from '../hooks/queries';
import { ApiRequestError } from '../lib/api';
import { alternatives, evaluate, evaluateBundle } from '../lib/eligibility';
import { DEGREE_LABELS, formatDate } from '../lib/format';
import { useStoredResults } from '../lib/results-store';
import { NotFoundPage } from './NotFoundPage';

const STATUS_SUMMARY = {
  Eligible: 'Your results appear to meet all of these requirements.',
  LikelyEligible:
    'Your results appear to meet the requirements that can be checked. Some need to be confirmed with the institution.',
  NeedsReview:
    'Some requirements could not be checked automatically. Check the official requirements.',
  NotEligible: 'Your results do not meet all of these requirements. See the details below.',
} as const;

/** "Other programmes to explore" when the student does not meet this programme's requirements. */
function Alternatives({ programmeId, field }: { programmeId: string; field: string | null }) {
  const results = useStoredResults();
  const bundle = useEligibilityBundle();
  const options = useMemo(
    () =>
      bundle.data && results
        ? alternatives(evaluateBundle(bundle.data, results), programmeId, field)
        : [],
    [bundle.data, results, programmeId, field],
  );
  if (options.length === 0) return null;
  return (
    <section aria-labelledby="alternatives-heading" className="rounded-lg bg-green-50 p-5">
      <h2 id="alternatives-heading" className="text-xl font-bold">
        Other programmes to explore
      </h2>
      <p className="mt-2">
        Your results appear to meet the published requirements for these programmes. They are
        options to explore, not recommendations.
      </p>
      <ul className="mt-4 space-y-3">
        {options.map(({ programme, result }) => (
          <li key={programme.id} className="flex flex-wrap items-center justify-between gap-2">
            <span>
              <Link to={`/programmes/${programme.id}`} className="font-semibold">
                {programme.name}
              </Link>{' '}
              · {programme.university.name}
            </span>
            <StatusBadge status={result.status} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ProgrammeDetailPage() {
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const year = params.get('year');
  const programme = useProgramme(id, year);
  const { catalogue, index } = useCatalogue();
  const results = useStoredResults();

  const cycle = programme.data?.cycle;
  const evaluation = useMemo(
    () =>
      cycle?.requirements && catalogue
        ? evaluate(cycle.requirements, results ?? {}, catalogue)
        : undefined,
    [cycle, catalogue, results],
  );

  if (programme.error instanceof ApiRequestError && programme.error.status === 404) {
    return <NotFoundPage />;
  }
  if (programme.isPending)
    return (
      <PageContainer title="Programme">
        <Loading />
      </PageContainer>
    );
  if (programme.error) {
    return (
      <PageContainer title="Programme">
        <LoadError onRetry={() => void programme.refetch()} />
      </PageContainer>
    );
  }

  const p = programme.data;
  const facts: [string, string | null][] = [
    ['Qualification', DEGREE_LABELS[p.degreeType]],
    ['Duration', p.durationYears ? `${p.durationYears} years` : null],
    ['Faculty or school', p.facultySchool],
    ['Campus', p.campus],
  ];

  return (
    <PageContainer title={p.name}>
      <p className="-mt-4 text-lg">
        <Link to={`/universities/${p.university.slug}`}>{p.university.name}</Link>
        {p.university.town && ` · ${p.university.town}`}
      </p>

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
      {p.description && <p className="max-w-prose">{p.description}</p>}

      <section
        aria-labelledby="requirements-heading"
        className="space-y-4 rounded-lg border border-blue-100 p-5"
      >
        {cycle ? (
          <>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 id="requirements-heading" className="text-2xl font-bold">
                Requirements for the {cycle.academicYear} admission cycle
              </h2>
              {p.availableYears.length > 1 && (
                <div>
                  <label htmlFor="year" className="mb-1 block text-sm font-semibold">
                    Admission year
                  </label>
                  <select
                    id="year"
                    value={cycle.academicYear}
                    onChange={(e) => {
                      const next = new URLSearchParams(params);
                      if (e.target.value === p.availableYears[0]) next.delete('year');
                      else next.set('year', e.target.value);
                      setParams(next, { replace: true });
                    }}
                    className="rounded-md border border-blue-300 bg-white p-2"
                  >
                    {p.availableYears.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <VerificationLine verification={cycle.verification} />

            {(cycle.applicationDeadline || cycle.applicationUrl) && (
              <div className="flex flex-wrap items-center gap-4">
                {cycle.applicationDeadline && (
                  <p className="font-semibold">
                    Application deadline: {formatDate(cycle.applicationDeadline)}
                  </p>
                )}
                {cycle.applicationUrl && (
                  <ExternalLinkButton href={cycle.applicationUrl}>
                    Apply on the official website
                  </ExternalLinkButton>
                )}
              </div>
            )}

            {results && evaluation && (
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge status={evaluation.status} />
                <p>{STATUS_SUMMARY[evaluation.status]}</p>
              </div>
            )}

            {evaluation?.root && index ? (
              <RequirementList
                root={evaluation.root}
                catalogue={index}
                showOutcomes={Boolean(results)}
              />
            ) : !cycle.requirements ? (
              <p>The requirements for this cycle have not been added yet.</p>
            ) : (
              <Loading />
            )}

            {!results && (
              <ButtonLink to={CHECK_ELIGIBILITY_PATH}>
                Check these requirements against your results
              </ButtonLink>
            )}
          </>
        ) : (
          <>
            <h2 id="requirements-heading" className="text-2xl font-bold">
              Admission requirements
            </h2>
            <p>Requirements for this programme have not been published yet.</p>
          </>
        )}
      </section>

      <EligibilityDisclaimer />

      {results && evaluation?.status === 'NotEligible' && (
        <Alternatives programmeId={p.id} field={p.field} />
      )}

      <ReportForm target={{ entityType: 'programme', entityId: p.id }} />
    </PageContainer>
  );
}
