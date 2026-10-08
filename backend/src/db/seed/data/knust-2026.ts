import type { DegreeType, RequirementGroupInput } from '@xcel/shared';
import {
  AKAN,
  all,
  any,
  anyElectives,
  atGrade,
  BUSINESS,
  credit,
  creditsFrom,
  cutoffAggregate,
  aggregateElectiveComponents,
  GENERAL_ARTS,
  GHANAIAN_LANGUAGES,
  HOME_ECONOMICS,
  type InstitutionDataset,
  manual,
  type Node,
  SCIENCE,
  TECHNICAL,
  VISUAL_ARTS,
  without,
} from './builders';

/**
 * KNUST undergraduate programmes for the 2026/2027 admission cycle, from the
 * official "Entry Requirements and Guidelines for Selecting an Undergraduate
 * Programme" (Academic Affairs Division, April 2026):
 * https://webapps.knust.edu.gh/check/forms/Admission_Requirement.pdf
 *
 * - Requirements: WASSCE entry requirements for each programme.
 * - Cut-offs: the guide's "Cut-off Aggregates", which KNUST publishes from
 *   the previous admissions (2024/2025) as a guide; they change every year.
 * - KNUST scores A1=1, B2=2, B3=3 and C4, C5, C6 all as 4.
 *
 * Subjects the guide accepts that are not in the WASSCE subject catalogue
 * (e.g. Engineering Science, Business Mathematics and the new SHS
 * curriculum's technical subjects) are left out of the alternatives.
 */

export const KNUST_GUIDE_URL = 'https://webapps.knust.edu.gh/check/forms/Admission_Requirement.pdf';
export const KNUST_CHECKED_ON = '2026-10-08';

// ---------- Elective requirements shared by several programmes ----------

const bioChemPhysOrMaths = (biology: string[] = ['BIOLOGY']) => [
  credit(...biology),
  credit('CHEMISTRY'),
  credit('PHYSICS', 'ELECTIVE_MATHS'),
];

/** Engineering: Physics, Elective Mathematics, and Chemistry or an accepted alternative. */
const engineering = (
  alternatives: string[] = [],
  integratedScienceB3WithoutChemistry = false,
): Node[] => {
  const third: Node =
    alternatives.length === 0
      ? credit('CHEMISTRY')
      : integratedScienceB3WithoutChemistry
        ? any(
            [
              credit('CHEMISTRY'),
              all(
                [credit(...alternatives), atGrade('B3', 'INTEGRATED_SCIENCE')],
                'Without Chemistry',
              ),
            ],
            'Chemistry, or an accepted alternative with B3 or better in Integrated Science',
          )
        : credit('CHEMISTRY', ...alternatives);
  return [credit('PHYSICS'), credit('ELECTIVE_MATHS'), third];
};

const MECHANICAL_ALTERNATIVES = [
  'METALWORK',
  'AUTO_MECHANICS',
  'APPLIED_ELECTRICITY',
  'TECHNICAL_DRAWING',
  'BUILDING_CONSTRUCTION',
  'WOODWORK',
];

const healthSciences = (biology: string[] = ['BIOLOGY']) => bioChemPhysOrMaths(biology);

const agriculturalScience = () => [
  credit('CHEMISTRY'),
  credit('PHYSICS', 'ELECTIVE_MATHS'),
  credit('BIOLOGY', 'GENERAL_AGRICULTURE'),
];

const buildingTechnology = () => [
  credit('ELECTIVE_MATHS'),
  creditsFrom(2, [
    'TECHNICAL_DRAWING',
    'WOODWORK',
    'BUILDING_CONSTRUCTION',
    'METALWORK',
    'CHEMISTRY',
    'PHYSICS',
    'ECONOMICS',
    'GEOGRAPHY',
  ]),
];

const landEconomy = () => [
  any([
    all([
      credit('ECONOMICS'),
      credit('GEOGRAPHY'),
      creditsFrom(1, [
        'FINANCIAL_ACCOUNTING',
        'BUSINESS_MANAGEMENT',
        'GOVERNMENT',
        'FRENCH',
        'LITERATURE_IN_ENGLISH',
        'HISTORY',
        'BUILDING_CONSTRUCTION',
        'TECHNICAL_DRAWING',
        'ELECTIVE_MATHS',
      ]),
    ]),
    all([
      credit('ECONOMICS'),
      creditsFrom(2, [
        'ELECTIVE_MATHS',
        'GEOGRAPHY',
        'FINANCIAL_ACCOUNTING',
        'BUSINESS_MANAGEMENT',
        'GOVERNMENT',
        'FRENCH',
        'BUILDING_CONSTRUCTION',
        'TECHNICAL_DRAWING',
        'GKA',
      ]),
    ]),
  ]),
];

const businessSchool = (withHomeEconomics: boolean) => [
  creditsFrom(3, [
    ...BUSINESS,
    ...GENERAL_ARTS,
    ...SCIENCE,
    ...(withHomeEconomics ? HOME_ECONOMICS : []),
  ]),
];

// ---------- Programmes ----------

