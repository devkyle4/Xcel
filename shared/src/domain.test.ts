import { describe, expect, it } from 'vitest';
import { isValidAcademicYear } from './domain';

describe('isValidAcademicYear', () => {
  it.each(['2026/2027', '1999/2000'])('accepts %s', (year) => {
    expect(isValidAcademicYear(year)).toBe(true);
  });

  it.each(['2026/2028', '2026-2027', '2026', '26/27', '2027/2026', ' 2026/2027'])(
    'rejects %s',
    (year) => {
      expect(isValidAcademicYear(year)).toBe(false);
    },
  );
});
