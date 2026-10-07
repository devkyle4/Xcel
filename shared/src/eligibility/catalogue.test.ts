import { describe, expect, it } from 'vitest';
import { indexCatalogue } from './catalogue';
import { catalogue } from './test-fixtures';

describe('indexCatalogue', () => {
  const index = indexCatalogue(catalogue);

  it('compares grades by configured rank, best first', () => {
    expect(index.meetsMinimum('A1', 'C6')).toBe(true);
    expect(index.meetsMinimum('C6', 'C6')).toBe(true);
    expect(index.meetsMinimum('D7', 'C6')).toBe(false);
    expect(index.meetsMinimum('F9', 'E8')).toBe(false);
  });

  it('uses the configured ordering rather than the grade codes', () => {
    // A hypothetical scale where "Z" is the best grade.
    const custom = indexCatalogue({
      grades: [
        { code: 'Z', rank: 1, points: 1, isPass: true },
        { code: 'A', rank: 2, points: 2, isPass: true },
      ],
      subjects: [],
    });
    expect(custom.meetsMinimum('Z', 'A')).toBe(true);
    expect(custom.meetsMinimum('A', 'Z')).toBe(false);
  });

  it('throws on unknown grade codes', () => {
    expect(() => index.meetsMinimum('X1', 'C6')).toThrow(/Unknown grade/);
  });

  it('looks up subject names and categories', () => {
    expect(index.subjectName('PHYSICS')).toBe('Physics');
    expect(index.subjectName('NOPE')).toBe('NOPE');
    expect(index.subjectCodes('core')).toEqual([
      'ENGLISH',
      'CORE_MATHS',
      'INTEGRATED_SCIENCE',
      'SOCIAL_STUDIES',
    ]);
    expect(index.subjectCodes()).toHaveLength(catalogue.subjects.length);
  });
});