export interface KnustProgramme {
  slug: string;
  name: string;
  faculty: string;
  field: string;
  degreeType: DegreeType;
  campus: string;
  /** Cut-off aggregate from the 2026 guide. */
  cutoff: number;
  /** Elective and other programme-specific requirements (core subjects are added for all). */
  electives: Node[];
  /** Social Studies is also a required core credit (History, Political Studies, Sociology, Social Work). */
  socialStudies?: boolean;
  /** Steps the platform cannot check, such as interviews. */
  confirm?: string[];
}

const p = (
  slug: string,
  name: string,
  faculty: string,
  field: string,
  cutoff: number,
  electives: Node[],
  extra: Partial<KnustProgramme> = {},
): KnustProgramme => ({
  slug,
  name,
  faculty,
  field,
  degreeType: 'bachelor',
  campus: 'Kumasi',
  cutoff,
  electives,
  ...extra,
});

const AGRIC = 'Faculty of Agriculture';
const NRM = 'Faculty of Natural Resource Management';
const BUILT = 'Faculty of Built Environment';
const ART = 'Faculty of Art';
const EDU = 'Faculty of Educational Studies';
const ENG = 'College of Engineering';
const HEALTH = 'College of Health Sciences';
const SOCIAL = 'Faculty of Social Sciences';
const LAW = 'Faculty of Law';
const KSB = 'KNUST School of Business';
const BIO = 'Faculty of Biosciences';
const PHYS = 'Faculty of Physical and Computational Sciences';

