import type { subjects } from '../schema';

type SubjectSeed = Omit<typeof subjects.$inferInsert, 'id' | 'createdAt' | 'updatedAt'>;

const core = (code: string, name: string, aliases: string[] = []): SubjectSeed => ({
  code,
  name,
  category: 'core',
  aliases,
});

const elective = (code: string, name: string, aliases: string[] = []): SubjectSeed => ({
  code,
  name,
  category: 'elective',
  aliases,
});

/**
 * Starting WASSCE subject catalogue. The administrator maintains this list;
 * codes are stable identifiers referenced by requirement rules, so never
 * rename a code once rules use it.
 */
export const subjectSeeds: SubjectSeed[] = [
  core('ENGLISH', 'English Language', ['English', 'Core English']),
  core('CORE_MATHS', 'Core Mathematics', [
    'Mathematics (Core)',
    'Core Maths',
    'General Mathematics',
  ]),
  core('INTEGRATED_SCIENCE', 'Integrated Science', ['Science', 'Core Science']),
  core('SOCIAL_STUDIES', 'Social Studies'),

  // Science
  elective('ELECTIVE_MATHS', 'Elective Mathematics', [
    'Mathematics (Elective)',
    'Further Mathematics',
    'Elective Maths',
  ]),
  elective('PHYSICS', 'Physics'),
  elective('CHEMISTRY', 'Chemistry'),
  elective('BIOLOGY', 'Biology'),
  elective('ELECTIVE_ICT', 'Information and Communication Technology (Elective)', [
    'ICT',
    'Elective ICT',
  ]),

  // Agriculture
  elective('GENERAL_AGRICULTURE', 'General Agriculture', ['Agricultural Science']),
  elective('ANIMAL_HUSBANDRY', 'Animal Husbandry'),
  elective('CROP_HUSBANDRY', 'Crop Husbandry and Horticulture', ['Crop Husbandry']),
  elective('FISHERIES', 'Fisheries'),
  elective('FORESTRY', 'Forestry'),

  // Business
  elective('BUSINESS_MANAGEMENT', 'Business Management'),
  elective('FINANCIAL_ACCOUNTING', 'Financial Accounting', ['Accounting']),
  elective('COST_ACCOUNTING', 'Principles of Cost Accounting', ['Cost Accounting', 'Costing']),
  elective('ECONOMICS', 'Economics'),

  // General Arts
  elective('GEOGRAPHY', 'Geography'),
  elective('GOVERNMENT', 'Government'),
  elective('HISTORY', 'History'),
  elective('LITERATURE_IN_ENGLISH', 'Literature-in-English', ['Literature']),
  elective('CRS', 'Christian Religious Studies', ['CRS']),
  elective('IRS', 'Islamic Religious Studies', ['IRS']),
  elective('FRENCH', 'French'),
  elective('ARABIC', 'Arabic'),
  elective('MUSIC', 'Music'),
  elective('PHYSICAL_EDUCATION', 'Physical Education', ['PE']),

  // Ghanaian languages
  elective('AKUAPEM_TWI', 'Akuapem Twi'),
  elective('ASANTE_TWI', 'Asante Twi'),
  elective('FANTE', 'Fante', ['Mfantse']),
  elective('EWE', 'Ewe'),
  elective('GA', 'Ga'),
  elective('DANGME', 'Dangme'),
  elective('NZEMA', 'Nzema'),
  elective('DAGBANI', 'Dagbani'),
  elective('DAGAARE', 'Dagaare'),
  elective('GONJA', 'Gonja'),
  elective('KASEM', 'Kasem'),

  // Technical
  elective('TECHNICAL_DRAWING', 'Technical Drawing'),
  elective('BUILDING_CONSTRUCTION', 'Building Construction'),
  elective('WOODWORK', 'Woodwork'),
  elective('METALWORK', 'Metalwork'),
  elective('AUTO_MECHANICS', 'Auto Mechanics'),
  elective('APPLIED_ELECTRICITY', 'Applied Electricity'),
  elective('ELECTRONICS', 'Electronics'),

  // Visual Arts
  elective('GKA', 'General Knowledge in Art', ['GKA']),
  elective('GRAPHIC_DESIGN', 'Graphic Design'),
  elective('PICTURE_MAKING', 'Picture Making'),
  elective('CERAMICS', 'Ceramics'),
  elective('SCULPTURE', 'Sculpture'),
  elective('TEXTILES', 'Textiles'),
  elective('LEATHERWORK', 'Leatherwork'),
  elective('BASKETRY', 'Basketry'),
  elective('JEWELLERY', 'Jewellery'),

  // Home Economics
  elective('MANAGEMENT_IN_LIVING', 'Management in Living'),
  elective('FOOD_AND_NUTRITION', 'Food and Nutrition'),
  elective('CLOTHING_AND_TEXTILES', 'Clothing and Textiles'),
];
