// Domain vocabularies shared by the database schema, API validation and UI.
// Database enums are generated from these arrays, so they are the single source of truth.

export const PUBLISH_STATUSES = [
  'draft',
  'needs_verification',
  'verified',
  'published',
  'unpublished',
  'archived',
] as const;
export type PublishStatus = (typeof PUBLISH_STATUSES)[number];

export const SCHOLARSHIP_STATUSES = ['draft', 'published', 'expired', 'archived'] as const;
export type ScholarshipStatus = (typeof SCHOLARSHIP_STATUSES)[number];

export const REPORT_STATUSES = ['open', 'under_review', 'resolved', 'dismissed'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const VERIFICATION_STATUSES = ['pending', 'verified', 'rejected'] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const USER_ROLES = ['admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const SUBJECT_CATEGORIES = ['core', 'elective'] as const;
export type SubjectCategory = (typeof SUBJECT_CATEGORIES)[number];

/** How a requirement group combines its children: AND, OR, or "any N of". */
export const REQUIREMENT_OPERATORS = ['all', 'any', 'at_least'] as const;
export type RequirementOperator = (typeof REQUIREMENT_OPERATORS)[number];

export const INSTITUTION_TYPES = [
  'public_university',
  'private_university',
  'technical_university',
  'college_of_education',
  'nursing_and_midwifery_college',
  'other',
] as const;
export type InstitutionType = (typeof INSTITUTION_TYPES)[number];

export const DEGREE_TYPES = ['certificate', 'diploma', 'hnd', 'bachelor'] as const;
export type DegreeType = (typeof DEGREE_TYPES)[number];

export const STUDY_LEVELS = ['certificate', 'diploma', 'undergraduate', 'postgraduate'] as const;
export type StudyLevel = (typeof STUDY_LEVELS)[number];

export const GHANA_REGIONS = [
  'ahafo',
  'ashanti',
  'bono',
  'bono_east',
  'central',
  'eastern',
  'greater_accra',
  'north_east',
  'northern',
  'oti',
  'savannah',
  'upper_east',
  'upper_west',
  'volta',
  'western',
  'western_north',
] as const;
export type GhanaRegion = (typeof GHANA_REGIONS)[number];

export const MENTOR_STATUSES = ['active', 'inactive', 'archived'] as const;
export type MentorStatus = (typeof MENTOR_STATUSES)[number];

export const MENTOR_EXPERTISE_KINDS = ['topic', 'field', 'programme_area'] as const;
export type MentorExpertiseKind = (typeof MENTOR_EXPERTISE_KINDS)[number];

/** Mentoring topics (SRS 21.2). */
export const MENTORING_TOPICS = [
  { code: 'choosing_programme', label: 'Choosing a university programme' },
  { code: 'wassce_requirements', label: 'Understanding WASSCE results and programme requirements' },
  { code: 'academic_career_options', label: 'Exploring academic and career options' },
  { code: 'comparing_programmes', label: 'Comparing programmes' },
  { code: 'application_guidance', label: 'University application guidance' },
  { code: 'scholarship_guidance', label: 'Scholarship guidance' },
  { code: 'general_guidance', label: 'General university guidance' },
] as const;
export type MentoringTopicCode = (typeof MENTORING_TOPICS)[number]['code'];

/** Records that carry source/verification history. */
export const VERIFIABLE_ENTITY_TYPES = [
  'university',
  'programme_admission_cycle',
  'scholarship_cycle',
] as const;
export type VerifiableEntityType = (typeof VERIFIABLE_ENTITY_TYPES)[number];

/** Records the public can report as incorrect. */
export const REPORTABLE_ENTITY_TYPES = ['university', 'programme', 'scholarship'] as const;
export type ReportableEntityType = (typeof REPORTABLE_ENTITY_TYPES)[number];

/** Academic years are written as "2026/2027". */
export const ACADEMIC_YEAR_PATTERN = /^(\d{4})\/(\d{4})$/;

export function isValidAcademicYear(value: string): boolean {
  const match = ACADEMIC_YEAR_PATTERN.exec(value);
  return match !== null && Number(match[2]) === Number(match[1]) + 1;
}

/** Keys of admin-editable platform settings stored in the database. */
export const SETTING_KEYS = {
  /** Days after verification before a record is flagged as stale (OI-02, provisional). */
  staleAfterDays: 'stale_after_days',
} as const;