const MAIN: KnustProgramme[] = [
  // College of Agriculture and Natural Resources
  p('bsc-agriculture', 'BSc. Agriculture', AGRIC, 'Agriculture', 20, [
    credit('CHEMISTRY'),
    creditsFrom(2, [
      'PHYSICS',
      'ELECTIVE_MATHS',
      'BIOLOGY',
      'GENERAL_AGRICULTURE',
      'ANIMAL_HUSBANDRY',
      'CROP_HUSBANDRY',
    ]),
  ]),
  p('bsc-agricultural-biotechnology', 'BSc. Agricultural Biotechnology', AGRIC, 'Agriculture', 17, [
    credit('CHEMISTRY'),
    creditsFrom(2, [
      'PHYSICS',
      'ELECTIVE_MATHS',
      'BIOLOGY',
      'GENERAL_AGRICULTURE',
      'ANIMAL_HUSBANDRY',
      'CROP_HUSBANDRY',
    ]),
  ]),
  p('bsc-agribusiness-management', 'BSc. Agribusiness Management', AGRIC, 'Agriculture', 15, [
    any([
      all(
        [
          credit('CHEMISTRY'),
          credit('PHYSICS', 'ELECTIVE_MATHS'),
          credit('BIOLOGY', 'GENERAL_AGRICULTURE'),
        ],
        'Science',
      ),
      all(
        [
          creditsFrom(3, [
            'ECONOMICS',
            'FINANCIAL_ACCOUNTING',
            'BUSINESS_MANAGEMENT',
            'COST_ACCOUNTING',
            'ELECTIVE_MATHS',
          ]),
          atGrade('B3', 'INTEGRATED_SCIENCE'),
        ],
        'Business, with B3 or better in Integrated Science',
      ),
      all(
        [
          credit('ECONOMICS'),
          credit('GEOGRAPHY'),
          credit('ELECTIVE_MATHS'),
          atGrade('B3', 'INTEGRATED_SCIENCE'),
        ],
        'General Arts, with B3 or better in Integrated Science',
      ),
      all(
        [
          credit('CHEMISTRY'),
          credit('PHYSICS', 'ELECTIVE_MATHS'),
          credit('BIOLOGY', 'GENERAL_AGRICULTURE', 'CROP_HUSBANDRY'),
        ],
        'General Agriculture',
      ),
    ]),
  ]),
  p(
    'bsc-landscape-design-and-management',
    'BSc. Landscape Design and Management',
    AGRIC,
    'Agriculture',
    17,
    [
      any([
        all(
          [
            credit('CHEMISTRY'),
            credit('PHYSICS', 'ELECTIVE_MATHS', 'CROP_HUSBANDRY'),
            credit('BIOLOGY', 'GENERAL_AGRICULTURE'),
          ],
          'Science',
        ),
        all(
          [
            creditsFrom(3, [
              'ELECTIVE_MATHS',
              'GEOGRAPHY',
              'ECONOMICS',
              'TECHNICAL_DRAWING',
              'GKA',
            ]),
          ],
          'General Arts',
        ),
        all(
          [creditsFrom(3, ['GKA', 'GRAPHIC_DESIGN', 'CHEMISTRY', 'PICTURE_MAKING', 'SCULPTURE'])],
          'Visual Art',
        ),
      ]),
    ],
  ),
  p(
    'bsc-natural-resources-management',
    'BSc. Natural Resources Management',
    NRM,
    'Agriculture',
    18,
    agriculturalScience(),
  ),
  p(
    'bsc-forest-resources-technology',
    'BSc. Forest Resources Technology',
    NRM,
    'Agriculture',
    24,
    agriculturalScience(),
  ),
  p(
    'bsc-aquaculture-and-water-resources-management',
    'BSc. Aquaculture and Water Resources Management',
    NRM,
    'Agriculture',
    20,
    agriculturalScience(),
  ),
  p('bsc-packaging-technology', 'BSc. Packaging Technology', NRM, 'Agriculture', 15, [
    creditsFrom(3, [...SCIENCE, ...GENERAL_ARTS, ...VISUAL_ARTS, ...TECHNICAL, ...HOME_ECONOMICS]),
  ]),

  // College of Art and Built Environment
  p('bsc-architecture', 'BSc. Architecture', BUILT, 'Built Environment', 7, [
    credit('ELECTIVE_MATHS'),
    creditsFrom(2, [
      'TECHNICAL_DRAWING',
      'WOODWORK',
      'METALWORK',
      'BUILDING_CONSTRUCTION',
      'CHEMISTRY',
      'PHYSICS',
      'BIOLOGY',
      'GKA',
      'GRAPHIC_DESIGN',
      'PICTURE_MAKING',
      'ECONOMICS',
      'GEOGRAPHY',
    ]),
  ]),
  p(
    'bsc-construction-technology-and-management',
    'BSc. Construction Technology and Management',
    BUILT,
    'Built Environment',
    9,
    buildingTechnology(),
  ),
  p(
    'bsc-quantity-surveying-and-construction-economics',
    'BSc. Quantity Surveying and Construction Economics',
    BUILT,
    'Built Environment',
    9,
    buildingTechnology(),
  ),
  p('bsc-development-planning', 'BSc. Development Planning', BUILT, 'Built Environment', 9, [
    creditsFrom(3, [
      'GEOGRAPHY',
      'ECONOMICS',
      'GOVERNMENT',
      'HISTORY',
      'ELECTIVE_MATHS',
      'GKA',
      'BUSINESS_MANAGEMENT',
      'FINANCIAL_ACCOUNTING',
      'COST_ACCOUNTING',
    ]),
  ]),
  p(
    'bsc-human-settlement-planning',
    'BSc. Human Settlement Planning',
    BUILT,
    'Built Environment',
    10,
    [
      credit('GEOGRAPHY'),
      any([
        creditsFrom(2, [
          'ECONOMICS',
          'BUSINESS_MANAGEMENT',
          'GOVERNMENT',
          'ELECTIVE_MATHS',
          'FINANCIAL_ACCOUNTING',
          'COST_ACCOUNTING',
          'GRAPHIC_DESIGN',
        ]),
        all([
          creditsFrom(1, [
            'ECONOMICS',
            'BUSINESS_MANAGEMENT',
            'GOVERNMENT',
            'ELECTIVE_MATHS',
            'FINANCIAL_ACCOUNTING',
            'COST_ACCOUNTING',
            'GRAPHIC_DESIGN',
          ]),
          creditsFrom(1, [
            'TECHNICAL_DRAWING',
            'PICTURE_MAKING',
            'SCULPTURE',
            'PHYSICS',
            'HISTORY',
            'BUILDING_CONSTRUCTION',
            'WOODWORK',
            'METALWORK',
            'GKA',
          ]),
        ]),
      ]),
    ],
  ),
  p('bsc-land-economy', 'BSc. Land Economy', BUILT, 'Built Environment', 8, landEconomy()),
  p('bsc-real-estate', 'BSc. Real Estate', BUILT, 'Built Environment', 9, landEconomy()),
  p(
    'bfa-fine-art-and-curatorial-practice',
    'BFA. Fine Art and Curatorial Practice',
    ART,
    'Art and Design',
    16,
    [
      credit('GKA'),
      any(
        [
          creditsFrom(2, without(VISUAL_ARTS, 'GKA')),
          creditsFrom(2, without(HOME_ECONOMICS, 'GKA')),
          creditsFrom(2, TECHNICAL),
          creditsFrom(2, SCIENCE),
          creditsFrom(2, GENERAL_ARTS),
          creditsFrom(2, BUSINESS),
        ],
        'Two more electives from one programme (Visual Art, Home Economics, Technical, Science, General Arts or Business)',
      ),
    ],
  ),
  p(
    'ba-communication-design',
    'BA. Communication Design (Graphic Design)',
    ART,
    'Art and Design',
    11,
    [
      credit('GRAPHIC_DESIGN'),
      credit('GKA'),
      credit('ELECTIVE_ICT'),
      creditsFrom(1, ['PICTURE_MAKING', 'CERAMICS', 'SCULPTURE', 'TEXTILES', 'JEWELLERY']),
    ],
  ),
  p(
    'ba-integrated-rural-art-and-industry',
    'BA. Integrated Rural Art and Industry',
    ART,
    'Art and Design',
    15,
    [
      creditsFrom(3, [
        'PICTURE_MAKING',
        'LEATHERWORK',
        'GRAPHIC_DESIGN',
        'TEXTILES',
        'JEWELLERY',
        'BASKETRY',
        'SCULPTURE',
        'CERAMICS',
        'GKA',
        'MANAGEMENT_IN_LIVING',
        'CLOTHING_AND_TEXTILES',
        'FOOD_AND_NUTRITION',
        'PHYSICS',
        'CHEMISTRY',
        'ELECTIVE_MATHS',
        'BIOLOGY',
        'CRS',
        'IRS',
        'BUILDING_CONSTRUCTION',
        'ECONOMICS',
        'HISTORY',
        ...AKAN,
        'GEOGRAPHY',
        'LITERATURE_IN_ENGLISH',
        'BUSINESS_MANAGEMENT',
        'FINANCIAL_ACCOUNTING',
        'COST_ACCOUNTING',
        'ELECTIVE_ICT',
      ]),
    ],
  ),
  p('ba-publishing-studies', 'BA. Publishing Studies', ART, 'Art and Design', 12, [
    any([
      all(
        [
          credit('GKA'),
          credit('PICTURE_MAKING', 'GRAPHIC_DESIGN'),
          credit('TEXTILES', 'SCULPTURE', 'LEATHERWORK'),
        ],
        'Visual Arts',
      ),
      all(
        [
          creditsFrom(3, [
            'GEOGRAPHY',
            'ECONOMICS',
            'GOVERNMENT',
            'LITERATURE_IN_ENGLISH',
            'HISTORY',
            'CRS',
            'IRS',
            'FRENCH',
            ...GHANAIAN_LANGUAGES,
          ]),
        ],
        'General Arts',
      ),
      all(
        [
          creditsFrom(3, [
            'ECONOMICS',
            'FINANCIAL_ACCOUNTING',
            'BUSINESS_MANAGEMENT',
            'COST_ACCOUNTING',
            'ELECTIVE_MATHS',
          ]),
        ],
        'Business',
      ),
      all(
        [
          credit('GKA'),
          credit('MANAGEMENT_IN_LIVING'),
          credit('FOOD_AND_NUTRITION', 'CLOTHING_AND_TEXTILES'),
        ],
        'Vocational/Home Economics',
      ),
      all([credit('BIOLOGY'), credit('CHEMISTRY'), credit('ELECTIVE_MATHS', 'PHYSICS')], 'Science'),
    ]),
  ]),
  p(
    'bsc-metal-product-design-technology',
    'BSc. Metal Product Design Technology',
    ART,
    'Art and Design',
    16,
    [creditsFrom(3, [...VISUAL_ARTS, ...HOME_ECONOMICS, ...TECHNICAL, ...SCIENCE])],
  ),
  p(
    'bsc-textile-design-and-technology',
    'BSc. Textile Design and Technology',
    ART,
    'Art and Design',
    13,
    [anyElectives(3)],
  ),
  p('bsc-fashion-design', 'BSc. Fashion Design', ART, 'Art and Design', 11, [anyElectives(3)]),
  p('bsc-ceramic-technology', 'BSc. Ceramic Technology', ART, 'Art and Design', 23, [
    any([
      all(
        [credit('CERAMICS'), credit('GKA'), credit('CHEMISTRY', 'ELECTIVE_MATHS', 'PHYSICS')],
        'Visual Art',
      ),
      all([creditsFrom(3, ['ELECTIVE_MATHS', 'CHEMISTRY', 'PHYSICS', 'BIOLOGY'])], 'Science'),
      all(
        [
          creditsFrom(3, [
            'TECHNICAL_DRAWING',
            'BUILDING_CONSTRUCTION',
            'APPLIED_ELECTRICITY',
            'AUTO_MECHANICS',
            'ELECTRONICS',
            'PHYSICS',
          ]),
        ],
        'Technical',
      ),
    ]),
  ]),
  p('bfa-ceramics', 'BFA. Ceramics', ART, 'Art and Design', 24, [
    creditsFrom(3, [...VISUAL_ARTS, ...HOME_ECONOMICS, ...GENERAL_ARTS]),
  ]),
  p(
    'bed-junior-high-school-specialism',
    'B.Ed. Junior High School Specialism',
    EDU,
    'Education',
    15,
    [
      any(
        [
          creditsFrom(3, [...SCIENCE, 'GENERAL_AGRICULTURE']),
          creditsFrom(3, VISUAL_ARTS),
          all([
            credit('HISTORY', 'GEOGRAPHY'),
            creditsFrom(2, without(GENERAL_ARTS, 'HISTORY', 'GEOGRAPHY')),
          ]),
        ],
        'Science/Agriculture/ICT (Mathematics, Science, ICT and Agricultural Science options), Visual Art, or General Arts with History or Geography',
      ),
    ],
  ),
  p('bed-chemistry', 'B.Ed. Chemistry', EDU, 'Education', 20, [
    credit('CHEMISTRY'),
    credit('ELECTIVE_MATHS'),
    credit('PHYSICS', 'BIOLOGY', 'ELECTIVE_ICT'),
  ]),
  p('bed-biology', 'B.Ed. Biology', EDU, 'Education', 18, [
    credit('BIOLOGY'),
    credit('CHEMISTRY'),
    credit('ELECTIVE_ICT', 'PHYSICS', 'ELECTIVE_MATHS'),
  ]),
  p('bed-mathematics', 'B.Ed. Mathematics', EDU, 'Education', 21, [
    credit('ELECTIVE_MATHS'),
    credit('PHYSICS'),
    credit('CHEMISTRY', 'ELECTIVE_ICT', 'BIOLOGY'),
  ]),
  p('bed-physics', 'B.Ed. Physics', EDU, 'Education', 24, [
    credit('PHYSICS'),
    credit('ELECTIVE_MATHS'),
    credit('CHEMISTRY', 'ELECTIVE_ICT', 'ELECTRONICS'),
  ]),
  p(
    'bed-stem-aviation-and-aerospace',
    'B.Ed. STEM (Aviation and Aerospace)',
    EDU,
    'Education',
    21,
    [
      credit('PHYSICS'),
      credit('ELECTIVE_MATHS'),
      credit(
        'CHEMISTRY',
        'METALWORK',
        'AUTO_MECHANICS',
        'APPLIED_ELECTRICITY',
        'ELECTRONICS',
        'TECHNICAL_DRAWING',
        'BUILDING_CONSTRUCTION',
        'ELECTIVE_ICT',
      ),
    ],
  ),
  p('bed-stem-manufacturing', 'B.Ed. STEM (Manufacturing)', EDU, 'Education', 24, [
    credit('PHYSICS'),
    credit('ELECTIVE_MATHS'),
    credit('CHEMISTRY', 'METALWORK', 'AUTO_MECHANICS', 'APPLIED_ELECTRICITY', 'TECHNICAL_DRAWING'),
  ]),

  // College of Engineering
  p(
    'bsc-aerospace-engineering',
    'BSc. Aerospace Engineering',
    ENG,
    'Engineering',
    7,
    engineering([...MECHANICAL_ALTERNATIVES, 'ELECTIVE_ICT']),
  ),
  p(
    'bsc-agricultural-engineering',
    'BSc. Agricultural Engineering',
    ENG,
    'Engineering',
    13,
    engineering(
      [
        'TECHNICAL_DRAWING',
        'GENERAL_AGRICULTURE',
        'BIOLOGY',
        'METALWORK',
        'AUTO_MECHANICS',
        'APPLIED_ELECTRICITY',
        'BUILDING_CONSTRUCTION',
      ],
      true,
    ),
  ),
  p(
    'bsc-automobile-engineering',
    'BSc. Automobile Engineering',
    ENG,
    'Engineering',
    10,
    engineering(MECHANICAL_ALTERNATIVES, true),
  ),
  p(
    'bsc-biomedical-engineering',
    'BSc. Biomedical Engineering',
    ENG,
    'Engineering',
    6,
    engineering(['APPLIED_ELECTRICITY', 'ELECTIVE_ICT', 'BIOLOGY']),
  ),
  p('bsc-chemical-engineering', 'BSc. Chemical Engineering', ENG, 'Engineering', 7, engineering()),
  p('bsc-civil-engineering', 'BSc. Civil Engineering', ENG, 'Engineering', 7, engineering()),
  p(
    'bsc-computer-engineering',
    'BSc. Computer Engineering',
    ENG,
    'Engineering',
    6,
    engineering(['APPLIED_ELECTRICITY', 'ELECTIVE_ICT']),
  ),
  p(
    'bsc-electrical-electronic-engineering',
    'BSc. Electrical/Electronic Engineering',
    ENG,
    'Engineering',
    6,
    engineering(['APPLIED_ELECTRICITY', 'ELECTRONICS', 'ELECTIVE_ICT']),
  ),
  p(
    'bsc-geological-engineering',
    'BSc. Geological Engineering',
    ENG,
    'Engineering',
    8,
    engineering(),
  ),
  p(
    'bsc-geomatic-engineering',
    'BSc. Geomatic (Geodetic) Engineering',
    ENG,
    'Engineering',
    9,
    engineering(['GEOGRAPHY', 'TECHNICAL_DRAWING']),
  ),
  p(
    'bsc-industrial-engineering',
    'BSc. Industrial Engineering',
    ENG,
    'Engineering',
    10,
    engineering(MECHANICAL_ALTERNATIVES, true),
  ),
  p(
    'bsc-marine-engineering',
    'BSc. Marine Engineering',
    ENG,
    'Engineering',
    9,
    engineering(MECHANICAL_ALTERNATIVES, true),
  ),
  p(
    'bsc-materials-engineering',
    'BSc. Materials Engineering',
    ENG,
    'Engineering',
    10,
    engineering(),
  ),
  p(
    'bsc-mechanical-engineering',
    'BSc. Mechanical Engineering',
    ENG,
    'Engineering',
    7,
    engineering([...MECHANICAL_ALTERNATIVES, 'ELECTIVE_ICT']),
  ),
  p(
    'bsc-metallurgical-engineering',
    'BSc. Metallurgical Engineering',
    ENG,
    'Engineering',
    11,
    engineering(),
  ),
  p(
    'bsc-petrochemical-engineering',
    'BSc. Petrochemical Engineering',
    ENG,
    'Engineering',
    7,
    engineering(),
  ),
  p(
    'bsc-petroleum-engineering',
    'BSc. Petroleum Engineering',
    ENG,
    'Engineering',
    6,
    engineering(),
  ),
  p(
    'bsc-telecommunication-engineering',
    'BSc. Telecommunication Engineering',
    ENG,
    'Engineering',
    9,
    engineering(['APPLIED_ELECTRICITY', 'ELECTIVE_ICT']),
  ),

  // College of Health Sciences
  p(
    'bds-dental-surgery',
    'Bachelor of Dental Surgery (BDS) (Fee-Paying Only)',
    HEALTH,
    'Health Sciences',
    6,
    healthSciences(),
    {
      confirm: ['Short-listed applicants must pass an entrance examination and an interview'],
    },
  ),
  p(
    'dvm-veterinary-medicine',
    'Doctor of Veterinary Medicine (DVM)',
    HEALTH,
    'Health Sciences',
    10,
    healthSciences(['BIOLOGY', 'ANIMAL_HUSBANDRY']),
  ),
  p(
    'bsc-disability-and-rehabilitation-studies',
    'BSc. Disability and Rehabilitation Studies',
    HEALTH,
    'Health Sciences',
    13,
    [creditsFrom(3, [...SCIENCE, ...GENERAL_ARTS, ...BUSINESS, ...VISUAL_ARTS, ...HOME_ECONOMICS])],
  ),
  p(
    'bhm-herbal-medicine',
    'Bachelor of Herbal Medicine (BHM)',
    HEALTH,
    'Health Sciences',
    14,
    healthSciences(),
  ),
  p(
    'bsc-human-biology-medicine',
    'BSc. Human Biology (Medicine)',
    HEALTH,
    'Health Sciences',
    6,
    healthSciences(),
    {
      confirm: ['Short-listed applicants must pass an entrance examination and an interview'],
    },
  ),
  p(
    'bsc-medical-laboratory-science',
    'BSc. Medical Laboratory Science',
    HEALTH,
    'Health Sciences',
    7,
    healthSciences(),
  ),
  p('bsc-medical-imaging', 'BSc. Medical Imaging', HEALTH, 'Health Sciences', 7, healthSciences()),
  p('bsc-midwifery', 'BSc. Midwifery', HEALTH, 'Health Sciences', 8, healthSciences(), {
    confirm: ['Applicants must pass an interview before admission'],
  }),
  p('bsc-nursing', 'BSc. Nursing', HEALTH, 'Health Sciences', 7, healthSciences(), {
    confirm: ['Applicants must pass an interview before admission'],
  }),
  p(
    'bsc-physiotherapy-and-sports-science',
    'BSc. Physiotherapy and Sports Science',
    HEALTH,
    'Health Sciences',
    12,
    healthSciences(),
  ),
  p('pharm-d', 'Doctor of Pharmacy (Pharm D)', HEALTH, 'Health Sciences', 6, healthSciences()),

  // College of Humanities and Social Sciences
  p('ba-akan-language-and-culture', 'BA. Akan Language and Culture', SOCIAL, 'Languages', 22, [
    credit(...AKAN),
    creditsFrom(2, [
      'HISTORY',
      'GEOGRAPHY',
      'LITERATURE_IN_ENGLISH',
      'FRENCH',
      'ECONOMICS',
      'CRS',
      'IRS',
      'GOVERNMENT',
      'BUSINESS_MANAGEMENT',
    ]),
  ]),
  p('ba-economics', 'BA. Economics', SOCIAL, 'Social Sciences', 10, [
    credit('ELECTIVE_MATHS'),
    anyElectives(2),
  ]),
  p('ba-english', 'BA. English', SOCIAL, 'Languages', 13, [creditsFrom(3, GENERAL_ARTS)]),
  p(
    'ba-french-and-francophone-studies',
    'BA. French and Francophone Studies',
    SOCIAL,
    'Languages',
    14,
    [
      atGrade('B3', 'FRENCH'),
      creditsFrom(2, [...without(GENERAL_ARTS, 'FRENCH'), 'BUSINESS_MANAGEMENT']),
    ],
  ),
  p(
    'ba-geography-and-rural-development',
    'BA. Geography and Rural Development',
    SOCIAL,
    'Social Sciences',
    10,
    [credit('GEOGRAPHY'), creditsFrom(2, without(GENERAL_ARTS, 'GEOGRAPHY'))],
  ),
  p('ba-history', 'BA. History', SOCIAL, 'Social Sciences', 15, [anyElectives(3)], {
    socialStudies: true,
  }),
  p('ba-linguistics', 'BA. Linguistics', SOCIAL, 'Languages', 15, [
    creditsFrom(1, ['LITERATURE_IN_ENGLISH', 'FRENCH', 'ARABIC', ...GHANAIAN_LANGUAGES]),
    creditsFrom(2, [
      'LITERATURE_IN_ENGLISH',
      'FRENCH',
      'ARABIC',
      ...GHANAIAN_LANGUAGES,
      'HISTORY',
      'GEOGRAPHY',
      'ECONOMICS',
      'CRS',
      'IRS',
      'GOVERNMENT',
      'BUSINESS_MANAGEMENT',
    ]),
  ]),
  p(
    'ba-media-and-communication-studies',
    'BA. Media and Communication Studies',
    SOCIAL,
    'Social Sciences',
    9,
    [anyElectives(3)],
  ),
  p(
    'ba-political-studies',
    'BA. Political Studies',
    SOCIAL,
    'Social Sciences',
    9,
    [anyElectives(3)],
    { socialStudies: true },
  ),
  p(
    'bachelor-of-public-administration',
    'Bachelor of Public Administration',
    SOCIAL,
    'Social Sciences',
    11,
    [anyElectives(3)],
  ),
  p(
    'ba-religion-and-human-development',
    'BA. Religious Studies (Religion and Human Development)',
    SOCIAL,
    'Social Sciences',
    20,
    [credit('CRS', 'IRS'), creditsFrom(2, GENERAL_ARTS)],
  ),
  p(
    'ba-sociology',
    'BA. Sociology',
    SOCIAL,
    'Social Sciences',
    11,
    [creditsFrom(3, [...GENERAL_ARTS, ...SCIENCE, ...BUSINESS])],
    { socialStudies: true },
  ),
  p(
    'ba-social-work',
    'BA. Social Work',
    SOCIAL,
    'Social Sciences',
    11,
    [creditsFrom(3, [...GENERAL_ARTS, ...SCIENCE, ...BUSINESS])],
    { socialStudies: true },
  ),
  p('llb', 'LLB (Bachelor of Laws)', LAW, 'Law', 6, [
    creditsFrom(3, [...GENERAL_ARTS, ...BUSINESS, ...VISUAL_ARTS, ...SCIENCE]),
  ]),
  p(
    'bba-human-resource-management',
    'BSc. Business Administration (Human Resource Management/Management)',
    KSB,
    'Business',
    7,
    businessSchool(true),
  ),
  p(
    'bba-marketing-international-business',
    'BSc. Business Administration (Marketing/International Business)',
    KSB,
    'Business',
    9,
    businessSchool(true),
  ),
  p(
    'bba-accounting-banking-and-finance',
    'BSc. Business Administration (Accounting/Banking and Finance)',
    KSB,
    'Business',
    7,
    businessSchool(false),
  ),
  p(
    'bba-logistics-and-supply-chain-management',
    'BSc. Business Administration (Logistics and Supply Chain Management/Business Information Technology)',
    KSB,
    'Business',
    8,
    businessSchool(false),
  ),
  p(
    'bsc-hospitality-and-tourism-management',
    'BSc. Hospitality and Tourism Management',
    KSB,
    'Business',
    10,
    businessSchool(true),
  ),

  // College of Science
  p('bsc-biochemistry', 'BSc. Biochemistry', BIO, 'Sciences', 9, bioChemPhysOrMaths()),
  p(
    'bsc-food-science-and-technology',
    'BSc. Food Science and Technology',
    BIO,
    'Sciences',
    11,
    bioChemPhysOrMaths(),
  ),
  p('bsc-dietetics', 'BSc. Dietetics', BIO, 'Sciences', 9, [
    any([
      all(bioChemPhysOrMaths(), 'Biology, Chemistry, and Physics or Mathematics'),
      all(
        [
          credit('FOOD_AND_NUTRITION'),
          credit('MANAGEMENT_IN_LIVING'),
          credit('CHEMISTRY', 'BIOLOGY'),
        ],
        'Food and Nutrition, Management in Living, and Chemistry or Biology',
      ),
    ]),
  ]),
  p('bsc-human-nutrition', 'BSc. Human Nutrition', BIO, 'Sciences', 10, [
    any([
      all(bioChemPhysOrMaths(), 'Biology, Chemistry, and Physics or Mathematics'),
      all(
        [
          credit('FOOD_AND_NUTRITION'),
          credit('MANAGEMENT_IN_LIVING'),
          credit('CHEMISTRY', 'BIOLOGY'),
        ],
        'Food and Nutrition, Management in Living, and Chemistry or Biology',
      ),
    ]),
  ]),
  p('bsc-biological-science', 'BSc. Biological Science', BIO, 'Sciences', 9, bioChemPhysOrMaths()),
  p(
    'bsc-environmental-sciences',
    'BSc. Environmental Sciences',
    BIO,
    'Sciences',
    12,
    bioChemPhysOrMaths(['BIOLOGY', 'GENERAL_AGRICULTURE']),
  ),
  p(
    'doctor-of-optometry',
    'Doctor of Optometry',
    BIO,
    'Health Sciences',
    6,
    [credit('BIOLOGY'), credit('PHYSICS'), credit('CHEMISTRY', 'ELECTIVE_MATHS')],
    {
      confirm: ['Short-listed applicants must pass an interview'],
    },
  ),
  p('bsc-chemistry', 'BSc. Chemistry', PHYS, 'Sciences', 15, [
    credit('CHEMISTRY'),
    credit('PHYSICS'),
    credit('ELECTIVE_MATHS', 'BIOLOGY'),
  ]),
  p('bsc-computer-science', 'BSc. Computer Science', PHYS, 'Computing', 7, [
    credit('ELECTIVE_MATHS'),
    credit('PHYSICS'),
    credit('CHEMISTRY', 'APPLIED_ELECTRICITY', 'ELECTRONICS'),
  ]),
  p('bsc-information-technology', 'BSc. Information Technology (ICT)', PHYS, 'Computing', 10, [
    credit('ELECTIVE_MATHS'),
    anyElectives(2),
  ]),
  p('bsc-mathematics', 'BSc. Mathematics', PHYS, 'Mathematical Sciences', 15, [
    credit('ELECTIVE_MATHS'),
    credit('PHYSICS'),
    credit('CHEMISTRY', 'BIOLOGY'),
  ]),
  p('bsc-actuarial-science', 'BSc. Actuarial Science', PHYS, 'Mathematical Sciences', 10, [
    credit('ELECTIVE_MATHS'),
    anyElectives(2),
  ]),
  p('bsc-statistics', 'BSc. Statistics', PHYS, 'Mathematical Sciences', 12, [
    credit('ELECTIVE_MATHS'),
    anyElectives(2),
  ]),
  p('bsc-physics', 'BSc. Physics', PHYS, 'Sciences', 16, [
    credit('ELECTIVE_MATHS'),
    credit('PHYSICS'),
    credit('CHEMISTRY', 'ELECTRONICS'),
  ]),
  p(
    'bsc-meteorology-and-climate-science',
    'BSc. Meteorology and Climate Science',
    PHYS,
    'Sciences',
    17,
    [credit('ELECTIVE_MATHS'), credit('PHYSICS'), credit('CHEMISTRY', 'ELECTRONICS')],
  ),
];

