import type { UserRole } from '@xcel/shared';
import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';
import type { Db } from '../../db/client';
import { type SessionContext, SESSION_ABSOLUTE_MS, validateSession } from './sessions';

/** The "__Host-" prefix pins the cookie to this exact host over HTTPS, path "/". */
const COOKIE_NAME = 'xcel_admin';

export type AdminEnv = { Variables: { admin: SessionContext } };

export function setSessionCookie(c: Context, token: string) {
  setCookie(c, COOKIE_NAME, token, {
    prefix: 'host',
    httpOnly: true,
    secure: true,
    sameSite: 'Strict',
    path: '/',
    maxAge: SESSION_ABSOLUTE_MS / 1000,
  });
}

export function clearSessionCookie(c: Context) {
  deleteCookie(c, COOKIE_NAME, { prefix: 'host', secure: true, path: '/' });
}

export function getSessionToken(c: Context): string | undefined {
  return getCookie(c, COOKIE_NAME, 'host');
}

/** Looks up the request's session, or null. */
export async function currentSession(c: Context, db: Db): Promise<SessionContext | null> {
  const token = getSessionToken(c);
  return token ? validateSession(db, token) : null;
}

/**
 * Server-side authorization for admin routes: requires a valid session whose
 * user has one of `roles`. Responds 401 without a session, 403 without a role.
 */
export function requireRole(db: () => Db, ...roles: UserRole[]) {
  return createMiddleware<AdminEnv>(async (c, next) => {
    const session = await currentSession(c, db());
    if (!session) return c.json({ error: 'Authentication required' }, 401);
    if (!roles.includes(session.user.role)) return c.json({ error: 'Forbidden' }, 403);
    c.set('admin', session);
    await next();
  });
}
