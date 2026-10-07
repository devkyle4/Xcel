import {
  type AdminVerificationRecord,
  type Paginated,
  type StaleRecord,
  type StaleReport,
  type VerifiableEntityType,
  verificationCreateSchema,
  verificationListQuerySchema,
} from '@xcel/shared';
import { and, count, desc, eq, type SQL, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import type { Db, Executor } from '../../db/client';
import {
  programmeAdmissionCycles,
  scholarshipCycles,
  sources,
  universities,
  users,
  verificationRecords,
} from '../../db/schema';
import { audited } from '../../lib/audit';
import type { AdminEnv } from '../../lib/auth/middleware';
import { countOf, paginate, parseJson, parseQuery, ValidationError } from '../../lib/http';
import { getSettings } from '../../lib/settings';

export async function entityExists(db: Executor, type: VerifiableEntityType, id: string) {
  const rows =
    type === 'university'
      ? await db.select({ id: universities.id }).from(universities).where(eq(universities.id, id))
      : type === 'programme_admission_cycle'
        ? await db
            .select({ id: programmeAdmissionCycles.id })
            .from(programmeAdmissionCycles)
            .where(eq(programmeAdmissionCycles.id, id))
        : await db
            .select({ id: scholarshipCycles.id })
            .from(scholarshipCycles)
            .where(eq(scholarshipCycles.id, id));
  return rows.length > 0;
}

/** True if the entity's most recent verification record says "verified". */
export async function isCurrentlyVerified(db: Executor, type: VerifiableEntityType, id: string) {
  const [latest] = await db
    .select({ status: verificationRecords.status })
    .from(verificationRecords)
    .where(and(eq(verificationRecords.entityType, type), eq(verificationRecords.entityId, id)))
    .orderBy(desc(verificationRecords.verifiedAt))
    .limit(1);
  return latest?.status === 'verified';
}

export async function listVerifications(
  db: Db,
  where: SQL | undefined,
  page: { limit: number; offset: number },
): Promise<AdminVerificationRecord[]> {
  const rows = await db
    .select({
      id: verificationRecords.id,
      entityType: verificationRecords.entityType,
      entityId: verificationRecords.entityId,
      status: verificationRecords.status,
      verifiedAt: verificationRecords.verifiedAt,
      notes: verificationRecords.notes,
      verifierId: users.id,
      verifierName: users.name,
      sourceId: sources.id,
      sourceTitle: sources.title,
      sourceUrl: sources.url,
      sourceYear: sources.academicYear,
    })
    .from(verificationRecords)
    .leftJoin(users, eq(users.id, verificationRecords.verifiedBy))
    .leftJoin(sources, eq(sources.id, verificationRecords.sourceId))
    .where(where)
    .orderBy(desc(verificationRecords.verifiedAt))
    .limit(page.limit)
    .offset(page.offset);

  return rows.map((r) => ({
    id: r.id,
    entityType: r.entityType,
    entityId: r.entityId,
    status: r.status,
    verifiedAt: r.verifiedAt.toISOString(),
    notes: r.notes,
    verifiedBy: r.verifierId ? { id: r.verifierId, name: r.verifierName! } : null,
    source: r.sourceId
      ? { id: r.sourceId, title: r.sourceTitle!, url: r.sourceUrl, academicYear: r.sourceYear }
      : null,
  }));
}

/** Verified or published records whose last successful verification is older than the threshold. */
export async function staleRecords(db: Db, staleAfterDays: number): Promise<StaleRecord[]> {
  const latestVerified = (type: VerifiableEntityType, idColumn: SQL) => sql`
    LEFT JOIN LATERAL (
      SELECT vr.verified_at FROM verification_records vr
      WHERE vr.entity_type = ${type} AND vr.entity_id = ${idColumn} AND vr.status = 'verified'
      ORDER BY vr.verified_at DESC LIMIT 1
    ) lv ON true`;
  const isStale = sql`(lv.verified_at IS NULL OR lv.verified_at < now() - make_interval(days => ${staleAfterDays}::int))`;

  const rows = await db.execute<{
    entity_type: VerifiableEntityType;
    entity_id: string;
    label: string;
    status: StaleRecord['status'];
    last_verified_at: Date | null;
  }>(sql`
    SELECT 'university' AS entity_type, u.id AS entity_id, u.name AS label, u.status::text AS status,
           lv.verified_at AS last_verified_at
    FROM universities u
    ${latestVerified('university', sql`u.id`)}
    WHERE u.status IN ('verified', 'published') AND ${isStale}
    UNION ALL
    SELECT 'programme_admission_cycle', c.id, p.name || ' (' || c.academic_year || ')', c.status::text,
           lv.verified_at
    FROM programme_admission_cycles c
    JOIN programmes p ON p.id = c.programme_id
    ${latestVerified('programme_admission_cycle', sql`c.id`)}
    WHERE c.status IN ('verified', 'published') AND ${isStale}
    UNION ALL
    SELECT 'scholarship_cycle', sc.id, s.name || ' (' || sc.academic_year || ')', s.status::text,
           lv.verified_at
    FROM scholarships s
    JOIN LATERAL (
      SELECT id, academic_year FROM scholarship_cycles
      WHERE scholarship_id = s.id ORDER BY academic_year DESC LIMIT 1
    ) sc ON true
    ${latestVerified('scholarship_cycle', sql`sc.id`)}
    WHERE s.status = 'published' AND ${isStale}
    ORDER BY last_verified_at ASC NULLS FIRST, label`);

  return rows.map((r) => ({
    entityType: r.entity_type,
    entityId: r.entity_id,
    label: r.label,
    status: r.status,
    lastVerifiedAt: r.last_verified_at ? new Date(r.last_verified_at).toISOString() : null,
  }));
}

export function verificationRoutes(db: () => Db) {
  return new Hono<AdminEnv>()
    .get('/', async (c) => {
      const query = parseQuery(c, verificationListQuerySchema);
      const conditions: SQL[] = [];
      if (query.entityType) conditions.push(eq(verificationRecords.entityType, query.entityType));
      if (query.entityId) conditions.push(eq(verificationRecords.entityId, query.entityId));
      const where = conditions.length ? and(...conditions) : undefined;
      const [items, total] = await Promise.all([
        listVerifications(db(), where, paginate(query)),
        countOf(db().select({ total: count() }).from(verificationRecords).where(where)),
      ]);
      return c.json<Paginated<AdminVerificationRecord>>({
        items,
        page: query.page,
        pageSize: query.pageSize,
        total,
      });
    })
    .get('/stale', async (c) => {
      const { staleAfterDays } = await getSettings(db());
      return c.json<StaleReport>({
        staleAfterDays,
        items: await staleRecords(db(), staleAfterDays),
      });
    })
    .post('/', async (c) => {
      const input = await parseJson(c, verificationCreateSchema);
      const actor = c.get('admin').user;

      if (!(await entityExists(db(), input.entityType, input.entityId))) {
        throw new ValidationError([{ path: 'entityId', message: 'No such record' }]);
      }
      if (input.sourceId) {
        const [source] = await db()
          .select({ id: sources.id })
          .from(sources)
          .where(eq(sources.id, input.sourceId));
        if (!source) throw new ValidationError([{ path: 'sourceId', message: 'No such source' }]);
      }

      const record = await audited(db(), actor.id, async (tx, audit) => {
        const verifiedAt = input.verifiedAt ? new Date(input.verifiedAt) : new Date();
        const [row] = await tx
          .insert(verificationRecords)
          .values({
            entityType: input.entityType,
            entityId: input.entityId,
            sourceId: input.sourceId ?? null,
            status: input.status,
            notes: input.notes ?? null,
            verifiedAt,
            verifiedBy: actor.id,
          })
          .returning();
        if (input.entityType === 'programme_admission_cycle' && input.status === 'verified') {
          await tx
            .update(programmeAdmissionCycles)
            .set({ verifiedAt })
            .where(eq(programmeAdmissionCycles.id, input.entityId));
        }
        await audit({
          action: 'verification.create',
          entityType: input.entityType,
          entityId: input.entityId,
          after: row,
        });
        return row!;
      });

      const [created] = await listVerifications(db(), eq(verificationRecords.id, record.id), {
        limit: 1,
        offset: 0,
      });
      return c.json(created!, 201);
    });
}
