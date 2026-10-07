import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app';
import { getDatabase } from '../../db/client';
import { adminSessions, auditLogs, users } from '../../db/schema';
import { audited } from '../../lib/audit';
import { SESSION_IDLE_MS } from '../../lib/auth/sessions';
import { LOGIN_LIMIT_PER_EMAIL } from './auth';
import { AdminUserError, createAdminUser, resetAdminPassword } from './users';

const database = getDatabase();
const { db } = database;
const app = createApp();

const PASSWORD = 'a-long-test-password';
const fastHash = { N: 2 ** 10, r: 8, p: 1 };
let adminId: string;

function login(email: string, password: string, headers: Record<string, string> = {}) {
  return app.request('/api/admin/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ email, password }),
  });
}

/** Logs in and returns a Cookie header for later requests. */
async function loginCookie(email = 'admin@example.com') {
  const res = await login(email, PASSWORD);
  expect(res.status).toBe(200);
  const cookie = res.headers.get('set-cookie')!.split(';')[0]!;
  return { Cookie: cookie };
}

/** Browsers send Origin on every POST; the CSRF guard rejects POSTs without a same-site one. */
const request = (path: string, headers: Record<string, string>, method = 'GET') =>
  app.request(path, {
    method,
    headers: method === 'GET' ? headers : { Origin: 'http://localhost', ...headers },
  });

beforeAll(async () => {
  // The test database is recreated per run. Users cannot be truncated: audit logs
  // reference them and are append-only.
  await db.execute(sql`TRUNCATE admin_sessions, rate_limits`);
  ({ id: adminId } = await createAdminUser(
    db,
    { email: 'Admin@Example.com', name: 'Ama Admin', password: PASSWORD },
    null,
    fastHash,
  ));
  await createAdminUser(
    db,
    { email: 'inactive@example.com', name: 'Inactive', password: PASSWORD },
    null,
    fastHash,
  );
  await db.update(users).set({ isActive: false }).where(eq(users.email, 'inactive@example.com'));
});

beforeEach(async () => {
  await db.execute(sql`TRUNCATE rate_limits`);
});

afterAll(async () => {
  await database.sql.end();
});

describe('login', () => {
  it('signs in with a case-insensitive email and sets a hardened session cookie', async () => {
    const res = await login('ADMIN@example.com', PASSWORD);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      user: { id: adminId, email: 'admin@example.com', name: 'Ama Admin', role: 'admin' },
    });

    const cookie = res.headers.get('set-cookie')!;
    expect(cookie).toMatch(/^__Host-xcel_admin=[\w-]{43};/);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).toContain('Path=/');
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('stores only a hash of the session token', async () => {
    const { Cookie } = await loginCookie();
    const token = Cookie.split('=')[1]!;
    const rows = await db.select({ id: adminSessions.id }).from(adminSessions);
    expect(rows.map((r) => r.id)).not.toContain(token);
  });

  it.each([
    ['a wrong password', 'admin@example.com', 'wrong-password-123'],
    ['an unknown email', 'nobody@example.com', PASSWORD],
    ['a deactivated account', 'inactive@example.com', PASSWORD],
  ])('gives the same answer for %s', async (_, email, password) => {
    const res = await login(email, password);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Invalid email or password' });
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('rejects malformed requests', async () => {
    expect((await login('not-an-email', PASSWORD)).status).toBe(400);
    const res = await app.request('/api/admin/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not json',
    });
    expect(res.status).toBe(400);
  });

  it('rate-limits repeated attempts for an email, even with the right password', async () => {
    for (let i = 0; i < LOGIN_LIMIT_PER_EMAIL.limit; i++) {
      expect((await login('admin@example.com', 'wrong-password-123')).status).toBe(401);
    }
    const blocked = await login('admin@example.com', PASSWORD);
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0);
  });

  it('rate-limits by IP across different emails', async () => {
    let status = 0;
    for (let i = 0; i < 21; i++) {
      status = (await login(`user${i}@example.com`, PASSWORD, { 'X-Real-IP': '203.0.113.7' }))
        .status;
    }
    expect(status).toBe(429);
    // Another IP is unaffected.
    expect(
      (await login('admin@example.com', PASSWORD, { 'X-Real-IP': '203.0.113.8' })).status,
    ).toBe(200);
    // Slow by design: each unknown-email attempt still verifies a full-cost hash.
  }, 30_000);

  it('never stores raw IPs or emails in rate-limit keys', async () => {
    await login('admin@example.com', PASSWORD, { 'X-Real-IP': '203.0.113.9' });
    const keys = (await db.execute<{ key: string }>(sql`SELECT key FROM rate_limits`)).map(
      (r) => r.key,
    );
    expect(keys.join(' ')).not.toMatch(/203\.0\.113\.9|admin@example\.com/);
  });

  it('rejects cross-site form posts', async () => {
    const res = await app.request('/api/admin/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Origin: 'https://evil.example',
      },
      body: `email=admin@example.com&password=${PASSWORD}`,
    });
    expect(res.status).toBe(403);
  });
});

