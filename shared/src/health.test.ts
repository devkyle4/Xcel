import { describe, expect, it } from 'vitest';
import { healthResponseSchema } from './health';

describe('healthResponseSchema', () => {
  it('accepts a valid health response', () => {
    expect(healthResponseSchema.parse({ status: 'ok', database: 'ok' })).toEqual({
      status: 'ok',
      database: 'ok',
    });
  });

  it('rejects unknown status values', () => {
    expect(() => healthResponseSchema.parse({ status: 'up', database: 'ok' })).toThrow();
  });
});