/** Obuasi campus programmes share the Kumasi requirements but have their own cut-offs. */
const OBUASI_CUTOFFS: [string, number][] = [
  ['bsc-civil-engineering', 11],
  ['bsc-electrical-electronic-engineering', 10],
  ['bsc-geological-engineering', 14],
  ['bsc-geomatic-engineering', 15],
  ['bsc-materials-engineering', 15],
  ['bsc-mechanical-engineering', 12],
  ['bsc-metallurgical-engineering', 16],
  ['bsc-medical-laboratory-science', 9],
  ['bsc-midwifery', 13],
  ['bsc-nursing', 12],
  ['bba-human-resource-management', 15],
  ['bba-marketing-international-business', 16],
  ['bba-accounting-banking-and-finance', 12],
  ['bba-logistics-and-supply-chain-management', 15],
  ['bsc-environmental-sciences', 19],
];

const OBUASI = OBUASI_CUTOFFS.map(([slug, cutoff]): KnustProgramme => {
  const main = MAIN.find((m) => m.slug === slug);
  if (!main) throw new Error(`No Kumasi programme ${slug} for Obuasi campus`);
  return {
    ...main,
    slug: `${slug}-obuasi`,
    name: `${main.name} (Obuasi Campus)`,
    campus: 'Obuasi',
    cutoff,
  };
});