describe('sessions', () => {
  it('identifies the signed-in admin', async () => {
    const res = await request('/api/admin/auth/me', await loginCookie());
    expect(await res.json()).toMatchObject({ user: { email: 'admin@example.com' } });
  });

  it('ends the session on logout', async () => {
    const cookie = await loginCookie();
    const logout = await request('/api/admin/auth/logout', cookie, 'POST');
    expect(logout.status).toBe(204);
    expect(logout.headers.get('set-cookie')).toMatch(/__Host-xcel_admin=;.*Max-Age=0/);
    expect((await request('/api/admin/auth/me', cookie)).status).toBe(401);
  });

  it('ends every session with logout-all', async () => {
    const first = await loginCookie();
    const second = await loginCookie();
    expect((await request('/api/admin/auth/logout-all', first, 'POST')).status).toBe(204);
    expect((await request('/api/admin/auth/me', second)).status).toBe(401);
  });

  it('expires sessions after the absolute lifetime', async () => {
    const cookie = await loginCookie();
    await db.update(adminSessions).set({ expiresAt: new Date(Date.now() - 1000) });
    expect((await request('/api/admin/auth/me', cookie)).status).toBe(401);
  });

  it('expires idle sessions', async () => {
    const cookie = await loginCookie();
    await db
      .update(adminSessions)
      .set({ lastSeenAt: new Date(Date.now() - SESSION_IDLE_MS - 1000) });
    expect((await request('/api/admin/auth/me', cookie)).status).toBe(401);
  });

  it('ends sessions when the account is deactivated', async () => {
    const cookie = await loginCookie();
    await db.update(users).set({ isActive: false }).where(eq(users.id, adminId));
    try {
      expect((await request('/api/admin/auth/me', cookie)).status).toBe(401);
    } finally {
      await db.update(users).set({ isActive: true }).where(eq(users.id, adminId));
    }
  });

  it('ignores forged tokens', async () => {
    const res = await request('/api/admin/auth/me', { Cookie: '__Host-xcel_admin=forged-token' });
    expect(res.status).toBe(401);
  });

  it('signs out everywhere when the password is reset', async () => {
    const cookie = await loginCookie();
    await resetAdminPassword(db, 'admin@example.com', PASSWORD);
    expect((await request('/api/admin/auth/me', cookie)).status).toBe(401);
  });
});

describe('authorization', () => {
  it('requires a session for admin routes, including unknown ones', async () => {
    for (const path of ['/api/admin/audit-logs', '/api/admin/universities', '/api/admin/x/y']) {
      const res = await request(path, {});
      expect(res.status, path).toBe(401);
      expect(res.headers.get('cache-control')).toBe('no-store');
    }
  });

  it('allows admin routes with a session; unknown ones are then 404', async () => {
    const cookie = await loginCookie();
    expect((await request('/api/admin/audit-logs', cookie)).status).toBe(200);
    expect((await request('/api/admin/x/y', cookie)).status).toBe(404);
  });
});

describe('audit log', () => {
  it('records account creation and sign-ins with the actor, never the password hash', async () => {
    const cookie = await loginCookie();
    const res = await request(`/api/admin/audit-logs?entityId=${adminId}&pageSize=50`, cookie);
    const body = (await res.json()) as {
      items: { action: string; actor: { name: string } | null; after: unknown }[];
    };
    const actions = body.items.map((i) => i.action);
    expect(actions).toContain('user.create');
    expect(actions).toContain('auth.login');
    expect(body.items.find((i) => i.action === 'auth.login')?.actor?.name).toBe('Ama Admin');
    expect(JSON.stringify(body)).not.toMatch(/scrypt\$/);
  });

  it('saves nothing if the write or its audit entry fails', async () => {
    const before = await db.$count(auditLogs);
    await expect(
      audited(db, adminId, async (tx, audit) => {
        await tx.update(users).set({ name: 'Changed' }).where(eq(users.id, adminId));
        await audit({ action: 'user.update', entityType: 'user', entityId: adminId });
        throw new Error('write failed');
      }),
    ).rejects.toThrow('write failed');

    expect(await db.$count(auditLogs)).toBe(before);
    const [user] = await db.select({ name: users.name }).from(users).where(eq(users.id, adminId));
    expect(user?.name).toBe('Ama Admin');
  });
});

describe('createAdminUser', () => {
  it('rejects duplicate emails regardless of case', async () => {
    await expect(
      createAdminUser(
        db,
        { email: 'ADMIN@example.com', name: 'Dup', password: PASSWORD },
        null,
        fastHash,
      ),
    ).rejects.toThrow(AdminUserError);
  });

  it('rejects short passwords', async () => {
    await expect(
      createAdminUser(
        db,
        { email: 'new@example.com', name: 'New', password: 'short' },
        null,
        fastHash,
      ),
    ).rejects.toThrow(/at least 12/);
  });
});
