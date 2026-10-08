import type {
  DegreeType,
  GhanaRegion,
  InstitutionType,
  StudyLevel,
  SubjectCategory,
} from '../domain';
import type { AcademicCatalogue, RequirementGroupNode } from '../eligibility';
import type { ScholarshipAvailability } from './scholarships';

// Response shapes of the public API. Dates are ISO strings.

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface ApiError {
  error: string;
  issues?: { path: string; message: string }[];
}

export interface SourceInfo {
  title: string;
  url: string | null;
  publisher: string | null;
  academicYear: string | null;
}

/** Shown as "Verified on {date}" with a source link. */
export interface VerificationInfo {
  verifiedAt: string;
  source: SourceInfo | null;
}

export interface SubjectInfo {
  code: string;
  name: string;
  category: SubjectCategory;
  aliases: string[];
  /** Inactive subjects are not offered for results entry but may still appear in requirements. */
  isActive: boolean;
}

export interface GradeInfo {
  code: string;
  label: string;
  rank: number;
  points: number | null;
  isPass: boolean;
}

export interface UniversityRef {
  slug: string;
  name: string;
  shortName: string | null;
  region: GhanaRegion | null;
  town: string | null;
}

export interface UniversitySummary extends UniversityRef {
  institutionType: InstitutionType;
  logoUrl: string | null;
}

export interface UniversityDetail extends UniversitySummary {
  description: string | null;
  websiteUrl: string | null;
  admissionsUrl: string | null;
  verification: VerificationInfo | null;
  programmes: ProgrammeSummary[];
  scholarships: ScholarshipSummary[];
}

export interface ProgrammeSummary {
  id: string;
  name: string;
  field: string | null;
  degreeType: DegreeType;
  durationYears: number | null;
  campus: string | null;
  university: UniversityRef;
  /** Latest published admission year, or null if requirements are not yet published. */
  academicYear: string | null;
}

export interface AdmissionCycleInfo {
  id: string;
  academicYear: string;
  version: number;
  applicationOpensOn: string | null;
  applicationDeadline: string | null;
  applicationUrl: string | null;
  notes: string | null;
  requirements: RequirementGroupNode | null;
  verification: VerificationInfo | null;
}

export interface ProgrammeDetail extends ProgrammeSummary {
  description: string | null;
  facultySchool: string | null;
  /** Published admission years, newest first. */
  availableYears: string[];
  /** The selected (default: latest) published cycle. */
  cycle: AdmissionCycleInfo | null;
}

export interface ScholarshipSummary {
  slug: string;
  name: string;
  providerName: string;
  studyLevels: StudyLevel[];
  fields: string[];
  eligibilityCategories: string[];
  location: string | null;
  coverage: string | null;
  academicYear: string | null;
  opensOn: string | null;
  closesOn: string | null;
  availability: ScholarshipAvailability;
}

export interface ScholarshipDetail extends ScholarshipSummary {
  description: string | null;
  providerUrl: string | null;
  applicationUrl: string | null;
  university: { slug: string; name: string } | null;
  requirements: string[];
  verification: VerificationInfo | null;
}

/**
 * Everything the browser needs to check eligibility locally: the grade and
 * subject catalogue and every published programme's current requirements.
 * Student results are never sent to the server.
 */
export interface EligibilityBundle {
  catalogue: AcademicCatalogue;
  programmes: EligibilityBundleProgramme[];
}

export interface EligibilityBundleProgramme {
  id: string;
  name: string;
  field: string | null;
  degreeType: DegreeType;
  university: UniversityRef;
  academicYear: string;
  cycleId: string;
  requirements: RequirementGroupNode | null;
}
