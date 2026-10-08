/**
 * After the logo, these links, then the Check Eligibility button. Programmes
 * is not in the navbar (decided 2026-10-08); it is reached from the homepage
 * and eligibility results.
 */
export const NAV_LINKS = [
  { to: '/universities', label: 'Universities' },
  { to: '/scholarships', label: 'Scholarships' },
  { to: '/mentors', label: 'Find a Mentor' },
] as const;

export const CHECK_ELIGIBILITY_PATH = '/check-eligibility';
