import { type AdminUser, newPasswordSchema } from '@xcel/shared';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../../db/client';
import { users } from '../../db/schema';
import { audited } from '../../lib/audit';
import { hashPassword } from '../../lib/auth/password';
import { deleteUserSessions } from '../../lib/auth/sessions';

export class AdminUserError extends Error {}

const newAdminSchema = z.object({
  email: z.email().max(254),
  name: z.string().trim().min(1).max(100),
  password: newPasswordSchema,
});

const findByEmail = (db: Db, email: string) =>
  db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = lower(${email})`);

/** Creates an administrator. `actorUserId` is null when run from the command line. */
export async function createAdminUser(
  db: Db,
  input: { email: string; name: string; password: string },
  actorUserId: string | null = null,
  hashCost?: Parameters<typeof hashPassword>[1],
): Promise<AdminUser> {
  const parsed = newAdminSchema.safeParse(input);
  if (!parsed.success) throw new AdminUserError(z.prettifyError(parsed.error));
  const { email, name, password } = parsed.data;

  if ((await findByEmail(db, email)).length > 0) {
    throw new AdminUserError(`An account for ${email} already exists`);
  }
  const passwordHash = await hashPassword(password, hashCost);

  return audited(db, actorUserId, async (tx, audit) => {
    const [user] = await tx
      .insert(users)
      .values({ email: email.toLowerCase(), name, passwordHash, role: 'admin' })
      .returning({ id: users.id, email: users.email, name: users.name, role: users.role });
    await audit({ action: 'user.create', entityType: 'user', entityId: user!.id, after: user });
    return user!;
  });
}

/** Sets a new password and signs the user out everywhere. */
export async function resetAdminPassword(
  db: Db,
  email: string,
  password: string,
  actorUserId: string | null = null,
) {
  const parsedPassword = newPasswordSchema.safeParse(password);
  if (!parsedPassword.success) throw new AdminUserError(z.prettifyError(parsedPassword.error));

  const [user] = await findByEmail(db, email);
  if (!user) throw new AdminUserError(`No account exists for ${email}`);
  const passwordHash = await hashPassword(parsedPassword.data);

  await audited(db, actorUserId, async (tx, audit) => {
    await tx.update(users).set({ passwordHash }).where(eq(users.id, user.id));
    await deleteUserSessions(tx, user.id);
    await audit({ action: 'user.password_reset', entityType: 'user', entityId: user.id });
  });
}
