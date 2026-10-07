import { ArrowRight, Award, BookOpen, ClipboardCheck, ShieldCheck, Users } from 'lucide-react';
import { Link } from 'react-router';
import { EligibilityDisclaimer } from '../components/Disclaimer';
import { ButtonLink } from '../components/ui/Button';
import { BRAND, pageTitle } from '../config/brand';
import { CHECK_ELIGIBILITY_PATH } from '../config/navigation';

const EXPLORE = [
  {
    to: '/programmes',
    Icon: BookOpen,
    title: 'Explore programmes',
    text: 'Search university programmes and see the admission requirements for each academic year.',
  },
  {
    to: '/scholarships',
    Icon: Award,
    title: 'Find scholarships',
    text: 'See scholarships that are open now or opening soon, with deadlines and official links.',
  },
  {
    to: '/mentors',
    Icon: Users,
    title: 'Talk to a mentor',
    text: 'Ask a mentor for one-on-one guidance on choosing and applying for programmes.',
  },
] as const;

const STEPS = [
  {
    title: 'Enter your WASSCE results',
    text: 'No account needed. Your results stay on your device.',
  },
  {
    title: 'See which programmes match',
    text: 'For each programme, see which requirements you meet and which you do not, and why.',
  },
  {
    title: 'Apply through the official website',
    text: 'Follow the link to the university’s own application page to apply.',
  },
] as const;

export function HomePage() {
  return (
    <>
      <title>{pageTitle()}</title>

      <section className="bg-blue-50">
        <div className="mx-auto max-w-6xl px-4 py-14 md:py-20">
          <h1 className="max-w-3xl text-3xl font-bold md:text-5xl">
            Find university programmes that match your WASSCE results
          </h1>
          <p className="mt-4 max-w-2xl text-lg">
            {BRAND.name} checks your results against each programme’s published admission
            requirements and explains every result, requirement by requirement.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink to={CHECK_ELIGIBILITY_PATH}>
              Check your eligibility <ArrowRight aria-hidden="true" className="size-5" />
            </ButtonLink>
            <ButtonLink to="/programmes" variant="secondary">
              Browse programmes
            </ButtonLink>
          </div>
          <div className="mt-8 max-w-2xl">
            <EligibilityDisclaimer />
          </div>
        </div>
      </section>

      <section aria-labelledby="explore-heading" className="mx-auto max-w-6xl px-4 py-14">
        <h2 id="explore-heading" className="text-2xl font-bold">
          What you can do
        </h2>
        <ul className="mt-6 grid gap-4 md:grid-cols-3">
          {EXPLORE.map(({ to, Icon, title, text }) => (
            <li key={to} className="rounded-lg border border-blue-100 bg-white p-6">
              <Icon aria-hidden="true" className="size-8 text-blue-700" />
              <h3 className="mt-3 text-lg font-semibold">
                <Link to={to}>{title}</Link>
              </h3>
              <p className="mt-2">{text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="how-heading" className="bg-off-white">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h2 id="how-heading" className="text-2xl font-bold">
            How it works
          </h2>
          <ol className="mt-6 grid gap-6 md:grid-cols-3">
            {STEPS.map(({ title, text }, i) => (
              <li key={title} className="flex gap-4">
                <span
                  aria-hidden="true"
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-700 font-bold text-white"
                >
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="mt-1">{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="trust-heading" className="mx-auto max-w-6xl px-4 py-14">
        <div className="flex flex-col gap-4 md:flex-row md:items-start">
          <ShieldCheck aria-hidden="true" className="size-10 shrink-0 text-green-700" />
          <div>
            <h2 id="trust-heading" className="text-2xl font-bold">
              Information you can check
            </h2>
            <ul className="mt-4 space-y-2">
              <li className="flex gap-2">
                <ClipboardCheck
                  aria-hidden="true"
                  className="mt-1 size-5 shrink-0 text-green-700"
                />
                Requirements are shown for a specific academic year.
              </li>
              <li className="flex gap-2">
                <ClipboardCheck
                  aria-hidden="true"
                  className="mt-1 size-5 shrink-0 text-green-700"
                />
                Each programme and scholarship shows when it was verified and links to its source.
              </li>
              <li className="flex gap-2">
                <ClipboardCheck
                  aria-hidden="true"
                  className="mt-1 size-5 shrink-0 text-green-700"
                />
                Spotted something wrong? Report it from the programme or scholarship page.
              </li>
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}
