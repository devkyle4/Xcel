import {
  type AcademicCatalogue,
  type EligibilityBundle,
  type EligibilityBundleProgramme,
  type EligibilityResult,
  type EligibilityStatus,
  evaluateEligibility,
  type RequirementGroupNode,
  type StudentResults,
  validateStudentResults,
} from '@xcel/shared';

/** Display order of statuses: best first. */
export const STATUS_ORDER: readonly EligibilityStatus[] = [
  'Eligible',
  'LikelyEligible',
  'NeedsReview',
  'NotEligible',
];

/**
 * Drops results for subjects or grades the catalogue no longer has (e.g. a
 * subject removed since the results were entered), rather than failing.
 */
export function usableResults(
  results: StudentResults,
  catalogue: AcademicCatalogue,
): StudentResults {
  const invalid = new Set(validateStudentResults(results, catalogue).map((i) => i.subjectCode));
  return Object.fromEntries(Object.entries(results).filter(([code]) => !invalid.has(code)));
}

export function evaluate(
  requirements: RequirementGroupNode | null,
  results: StudentResults,
  catalogue: AcademicCatalogue,
): EligibilityResult {
  return evaluateEligibility(requirements, usableResults(results, catalogue), catalogue);
}

export interface ProgrammeEvaluation {
  programme: EligibilityBundleProgramme;
  result: EligibilityResult;
}

/** Evaluates every programme in the bundle, in the browser. */
export function evaluateBundle(
  bundle: EligibilityBundle,
  results: StudentResults,
): ProgrammeEvaluation[] {
  const usable = usableResults(results, bundle.catalogue);
  return bundle.programmes.map((programme) => ({
    programme,
    result: evaluateEligibility(programme.requirements, usable, bundle.catalogue),
  }));
}

/**
 * Other programmes to explore after a programme does not match: those the
 * student appears eligible for, same field first. Never ranked as "best".
 */
export function alternatives(
  evaluations: ProgrammeEvaluation[],
  excludeId: string,
  field: string | null,
  limit = 5,
): ProgrammeEvaluation[] {
  const matching = evaluations.filter(
    (e) =>
      e.programme.id !== excludeId &&
      (e.result.status === 'Eligible' || e.result.status === 'LikelyEligible'),
  );
  const sameField = (e: ProgrammeEvaluation) =>
    field !== null && e.programme.field?.toLowerCase() === field.toLowerCase();
  return [...matching.filter(sameField), ...matching.filter((e) => !sameField(e))].slice(0, limit);
}
