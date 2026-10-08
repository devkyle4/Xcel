# CLAUDE.md — SHS Graduate Programme & Scholarship Discovery Platform

Read this file at the start of every session. The full requirements live in
`docs/SRS.docx` (SRS v1.3).
When this file and the SRS disagree, this file wins — it records later decisions.

## What we're building

A public web platform for Ghanaian SHS graduates to:

1. Enter WASSCE results (no account) and see which university programmes they
   appear eligible for, with a requirement-by-requirement explanation.
2. Browse programmes, universities and scholarships.
3. Send a session request to a verified mentor by email (no account). The
   mentor contacts the student directly to arrange the session.

An administrator maintains all data. The platform never guarantees admission,
scholarship awards or mentoring outcomes — say so wherever results are shown.

Product principle: accuracy, transparency, simplicity, student agency. This is a
requirements-driven discovery system, not a directory.

## Tech stack

- Frontend: React + TypeScript
- Backend: API-based (separate from frontend)
- Database: PostgreSQL (use its full-text search for the MVP)
- Repo layout: separate `frontend/`, `backend/` and `shared/` (domain models/types)

Backend domains: auth/admin, universities, programmes, academic data
(subjects, grades), eligibility, scholarships, mentoring, search, verification, audit.

## Non-negotiable rules

- Admission rules are structured data in the database. Never hard-code
  requirements or grade ordering in frontend components.
- Requirements always belong to a `ProgrammeAdmissionCycle` (academic year).
  Never attach requirements directly to a programme.
- Updates create new versions; never silently overwrite history.
- Only `Published` records appear in public search.
- Every admin write is recorded in `AuditLog`.
- No storage of student data. WASSCE results stay in the browser for the
  current session only. Mentor session requests are emailed and then
  discarded, never written to the database or logs.
- Mentor email addresses are never sent to the browser.
- Admin authorization is enforced server-side, never only in the UI.
- Student results are never persisted permanently, logged, indexed or exposed.
  Temporary server-side sessions need non-guessable IDs and an expiry.
- Explanations are generated from structured rules, never free-text results.

## Eligibility engine

Outcome states: `Eligible`, `LikelyEligible`, `NotEligible`, `NeedsReview`.

Must support: AND, OR, nested groups, minimum grade, subject-specific rules.
Should support: "any N of" subject groups, equivalent/alternative subjects.

Grades use a configurable ordered model (e.g. "C6 or better"). Aggregate is
calculated only where rules require it; eligibility never depends on aggregate alone.

Every result must report: satisfied rules, unsatisfied rules, student grade vs.
required threshold, OR alternatives, and the specific rule(s) causing failure.
New rule types must be addable without migrating existing programme data.

Keep the engine a pure, well-tested module (no I/O). Write unit tests for every
rule type and for AND/OR combinations before wiring it to the API.

## Data model

User, University, FacultySchool, Programme, ProgrammeAdmissionCycle,
RequirementGroup, RequirementRule, Subject, Grade, Scholarship, ScholarshipCycle,
ScholarshipRequirement, Source, VerificationRecord, AuditLog, UserReport,
Mentor (incl. private contact email), MentorExpertise.

There is no Booking, AvailabilitySlot or student entity.

- Publishing states: Draft → NeedsVerification → Verified → Published
  (plus Unpublished, Archived).
- Scholarship status: Draft, Published, Expired, Archived. Expire automatically
  from closing date; never show expired scholarships as open.
- UserReport status: Open, UnderReview, Resolved, Dismissed.
- Verification stores: source URL, source academic year, last verified date,
  verifier, status.

## Mentor session requests

No calendar, slots or booking records. A student sends a message from the
mentor's profile; the backend emails it to the mentor and stores nothing.

