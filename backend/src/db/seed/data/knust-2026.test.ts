import {
  type AcademicCatalogue,
  evaluateEligibility,
  type RequirementGroupInput,
  type RequirementGroupNode,
  type RequirementNode,
  type RequirementRuleInput,
  type StudentResults,
  validateRequirementTree,
} from '@xcel/shared';
import { describe, expect, it } from 'vitest';
import { gradeSeeds } from '../grades';
import { subjectSeeds } from '../subjects';
import { KNUST_PROGRAMMES, knustRequirements } from './knust-2026';

const catalogue: AcademicCatalogue = {
  grades: gradeSeeds.map((g) => ({
    code: g.code,
    rank: g.rank,
    points: g.points ?? null,
    isPass: g.isPass,
  })),
  subjects: subjectSeeds.map((s) => ({ code: s.code, name: s.name, category: s.category })),
};

/** Gives every node an id, as saving to the database does. */
function withIds(root: RequirementGroupInput): RequirementGroupNode {
  let n = 0;
  const visit = (node: RequirementGroupInput | RequirementRuleInput): RequirementNode =>
    node.kind === 'group'
      ? { ...node, id: `g${n++}`, children: node.children.map(visit) }
      : { ...node, id: `r${n++}` };
  return visit(root) as RequirementGroupNode;
}

const tree = (slug: string) =>
  withIds(knustRequirements(KNUST_PROGRAMMES.find((p) => p.slug === slug)!));
const status = (slug: string, results: StudentResults) =>
  evaluateEligibility(tree(slug), results, catalogue).status;

const scienceStudent: StudentResults = {
  ENGLISH: 'A1',
  CORE_MATHS: 'A1',
  INTEGRATED_SCIENCE: 'A1',
  SOCIAL_STUDIES: 'B2',
  PHYSICS: 'A1',
  CHEMISTRY: 'A1',
  ELECTIVE_MATHS: 'A1',
  BIOLOGY: 'B2',
};

describe('KNUST 2026/2027 data', () => {
  it('has 109 programmes with unique slugs and cut-offs within the minimum of 24', () => {
    expect(KNUST_PROGRAMMES).toHaveLength(109);
    expect(new Set(KNUST_PROGRAMMES.map((p) => p.slug)).size).toBe(109);
    for (const p of KNUST_PROGRAMMES) expect(p.cutoff, p.slug).toBeLessThanOrEqual(24);
  });

  it('has a valid requirement tree for every programme', () => {
    for (const programme of KNUST_PROGRAMMES) {
      expect(
        validateRequirementTree(withIds(knustRequirements(programme)), catalogue),
        programme.name,
      ).toEqual([]);
    }
  });

  it('scores C4, C5 and C6 as 4, as KNUST does', () => {
    const c6 = {
      ENGLISH: 'C6',
      CORE_MATHS: 'C6',
      INTEGRATED_SCIENCE: 'C6',
      CHEMISTRY: 'C6',
      PHYSICS: 'C6',
      BIOLOGY: 'C6',
    };
    // KNUST aggregate 24 (standard WAEC points would give 36).
    const result = evaluateEligibility(tree('bsc-forest-resources-technology'), c6, catalogue);
    expect(result.status).toBe('Eligible');
    expect(status('bsc-agriculture', c6)).toBe('NotEligible'); // cut-off 20
  });

  it('assesses a strong science student across programmes', () => {
    expect(status('bsc-computer-engineering', scienceStudent)).toBe('Eligible');
    expect(status('bsc-computer-science', scienceStudent)).toBe('Eligible');
    expect(status('llb', scienceStudent)).toBe('Eligible');
    // Biology (B2) is a required elective and counts: 1+1+1 + 2+1+1 = 7, above the cut-off of 6.
    expect(status('bsc-human-biology-medicine', scienceStudent)).toBe('NotEligible');
    // With A1 in Biology the entrance examination and interview are still to confirm.
    expect(status('bsc-human-biology-medicine', { ...scienceStudent, BIOLOGY: 'A1' })).toBe(
      'LikelyEligible',
    );
  });

  it('explains a missing subject and a cut-off that is not met', () => {
    const business: StudentResults = {
      ENGLISH: 'B3',
      CORE_MATHS: 'B3',
      INTEGRATED_SCIENCE: 'B3',
      SOCIAL_STUDIES: 'B2',
      ECONOMICS: 'B2',
      FINANCIAL_ACCOUNTING: 'B3',
      BUSINESS_MANAGEMENT: 'B3',
      ELECTIVE_MATHS: 'B3',
    };
    const cs = evaluateEligibility(tree('bsc-computer-science'), business, catalogue);
    expect(cs.status).toBe('NotEligible');
    expect(cs.causes.map((c) => c.kind === 'rule' && c.reason)).toContain('not_taken');

    // Aggregate 3+3+3 + 2+3+3 = 17: meets the business requirements but not the cut-off of 7.
    const accounting = evaluateEligibility(
      tree('bba-accounting-banking-and-finance'),
      business,
      catalogue,
    );
    expect(accounting.status).toBe('NotEligible');
    expect(accounting.causes).toEqual([
      expect.objectContaining({ ruleType: 'aggregate_max', reason: 'aggregate_too_high' }),
    ]);
    expect(status('bsc-hospitality-and-tourism-management', business)).toBe('NotEligible'); // cut-off 10
    expect(status('bba-accounting-banking-and-finance-obuasi', business)).toBe('NotEligible'); // cut-off 12
  });

  it('accepts alternatives to Chemistry only with B3 in Integrated Science where required', () => {
    const technical: StudentResults = {
      ENGLISH: 'A1',
      CORE_MATHS: 'A1',
      INTEGRATED_SCIENCE: 'C4',
      PHYSICS: 'A1',
      ELECTIVE_MATHS: 'A1',
      TECHNICAL_DRAWING: 'A1',
    };
    expect(status('bsc-automobile-engineering', technical)).toBe('NotEligible');
    expect(status('bsc-automobile-engineering', { ...technical, INTEGRATED_SCIENCE: 'B3' })).toBe(
      'Eligible',
    );
  });
});
