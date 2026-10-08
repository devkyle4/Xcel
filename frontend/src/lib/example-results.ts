import {
  type CatalogueIndex,
  describeRequirement,
  type EligibilityBundle,
  type EligibilityStatus,
  type NodeResult,
  type RuleResult,
  type StudentResults,
} from '@xcel/shared';
import { evaluateBundle, usableResults } from './eligibility';

/**
 * Sample WASSCE results for the homepage preview. They are only an example
 * input: what they qualify for is worked out from the published requirements.
 */
export const EXAMPLE_RESULTS: StudentResults = {
  CORE_MATHS: 'B2',
  ENGLISH: 'B3',
  INTEGRATED_SCIENCE: 'A1',
  SOCIAL_STUDIES: 'A1',
  ELECTIVE_MATHS: 'B2',
  PHYSICS: 'A1',
  CHEMISTRY: 'B2',
};

export interface ExampleSummary {
  /** The example grades the catalogue recognises, in display order. */
  grades: { code: string; name: string; grade: string; core: boolean }[];
  /** Programmes the example appears eligible (or likely eligible) for. */
  matches: number;
  total: number;
  /** Universities with published programmes, by short name. */
  universities: string[];
  /** The most common admission year among published programmes. */
  academicYear: string | null;
  /** One programme the example is eligible for, with a few of its requirements. */
  featured: {
    id: string;
    name: string;
    university: string;
    status: EligibilityStatus;
    rules: { text: string; met: boolean }[];
  } | null;
}

const rulesOf = (node: NodeResult): RuleResult[] =>
  node.kind === 'rule' ? [node] : node.children.flatMap(rulesOf);

export function summariseExample(bundle: EligibilityBundle, index: CatalogueIndex): ExampleSummary {
  const results = usableResults(EXAMPLE_RESULTS, bundle.catalogue);
  const evaluations = evaluateBundle(bundle, results);
  const eligible = evaluations.filter(
    (e) => e.result.status === 'Eligible' || e.result.status === 'LikelyEligible',
  );

  const years = new Map<string, number>();
  for (const p of bundle.programmes)
    years.set(p.academicYear, (years.get(p.academicYear) ?? 0) + 1);
  const academicYear = [...years].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const universities = [
    ...new Set(bundle.programmes.map((p) => p.university.shortName ?? p.university.name)),
  ].sort();

  const pick =
    eligible.find((e) => /computer/i.test(e.programme.name)) ??
    [...eligible].sort((a, b) => a.programme.name.localeCompare(b.programme.name))[0];
  const featured = pick?.result.root
    ? {
        id: pick.programme.id,
        name: pick.programme.name,
        university: pick.programme.university.shortName ?? pick.programme.university.name,
        status: pick.result.status,
        rules: rulesOf(pick.result.root)
          .filter((r) => r.explanation.type !== 'manual_review' && r.explanation.type !== 'invalid')
          .slice(0, 3)
          .map((r) => ({ text: describeRequirement(r, index), met: r.outcome === 'satisfied' })),
      }
    : null;

  return {
    grades: Object.entries(results).map(([code, grade]) => ({
      code,
      name: index.subjectName(code),
      grade,
      core: index.subject(code)?.category === 'core',
    })),
    matches: eligible.length,
    total: bundle.programmes.length,
    universities,
    academicYear,
    featured,
  };
}
