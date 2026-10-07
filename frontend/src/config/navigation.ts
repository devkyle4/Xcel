/** SRS 11.4: after the logo, these four links, then the Check Eligibility button. */
export const NAV_LINKS = [
  { to: '/programmes', label: 'Programmes' },
  { to: '/universities', label: 'Universities' },
  { to: '/scholarships', label: 'Scholarships' },
  { to: '/mentors', label: 'Find a Mentor' },
] as const;

export const CHECK_ELIGIBILITY_PATH = '/check-eligibility';
