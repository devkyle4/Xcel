import { describe, expect, it } from 'vitest';
import { gradeSeeds } from './grades';
import { subjectSeeds } from './subjects';

describe('grade seed data', () => {
  it('has unique codes', () => {
    const codes = gradeSeeds.map((g) => g.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('has contiguous ranks starting at 1, best grade first', () => {
    expect(gradeSeeds.map((g) => g.rank)).toEqual(gradeSeeds.map((_, i) => i + 1));
    expect(gradeSeeds[0]?.code).toBe('A1');
  });

  it('marks only F9 as a fail', () => {
    expect(gradeSeeds.filter((g) => !g.isPass).map((g) => g.code)).toEqual(['F9']);
  });
});

describe('subject seed data', () => {
  it('has unique codes in UPPER_SNAKE_CASE', () => {
    const codes = subjectSeeds.map((s) => s.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) expect(code).toMatch(/^[A-Z][A-Z0-9_]*$/);
  });

  it('has unique names', () => {
    const names = subjectSeeds.map((s) => s.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });

  it('has the four WASSCE core subjects', () => {
    expect(subjectSeeds.filter((s) => s.category === 'core').map((s) => s.code)).toEqual([
      'ENGLISH',
      'CORE_MATHS',
      'INTEGRATED_SCIENCE',
      'SOCIAL_STUDIES',
    ]);
  });

  it('never uses an alias that is another subject’s name or alias', () => {
    const owner = new Map<string, string>();
    for (const s of subjectSeeds) {
      for (const term of [s.name, ...(s.aliases ?? [])]) {
        const key = term.toLowerCase();
        const existing = owner.get(key);
        if (existing && existing !== s.code) {
          throw new Error(`"${term}" is used by both ${existing} and ${s.code}`);
        }
        owner.set(key, s.code);
      }
    }
  });
});
