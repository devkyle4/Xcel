import type {
  DegreeType,
  GhanaRegion,
  InstitutionType,
  RequirementGroupInput,
  RequirementRuleInput,
} from '@xcel/shared';

/** Building blocks for writing university entry requirements as data. */

export type Node = RequirementGroupInput | RequirementRuleInput;

export const credit = (...subjectCodes: string[]): RequirementRuleInput => ({
  kind: 'rule',
  ruleType: 'subject_grade',
  params: { subjectCodes, minGrade: 'C6' },
});
export const atGrade = (minGrade: string, ...subjectCodes: string[]): RequirementRuleInput => ({
  kind: 'rule',
  ruleType: 'subject_grade',
  params: { subjectCodes, minGrade },
});
/** Credit passes in `count` distinct subjects from a list. */
export const creditsFrom = (
  count: number,
  subjectCodes: readonly string[],
): RequirementRuleInput => ({
  kind: 'rule',
  ruleType: 'subject_count',
  params: { count, minGrade: 'C6', subjectCodes: [...new Set(subjectCodes)] },
});
/** Credit passes in `count` electives of any kind. */
export const anyElectives = (count: number): RequirementRuleInput => ({
  kind: 'rule',
  ruleType: 'subject_count',
  params: { count, minGrade: 'C6', category: 'elective' },
});
export const manual = (description: string): RequirementRuleInput => ({
  kind: 'rule',
  ruleType: 'manual_review',
  params: { description },
});
export const all = (children: Node[], label?: string): RequirementGroupInput => ({
  kind: 'group',
  operator: 'all',
  children,
  ...(label && { label }),
});
export const any = (children: Node[], label?: string): RequirementGroupInput => ({
  kind: 'group',
  operator: 'any',
  children,
  ...(label && { label }),
});
export const atLeast = (
  minCount: number,
  children: Node[],
  label?: string,
): RequirementGroupInput => ({
  kind: 'group',
  operator: 'at_least',
  minCount,
  children,
  ...(label && { label }),
});

export interface AggregateComponent {
  subjectCodes?: string[];
  category?: 'core' | 'elective';
  count: number;
}

/** An aggregate rule for a published cut-off. */
export const cutoffAggregate = (
  maxAggregate: number,
  components: AggregateComponent[],
  gradePoints?: Record<string, number>,
): RequirementRuleInput => ({
  kind: 'rule',
  ruleType: 'aggregate_max',
  label: 'Cut-off aggregate',
  params: { maxAggregate, basis: 'cutoff', components, ...(gradePoints && { gradePoints }) },
});

/** Subject codes a set of requirements names (ignoring core subjects), or null if it accepts any elective. */
export function electivePool(nodes: Node[], exclude: readonly string[] = []): string[] | null {
  const codes = new Set<string>();
  let anyElective = false;
  const visit = (node: Node) => {
    if (node.kind === 'group') return node.children.forEach(visit);
    const params = node.params as { subjectCodes?: string[]; category?: string };
    if (node.ruleType === 'subject_count' && params.category) anyElective = true;
    for (const code of params.subjectCodes ?? []) if (!exclude.includes(code)) codes.add(code);
  };
  nodes.forEach(visit);
  return anyElective ? null : [...codes];
}

// ---------- SHS elective groupings ----------