| Field | Required | Rules |
|---|---|---|
| Full name | Yes | 2–100 chars |
| Phone | Yes | Valid Ghana mobile: `0XX XXX XXXX` or `+233 XX XXX XXXX`; normalise to +233 |
| Email | No | Valid format; used as reply-to |
| Topic | Yes | Dropdown of mentoring topics (SRS 21.2) |
| Message | Yes | Pre-filled default, editable, 1–1,000 chars |
| Disclaimer checkbox | Yes | Mentoring is guidance only |

Default message (re-fills when name/topic change, until the user edits it):

```
Hello [Mentor name],

My name is [Student name]. I recently completed SHS and I would like to book a
mentoring session with you on [topic].

Please contact me on the phone number below to arrange a convenient date and time.

Thank you.
```

Email to mentor:

```
Subject: Mentoring request from [Student name] – [Topic]

[message]

──────────────
Name:   [name]
Phone:  [phone]
Email:  [email or "Not provided"]
Topic:  [topic]
Sent via Xcel
```

- Reply-to = student email when provided.
- Send server-side only, never via `mailto:`.
- Protect `POST /api/mentors/{id}/request` with a CAPTCHA (e.g. Cloudflare
  Turnstile) and rate limiting (~5 per hour per IP).
- Deactivated mentors can't receive requests.
- Success: "Your message has been sent to [Mentor]. They'll contact you on [phone]."
- Failure: show an error and keep the form contents.

## API areas

```
/api/universities
/api/programmes
/api/eligibility/requirements
/api/scholarships
/api/subjects
/api/grades
/api/mentors
/api/mentors/{id}/request
/api/reports
/api/admin/*          (includes verification: /api/admin/verification)
```

Eligibility is checked in the browser (decided 2026-10-07): the browser downloads
the published requirements and catalogue from `/api/eligibility/requirements`
and runs the shared engine locally. No endpoint ever receives student results.

## MVP scope

Public: homepage, results entry, eligibility check + explanations, programme
search and detail, university directory, scholarship search and detail,
mentor directory and session request form, official links, academic-year display,
source/verification display, report-an-error.

Admin: login, dashboard, CRUD for universities, programmes, admission cycles,
subjects/grades, requirement rule builder, scholarships, mentors (incl.
private email), verification management, publishing/archiving, audit log.

Out of scope: student accounts, saved items, university/provider accounts,
SMS/WhatsApp/email notifications (except mentor request emails), online
session scheduling or calendars, storing student data, AI assistant,
payments, direct application submission, scraping.

## Navigation

Logo (links home) + 4 items, in this order:

1. Universities
2. Scholarships
3. Find a Mentor
4. Check Eligibility — primary CTA, styled as a green button

Programmes is not in the navbar (decided 2026-10-08); students reach
programmes through the homepage and eligibility results.

Admin login is not in the public nav (use `/admin`). About, disclaimer and
contact go in the footer. On mobile, collapse links into a menu but keep
"Check Eligibility" visible.

## Colour tokens

Palette is blue, green and white, with red reserved for negative outcomes.

```css
:root {
  --blue-50:  #EFF6FF;
  --blue-100: #DBEAFE;
  --blue-300: #93C5FD;
  --blue-500: #3B82F6;
  --blue-700: #1D4ED8;
  --blue-900: #1E3A8A;
  --blue-950: #0B1F4D;

  --green-50:  #F0FDF4;
  --green-100: #DCFCE7;
  --green-300: #86EFAC;
  --green-500: #22C55E;
  --green-700: #15803D;
  --green-800: #166534;
  --green-900: #14532D;

  --red-50:  #FEF2F2;
  --red-100: #FEE2E2;
  --red-300: #FCA5A5;
  --red-600: #DC2626;
  --red-700: #B91C1C;
  --red-800: #991B1B;

  --white:     #FFFFFF;
  --off-white: #F8FAFC;
}
```

| Role | Token |
|---|---|
| Navbar, footer, headings, body text | `--blue-950` |
| Links, secondary buttons, focus rings | `--blue-700` |
| Primary CTA (Check Eligibility, Send request) | `--green-700`, hover `--green-800`, white text |
| Info panels / section backgrounds | `--blue-50` or `--green-50` |
| Page and card backgrounds | `--white`, alternate sections `--off-white` |
| Errors, unmet requirements, expired/past deadlines | red scale |

