import { InfoPanel } from './ui/InfoPanel';

/** Standard copy (CLAUDE.md "Copy rules"). Use wherever eligibility results are shown. */
export const ELIGIBILITY_DISCLAIMER =
  'Eligibility is based on the requirements stored on this platform. Final admission decisions are made by the institution.';

export const MENTORING_DISCLAIMER =
  'Mentors give guidance and information. They cannot guarantee admission or scholarship outcomes.';

export function EligibilityDisclaimer() {
  return <InfoPanel title="Important">{ELIGIBILITY_DISCLAIMER}</InfoPanel>;
}

export function MentoringDisclaimer() {
  return <InfoPanel title="About mentoring">{MENTORING_DISCLAIMER}</InfoPanel>;
}
