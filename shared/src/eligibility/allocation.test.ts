import { describe, expect, it } from 'vitest';
import { allocateSubjects, largestCompatibleSubset, MAX_SHARED_REQUESTS } from './allocation';

describe('allocateSubjects', () => {
  it('assigns each request its own subjects', () => {
    expect(
      allocateSubjects([
        { candidates: ['PHYSICS'], required: 1 },
        { candidates: ['CHEMISTRY', 'BIOLOGY'], required: 2 },
      ]),
    ).toEqual([['PHYSICS'], ['CHEMISTRY', 'BIOLOGY']]);
  });

  it('fails when two requests need the same only subject', () => {
    expect(
      allocateSubjects([
        { candidates: ['PHYSICS'], required: 1 },
        { candidates: ['PHYSICS'], required: 1 },
      ]),
    ).toBeNull();
  });

  it('reassigns subjects to find an allocation when a greedy choice would fail', () => {
    // Greedy would give PHYSICS to the first request and leave the second with nothing.
    expect(
      allocateSubjects([
        { candidates: ['PHYSICS', 'CHEMISTRY'], required: 1 },
        { candidates: ['PHYSICS'], required: 1 },
      ]),
    ).toEqual([['CHEMISTRY'], ['PHYSICS']]);
  });

  it('fails when a multi-subject request cannot be filled', () => {
    expect(
      allocateSubjects([
        { candidates: ['PHYSICS'], required: 1 },
        { candidates: ['PHYSICS', 'CHEMISTRY'], required: 2 },
      ]),
    ).toBeNull();
  });
});

describe('largestCompatibleSubset', () => {
  it('returns all requests when they fit together', () => {
    const result = largestCompatibleSubset([
      { candidates: ['PHYSICS'], required: 1 },
      { candidates: ['CHEMISTRY'], required: 1 },
    ]);
    expect(result?.indices).toEqual([0, 1]);
  });

  it('drops the fewest requests, preferring earlier ones', () => {
    const result = largestCompatibleSubset([
      { candidates: ['PHYSICS'], required: 1 },
      { candidates: ['PHYSICS'], required: 1 },
      { candidates: ['CHEMISTRY'], required: 1 },
    ]);
    expect(result).toEqual({ indices: [0, 2], counted: [['PHYSICS'], ['CHEMISTRY']] });
  });

  it('gives up beyond the search limit', () => {
    const many = Array.from({ length: MAX_SHARED_REQUESTS + 1 }, () => ({
      candidates: ['PHYSICS'],
      required: 1,
    }));
    expect(largestCompatibleSubset(many)).toBeNull();
  });
});
