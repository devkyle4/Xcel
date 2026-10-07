import { type AdminUser, loginRequestSchema } from '@xcel/shared';
import { eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import type { Db } from '../../db/client';
import { users } from '../../db/schema';
import { audited } from '../../lib/audit';
import { clearSessionCookie, currentSession, setSessionCookie } from '../../lib/auth/middleware';
import { getDummyHash, verifyPassword } from '../../lib/auth/password';
import { createSession, deleteSession, deleteUserSessions } from '../../lib/auth/sessions';
import { parseJson } from '../../lib/http';
import { clientIp, hitRateLimit, type RateLimit, rateLimitKey } from '../../lib/rate-limit';

export const LOGIN_LIMIT_PER_EMAIL: RateLimit = { limit: 5, windowSeconds: 15 * 60 };
export const LOGIN_LIMIT_PER_IP: RateLimit = { limit: 20, windowSeconds: 15 * 60 };

const INVALID_CREDENTIALS = 'Invalid email or password';

/** Login, logout and current-user endpoints. These handle their own authentication. */
export function adminAuthRoutes(db: () => Db) {
  return new Hono()
    .post('/login', async (c) => {
      const { email, password } = await parseJson(c, loginRequestSchema);

      const [byIp, byEmail] = await Promise.all([
        hitRateLimit(
          db(),
          rateLimitKey('login-ip', clientIp(c.req.raw.headers)),
          LOGIN_LIMIT_PER_IP,
        ),
        hitRateLimit(db(), rateLimitKey('login-email', email), LOGIN_LIMIT_PER_EMAIL),
      ]);
      if (!byIp.allowed || !byEmail.allowed) {
        c.header(
          'Retry-After',
          String(
            Math.max(
              byIp.allowed ? 0 : byIp.retryAfterSeconds,
              byEmail.allowed ? 0 : byEmail.retryAfterSeconds,
            ),
          ),
        );
        return c.json({ error: 'Too many login attempts. Try again later.' }, 429);
      }

      const [user] = await db()
        .select()
        .from(users)
        .where(sql`lower(${users.email}) = lower(${email})`);
      // Always verify a hash, so timing does not reveal whether the email exists.
      const passwordOk = await verifyPassword(
        password,
        user?.passwordHash ?? (await getDummyHash()),
      );
      if (!user || !passwordOk || !user.isActive) {
        return c.json({ error: INVALID_CREDENTIALS }, 401);
      }

      const { token } = await audited(db(), user.id, async (tx, audit) => {
        const session = await createSession(tx, user.id);
        await tx.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
        await audit({ action: 'auth.login', entityType: 'user', entityId: user.id });
        return session;
      });

      setSessionCookie(c, token);
      return c.json<{ user: AdminUser }>({
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
      });
    })
    .post('/logout', async (c) => {
      const session = await currentSession(c, db());
      if (session) {
        await audited(db(), session.user.id, async (tx, audit) => {
          await deleteSession(tx, session.sessionId);
          await audit({ action: 'auth.logout', entityType: 'user', entityId: session.user.id });
        });
      }
      clearSessionCookie(c);
      return c.body(null, 204);
    })
    .post('/logout-all', async (c) => {
      const session = await currentSession(c, db());
      if (!session) return c.json({ error: 'Authentication required' }, 401);
      await audited(db(), session.user.id, async (tx, audit) => {
        await deleteUserSessions(tx, session.user.id);
        await audit({ action: 'auth.logout_all', entityType: 'user', entityId: session.user.id });
      });
      clearSessionCookie(c);
      return c.body(null, 204);
    })
    .get('/me', async (c) => {
      const session = await currentSession(c, db());
      if (!session) return c.json({ error: 'Authentication required' }, 401);
      return c.json<{ user: AdminUser }>({ user: session.user });
    });
}