Red is only for negative outcomes and errors — never decorative or for normal buttons.

## Eligibility status styles

| Status | Background | Text | Border | Icon |
|---|---|---|---|---|
| Eligible | `--green-100` | `--green-900` | — | ✓ check |
| Likely Eligible | `--green-50` | `--green-800` | `--green-300` | dashed check |
| Needs Review | `--blue-100` | `--blue-900` | — | ? help |
| Not Eligible | `--red-100` | `--red-800` | — | ✕ cross |

Strong variant of Not Eligible: `--red-700` background with white text.
If a status is clickable, label it ("See why") so it isn't mistaken for a
destructive action.

## Accessibility

- WCAG-aligned. White text only on `--green-700`+, `--blue-700`+, `--red-700`+.
  Never put text on green-500 or lighter greens.
- Colour is never the only signal: every status has an icon and a text label.
- All form controls labelled; full keyboard navigation; visible focus rings.
- Mobile-first: the eligibility flow must work well on small screens.

## Copy rules

- Plain language in all explanations.
- Show "Requirements for the {academic year} admission cycle" on programme pages.
- Show "Verified on {date}" + source link on programme and scholarship data.
- Standard disclaimer: eligibility is based on requirements stored on this
  platform; final admission decisions are made by the institution.
- Mentoring disclaimer: mentors give guidance, not guaranteed admission or
  scholarship outcomes.
- Alternative programmes are "options to explore", never "best for you".

## Decisions

- `LikelyEligible` (OI-01): every checkable requirement is met, but at least one
  needs a person to confirm it (`manual_review` rules). A definite failure gives
  `NotEligible`; a requirement that cannot be evaluated gives `NeedsReview`.
- Mentor verification (OI-04): none. The administrator adds mentors directly;
  mentors are `active`, `inactive` or `archived`.
- Email provider (OI-03): Resend, called from the backend. Without an API key
  (local development) emails go to an in-memory outbox and are never logged.
- CAPTCHA: Cloudflare Turnstile, verified server-side.
- Mentor email footer: "Sent via Xcel" (replaces "Sent via the SHS Discovery Platform").
- Mentor response time (OI-05): not shown to students.
- Platform name: Xcel.

## Open questions (ask before implementing)

- How many days before a record is flagged as stale (OI-02). Stored as the
  `stale_after_days` setting, provisionally 365.

## Build workflow (chunked)

Build in the milestones below, one at a time, in order. Do not start the next
milestone until I say so.

1. Scaffold: frontend, backend, shared package, local DB connection, lint/test setup
2. Database schema, migrations and seed data (subjects, grade ordering)
3. Eligibility engine as a pure module with full unit tests
4. Public API: universities, programmes, scholarships, eligibility check
5. Admin authentication, role-based authorization and audit logging
6a. Admin API: universities, faculties/schools, programmes, sources and verification
6b. Admin API: admission cycles, versioning and requirement rule builder
7. Admin API: scholarships, subjects/grades, publishing, user reports
8. Frontend foundation: design tokens, navbar, footer, homepage
9. Results entry, eligibility results and programme detail pages
10. Browse and search: programmes, universities, scholarships
11. Mentors: directory, profiles, session request form and email sending
12. Admin interface: login, dashboard, management screens, rule builder UI
13. Accessibility pass, final checks and deployment

At the end of every milestone:

- Run the tests and lint; fix failures before stopping.
- Stop and give me a short summary: what was built, files changed, how to try
  it, and anything left unfinished or decided on my behalf.
- Wait for my approval, then make ONE commit for the milestone using
  Conventional Commits, e.g. `feat(eligibility): add rule engine with AND/OR groups`.
- Do not push unless I ask.
- Never commit `.env` files, secrets or API keys. Check `.gitignore` before
  each commit.
- If a milestone grows too large, propose splitting it before starting.