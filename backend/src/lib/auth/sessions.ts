import type { AdminUser } from '@xcel/shared';
import { and, eq, gt } from 'drizzle-orm';
import { createHash, randomBytes } from 'node:crypto';
import type { Executor } from '../../db/client';
import { adminSessions, users } from '../../db/schema';

/** Sessions end 12 hours after login, or after 2 hours without activity. */
export const SESSION_ABSOLUTE_MS = 12 * 60 * 60 * 1000;
export const SESSION_IDLE_MS = 2 * 60 * 60 * 1000;
/** Avoid a database write on every request: refresh last-seen at most this often. */
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export async function createSession(db: Executor, userId: string, now = new Date()) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(now.getTime() + SESSION_ABSOLUTE_MS);
  await db
    .insert(adminSessions)
    .values({ id: hashToken(token), userId, createdAt: now, lastSeenAt: now, expiresAt });
  return { token, expiresAt };
}

export interface SessionContext {
  sessionId: string;
  user: AdminUser;
}

/** Returns the session's active user, or null if the token is unknown, expired or idle. */
export async function validateSession(
  db: Executor,
  token: string,
  now = new Date(),
): Promise<SessionContext | null> {
  const sessionId = hashToken(token);
  const [row] = await db
    .select({
      lastSeenAt: adminSessions.lastSeenAt,
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
    })
    .from(adminSessions)
    .innerJoin(users, eq(users.id, adminSessions.userId))
    .where(
      and(
        eq(adminSessions.id, sessionId),
        gt(adminSessions.expiresAt, now),
        gt(adminSessions.lastSeenAt, new Date(now.getTime() - SESSION_IDLE_MS)),
        eq(users.isActive, true),
      ),
    );
  if (!row) return null;

  if (now.getTime() - row.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    await db.update(adminSessions).set({ lastSeenAt: now }).where(eq(adminSessions.id, sessionId));
  }
  return {
    sessionId,
    user: { id: row.id, email: row.email, name: row.name, role: row.role },
  };
}

export async function deleteSession(db: Executor, sessionId: string) {
  await db.delete(adminSessions).where(eq(adminSessions.id, sessionId));
}

export async function deleteUserSessions(db: Executor, userId: string) {
  await db.delete(adminSessions).where(eq(adminSessions.userId, userId));
}
