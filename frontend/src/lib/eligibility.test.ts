import { bundle, studentResults } from '../test/fixtures';
import { alternatives, evaluateBundle, usableResults } from './eligibility';

describe('eligibility helpers', () => {
  it('evaluates every programme in the browser', () => {
    expect(
      evaluateBundle(bundle, studentResults).map((e) => [e.programme.name, e.result.status]),
    ).toEqual([
      ['BSc Computer Engineering', 'NotEligible'],
      ['BSc Nursing', 'Eligible'],
      ['LLB Law', 'LikelyEligible'],
    ]);
  });

  it('ignores results for subjects the catalogue no longer has', () => {
    expect(
      usableResults({ ENGLISH: 'A1', ASTRONOMY: 'A1', PHYSICS: 'Z9' }, bundle.catalogue),
    ).toEqual({
      ENGLISH: 'A1',
    });
  });

  it('suggests eligible alternatives, same field first, excluding the current programme', () => {
    const evaluations = evaluateBundle(bundle, studentResults);
    expect(
      alternatives(evaluations, bundle.programmes[0]!.id, 'Law').map((e) => e.programme.name),
    ).toEqual(['LLB Law', 'BSc Nursing']);
  });
});
