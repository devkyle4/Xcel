import {
  type AdminMentor,
  mentorCreateSchema,
  mentorExpertiseSchema,
  type MentoringTopicCode,
  mentorStatusChangeSchema,
  mentorUpdateSchema,
} from '@xcel/shared';
import { and, asc, eq, gte, inArray, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import type { Db } from '../../db/client';
import { mentorExpertise, mentorRequestStats, mentors } from '../../db/schema';
import { audited } from '../../lib/audit';
import type { AdminEnv } from '../../lib/auth/middleware';
import { NotFoundError, parseJson, uuidParam } from '../../lib/http';
import { uniqueSlug } from '../../lib/slug';

type Mentor = typeof mentors.$inferSelect;

async function findMentor(db: Db, id: string): Promise<Mentor> {
  const [row] = await db.select().from(mentors).where(eq(mentors.id, id));
  if (!row) throw new NotFoundError('Mentor not found');
  return row;
}

async function describeMentors(db: Db, rows: Mentor[]): Promise<AdminMentor[]> {
  const ids = rows.map((r) => r.id);
  const since = new Date();
  since.setUTCMonth(since.getUTCMonth() - 11, 1);
  const [expertise, stats] = await Promise.all([
    ids.length
      ? db
          .select()
          .from(mentorExpertise)
          .where(inArray(mentorExpertise.mentorId, ids))
          .orderBy(asc(mentorExpertise.value))
      : [],
    ids.length
      ? db
          .select({
            mentorId: mentorRequestStats.mentorId,
            sent: sql<number>`sum(${mentorRequestStats.sentCount})::int`,
          })
          .from(mentorRequestStats)
          .where(
            and(
              inArray(mentorRequestStats.mentorId, ids),
              gte(mentorRequestStats.month, since.toISOString().slice(0, 10)),
            ),
          )
          .groupBy(mentorRequestStats.mentorId)
      : [],
  ]);
  const of = (id: string, kind: string) =>
    expertise.filter((e) => e.mentorId === id && e.kind === kind).map((e) => e.value);
  return rows.map((m) => ({
    id: m.id,
    slug: m.slug,
    fullName: m.fullName,
    headline: m.headline,
    photoUrl: m.photoUrl,
    bio: m.bio,
    background: m.background,
    contactEmail: m.contactEmail,
    status: m.status,
    topics: of(m.id, 'topic') as MentoringTopicCode[],
    fields: of(m.id, 'field'),
    programmeAreas: of(m.id, 'programme_area'),
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
    requestsSent: stats.find((s) => s.mentorId === m.id)?.sent ?? 0,
  }));
}

/** Mentor management, including the private contact email. Every change is audited. */
export function mentorAdminRoutes(db: () => Db) {
  return new Hono<AdminEnv>()
    .get('/', async (c) => {
      const rows = await db().select().from(mentors).orderBy(asc(mentors.fullName));
      return c.json(await describeMentors(db(), rows));
    })
    .post('/', async (c) => {
      const input = await parseJson(c, mentorCreateSchema);
      const slug =
        input.slug ??
        (await uniqueSlug(
          input.fullName,
          async (s) => (await db().$count(mentors, eq(mentors.slug, s))) > 0,
        ));
      const created = await audited(db(), c.get('admin').user.id, async (tx, audit) => {
        // New mentors start inactive: they appear publicly once activated.
        const [row] = await tx
          .insert(mentors)
          .values({ ...input, slug, status: 'inactive' })
          .returning();
        await audit({
          action: 'mentor.create',
          entityType: 'mentor',
          entityId: row!.id,
          after: row,
        });
        return row!;
      });
      return c.json((await describeMentors(db(), [created]))[0], 201);
    })
    .get('/:id', async (c) =>
      c.json((await describeMentors(db(), [await findMentor(db(), uuidParam(c, 'id'))]))[0]),
    )
    .patch('/:id', async (c) => {
      const before = await findMentor(db(), uuidParam(c, 'id'));
      const input = await parseJson(c, mentorUpdateSchema);
      const updated = await audited(db(), c.get('admin').user.id, async (tx, audit) => {
        const [row] = await tx
          .update(mentors)
          .set(input)
          .where(eq(mentors.id, before.id))
          .returning();
        await audit({
          action: 'mentor.update',
          entityType: 'mentor',
          entityId: before.id,
          before,
          after: row,
        });
        return row!;
      });
      return c.json((await describeMentors(db(), [updated]))[0]);
    })
    .post('/:id/status', async (c) => {
      const before = await findMentor(db(), uuidParam(c, 'id'));
      const { status } = await parseJson(c, mentorStatusChangeSchema);
      const updated = await audited(db(), c.get('admin').user.id, async (tx, audit) => {
        const [row] = await tx
          .update(mentors)
          .set({ status, archivedAt: status === 'archived' ? new Date() : null })
          .where(eq(mentors.id, before.id))
          .returning();
        await audit({
          action: 'mentor.status',
          entityType: 'mentor',
          entityId: before.id,
          before: { status: before.status },
          after: { status },
        });
        return row!;
      });
      return c.json((await describeMentors(db(), [updated]))[0]);
    })
    .put('/:id/expertise', async (c) => {
      const mentor = await findMentor(db(), uuidParam(c, 'id'));
      const input = await parseJson(c, mentorExpertiseSchema);
      await audited(db(), c.get('admin').user.id, async (tx, audit) => {
        const before = await tx
          .select()
          .from(mentorExpertise)
          .where(eq(mentorExpertise.mentorId, mentor.id));
        await tx.delete(mentorExpertise).where(eq(mentorExpertise.mentorId, mentor.id));
        const rows = [
          ...input.topics.map((value) => ({ mentorId: mentor.id, kind: 'topic' as const, value })),
          ...input.fields.map((value) => ({ mentorId: mentor.id, kind: 'field' as const, value })),
          ...input.programmeAreas.map((value) => ({
            mentorId: mentor.id,
            kind: 'programme_area' as const,
            value,
          })),
        ];
        if (rows.length) await tx.insert(mentorExpertise).values(rows);
        await audit({
          action: 'mentor.expertise',
          entityType: 'mentor',
          entityId: mentor.id,
          before: before.map((e) => ({ kind: e.kind, value: e.value })),
          after: input,
        });
      });
      return c.json((await describeMentors(db(), [mentor]))[0]);
    });
}