export const GHANAIAN_LANGUAGES = [
  'AKUAPEM_TWI',
  'ASANTE_TWI',
  'FANTE',
  'EWE',
  'GA',
  'DANGME',
  'NZEMA',
  'DAGBANI',
  'DAGAARE',
  'GONJA',
  'KASEM',
];
export const AKAN = ['ASANTE_TWI', 'AKUAPEM_TWI', 'FANTE'];
export const SCIENCE = ['PHYSICS', 'CHEMISTRY', 'BIOLOGY', 'ELECTIVE_MATHS', 'ELECTIVE_ICT'];
export const GENERAL_ARTS = [
  'LITERATURE_IN_ENGLISH',
  'HISTORY',
  'GEOGRAPHY',
  'GOVERNMENT',
  'ECONOMICS',
  'CRS',
  'IRS',
  'FRENCH',
  'ARABIC',
  'MUSIC',
  'ELECTIVE_MATHS',
  'ELECTIVE_ICT',
  ...GHANAIAN_LANGUAGES,
];
export const BUSINESS = [
  'BUSINESS_MANAGEMENT',
  'FINANCIAL_ACCOUNTING',
  'COST_ACCOUNTING',
  'ECONOMICS',
  'ELECTIVE_MATHS',
  'ELECTIVE_ICT',
];
export const VISUAL_ARTS = [
  'GKA',
  'GRAPHIC_DESIGN',
  'PICTURE_MAKING',
  'CERAMICS',
  'SCULPTURE',
  'TEXTILES',
  'LEATHERWORK',
  'BASKETRY',
  'JEWELLERY',
];
export const HOME_ECONOMICS = [
  'MANAGEMENT_IN_LIVING',
  'FOOD_AND_NUTRITION',
  'CLOTHING_AND_TEXTILES',
  'GKA',
  'BIOLOGY',
  'CHEMISTRY',
  'ECONOMICS',
];
export const AGRICULTURE = [
  'GENERAL_AGRICULTURE',
  'ANIMAL_HUSBANDRY',
  'CROP_HUSBANDRY',
  'FISHERIES',
  'FORESTRY',
  'CHEMISTRY',
  'PHYSICS',
  'BIOLOGY',
  'ELECTIVE_MATHS',
];
export const TECHNICAL = [
  'TECHNICAL_DRAWING',
  'BUILDING_CONSTRUCTION',
  'WOODWORK',
  'METALWORK',
  'AUTO_MECHANICS',
  'APPLIED_ELECTRICITY',
  'ELECTRONICS',
  'PHYSICS',
  'ELECTIVE_MATHS',
];
export const without = (list: readonly string[], ...remove: string[]) =>
  list.filter((c) => !remove.includes(c));

// ---------- An institution's dataset ----------

export interface InstitutionProgramme {
  slug: string;
  name: string;
  faculty: string;
  field: string;
  degreeType: DegreeType;
  campus: string;
  cutoff: number;
  requirements: RequirementGroupInput;
  /** Shown on the admission cycle, e.g. fee-paying cut-offs. */
  notes: string;
}

export interface InstitutionDataset {
  university: {
    slug: string;
    name: string;
    shortName: string;
    institutionType: InstitutionType;
    region: GhanaRegion;
    town: string;
    description: string;
    websiteUrl: string;
    admissionsUrl: string;
  };
  source: { title: string; url: string; publisher: string };
  academicYear: string;
  checkedOn: string;
  applicationUrl: string;
  verificationNote: string;
  programmes: InstitutionProgramme[];
}

/**
 * The elective part of an aggregate: required electives always count (one
 * component each, e.g. "Elective Mathematics"), and the remaining places go to
 * the best of the other accepted electives. Requirements with option groups
 * fall back to the best three from every elective they name.
 */
export function aggregateElectiveComponents(
  electives: Node[],
  exclude: readonly string[] = [],
  places = 3,
): AggregateComponent[] {
  const flat = electives.every((n) => n.kind === 'rule');
  if (flat) {
    const components: AggregateComponent[] = [];
    for (const node of electives as RequirementRuleInput[]) {
      const params = node.params as {
        subjectCodes?: string[];
        category?: 'core' | 'elective';
        count?: number;
      };
      if (node.ruleType === 'subject_grade' && params.subjectCodes) {
        const codes = params.subjectCodes.filter((c) => !exclude.includes(c));
        if (codes.length) components.push({ subjectCodes: codes, count: 1 });
      } else if (node.ruleType === 'subject_count') {
        components.push(
          params.category
            ? { category: params.category, count: params.count! }
            : { subjectCodes: params.subjectCodes!, count: params.count! },
        );
      }
    }
    const total = components.reduce((sum, c) => sum + c.count, 0);
    // Specific subjects first, so "any elective" places do not take them.
    if (total === places)
      return components.sort((a, b) => Number(Boolean(a.category)) - Number(Boolean(b.category)));
  }
  const pool = electivePool(electives, exclude);
  return [pool ? { subjectCodes: pool, count: places } : { category: 'elective', count: places }];
}