export const KNUST_PROGRAMMES: KnustProgramme[] = [...MAIN, ...OBUASI];

/** The full requirement tree for a programme. */
export function knustRequirements(programme: KnustProgramme): RequirementGroupInput {
  return all([
    all(
      [
        credit('ENGLISH'),
        credit('CORE_MATHS'),
        credit('INTEGRATED_SCIENCE'),
        ...(programme.socialStudies ? [credit('SOCIAL_STUDIES')] : []),
      ],
      'Core subjects',
    ),
    all(programme.electives, 'Elective subjects'),
    cutoffAggregate(
      programme.cutoff,
      [
        { subjectCodes: ['ENGLISH'], count: 1 },
        { subjectCodes: ['CORE_MATHS'], count: 1 },
        { subjectCodes: ['INTEGRATED_SCIENCE', 'SOCIAL_STUDIES'], count: 1 },
        ...aggregateElectiveComponents(programme.electives, ['INTEGRATED_SCIENCE']),
      ],
      { C4: 4, C5: 4, C6: 4 },
    ),
    ...(programme.confirm ?? []).map(manual),
  ]);
}

const KNUST_NOTE = `Checked against KNUST's official "Entry Requirements and Guidelines for Selecting an Undergraduate Programme" (April 2026) on ${KNUST_CHECKED_ON}. Cut-off aggregates are those KNUST published in that guide from the previous admissions (2024/2025); they change every year.`;

