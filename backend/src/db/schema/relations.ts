import { relations } from 'drizzle-orm';
import { mentorExpertise, mentorRequestStats, mentors } from './mentors';
import {
  programmeAdmissionCycles,
  programmes,
  requirementGroups,
  requirementRules,
} from './programmes';
import { scholarshipCycles, scholarshipRequirements, scholarships } from './scholarships';
import { facultySchools, universities } from './universities';
import { sources, verificationRecords } from './verification';

export const universitiesRelations = relations(universities, ({ many }) => ({
  facultySchools: many(facultySchools),
  programmes: many(programmes),
  scholarships: many(scholarships),
}));

export const facultySchoolsRelations = relations(facultySchools, ({ one, many }) => ({
  university: one(universities, {
    fields: [facultySchools.universityId],
    references: [universities.id],
  }),
  programmes: many(programmes),
}));

export const programmesRelations = relations(programmes, ({ one, many }) => ({
  university: one(universities, {
    fields: [programmes.universityId],
    references: [universities.id],
  }),
  facultySchool: one(facultySchools, {
    fields: [programmes.facultySchoolId],
    references: [facultySchools.id],
  }),
  admissionCycles: many(programmeAdmissionCycles),
}));

export const programmeAdmissionCyclesRelations = relations(
  programmeAdmissionCycles,
  ({ one, many }) => ({
    programme: one(programmes, {
      fields: [programmeAdmissionCycles.programmeId],
      references: [programmes.id],
    }),
    supersedes: one(programmeAdmissionCycles, {
      fields: [programmeAdmissionCycles.supersedesCycleId],
      references: [programmeAdmissionCycles.id],
      relationName: 'cycleVersions',
    }),
    supersededBy: many(programmeAdmissionCycles, { relationName: 'cycleVersions' }),
    requirementGroups: many(requirementGroups),
  }),
);

export const requirementGroupsRelations = relations(requirementGroups, ({ one, many }) => ({
  cycle: one(programmeAdmissionCycles, {
    fields: [requirementGroups.cycleId],
    references: [programmeAdmissionCycles.id],
  }),
  parent: one(requirementGroups, {
    fields: [requirementGroups.parentGroupId],
    references: [requirementGroups.id],
    relationName: 'groupTree',
  }),
  children: many(requirementGroups, { relationName: 'groupTree' }),
  rules: many(requirementRules),
}));

export const requirementRulesRelations = relations(requirementRules, ({ one }) => ({
  group: one(requirementGroups, {
    fields: [requirementRules.groupId],
    references: [requirementGroups.id],
  }),
}));

export const scholarshipsRelations = relations(scholarships, ({ one, many }) => ({
  university: one(universities, {
    fields: [scholarships.universityId],
    references: [universities.id],
  }),
  cycles: many(scholarshipCycles),
}));

export const scholarshipCyclesRelations = relations(scholarshipCycles, ({ one, many }) => ({
  scholarship: one(scholarships, {
    fields: [scholarshipCycles.scholarshipId],
    references: [scholarships.id],
  }),
  requirements: many(scholarshipRequirements),
}));

export const scholarshipRequirementsRelations = relations(scholarshipRequirements, ({ one }) => ({
  cycle: one(scholarshipCycles, {
    fields: [scholarshipRequirements.cycleId],
    references: [scholarshipCycles.id],
  }),
}));

export const sourcesRelations = relations(sources, ({ many }) => ({
  verificationRecords: many(verificationRecords),
}));

export const verificationRecordsRelations = relations(verificationRecords, ({ one }) => ({
  source: one(sources, {
    fields: [verificationRecords.sourceId],
    references: [sources.id],
  }),
}));

export const mentorsRelations = relations(mentors, ({ many }) => ({
  expertise: many(mentorExpertise),
  requestStats: many(mentorRequestStats),
}));

export const mentorExpertiseRelations = relations(mentorExpertise, ({ one }) => ({
  mentor: one(mentors, { fields: [mentorExpertise.mentorId], references: [mentors.id] }),
}));

export const mentorRequestStatsRelations = relations(mentorRequestStats, ({ one }) => ({
  mentor: one(mentors, { fields: [mentorRequestStats.mentorId], references: [mentors.id] }),
}));
