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
import { UG } from './ug-2026';

const catalogue: AcademicCatalogue = {
  grades: gradeSeeds.map((g) => ({
    code: g.code,
    rank: g.rank,
    points: g.points ?? null,
    isPass: g.isPass,
  })),
  subjects: subjectSeeds.map((s) => ({ code: s.code, name: s.name, category: s.category })),
};

function withIds(root: RequirementGroupInput): RequirementGroupNode {
  let n = 0;
  const visit = (node: RequirementGroupInput | RequirementRuleInput): RequirementNode =>
    node.kind === 'group'
      ? { ...node, id: `g${n++}`, children: node.children.map(visit) }
      : { ...node, id: `r${n++}` };
  return visit(root) as RequirementGroupNode;
}

const evaluate = (slug: string, results: StudentResults) =>
  evaluateEligibility(
    withIds(UG.programmes.find((p) => p.slug === slug)!.requirements),
    results,
    catalogue,
  );

const science: StudentResults = {
  ENGLISH: 'A1',
  CORE_MATHS: 'A1',
  INTEGRATED_SCIENCE: 'A1',
  SOCIAL_STUDIES: 'B2',
  PHYSICS: 'A1',
  CHEMISTRY: 'A1',
  ELECTIVE_MATHS: 'B3',
  BIOLOGY: 'A1',
};

describe('University of Ghana 2026/2027 data', () => {
  it('has unique slugs and a valid requirement tree for every programme', () => {
    expect(new Set(UG.programmes.map((p) => p.slug)).size).toBe(UG.programmes.length);
    for (const p of UG.programmes) {
      expect(validateRequirementTree(withIds(p.requirements), catalogue), p.name).toEqual([]);
      expect(p.cutoff, p.slug).toBeLessThanOrEqual(24);
    }
  });

  it('counts Integrated Science for sciences and Social Studies for other programmes', () => {
    // Science aggregate: 1 + 1 + 1 (Integrated Science) + 1 + 1 + 3 = 8.
    expect(evaluate('bsc-computer-engineering', science).root!.children.at(-1)).toMatchObject({
      explanation: { aggregate: 8 },
    });
    // Non-science aggregate uses Social Studies (B2): 1 + 1 + 2 + best three electives (1 + 1 + 1) = 7.
    expect(evaluate('llb', science).root!.children.at(-1)).toMatchObject({
      explanation: { aggregate: 7 },
    });
  });

  it('requires B3 in Elective Mathematics for engineering and computer science', () => {
    expect(evaluate('bsc-computer-science', science).status).toBe('NotEligible'); // aggregate 8 > 7
    expect(evaluate('bsc-computer-science', { ...science, ELECTIVE_MATHS: 'A1' }).status).toBe(
      'Eligible',
    );
    const c4 = evaluate('bsc-computer-engineering', { ...science, ELECTIVE_MATHS: 'C4' });
    expect(c4.causes).toEqual(
      expect.arrayContaining([expect.objectContaining({ reason: 'grade_too_low' })]),
    );
  });

  it('accepts a General Arts student for Nursing but not for Medicine', () => {
    const arts: StudentResults = {
      ENGLISH: 'B2',
      CORE_MATHS: 'B3',
      INTEGRATED_SCIENCE: 'B3',
      SOCIAL_STUDIES: 'A1',
      LITERATURE_IN_ENGLISH: 'B2',
      GOVERNMENT: 'B3',
      ECONOMICS: 'B2',
      HISTORY: 'C4',
    };
    expect(evaluate('bsc-nursing', arts).status).toBe('Eligible'); // aggregate 2+3+3+2+2+3 = 15
    expect(evaluate('mbchb', arts).status).toBe('NotEligible');
  });

  it('asks Fine Arts applicants to confirm the audition', () => {
    expect(evaluate('bachelor-of-fine-arts', science).status).toBe('LikelyEligible');
  });
});
