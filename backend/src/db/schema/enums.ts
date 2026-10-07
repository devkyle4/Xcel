import {
  DEGREE_TYPES,
  GHANA_REGIONS,
  INSTITUTION_TYPES,
  MENTOR_EXPERTISE_KINDS,
  MENTOR_STATUSES,
  PUBLISH_STATUSES,
  REPORT_STATUSES,
  REPORTABLE_ENTITY_TYPES,
  REQUIREMENT_OPERATORS,
  SCHOLARSHIP_STATUSES,
  STUDY_LEVELS,
  SUBJECT_CATEGORIES,
  USER_ROLES,
  VERIFIABLE_ENTITY_TYPES,
  VERIFICATION_STATUSES,
} from '@xcel/shared';
import { pgEnum } from 'drizzle-orm/pg-core';

export const publishStatus = pgEnum('publish_status', PUBLISH_STATUSES);
export const scholarshipStatus = pgEnum('scholarship_status', SCHOLARSHIP_STATUSES);
export const reportStatus = pgEnum('report_status', REPORT_STATUSES);
export const verificationStatus = pgEnum('verification_status', VERIFICATION_STATUSES);
export const userRole = pgEnum('user_role', USER_ROLES);
export const subjectCategory = pgEnum('subject_category', SUBJECT_CATEGORIES);
export const requirementOperator = pgEnum('requirement_operator', REQUIREMENT_OPERATORS);
export const institutionType = pgEnum('institution_type', INSTITUTION_TYPES);
export const degreeType = pgEnum('degree_type', DEGREE_TYPES);
export const studyLevel = pgEnum('study_level', STUDY_LEVELS);
export const ghanaRegion = pgEnum('ghana_region', GHANA_REGIONS);
export const mentorStatus = pgEnum('mentor_status', MENTOR_STATUSES);
export const mentorExpertiseKind = pgEnum('mentor_expertise_kind', MENTOR_EXPERTISE_KINDS);
export const verifiableEntityType = pgEnum('verifiable_entity_type', VERIFIABLE_ENTITY_TYPES);
export const reportableEntityType = pgEnum('reportable_entity_type', REPORTABLE_ENTITY_TYPES);
