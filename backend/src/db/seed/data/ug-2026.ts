import type { RequirementGroupInput } from '@xcel/shared';
import {
  AGRICULTURE,
  all,
  any,
  anyElectives,
  atGrade,
  atLeast,
  credit,
  creditsFrom,
  cutoffAggregate,
  aggregateElectiveComponents,
  GENERAL_ARTS,
  HOME_ECONOMICS,
  type InstitutionDataset,
  type InstitutionProgramme,
  manual,
  type Node,
  type AggregateComponent,
} from './builders';

/**
 * University of Ghana undergraduate programmes for the 2026/2027 admission
 * cycle, from UG's official admissions website:
 * - Cut-offs: https://admissions.ug.edu.gh/undergraduate/cut-off
 *   ("Cut Off Points for 2026/2027 Undergraduate Admissions")
 * - Requirements: https://admissions.ug.edu.gh/undergraduate/entry-requirements
 *
 * The cut-off used is the regular (first-choice) figure. Where UG shows a
 * second figure in brackets, e.g. "7(8)", it is the second-choice cut-off:
 * the eligibility check uses the first-choice figure (the platform does not
 * know how a student ranks their choices) and the cycle notes give both,
 * with any fee-paying cut-off.
 * Distance-education programmes are not included.
 */

export const UG_CUTOFF_URL = 'https://admissions.ug.edu.gh/undergraduate/cut-off';
export const UG_REQUIREMENTS_URL = 'https://admissions.ug.edu.gh/undergraduate/entry-requirements';
export const UG_CHECKED_ON = '2026-10-08';

const CBAS = 'College of Basic and Applied Sciences';
const HEALTH = 'College of Health Sciences';
const EDUCATION = 'College of Education';
const HUMANITIES = 'College of Humanities';

/** Core credits named on each programme's entry requirements. */
const CORE_SCIENCE = ['ENGLISH', 'CORE_MATHS', 'INTEGRATED_SCIENCE'];
const CORE_ALL = ['ENGLISH', 'CORE_MATHS', 'INTEGRATED_SCIENCE', 'SOCIAL_STUDIES'];

/** UG aggregates: sciences count Integrated Science; other disciplines count Social Studies. */
type Discipline = 'science' | 'non-science';

interface UgProgramme {
  slug: string;
  name: string;
  faculty: string;
  field: string;
  campus?: string;
  discipline: Discipline;
  cutoff: number;
  /** Other published cut-offs: second choice (the bracketed figure), fee-paying, and any note. */
  published: { feePaying?: number; secondChoice?: number; note?: string };
  core: Node[];
  electives: Node[];
  /** Overrides how the three electives in the aggregate are chosen. */
  aggregateElectives?: AggregateComponent[];
  confirm?: string[];
}

const core = (subjects: string[], overrides: Node[] = []): Node[] => {
  const overridden = new Set(
    overrides.flatMap((n) =>
      n.kind === 'rule' ? ((n.params as { subjectCodes?: string[] }).subjectCodes ?? []) : [],
    ),
  );
  return [...subjects.filter((s) => !overridden.has(s)).map((s) => credit(s)), ...overrides];
};

const ugRequirements = (p: UgProgramme): RequirementGroupInput => {
  const third = p.discipline === 'science' ? 'INTEGRATED_SCIENCE' : 'SOCIAL_STUDIES';
  const electiveComponents =
    p.aggregateElectives ?? aggregateElectiveComponents(p.electives, CORE_ALL);
  return all([
    all(p.core, 'Core subjects'),
    all(p.electives, 'Elective subjects'),
    cutoffAggregate(p.cutoff, [
      { subjectCodes: ['ENGLISH'], count: 1 },
      { subjectCodes: ['CORE_MATHS'], count: 1 },
      { subjectCodes: [third], count: 1 },
      ...electiveComponents,
    ]),
    ...(p.confirm ?? []).map(manual),
  ]);
};

const notes = (p: UgProgramme) =>
  [
    `Cut-off ${p.cutoff} (first choice), published by UG for 2026/2027 admissions.`,
    p.published.feePaying !== undefined && `Fee-paying cut-off: ${p.published.feePaying}.`,
    p.published.secondChoice !== undefined && `Second-choice cut-off: ${p.published.secondChoice}.`,
    p.published.note,
  ]
    .filter(Boolean)
    .join(' ');

// ---------- Elective requirements ----------

