# CLAUDE.md — SHS Graduate Programme & Scholarship Discovery Platform

Read this file at the start of every session. The full requirements live in
`docs/SRS.docx` (SHS Graduate Programme and Scholarship Platform SRS v1.1).
When this file and the SRS disagree, this file wins — it records later decisions.

## What we're building

A public web platform for Ghanaian SHS graduates to:

1. Enter WASSCE results (no account) and see which university programmes they
   appear eligible for, with a requirement-by-requirement explanation.
2. Browse programmes, universities and scholarships.
3. Book a one-on-one session with a verified mentor (no account).

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
Mentor, MentorExpertise, AvailabilitySlot, Booking.

- Publishing states: Draft → NeedsVerification → Verified → Published
  (plus Unpublished, Archived).
- Scholarship status: Draft, Published, Expired, Archived. Expire automatically
  from closing date; never show expired scholarships as open.
- UserReport status: Open, UnderReview, Resolved, Dismissed.
- Verification stores: source URL, source academic year, last verified date,
  verifier, status.
- Booking: unique reference, student name, email, topic, slot. A DB-level
  unique constraint must prevent double-booking a slot.

## API areas

```
/api/universities
/api/programmes
/api/programmes/{id}/eligibility
/api/eligibility/check
/api/scholarships
/api/subjects
/api/grades
/api/mentors
/api/mentors/{id}/availability
/api/bookings
/api/reports
/api/admin/*
/api/verification/*
```

## MVP scope

Public: homepage, results entry, eligibility check + explanations, programme
search and detail, university directory, scholarship search and detail,
mentor directory and booking, official links, academic-year display,
source/verification display, report-an-error.

Admin: login, dashboard, CRUD for universities, programmes, admission cycles,
subjects/grades, requirement rule builder, scholarships, mentors and
availability, bookings, verification management, publishing/archiving, audit log.

Out of scope: student accounts, saved items, university/provider accounts,
email/WhatsApp notifications (except booking confirmation), AI assistant,
payments, direct application submission, scraping.

## Navigation

Logo (links home) + 5 items, in this order:

1. Programmes
2. Universities
3. Scholarships
4. Find a Mentor
5. Check Eligibility — primary CTA, styled as a green button

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
| Primary CTA (Check Eligibility, Book session) | `--green-700`, hover `--green-800`, white text |
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

## Open questions (ask before implementing)

- Exact trigger for `LikelyEligible` vs `Eligible`.
- How many days before a record is flagged as stale.
- Retention period for booking names and emails.
- Email provider for booking confirmations.
- Single session length for MVP (30, 45 or 60 minutes).
