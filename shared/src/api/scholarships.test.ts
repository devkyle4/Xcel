import { describe, expect, it } from 'vitest';
import { ghanaToday, scholarshipAvailability } from './scholarships';

describe('scholarshipAvailability', () => {
  const today = '2026-10-07';
  const at = (opensOn: string | null, closesOn: string | null, status = 'published' as const) =>
    scholarshipAvailability({ status, opensOn, closesOn }, today);

  it('is open between the opening and closing dates, inclusive', () => {
    expect(at('2026-10-01', '2026-10-31')).toBe('open');
    expect(at('2026-10-07', '2026-10-07')).toBe('open');
    expect(at(null, '2026-12-01')).toBe('open');
  });

  it('is upcoming before the opening date', () => {
    expect(at('2026-11-01', '2026-12-01')).toBe('upcoming');
  });

  it('is closed after the closing date', () => {
    expect(at('2026-01-01', '2026-10-06')).toBe('closed');
  });

  it('is closed when marked expired, even with a future closing date', () => {
    expect(
      scholarshipAvailability({ status: 'expired', opensOn: null, closesOn: '2027-01-01' }, today),
    ).toBe('closed');
  });

  it('is unknown without dates', () => {
    expect(at(null, null)).toBe('unknown');
  });
});

describe('ghanaToday', () => {
  it('uses the UTC date', () => {
    expect(ghanaToday(new Date('2026-10-07T23:30:00Z'))).toBe('2026-10-07');
  });
});