const engineeringSciences = () => [
  credit('PHYSICS'),
  credit('CHEMISTRY'),
  atGrade('B3', 'ELECTIVE_MATHS'),
];
const electiveMathsB3PlusTwo = () => [atGrade('B3', 'ELECTIVE_MATHS'), anyElectives(2)];
const chemPhysBioOrMaths = () => [
  credit('CHEMISTRY'),
  credit('PHYSICS'),
  credit('BIOLOGY', 'ELECTIVE_MATHS'),
];
const medicine = () => [
  credit('CHEMISTRY'),
  creditsFrom(2, ['PHYSICS', 'BIOLOGY', 'ELECTIVE_MATHS']),
];
const SCIENCE_ELECTIVES = ['PHYSICS', 'CHEMISTRY', 'BIOLOGY', 'ELECTIVE_MATHS'];
/** Nursing and Midwifery accept any one of several elective combinations. */
const nursing = () => [
  any(
    [
      creditsFrom(3, SCIENCE_ELECTIVES),
      all([credit('GENERAL_AGRICULTURE'), credit('PHYSICS'), credit('CHEMISTRY')]),
      creditsFrom(3, GENERAL_ARTS),
      all([creditsFrom(2, GENERAL_ARTS), credit('FOOD_AND_NUTRITION')]),
      creditsFrom(3, [
        'ECONOMICS',
        'MANAGEMENT_IN_LIVING',
        'FOOD_AND_NUTRITION',
        'CHEMISTRY',
        'GKA',
        'FRENCH',
      ]),
    ],
    'Three electives from one of the accepted combinations',
  ),
];

const u = (
  slug: string,
  name: string,
  faculty: string,
  field: string,
  discipline: Discipline,
  cutoff: number,
  coreNodes: Node[],
  electives: Node[],
  extra: Partial<UgProgramme> = {},
): UgProgramme => ({
  slug,
  name,
  faculty,
  field,
  discipline,
  cutoff,
  published: {},
  core: coreNodes,
  electives,
  ...extra,
});

