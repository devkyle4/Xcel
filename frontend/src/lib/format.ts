import type { DegreeType, GhanaRegion, InstitutionType, StudyLevel } from '@xcel/shared';

const dateFormat = new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeZone: 'UTC' });

/** "1 September 2026" from an ISO date or timestamp. */
export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso));
}

export const DEGREE_LABELS: Record<DegreeType, string> = {
  certificate: 'Certificate',
  diploma: 'Diploma',
  hnd: 'HND',
  bachelor: 'Bachelor’s degree',
};

export const REGION_LABELS: Record<GhanaRegion, string> = {
  ahafo: 'Ahafo',
  ashanti: 'Ashanti',
  bono: 'Bono',
  bono_east: 'Bono East',
  central: 'Central',
  eastern: 'Eastern',
  greater_accra: 'Greater Accra',
  north_east: 'North East',
  northern: 'Northern',
  oti: 'Oti',
  savannah: 'Savannah',
  upper_east: 'Upper East',
  upper_west: 'Upper West',
  volta: 'Volta',
  western: 'Western',
  western_north: 'Western North',
};

export const INSTITUTION_LABELS: Record<InstitutionType, string> = {
  public_university: 'Public university',
  private_university: 'Private university',
  technical_university: 'Technical university',
  college_of_education: 'College of education',
  nursing_and_midwifery_college: 'Nursing and midwifery college',
  other: 'Other institution',
};

export const STUDY_LEVEL_LABELS: Record<StudyLevel, string> = {
  certificate: 'Certificate',
  diploma: 'Diploma',
  undergraduate: 'Undergraduate',
  postgraduate: 'Postgraduate',
};
