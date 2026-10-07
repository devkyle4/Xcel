import type { Hono } from 'hono';
import type { Db } from '../db/client';
import { createAdminUser } from '../modules/admin/users';

export type ApiCall = <T = Record<string, unknown>>(
  method: string,
  path: string,
  body?: unknown,
) => Promise<{ status: number; body: T }>;

/**
 * Creates an admin with a fast password hash, signs in, and returns a helper
 * that calls the API with that session (and a same-site Origin, as a browser would).
 */
export async function signInTestAdmin(app: Hono, db: Db, email: string) {
  const password = 'test-admin-password';
  const user = await createAdminUser(db, { email, name: 'Test Admin', password }, null, {
    N: 2 ** 10,
    r: 8,
    p: 1,
  });
  const res = await app.request('/api/admin/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (res.status !== 200) throw new Error(`Test admin login failed: ${res.status}`);
  const cookie = res.headers.get('set-cookie')!.split(';')[0]!;

  const api: ApiCall = async (method, path, body) => {
    const response = await app.request(path, {
      method,
      headers: {
        Cookie: cookie,
        Origin: 'http://localhost',
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
  };
  return { user, api };
}
