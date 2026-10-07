import { describe, expect, it } from 'vitest';
import { redact } from './audit';

describe('redact', () => {
  it('removes secrets at any depth and serialises dates', () => {
    expect(
      redact({
        email: 'admin@example.com',
        passwordHash: 'scrypt$...',
        nested: [{ password: 'hunter2', ok: 1 }],
        when: new Date('2026-10-07T00:00:00Z'),
      }),
    ).toEqual({
      email: 'admin@example.com',
      passwordHash: '[redacted]',
      nested: [{ password: '[redacted]', ok: 1 }],
      when: '2026-10-07T00:00:00.000Z',
    });
  });

  it('passes through primitives and null', () => {
    expect(redact(null)).toBeNull();
    expect(redact('text')).toBe('text');
  });
});