export const KNUST: InstitutionDataset = {
  university: {
    slug: 'knust',
    name: 'Kwame Nkrumah University of Science and Technology',
    shortName: 'KNUST',
    institutionType: 'public_university',
    region: 'ashanti',
    town: 'Kumasi',
    description:
      'Public university in Kumasi with a second campus in Obuasi. Applicants need credit passes (A1–C6) in English Language, Mathematics and Integrated Science, and in three electives relevant to the programme, with an aggregate of 24 or better.',
    websiteUrl: 'https://www.knust.edu.gh',
    admissionsUrl: 'https://apps.knust.edu.gh/admissions/',
  },
  source: {
    title:
      'Entry Requirements and Guidelines for Selecting an Undergraduate Programme (April 2026)',
    url: KNUST_GUIDE_URL,
    publisher: 'KNUST Academic Affairs Division, Registrar’s Office',
  },
  academicYear: '2026/2027',
  checkedOn: KNUST_CHECKED_ON,
  applicationUrl: 'https://apps.knust.edu.gh/admissions/apply',
  verificationNote: KNUST_NOTE,
  programmes: KNUST_PROGRAMMES.map((p) => ({
    slug: p.slug,
    name: p.name,
    faculty: p.faculty,
    field: p.field,
    degreeType: p.degreeType,
    campus: p.campus,
    cutoff: p.cutoff,
    requirements: knustRequirements(p),
    notes: `Cut-off aggregate ${p.cutoff}, from KNUST's April 2026 guide (2024/2025 admissions). It changes every year.`,
  })),
};
