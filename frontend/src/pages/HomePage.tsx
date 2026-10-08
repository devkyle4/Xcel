import {
  indexCatalogue,
  type MentorSummary,
  type ScholarshipSummary,
  topicLabel,
} from '@xcel/shared';
import {
  ArrowRight,
  BadgeCheck,
  CircleCheck,
  CircleX,
  ClipboardCheck,
  GraduationCap,
  Info,
  Lock,
  Mail,
  Megaphone,
  ShieldCheck,
  Users,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { Link } from 'react-router';
import { ELIGIBILITY_DISCLAIMER, MENTORING_DISCLAIMER } from '../components/Disclaimer';
import { MentorAvatar } from '../components/mentors/MentorAvatar';
import { StatusBadge } from '../components/ui/StatusBadge';
import { BRAND, pageTitle } from '../config/brand';
import { CHECK_ELIGIBILITY_PATH } from '../config/navigation';
import { useEligibilityBundle, useMentorList, useScholarshipList } from '../hooks/queries';
import { formatDate, STUDY_LEVEL_LABELS } from '../lib/format';
import { summariseExample, type ExampleSummary } from '../lib/example-results';

const container = 'mx-auto max-w-6xl px-4 md:px-6';
const card = 'rounded-xl bg-white shadow-[0_1px_8px_rgba(11,31,77,0.08)]';

function Eyebrow({
  icon,
  children,
  tone = 'green',
}: {
  icon?: ReactNode;
  children: ReactNode;
  tone?: 'green' | 'blue';
}) {
  return (
    <p
      className={`inline-flex items-center gap-1.5 text-xs font-bold tracking-widest uppercase ${tone === 'green' ? 'text-green-800' : 'text-blue-900'}`}
    >
      {icon}
      {children}
    </p>
  );
}

function ArrowLink({
  to,
  children,
  className = 'text-blue-700',
}: {
  to: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      to={to}
      className={`inline-flex items-center gap-1.5 font-bold no-underline hover:underline ${className}`}
    >
      {children}
      <ArrowRight aria-hidden="true" className="size-4" />
    </Link>
  );
}

export function HomePage() {
  const bundle = useEligibilityBundle();
  const example = useMemo(
    () =>
      bundle.data ? summariseExample(bundle.data, indexCatalogue(bundle.data.catalogue)) : null,
    [bundle.data],
  );
  const scholarships = useScholarshipList({ availability: 'open,upcoming', pageSize: 4 });
  const mentors = useMentorList({ pageSize: 3 });

  return (
    <>
      <title>{pageTitle()}</title>
      <Hero example={example} />
      <Pillars
        example={example}
        scholarship={scholarships.data?.items[0]}
        mentor={mentors.data?.items[0]}
      />
      {scholarships.data && scholarships.data.items.length > 0 && (
        <FeaturedScholarships items={scholarships.data.items} total={scholarships.data.total} />
      )}
      {mentors.data && mentors.data.items.length > 0 && (
        <Mentors items={mentors.data.items} total={mentors.data.total} />
      )}
      <HowItWorks />
      <Trust />
    </>
  );
}

// ---------- Hero ----------

function Hero({ example }: { example: ExampleSummary | null }) {
  return (
    <section className="relative overflow-hidden bg-linear-to-b from-blue-50 via-off-white to-off-white py-12 md:py-16">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 -left-20 size-96 rounded-full bg-blue-100/60 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-40 -right-24 size-[28rem] rounded-full bg-green-100/50 blur-3xl"
      />
      <div className={`${container} relative grid items-center gap-10 lg:grid-cols-12`}>
        <div className="flex flex-col items-start gap-5 lg:col-span-7">
          {example?.academicYear && (
            <p className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-4 py-1.5 text-xs font-bold tracking-wider text-blue-900 uppercase shadow-sm">
              <BadgeCheck aria-hidden="true" className="size-4 text-blue-700" />
              {example.academicYear} admission requirements
            </p>
          )}
          <h1 className="text-3xl leading-tight font-extrabold tracking-tight md:text-5xl md:leading-[1.15]">
            Find your path from <span className="text-blue-700">SHS to university</span> and
            scholarships
          </h1>
          <p className="max-w-2xl text-lg text-blue-900">
            Enter your WASSCE grades to see which programmes you appear eligible for
            {example && example.universities.length > 0
              ? ` at ${joinNames(example.universities)}`
              : ''}
            , with a requirement-by-requirement explanation. Explore verified scholarships and ask a
            mentor for guidance: free, with no account.
          </p>
          <ul className="flex flex-wrap gap-3" aria-label="Highlights">
            {example && (
              <Chip icon={<CircleCheck aria-hidden="true" className="size-5 text-green-700" />}>
                {example.total} programmes with published requirements
              </Chip>
            )}
            <Chip icon={<ShieldCheck aria-hidden="true" className="size-5 text-green-700" />}>
              Your grades stay in your browser
            </Chip>
            <Chip icon={<GraduationCap aria-hidden="true" className="size-5 text-green-700" />}>
              Free, no account needed
            </Chip>
          </ul>
        </div>

        <div className="lg:col-span-5">
          <div className={`${card} flex flex-col gap-4 p-5 md:p-6`}>
            {example ? (
              <ExamplePreview example={example} />
            ) : (
              <div className="h-64" aria-hidden="true" />
            )}
            <Link
              to={CHECK_ELIGIBILITY_PATH}
              className="flex items-center justify-center gap-2 rounded-lg bg-green-700 py-3 font-bold text-white no-underline shadow-md hover:bg-green-800"
            >
              Check your eligibility <ArrowRight aria-hidden="true" className="size-5" />
            </Link>
            <p className="flex items-start justify-center gap-1.5 text-center text-xs text-blue-900">
              <Lock aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-blue-700" />
              Your grades stay in your browser. They are never saved or sent to our server.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Chip({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold shadow-sm">
      {icon}
      {children}
    </li>
  );
}

const joinNames = (names: string[]) =>
  names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;

/** A worked example: sample grades checked against the published requirements, live. */
function ExamplePreview({ example }: { example: ExampleSummary }) {
  const core = example.grades.filter((g) => g.core);
  const electives = example.grades.filter((g) => !g.core);
  return (
    <figure className="overflow-hidden rounded-xl border border-blue-100">
      <figcaption className="flex items-center gap-2 border-b border-blue-100 px-4 py-3 text-sm font-semibold">
        <span aria-hidden="true" className="size-2 rounded-full bg-green-700" />
        Example: checking these WASSCE grades
      </figcaption>
      <div className="space-y-3 p-4">
        {[
          ['Core subjects', core],
          ['Electives', electives],
        ].map(([label, list]) => (
          <div key={label as string}>
            <p className="mb-1.5 text-xs text-blue-900">{label as string}</p>
            <ul className="grid grid-cols-2 gap-2">
              {(list as ExampleSummary['grades']).map((g) => (
                <li
                  key={g.code}
                  className="flex items-center justify-between gap-2 rounded-lg border border-blue-100 bg-off-white px-2.5 py-1.5 text-sm leading-tight"
                >
                  <span>{g.name}</span>
                  <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-bold text-blue-900">
                    {g.grade}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <p className="flex items-start gap-2.5 rounded-lg border border-green-300 bg-green-50 p-3 text-green-900">
          <CircleCheck aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-green-700" />
          <span>
            <span className="block font-bold">
              Appear eligible for {example.matches} of {example.total} programmes
            </span>
            <span className="text-sm">Worked out from the published requirements</span>
          </span>
        </p>
      </div>
    </figure>
  );
}

// ---------- Pillars ----------

function Pillars({
  example,
  scholarship,
  mentor,
}: {
  example: ExampleSummary | null;
  scholarship?: ScholarshipSummary;
  mentor?: MentorSummary;
}) {
  return (
    <section aria-labelledby="pillars-heading" className="bg-off-white py-14 md:py-20">
      <div className={`${container} flex flex-col gap-10`}>
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div className="flex max-w-2xl flex-col gap-2">
            <Eyebrow>Before you apply</Eyebrow>
            <h2 id="pillars-heading" className="text-3xl font-bold tracking-tight md:text-4xl">
              Everything you need before buying application vouchers
            </h2>
            <p className="text-blue-900">
              Check the published requirements before you pay application fees, so you only apply
              where you meet them.
            </p>
          </div>
          {example?.academicYear && (
            <p className="flex items-center gap-1.5 font-semibold text-blue-900">
              <ShieldCheck aria-hidden="true" className="size-5" />
              Requirements for the {example.academicYear} admission cycle
            </p>
          )}
        </div>

        <ul className="grid gap-6 md:grid-cols-3">
          <Pillar
            icon={<ClipboardCheck aria-hidden="true" className="size-7" />}
            iconClass="bg-green-50 text-green-700"
            title="Check your eligibility"
            text="See where you meet the requirements before paying application fees, with a requirement-by-requirement explanation."
            link={
              <ArrowLink to={CHECK_ELIGIBILITY_PATH} className="text-green-800">
                Check eligibility
              </ArrowLink>
            }
          >
            {example?.featured && (
              <div className="space-y-1.5 rounded-lg bg-off-white p-3 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-bold">
                    {example.featured.name} ({example.featured.university})
                  </span>
                  <StatusBadge status={example.featured.status} />
                </div>
                <ul className="space-y-1">
                  {example.featured.rules.map((r) => (
                    <li key={r.text} className="flex gap-1.5">
                      {r.met ? (
                        <CircleCheck
                          aria-hidden="true"
                          className="size-3.5 shrink-0 text-green-700"
                        />
                      ) : (
                        <CircleX aria-hidden="true" className="size-3.5 shrink-0 text-red-600" />
                      )}
                      <span>
                        <span className="sr-only">{r.met ? 'Met: ' : 'Not met: '}</span>
                        {r.text}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="text-blue-900">With the example grades above</p>
              </div>
            )}
          </Pillar>

          <Pillar
            icon={<GraduationCap aria-hidden="true" className="size-7" />}
            iconClass="bg-blue-50 text-blue-900"
            title="Find verified scholarships"
            text="Scholarships for Ghanaian undergraduates and SHS leavers, each checked against the provider's official information."
            link={<ArrowLink to="/scholarships">Browse scholarships</ArrowLink>}
          >
            {scholarship && (
              <div className="space-y-1.5 rounded-lg bg-off-white p-3 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-bold">{scholarship.name}</span>
                  <AvailabilityPill availability={scholarship.availability} />
                </div>
                <p className="text-blue-900">{scholarship.providerName}</p>
                {scholarship.closesOn && (
                  <p className="font-semibold">Closes {formatDate(scholarship.closesOn)}</p>
                )}
              </div>
            )}
          </Pillar>

          <Pillar
            icon={<Users aria-hidden="true" className="size-7" />}
            iconClass="bg-blue-100 text-blue-950"
            title="Talk to a mentor"
            text="Send a mentor a session request. They contact you directly to arrange a time. No account needed."
            link={
              <ArrowLink to="/mentors" className="text-blue-900">
                Find a mentor
              </ArrowLink>
            }
          >
            {mentor && (
              <div className="space-y-2 rounded-lg bg-off-white p-3 text-xs">
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="flex size-7 items-center justify-center rounded-full bg-blue-900 text-[11px] font-bold text-white"
                  >
                    {initials(mentor.fullName)}
                  </span>
                  <span>
                    <span className="block font-bold">{mentor.fullName}</span>
                    {mentor.headline && <span className="text-blue-900">{mentor.headline}</span>}
                  </span>
                </div>
                <p className="rounded bg-blue-50 p-1.5 text-blue-900">
                  Your request is emailed to the mentor, who contacts you to arrange a session.
                </p>
              </div>
            )}
          </Pillar>
        </ul>
      </div>
    </section>
  );
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

function Pillar({
  icon,
  iconClass,
  title,
  text,
  link,
  children,
}: {
  icon: ReactNode;
  iconClass: string;
  title: string;
  text: string;
  link: ReactNode;
  children?: ReactNode;
}) {
  return (
    <li className={`${card} flex flex-col justify-between gap-5 p-6`}>
      <div className="flex flex-col gap-4">
        <span className={`flex size-12 items-center justify-center rounded-lg ${iconClass}`}>
          {icon}
        </span>
        <div className="space-y-1.5">
          <h3 className="text-xl font-bold">{title}</h3>
          <p className="text-sm text-blue-900">{text}</p>
        </div>
        {children}
      </div>
      {link}
    </li>
  );
}

function AvailabilityPill({ availability }: { availability: ScholarshipSummary['availability'] }) {
  if (availability !== 'open' && availability !== 'upcoming') return null;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${availability === 'open' ? 'bg-green-100 text-green-900' : 'bg-blue-100 text-blue-900'}`}
    >
      <span
        aria-hidden="true"
        className={`size-2 rounded-full ${availability === 'open' ? 'bg-green-700' : 'bg-blue-700'}`}
      />
      {availability === 'open' ? 'Open' : 'Opening soon'}
    </span>
  );
}

// ---------- Featured scholarships ----------

function FeaturedScholarships({ items, total }: { items: ScholarshipSummary[]; total: number }) {
  return (
    <section aria-labelledby="scholarships-heading" className="bg-off-white py-12">
      <div className={`${container} flex flex-col gap-8`}>
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div className="flex flex-col gap-2">
            <Eyebrow icon={<BadgeCheck aria-hidden="true" className="size-4" />}>
              Open and opening soon
            </Eyebrow>
            <h2 id="scholarships-heading" className="text-3xl font-bold tracking-tight md:text-4xl">
              Featured verified scholarships
            </h2>
            <p className="max-w-xl text-blue-900">
              Every scholarship listed here has been checked against the provider’s official
              information, with a link to apply on the official website.
            </p>
          </div>
          <ArrowLink to="/scholarships?availability=open,upcoming">
            View all {total} open {total === 1 ? 'scholarship' : 'scholarships'}
          </ArrowLink>
        </div>
        <ul className="grid gap-6 md:grid-cols-2">
          {items.map((s) => (
            <li key={s.slug} className={`${card} flex flex-col justify-between overflow-hidden`}>
              <div className="flex flex-col gap-3 p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="mb-1 w-fit rounded bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-900">
                      {s.providerName}
                    </p>
                    <h3 className="text-lg font-bold">{s.name}</h3>
                  </div>
                  <AvailabilityPill availability={s.availability} />
                </div>
                {s.coverage && <p className="text-sm text-blue-900">{s.coverage}</p>}
                <ul className="flex flex-wrap gap-2" aria-label="Details">
                  {[...s.studyLevels.map((l) => STUDY_LEVEL_LABELS[l]), s.location]
                    .filter(Boolean)
                    .map((label) => (
                      <li
                        key={label}
                        className="rounded bg-off-white px-2 py-1 text-xs font-medium"
                      >
                        {label}
                      </li>
                    ))}
                </ul>
              </div>
              <div className="flex items-center justify-between gap-3 bg-off-white px-6 py-4">
                <p className="text-xs">
                  {s.closesOn ? (
                    <>
                      Deadline: <strong>{formatDate(s.closesOn)}</strong>
                    </>
                  ) : s.availability === 'upcoming' && s.opensOn ? (
                    <>
                      Opens: <strong>{formatDate(s.opensOn)}</strong>
                    </>
                  ) : (
                    'Check the official website for dates'
                  )}
                </p>
                <Link
                  to={`/scholarships/${s.slug}`}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-blue-900 px-4 py-1.5 text-sm font-bold text-white no-underline shadow-sm hover:bg-blue-950"
                >
                  View requirements <span className="sr-only">for {s.name}</span>
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ---------- Mentors ----------

function Mentors({ items, total }: { items: MentorSummary[]; total: number }) {
  return (
    <section aria-labelledby="mentors-heading" className="bg-off-white py-14 md:py-20">
      <div className={`${container} flex flex-col gap-10`}>
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div className="flex max-w-2xl flex-col gap-2">
            <Eyebrow tone="blue" icon={<Users aria-hidden="true" className="size-4" />}>
              Guidance from people who have been there
            </Eyebrow>
            <h2 id="mentors-heading" className="text-3xl font-bold tracking-tight md:text-4xl">
              Talk to a mentor
            </h2>
            <p className="text-blue-900">
              Ask about choosing a programme, understanding requirements or applying for
              scholarships.
            </p>
          </div>
          <ArrowLink to="/mentors">
            See all {total} {total === 1 ? 'mentor' : 'mentors'}
          </ArrowLink>
        </div>
        <ul className="grid gap-6 md:grid-cols-3">
          {items.map((m) => (
            <li key={m.slug} className={`${card} flex flex-col justify-between gap-5 p-6`}>
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <MentorAvatar src={m.photoUrl} name={m.fullName} />
                  <div>
                    <h3 className="text-lg font-bold">{m.fullName}</h3>
                    {m.headline && (
                      <p className="text-sm font-semibold text-blue-900">{m.headline}</p>
                    )}
                  </div>
                </div>
                {m.topics.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-bold tracking-wider uppercase">Can help with</p>
                    <ul className="flex flex-wrap gap-1.5">
                      {m.topics.map((t) => (
                        <li
                          key={t}
                          className="rounded bg-off-white px-2 py-0.5 text-xs font-medium"
                        >
                          {topicLabel(t)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <Link
                to={`/mentors/${m.slug}`}
                className="flex items-center justify-center gap-2 rounded-lg bg-blue-900 py-2 font-bold text-white no-underline shadow-sm hover:bg-blue-950"
              >
                <Mail aria-hidden="true" className="size-5" /> Request a session{' '}
                <span className="sr-only">with {m.fullName}</span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="flex items-center gap-3 rounded-lg bg-blue-50 p-4 text-sm shadow-sm">
          <Info aria-hidden="true" className="size-5 shrink-0 text-blue-700" />
          <span>
            <strong>About mentoring:</strong> {MENTORING_DISCLAIMER}
          </span>
        </p>
      </div>
    </section>
  );
}

// ---------- How it works ----------

const STEPS = [
  {
    title: 'Enter your WASSCE grades',
    text: 'Choose your core subjects and electives and your grades. The check runs in your browser: your grades are never sent to our server.',
    note: 'No account needed',
    noteIcon: Lock,
    badge: 'bg-blue-950',
  },
  {
    title: 'See why, requirement by requirement',
    text: 'For each programme, see which requirements you meet and which you do not, your grade against the grade required, and any alternatives.',
    note: 'Plain-language explanations',
    noteIcon: ClipboardCheck,
    badge: 'bg-green-700',
  },
  {
    title: 'Apply, or ask a mentor first',
    text: 'Follow the link to apply on the institution’s official website, look for matching scholarships, or ask a mentor for guidance.',
    note: 'Final decisions rest with the institution',
    noteIcon: CircleCheck,
    badge: 'bg-blue-900',
  },
] as const;

function HowItWorks() {
  return (
    <section aria-labelledby="how-heading" className="bg-white py-14 md:py-20">
      <div className={`${container} flex flex-col gap-10`}>
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-2 text-center">
          <Eyebrow>How {BRAND.name} works</Eyebrow>
          <h2 id="how-heading" className="text-3xl font-bold tracking-tight md:text-4xl">
            Checked on your device. Explained clearly.
          </h2>
        </div>
        <ol className="grid gap-6 md:grid-cols-3">
          {STEPS.map(({ title, text, note, noteIcon: NoteIcon, badge }, i) => (
            <li key={title} className="flex flex-col gap-3 rounded-xl bg-off-white p-6 shadow-sm">
              <span
                aria-hidden="true"
                className={`flex size-10 items-center justify-center rounded-full text-lg font-bold text-white ${badge}`}
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className="text-lg font-bold">{title}</h3>
              <p className="text-sm text-blue-900">{text}</p>
              <p className="mt-auto flex items-center gap-1.5 pt-1 text-xs font-semibold text-green-800">
                <NoteIcon aria-hidden="true" className="size-4" />
                {note}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ---------- Trust ----------

function Trust() {
  return (
    <section aria-labelledby="trust-heading" className="bg-off-white py-12">
      <div className={`${container} flex flex-col gap-6`}>
        <div
          className={`${card} flex flex-col items-start justify-between gap-6 p-6 md:flex-row md:items-center md:p-8`}
        >
          <div className="flex max-w-3xl items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-900">
              <ShieldCheck aria-hidden="true" className="size-7" />
            </span>
            <div className="space-y-1.5">
              <h2 id="trust-heading" className="text-lg font-bold">
                Accurate, transparent and independent
              </h2>
              <p className="text-sm text-blue-900">
                Requirements and scholarships come from official sources, each showing when it was
                verified and a link to the source. {ELIGIBILITY_DISCLAIMER}
              </p>
            </div>
          </div>
          <Link
            to="/about"
            className="inline-flex w-full shrink-0 items-center justify-center gap-1.5 rounded-lg bg-off-white px-4 py-2.5 font-semibold text-blue-950 no-underline hover:bg-blue-50 md:w-auto"
          >
            How we check information <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>

        <div className="flex flex-col items-center justify-between gap-4 rounded-xl bg-blue-950 p-6 text-white shadow-md sm:flex-row">
          <div className="flex items-center gap-4">
            <Megaphone aria-hidden="true" className="size-7 shrink-0 text-green-300" />
            <div>
              <p className="font-bold">
                Spotted an updated cut-off point or an outdated scholarship?
              </p>
              <p className="text-sm text-blue-100">
                Use “Report incorrect information” at the bottom of any university, programme or
                scholarship page.
              </p>
            </div>
          </div>
          <Link
            to="/universities"
            className="shrink-0 rounded-lg bg-white px-4 py-2 font-bold text-blue-950 no-underline shadow-sm hover:bg-off-white"
          >
            Browse universities
          </Link>
        </div>
      </div>
    </section>
  );
}
