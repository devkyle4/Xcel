import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password';

// A low cost keeps tests fast; production uses the default cost.
const cost = { N: 2 ** 10, r: 8, p: 1 };

describe('password hashing', () => {
  it('verifies the right password and rejects others', async () => {
    const stored = await hashPassword('correct horse battery staple', cost);
    expect(await verifyPassword('correct horse battery staple', stored)).toBe(true);
    expect(await verifyPassword('correct horse battery stapl', stored)).toBe(false);
  });

  it('salts each hash', async () => {
    expect(await hashPassword('same password', cost)).not.toBe(
      await hashPassword('same password', cost),
    );
  });

  it('records the parameters used', async () => {
    expect(await hashPassword('x'.repeat(12), cost)).toMatch(/^scrypt\$1024\$8\$1\$[^$]+\$[^$]+$/);
  });

  it('treats equivalent Unicode forms as the same password', async () => {
    const stored = await hashPassword('café-password', cost);
    expect(await verifyPassword('café-password', stored)).toBe(true);
  });

  it.each(['', 'bcrypt$x', 'scrypt$1024$8$1$salt', 'plaintext'])(
    'rejects a malformed stored hash %j',
    async (stored) => {
      expect(await verifyPassword('anything', stored)).toBe(false);
    },
  );

  it('uses the default cost when none is given', async () => {
    expect(await hashPassword('x'.repeat(12))).toMatch(/^scrypt\$131072\$8\$1\$/);
  });
});