const PROGRAMMES: UgProgramme[] = [
  // College of Basic and Applied Sciences
  u(
    'bsc-agricultural-engineering',
    'BSc. Agricultural Engineering',
    CBAS,
    'Engineering',
    'science',
    16,
    core(CORE_SCIENCE),
    engineeringSciences(),
  ),
  u(
    'bsc-biomedical-engineering',
    'BSc. Biomedical Engineering',
    CBAS,
    'Engineering',
    'science',
    7,
    core(CORE_SCIENCE),
    engineeringSciences(),
    {
      published: { feePaying: 8 },
    },
  ),
  u(
    'bsc-computer-engineering',
    'BSc. Computer Engineering',
    CBAS,
    'Engineering',
    'science',
    7,
    core(CORE_SCIENCE),
    engineeringSciences(),
    {
      published: {
        note: 'UG lists 7(8) for this programme, but its guidelines say it can only be chosen as a first choice, so the bracketed figure is not a second-choice cut-off.',
      },
    },
  ),
  u(
    'bsc-food-process-engineering',
    'BSc. Food Process Engineering',
    CBAS,
    'Engineering',
    'science',
    14,
    core(CORE_SCIENCE),
    engineeringSciences(),
  ),
  u(
    'bsc-materials-science-and-engineering',
    'BSc. Materials Science and Engineering',
    CBAS,
    'Engineering',
    'science',
    14,
    core(CORE_SCIENCE),
    engineeringSciences(),
  ),
  u(
    'bsc-biological-sciences',
    'BSc. Biological Sciences',
    CBAS,
    'Sciences',
    'science',
    13,
    core(CORE_SCIENCE),
    [credit('CHEMISTRY'), credit('PHYSICS'), credit('BIOLOGY')],
    {
      published: { feePaying: 14 },
      aggregateElectives: [
        { subjectCodes: ['BIOLOGY'], count: 1 },
        { subjectCodes: ['CHEMISTRY'], count: 1 },
        { subjectCodes: ['PHYSICS', 'ELECTIVE_MATHS'], count: 1 },
      ],
    },
  ),
  u(
    'bsc-psychology',
    'BSc. Psychology',
    CBAS,
    'Social Sciences',
    'science',
    16,
    core(CORE_SCIENCE),
    [credit('BIOLOGY'), credit('ELECTIVE_MATHS'), credit('PHYSICS', 'CHEMISTRY')],
    {
      published: { feePaying: 18 },
      aggregateElectives: [
        { subjectCodes: ['BIOLOGY'], count: 1 },
        { subjectCodes: ['ELECTIVE_MATHS'], count: 1 },
        { subjectCodes: ['CHEMISTRY', 'PHYSICS'], count: 1 },
      ],
    },
  ),
  u(
    'doctor-of-veterinary-medicine',
    'Doctor of Veterinary Medicine',
    CBAS,
    'Health Sciences',
    'science',
    15,
    core(CORE_SCIENCE),
    [credit('BIOLOGY'), credit('CHEMISTRY'), credit('PHYSICS', 'ELECTIVE_MATHS')],
    {
      published: {
        feePaying: 20,
        note: 'UG lists 15(16) for this programme, but its guidelines say it can only be chosen as a first choice, so the bracketed figure is not a second-choice cut-off.',
      },
    },
  ),
  u(
    'bsc-actuarial-science',
    'BSc. Actuarial Science',
    CBAS,
    'Mathematical Sciences',
    'science',
    9,
    core(CORE_SCIENCE),
    electiveMathsB3PlusTwo(),
    {
      published: { feePaying: 10 },
    },
  ),
  u(
    'bsc-computer-science',
    'BSc. Computer Science',
    CBAS,
    'Computing',
    'science',
    7,
    core(CORE_SCIENCE),
    electiveMathsB3PlusTwo(),
    {
      published: { feePaying: 9, secondChoice: 8 },
    },
  ),
  u(
    'bsc-information-technology',
    'BSc. Information Technology',
    CBAS,
    'Computing',
    'science',
    8,
    core(CORE_SCIENCE, [atGrade('B3', 'CORE_MATHS')]),
    [anyElectives(3)],
    {
      published: {
        feePaying: 10,
        note: 'UG lists 8(9) for this programme, but its guidelines say it can only be chosen as a first choice, so the bracketed figure is not a second-choice cut-off.',
      },
    },
  ),
  u(
    'bsc-earth-science',
    'BSc. Earth Science',
    CBAS,
    'Sciences',
    'science',
    14,
    core(CORE_SCIENCE),
    [
      credit('CHEMISTRY'),
      atLeast(
        2,
        [credit('PHYSICS'), credit('BIOLOGY', 'GEOGRAPHY'), credit('ELECTIVE_MATHS')],
        'Any two of these',
      ),
    ],
    { published: { feePaying: 20, secondChoice: 16 } },
  ),
  u(
    'bsc-physical-sciences',
    'BSc. Physical Sciences',
    CBAS,
    'Sciences',
    'science',
    24,
    core(CORE_SCIENCE, [atGrade('B3', 'CORE_MATHS')]),
    [credit('PHYSICS'), credit('CHEMISTRY'), credit('ELECTIVE_MATHS')],
    { published: { feePaying: 24 } },
  ),
  u(
    'bsc-mathematical-sciences',
    'BSc. Mathematical Sciences',
    CBAS,
    'Mathematical Sciences',
    'science',
    15,
    core(CORE_ALL),
    electiveMathsB3PlusTwo(),
    {
      published: { feePaying: 20, secondChoice: 16 },
    },
  ),
  u('bsc-agriculture', 'BSc. Agriculture', CBAS, 'Agriculture', 'science', 20, core(CORE_SCIENCE), [
    credit('CHEMISTRY'),
    atLeast(
      2,
      [
        credit('PHYSICS'),
        credit('BIOLOGY', 'GENERAL_AGRICULTURE'),
        credit('GEOGRAPHY'),
        credit('ELECTIVE_MATHS'),
      ],
      'Any two of these',
    ),
  ]),
  u(
    'bsc-family-and-consumer-sciences-family-and-child-studies',
    'BSc. Family and Consumer Sciences (Family and Child Studies)',
    CBAS,
    'Home Economics',
    'science',
    16,
    core(CORE_SCIENCE),
    [
      credit('MANAGEMENT_IN_LIVING'),
      creditsFrom(2, [
        'FOOD_AND_NUTRITION',
        'CLOTHING_AND_TEXTILES',
        'GKA',
        'BIOLOGY',
        'CHEMISTRY',
      ]),
    ],
    {
      published: {
        note: 'Published as 16(24)M: UG gives affirmative action to male applicants for this option.',
      },
    },
  ),
  u(
    'bsc-family-and-consumer-sciences-food-and-clothing',
    'BSc. Family and Consumer Sciences (Food and Clothing)',
    CBAS,
    'Home Economics',
    'science',
    20,
    core(CORE_SCIENCE),
    [
      any([
        all(
          [
            credit('MANAGEMENT_IN_LIVING'),
            credit('CHEMISTRY'),
            credit('FOOD_AND_NUTRITION', 'CLOTHING_AND_TEXTILES'),
          ],
          'Home Science background',
        ),
        all([credit('CHEMISTRY'), anyElectives(2)], 'Science background'),
      ]),
    ],
    { published: { secondChoice: 24 } },
  ),

  // College of Health Sciences (first-choice programmes)
  u(
    'mbchb',
    'Bachelor of Medicine and Bachelor of Surgery (MBChB)',
    HEALTH,
    'Health Sciences',
    'science',
    7,
    core(CORE_ALL),
    medicine(),
  ),
  u(
    'bachelor-of-dental-surgery',
    'Bachelor of Dental Surgery',
    HEALTH,
    'Health Sciences',
    'science',
    9,
    core(CORE_ALL),
    medicine(),
  ),
  u(
    'doctor-of-pharmacy',
    'Doctor of Pharmacy',
    HEALTH,
    'Health Sciences',
    'science',
    10,
    [
      credit('ENGLISH'),
      credit('CORE_MATHS'),
      credit('INTEGRATED_SCIENCE'),
      atGrade('E8', 'SOCIAL_STUDIES'),
    ],
    [credit('BIOLOGY'), credit('CHEMISTRY'), credit('PHYSICS', 'ELECTIVE_MATHS')],
  ),
  u(
    'bsc-nursing',
    'BSc. Nursing',
    HEALTH,
    'Health Sciences',
    'science',
    15,
    core(CORE_ALL),
    nursing(),
  ),
  u(
    'bsc-midwifery',
    'BSc. Midwifery',
    HEALTH,
    'Health Sciences',
    'science',
    18,
    core(CORE_ALL),
    nursing(),
  ),
  u(
    'bsc-medical-laboratory-sciences',
    'BSc. Medical Laboratory Sciences',
    HEALTH,
    'Health Sciences',
    'science',
    12,
    core(CORE_ALL),
    chemPhysBioOrMaths(),
  ),
  u(
    'bsc-physiotherapy',
    'BSc. Physiotherapy',
    HEALTH,
    'Health Sciences',
    'science',
    15,
    core(CORE_ALL),
    chemPhysBioOrMaths(),
  ),
  u(
    'bsc-nutrition-and-dietetics',
    'BSc. Nutrition and Dietetics',
    HEALTH,
    'Health Sciences',
    'science',
    15,
    core(CORE_ALL),
    chemPhysBioOrMaths(),
  ),
  u(
    'bsc-diagnostic-radiography',
    'BSc. Diagnostic Radiography',
    HEALTH,
    'Health Sciences',
    'science',
    13,
    core(CORE_ALL),
    chemPhysBioOrMaths(),
  ),
  u(
    'bsc-occupational-therapy',
    'BSc. Occupational Therapy',
    HEALTH,
    'Health Sciences',
    'science',
    15,
    core(CORE_ALL),
    chemPhysBioOrMaths(),
  ),
  u(
    'bsc-respiratory-therapy',
    'BSc. Respiratory Therapy',
    HEALTH,
    'Health Sciences',
    'science',
    15,
    core(CORE_ALL),
    chemPhysBioOrMaths(),
  ),
  u(
    'bachelor-of-public-health',
    'Bachelor of Public Health',
    HEALTH,
    'Health Sciences',
    'science',
    9,
    core(CORE_ALL),
    [
      any(
        [
          creditsFrom(3, SCIENCE_ELECTIVES),
          creditsFrom(3, [...GENERAL_ARTS, ...AGRICULTURE, ...HOME_ECONOMICS]),
        ],
        'Science, or General Arts, Agricultural Science or Home Economics electives',
      ),
    ],
  ),

  // College of Education
  u(
    'bed-social-studies',
    'Bachelor of Education in Social Studies',
    EDUCATION,
    'Education',
    'non-science',
    24,
    core(CORE_ALL),
    [anyElectives(3)],
  ),
  u(
    'bed-english',
    'Bachelor of Education in English',
    EDUCATION,
    'Education',
    'non-science',
    24,
    core(CORE_ALL),
    [credit('LITERATURE_IN_ENGLISH'), anyElectives(2)],
  ),
  u(
    'bed-mathematics',
    'Bachelor of Education in Mathematics',
    EDUCATION,
    'Education',
    'science',
    24,
    core(CORE_ALL),
    [credit('ELECTIVE_MATHS'), anyElectives(2)],
  ),
  u(
    'bed-science-physics',
    'Bachelor of Education in Science (Physics)',
    EDUCATION,
    'Education',
    'science',
    24,
    core(CORE_ALL),
    [credit('PHYSICS'), creditsFrom(2, SCIENCE_ELECTIVES)],
  ),
  u(
    'bed-science-chemistry',
    'Bachelor of Education in Science (Chemistry)',
    EDUCATION,
    'Education',
    'science',
    24,
    core(CORE_ALL),
    [credit('CHEMISTRY'), creditsFrom(2, SCIENCE_ELECTIVES)],
  ),
  u(
    'bed-science-biology',
    'Bachelor of Education in Science (Biology)',
    EDUCATION,
    'Education',
    'science',
    24,
    core(CORE_ALL),
    [credit('BIOLOGY'), creditsFrom(2, SCIENCE_ELECTIVES)],
  ),
  u(
    'bed-early-grade-specialism',
    'Bachelor of Education (Early Grade Specialism)',
    EDUCATION,
    'Education',
    'non-science',
    24,
    core(CORE_ALL),
    [anyElectives(3)],
  ),
  u(
    'bed-jhs-specialism',
    'Bachelor of Education (JHS Specialism)',
    EDUCATION,
    'Education',
    'non-science',
    24,
    core(CORE_ALL),
    [anyElectives(3)],
  ),
  u(
    'bed-upper-grade-specialism',
    'Bachelor of Education (Upper Grade Specialism)',
    EDUCATION,
    'Education',
    'non-science',
    24,
    core(CORE_ALL),
    [anyElectives(3)],
  ),
  u(
    'bed-physical-education-and-health',
    'Bachelor of Education in Physical Education and Health',
    EDUCATION,
    'Education',
    'non-science',
    24,
    core(CORE_ALL),
    [anyElectives(3)],
  ),
  u(
    'bed-french',
    'Bachelor of Education in French',
    EDUCATION,
    'Education',
    'non-science',
    24,
    core(CORE_ALL),
    [credit('FRENCH'), anyElectives(2)],
  ),
  u(
    'bed-spanish',
    'Bachelor of Education in Spanish',
    EDUCATION,
    'Education',
    'non-science',
    24,
    core(CORE_ALL),
    [anyElectives(3)],
  ),
  u(
    'bed-performing-arts',
    'Bachelor of Education in Performing Arts (Music, Dance, Theatre Arts)',
    EDUCATION,
    'Education',
    'non-science',
    24,
    core(CORE_ALL),
    [anyElectives(3)],
  ),
  u(
    'bed-ict',
    'Bachelor of Education in Information and Communication Technology',
    EDUCATION,
    'Education',
    'science',
    11,
    core(CORE_ALL, [atGrade('C4', 'CORE_MATHS')]),
    [anyElectives(3)],
    { published: { feePaying: 14 } },
  ),
  u(
    'bed-consumer-sciences',
    'Bachelor of Education in Consumer Sciences',
    EDUCATION,
    'Education',
    'science',
    24,
    core(CORE_ALL),
    [credit('BIOLOGY', 'CHEMISTRY'), credit('MANAGEMENT_IN_LIVING'), anyElectives(1)],
  ),
  u(
    'bed-arabic',
    'Bachelor of Education in Arabic',
    EDUCATION,
    'Education',
    'non-science',
    24,
    core(CORE_ALL),
    [anyElectives(3)],
  ),
  u(
    'bed-computer-science',
    'Bachelor of Education in Computer Science',
    EDUCATION,
    'Education',
    'science',
    9,
    core(CORE_ALL, [atGrade('C4', 'CORE_MATHS')]),
    [
      atGrade('C4', 'ELECTIVE_MATHS'),
      creditsFrom(2, ['PHYSICS', 'CHEMISTRY', 'BIOLOGY', 'ELECTIVE_ICT']),
    ],
    { published: { feePaying: 12 } },
  ),
  u(
    'bsc-administration-kumasi-takoradi',
    'BSc. Administration (Kumasi and Takoradi City Campuses)',
    EDUCATION,
    'Business',
    'non-science',
    24,
    core(CORE_ALL),
    [anyElectives(3)],
    {
      campus: 'Kumasi and Takoradi City Campuses',
    },
  ),

  // College of Humanities
  u('llb', 'Bachelor of Laws (LLB)', HUMANITIES, 'Law', 'non-science', 6, core(CORE_ALL), [
    anyElectives(3),
  ]),
  u(
    'bsc-administration',
    'BSc. Administration',
    HUMANITIES,
    'Business',
    'non-science',
    9,
    core(CORE_ALL),
    [anyElectives(3)],
    {
      published: { feePaying: 11 },
    },
  ),
  u(
    'bachelor-of-arts',
    'Bachelor of Arts',
    HUMANITIES,
    'Humanities',
    'non-science',
    15,
    core(CORE_ALL),
    [anyElectives(3)],
    {
      published: {
        feePaying: 18,
        note: 'For applicants with a Business, Science or Vocational background: 15 as first choice, 18 as second choice.',
      },
    },
  ),
  u(
    'bachelor-of-arts-business-bouquets',
    'Bachelor of Arts (bouquets with a business subject)',
    HUMANITIES,
    'Business',
    'non-science',
    11,
    core(CORE_ALL),
    [anyElectives(3)],
    {
      published: { feePaying: 14 },
    },
  ),
  u(
    'bachelor-of-fine-arts',
    'Bachelor of Fine Arts',
    HUMANITIES,
    'Art and Design',
    'non-science',
    20,
    core(CORE_ALL),
    [anyElectives(3)],
    {
      published: { feePaying: 22 },
      confirm: ['Applicants are expected to attend an audition or interview'],
    },
  ),
  u(
    'bachelor-of-music',
    'Bachelor of Music',
    HUMANITIES,
    'Art and Design',
    'non-science',
    20,
    core(CORE_ALL),
    [anyElectives(3)],
    {
      published: { feePaying: 22 },
    },
  ),

  // Accra City Campus
  u(
    'bachelor-of-arts-accra-city-campus',
    'Bachelor of Arts (Accra City Campus)',
    HUMANITIES,
    'Humanities',
    'non-science',
    24,
    core(CORE_ALL),
    [anyElectives(3)],
    {
      campus: 'Accra City Campus',
    },
  ),
  u(
    'bsc-administration-accra-city-campus',
    'BSc. Administration (Accra City Campus)',
    HUMANITIES,
    'Business',
    'non-science',
    24,
    core(CORE_ALL),
    [anyElectives(3)],
    {
      campus: 'Accra City Campus',
    },
  ),
];

