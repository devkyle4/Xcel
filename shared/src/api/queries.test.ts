import { describe, expect, it } from 'vitest';
import { programmeQuerySchema, scholarshipQuerySchema } from './queries';

describe('query schemas', () => {
  it('applies pagination defaults and coerces numbers', () => {
    expect(programmeQuerySchema.parse({ page: '2' })).toMatchObject({ page: 2, pageSize: 20 });
  });

  it('caps page size', () => {
    expect(programmeQuerySchema.safeParse({ pageSize: '500' }).success).toBe(false);
  });

  it('treats blank search text as absent', () => {
    expect(programmeQuerySchema.parse({ q: '   ' }).q).toBeUndefined();
  });

  it('parses a comma-separated availability list', () => {
    expect(scholarshipQuerySchema.parse({ availability: 'open, upcoming' }).availability).toEqual([
      'open',
      'upcoming',
    ]);
    expect(scholarshipQuerySchema.safeParse({ availability: 'open,soon' }).success).toBe(false);
  });

  it('rejects unknown enum values', () => {
    expect(programmeQuerySchema.safeParse({ region: 'mars' }).success).toBe(false);
  });
});
