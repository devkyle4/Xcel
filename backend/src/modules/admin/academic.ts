import {
  type AdminGrade,
  type AdminSubject,
  gradeCreateSchema,
  gradeOrderSchema,
  gradeUpdateSchema,
  subjectCreateSchema,
  subjectUpdateSchema,
} from '@xcel/shared';
import { asc, eq, max, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import type { Db } from '../../db/client';
import { grades, subjects } from '../../db/schema';
import { audited } from '../../lib/audit';
import type { AdminEnv } from '../../lib/auth/middleware';
import { ConflictError, NotFoundError, parseJson, ValidationError } from '../../lib/http';
import { ruleReferenceCounts } from '../../lib/rule-references';

async function findSubject(db: Db, code: string) {
  const [row] = await db.select().from(subjects).where(eq(subjects.code, code));
  if (!row) throw new NotFoundError('Subject not found');
  return row;
}

async function findGrade(db: Db, code: string) {
  const [row] = await db.select().from(grades).where(eq(grades.code, code));
  if (!row) throw new NotFoundError('Grade not found');
  return row;
}

/**
 * Subject and grade catalogue. Changes apply everywhere, including published
 * requirements, so every one is audited. Anything a requirement rule refers
 * to cannot be deleted.
 */
export function academicAdminRoutes(db: () => Db) {
  return new Hono<AdminEnv>()
    .get('/subjects', async (c) => {
      const [rows, usage] = await Promise.all([
        db().select().from(subjects).orderBy(asc(subjects.category), asc(subjects.name)),
        ruleReferenceCounts(db()),
      ]);
      return c.json<AdminSubject[]>(
        rows.map((s) => ({
          code: s.code,
          name: s.name,
          category: s.category,
          aliases: s.aliases,
          isActive: s.isActive,
          usedByRules: usage.subjects.get(s.code) ?? 0,
        })),
      );
    })
    .post('/subjects', async (c) => {
      const input = await parseJson(c, subjectCreateSchema);
      const created = await audited(db(), c.get('admin').user.id, async (tx, audit) => {
        const [row] = await tx.insert(subjects).values(input).returning();
        await audit({
          action: 'subject.create',
          entityType: 'subject',
          entityId: row!.code,
          after: row,
        });
        return row!;
      });
      return c.json(created, 201);
    })
    .patch('/subjects/:code', async (c) => {
      const before = await findSubject(db(), c.req.param('code'));
      const input = await parseJson(c, subjectUpdateSchema);
      const updated = await audited(db(), c.get('admin').user.id, async (tx, audit) => {
        const [row] = await tx
          .update(subjects)
          .set(input)
          .where(eq(subjects.code, before.code))
          .returning();
        await audit({
          action: 'subject.update',
          entityType: 'subject',
          entityId: before.code,
          before,
          after: row,
        });
        return row!;
      });
      return c.json(updated);
    })
    .delete('/subjects/:code', async (c) => {
      const before = await findSubject(db(), c.req.param('code'));
      const used = (await ruleReferenceCounts(db())).subjects.get(before.code) ?? 0;
      if (used > 0) {
        throw new ConflictError(
          `${used} requirement rule(s) refer to ${before.code}; deactivate it instead`,
        );
      }
      await audited(db(), c.get('admin').user.id, async (tx, audit) => {
        await tx.delete(subjects).where(eq(subjects.code, before.code));
        await audit({
          action: 'subject.delete',
          entityType: 'subject',
          entityId: before.code,
          before,
        });
      });
      return c.body(null, 204);
    })
    .get('/grades', async (c) => {
      const [rows, usage] = await Promise.all([
        db().select().from(grades).orderBy(asc(grades.rank)),
        ruleReferenceCounts(db()),
      ]);
      return c.json<AdminGrade[]>(
        rows.map((g) => ({
          code: g.code,
          label: g.label,
          rank: g.rank,
          points: g.points,
          isPass: g.isPass,
          usedByRules: usage.grades.get(g.code) ?? 0,
        })),
      );
    })
    .post('/grades', async (c) => {
      const input = await parseJson(c, gradeCreateSchema);
      const created = await audited(db(), c.get('admin').user.id, async (tx, audit) => {
        // New grades go last; use PUT /grades/order to position them.
        const [{ worst }] = (await tx.select({ worst: max(grades.rank) }).from(grades)) as [
          { worst: number | null },
        ];
        const [row] = await tx
          .insert(grades)
          .values({ ...input, rank: (worst ?? 0) + 1 })
          .returning();
        await audit({
          action: 'grade.create',
          entityType: 'grade',
          entityId: row!.code,
          after: row,
        });
        return row!;
      });
      return c.json(created, 201);
    })
    .patch('/grades/:code', async (c) => {
      const before = await findGrade(db(), c.req.param('code'));
      const input = await parseJson(c, gradeUpdateSchema);
      const updated = await audited(db(), c.get('admin').user.id, async (tx, audit) => {
        const [row] = await tx
          .update(grades)
          .set(input)
          .where(eq(grades.code, before.code))
          .returning();
        await audit({
          action: 'grade.update',
          entityType: 'grade',
          entityId: before.code,
          before,
          after: row,
        });
        return row!;
      });
      return c.json(updated);
    })
    .put('/grades/order', async (c) => {
      const { codes } = await parseJson(c, gradeOrderSchema);
      const current = await db()
        .select({ code: grades.code })
        .from(grades)
        .orderBy(asc(grades.rank));
      const known = current.map((g) => g.code);
      if (codes.length !== known.length || !known.every((code) => codes.includes(code))) {
        throw new ValidationError([
          { path: 'codes', message: `List every grade exactly once: ${known.join(', ')}` },
        ]);
      }
      await audited(db(), c.get('admin').user.id, async (tx, audit) => {
        // Move ranks out of the way first so the unique constraint holds at each step.
        await tx.update(grades).set({ rank: sql`${grades.rank} + 1000` });
        for (const [i, code] of codes.entries()) {
          await tx
            .update(grades)
            .set({ rank: i + 1 })
            .where(eq(grades.code, code));
        }
        await audit({
          action: 'grade.reorder',
          entityType: 'grade',
          before: { order: known },
          after: { order: codes },
        });
      });
      return c.json({ codes });
    })
    .delete('/grades/:code', async (c) => {
      const before = await findGrade(db(), c.req.param('code'));
      const used = (await ruleReferenceCounts(db())).grades.get(before.code) ?? 0;
      if (used > 0)
        throw new ConflictError(
          `${used} requirement rule(s) use ${before.code} as a minimum grade`,
        );
      await audited(db(), c.get('admin').user.id, async (tx, audit) => {
        await tx.delete(grades).where(eq(grades.code, before.code));
        await audit({ action: 'grade.delete', entityType: 'grade', entityId: before.code, before });
      });
      return c.body(null, 204);
    });
}