export const UG_PROGRAMMES = PROGRAMMES;

const UG_NOTE = `Checked against the University of Ghana's official admissions website (cut-off points for 2026/2027 and entry requirements) on ${UG_CHECKED_ON}.`;

export const UG: InstitutionDataset = {
  university: {
    slug: 'university-of-ghana',
    name: 'University of Ghana',
    shortName: 'UG',
    institutionType: 'public_university',
    region: 'greater_accra',
    town: 'Legon, Accra',
    description:
      'Public university at Legon, Accra, with city campuses in Accra, Kumasi and Takoradi. Applicants need credit passes (A1–C6) in the core subjects and three electives, with an aggregate of 24 or better; science programmes count Integrated Science in the aggregate and other programmes count Social Studies.',
    websiteUrl: 'https://www.ug.edu.gh',
    admissionsUrl: 'https://admissions.ug.edu.gh/',
  },
  source: {
    title: 'Cut Off Points for 2026/2027 Undergraduate Admissions',
    url: UG_CUTOFF_URL,
    publisher: 'University of Ghana Admissions',
  },
  academicYear: '2026/2027',
  checkedOn: UG_CHECKED_ON,
  applicationUrl: 'https://admissions.ug.edu.gh/',
  verificationNote: `${UG_NOTE} Entry requirements: ${UG_REQUIREMENTS_URL}`,
  programmes: PROGRAMMES.map((p): InstitutionProgramme => ({
    slug: p.slug,
    name: p.name,
    faculty: p.faculty,
    field: p.field,
    degreeType: 'bachelor',
    campus: p.campus ?? 'Legon',
    cutoff: p.cutoff,
    requirements: ugRequirements(p),
    notes: notes(p),
  })),
};
