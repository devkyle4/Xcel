import type {
  EligibilityBundle,
  GradeInfo,
  ProgrammeDetail,
  RequirementGroupNode,
  SubjectInfo,
} from '@xcel/shared';

const subject = (code: string, name: string, category: 'core' | 'elective'): SubjectInfo => ({
  code,
  name,
  category,
  aliases: [],
  isActive: true,
});

export const subjects: SubjectInfo[] = [
  subject('ENGLISH', 'English Language', 'core'),
  subject('CORE_MATHS', 'Core Mathematics', 'core'),
  subject('INTEGRATED_SCIENCE', 'Integrated Science', 'core'),
  subject('SOCIAL_STUDIES', 'Social Studies', 'core'),
  subject('BIOLOGY', 'Biology', 'elective'),
  subject('CHEMISTRY', 'Chemistry', 'elective'),
  subject('ELECTIVE_MATHS', 'Elective Mathematics', 'elective'),
  subject('PHYSICS', 'Physics', 'elective'),
];

export const grades: GradeInfo[] = ['A1', 'B2', 'B3', 'C4', 'C5', 'C6', 'D7', 'E8', 'F9'].map(
  (code, i) => ({
    code,
    label: ['Excellent', 'Very Good', 'Good', 'Credit', 'Credit', 'Credit', 'Pass', 'Pass', 'Fail'][
      i
    ]!,
    rank: i + 1,
    points: i + 1,
    isPass: code !== 'F9',
  }),
);

const rule = (id: string, ruleType: string, params: unknown) => ({
  kind: 'rule' as const,
  id,
  ruleType,
  params,
});
const all = (
  id: string,
  ...children: RequirementGroupNode['children'][number][]
): RequirementGroupNode => ({
  kind: 'group',
  id,
  operator: 'all',
  children,
});

export const engineeringRequirements = all(
  'g-eng',
  rule('r-eng-physics', 'subject_grade', { subjectCodes: ['PHYSICS'], minGrade: 'B3' }),
  rule('r-eng-maths', 'subject_grade', { subjectCodes: ['ELECTIVE_MATHS'], minGrade: 'C6' }),
);

const university = (slug: string, name: string) => ({
  slug,
  name,
  shortName: null,
  region: null,
  town: 'Kumasi',
});

export const bundle: EligibilityBundle = {
  catalogue: { subjects, grades },
  programmes: [
    {
      id: '11111111-1111-4111-8111-111111111111',
      name: 'BSc Computer Engineering',
      field: 'Engineering',
      degreeType: 'bachelor',
      university: university('knust', 'KNUST'),
      academicYear: '2026/2027',
      cycleId: 'c1',
      requirements: engineeringRequirements,
    },
    {
      id: '22222222-2222-4222-8222-222222222222',
      name: 'BSc Nursing',
      field: 'Health',
      degreeType: 'bachelor',
      university: university('ug', 'University of Ghana'),
      academicYear: '2026/2027',
      cycleId: 'c2',
      requirements: all(
        'g-nur',
        rule('r-nur-bio', 'subject_grade', { subjectCodes: ['BIOLOGY'], minGrade: 'C6' }),
        rule('r-nur-chem', 'subject_grade', { subjectCodes: ['CHEMISTRY'], minGrade: 'C6' }),
      ),
    },
    {
      id: '33333333-3333-4333-8333-333333333333',
      name: 'LLB Law',
      field: 'Law',
      degreeType: 'bachelor',
      university: university('ug', 'University of Ghana'),
      academicYear: '2026/2027',
      cycleId: 'c3',
      requirements: all(
        'g-law',
        rule('r-law-eng', 'subject_grade', { subjectCodes: ['ENGLISH'], minGrade: 'C6' }),
        rule('r-law-interview', 'manual_review', { description: 'Pass the entrance interview' }),
      ),
    },
  ],
};

/** English B3, Core Maths C4, Integrated Science C5, Social Studies B2, Physics C6, Elective Maths B3, Biology C4, Chemistry C5. */
export const studentResults = {
  ENGLISH: 'B3',
  CORE_MATHS: 'C4',
  INTEGRATED_SCIENCE: 'C5',
  SOCIAL_STUDIES: 'B2',
  PHYSICS: 'C6',
  ELECTIVE_MATHS: 'B3',
  BIOLOGY: 'C4',
  CHEMISTRY: 'C5',
};

export const programmeDetail: ProgrammeDetail = {
  id: bundle.programmes[0]!.id,
  name: 'BSc Computer Engineering',
  field: 'Engineering',
  degreeType: 'bachelor',
  durationYears: 4,
  campus: null,
  university: university('knust', 'KNUST'),
  academicYear: '2026/2027',
  description: 'Hardware and software engineering.',
  facultySchool: 'College of Engineering',
  availableYears: ['2026/2027', '2025/2026'],
  cycle: {
    id: 'c1',
    academicYear: '2026/2027',
    version: 1,
    applicationOpensOn: null,
    applicationDeadline: '2026-08-31',
    applicationUrl: 'https://apply.knust.example',
    notes: null,
    requirements: engineeringRequirements,
    verification: {
      verifiedAt: '2026-09-01T10:00:00.000Z',
      source: {
        title: 'KNUST Admission Brochure',
        url: 'https://knust.example/brochure',
        publisher: null,
        academicYear: '2026/2027',
      },
    },
  },
};

export const catalogueRoutes = { 'GET /api/subjects': subjects, 'GET /api/grades': grades };
