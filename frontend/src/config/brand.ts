/** Platform name and copy used across the site. Change the name here only. */
export const BRAND = {
  name: 'Xcel',
  tagline: 'Find university programmes and scholarships that match your WASSCE results.',
} as const;

/** "Programmes – Xcel"; the homepage title is just the name and tagline. */
export const pageTitle = (page?: string) =>
  page ? `${page} – ${BRAND.name}` : `${BRAND.name} – ${BRAND.tagline}`;
