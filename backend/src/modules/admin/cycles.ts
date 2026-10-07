import {
  type AdminCycle,
  cycleCreateSchema,
  cycleUpdateSchema,
  evaluateEligibility,
  type PreviewResponse,
  previewRequestSchema,
  type PublishStatus,
  requirementsInputSchema,
  statusChangeSchema,
  validateRequirementTree,
  validateStudentResults,
} from '@xcel/shared';
import { and, desc, eq, max, ne } from 'drizzle-orm';
import { Hono } from 'hono';
import type { Db, Executor } from '../../db/client';
import {
  programmeAdmissionCycles,
  programmes,
  universities,
  verificationRecords,
} from '../../db/schema';
import { audited } from '../../lib/audit';
import type { AdminEnv } from '../../lib/auth/middleware';
import {
  ConflictError,
  type Issue,
  NotFoundError,
  parseJson,
  uuidParam,
  ValidationError,
} from '../../lib/http';
import { transition } from '../../lib/publishing';
import { loadRequirementTrees, replaceRequirementTree } from '../../lib/requirements';
import { loadCatalogue } from '../catalogue';
import { findProgramme } from './programmes';
import { isCurrentlyVerified, listVerifications } from './verification';

type Cycle = typeof programmeAdmissionCycles.$inferSelect;

/** Statuses a once-published cycle can never return to: its content is frozen. */
const PRE_PUBLICATION: readonly PublishStatus[] = ['draft', 'needs_verification', 'verified'];

const isEditable = (cycle: Cycle) => cycle.status === 'draft' && cycle.publishedAt === null;

async function findCycle(db: Executor, id: string): Promise<Cycle> {
  const [row] = await db
    .select()
    .from(programmeAdmissionCycles)
    .where(eq(programmeAdmissionCycles.id, id));
  if (!row) throw new NotFoundError('Admission cycle not found');
  return row;
}

function assertEditable(cycle: Cycle) {
  if (!isEditable(cycle)) {
    throw new ConflictError(
      cycle.publishedAt
        ? 'This cycle has been published and cannot change; create a new version'
        : 'Only draft cycles can be edited; move it back to draft first',
    );
  }
}

async function loadTree(db: Executor, cycleId: string) {
  return (await loadRequirementTrees(db, [cycleId])).get(cycleId) ?? null;
}

const toIssues = (issues: ReturnType<typeof validateRequirementTree>): Issue[] =>
  issues.map((i) => ({ path: i.nodeId ?? 'requirements', message: i.message }));

async function nextVersion(db: Executor, programmeId: string, academicYear: string) {
  const [row] = await db
    .select({ latest: max(programmeAdmissionCycles.version) })
    .from(programmeAdmissionCycles)
    .where(
      and(
        eq(programmeAdmissionCycles.programmeId, programmeId),
        eq(programmeAdmissionCycles.academicYear, academicYear),
      ),
    );
  return (row?.latest ?? 0) + 1;
}

/** An existing never-published draft for the programme and year, if any. */
async function findOpenDraft(db: Executor, programmeId: string, academicYear: string) {
  const rows = await db
    .select()
    .from(programmeAdmissionCycles)
    .where(
      and(
        eq(programmeAdmissionCycles.programmeId, programmeId),
        eq(programmeAdmissionCycles.academicYear, academicYear),
        ne(programmeAdmissionCycles.status, 'archived'),
      ),
    );
  return rows.find((r) => r.publishedAt === null);
}

async function describeCycle(db: Db, cycle: Cycle): Promise<AdminCycle> {
  const [requirements, catalogue, [programme], verifications, versions] = await Promise.all([
    loadTree(db, cycle.id),
    loadCatalogue(db),
    db
      .select({ id: programmes.id, name: programmes.name, universityName: universities.name })
      .from(programmes)
      .innerJoin(universities, eq(universities.id, programmes.universityId))
      .where(eq(programmes.id, cycle.programmeId)),
    listVerifications(
      db,
      and(
        eq(verificationRecords.entityType, 'programme_admission_cycle'),
        eq(verificationRecords.entityId, cycle.id),
      ),
      { limit: 20, offset: 0 },
    ),
    db
      .select({
        id: programmeAdmissionCycles.id,
        version: programmeAdmissionCycles.version,
        status: programmeAdmissionCycles.status,
        publishedAt: programmeAdmissionCycles.publishedAt,
      })
      .from(programmeAdmissionCycles)
      .where(
        and(
          eq(programmeAdmissionCycles.programmeId, cycle.programmeId),
          eq(programmeAdmissionCycles.academicYear, cycle.academicYear),
        ),
      )
      .orderBy(desc(programmeAdmissionCycles.version)),
  ]);

  return {
    ...cycle,
    verifiedAt: cycle.verifiedAt?.toISOString() ?? null,
    publishedAt: cycle.publishedAt?.toISOString() ?? null,
    archivedAt: cycle.archivedAt?.toISOString() ?? null,
    createdAt: cycle.createdAt.toISOString(),
    updatedAt: cycle.updatedAt.toISOString(),
    editable: isEditable(cycle),
    programme: programme!,
    requirements,
    issues: validateRequirementTree(requirements, catalogue),
    verifications,
    versions: versions.map((v) => ({ ...v, publishedAt: v.publishedAt?.toISOString() ?? null })),
  };
}

/**
 * Admission cycles and their requirement trees. Never-published drafts can be
 * edited freely; anything else changes only through a new version.
 */
export function cycleAdminRoutes(db: () => Db) {
  return new Hono<AdminEnv>()
    .post('/programmes/:id/cycles', async (c) => {
      const programme = await findProgramme(db(), uuidParam(c, 'id'));
      const input = await parseJson(c, cycleCreateSchema);

      const existing = await db()
        .select({ id: programmeAdmissionCycles.id })
        .from(programmeAdmissionCycles)
        .where(
          and(
            eq(programmeAdmissionCycles.programmeId, programme.id),
            eq(programmeAdmissionCycles.academicYear, input.academicYear),
            ne(programmeAdmissionCycles.status, 'archived'),
          ),
        );
      if (existing.length > 0) {
        throw new ConflictError(
          `This programme already has a ${input.academicYear} cycle; edit it or create a new version of it`,
        );
      }

      const version = await nextVersion(db(), programme.id, input.academicYear);
      const created = await audited(db(), c.get('admin').user.id, async (tx, audit) => {
        const [row] = await tx
          .insert(programmeAdmissionCycles)
          .values({ ...input, programmeId: programme.id, version, status: 'draft' })
          .returning();
        await audit({
          action: 'admission_cycle.create',
          entityType: 'admission_cycle',
          entityId: row!.id,
          after: row,
        });
        return row!;
      });
      return c.json(await describeCycle(db(), created), 201);
    })
    .get('/cycles/:id', async (c) =>
      c.json(await describeCycle(db(), await findCycle(db(), uuidParam(c, 'id')))),
    )
    .patch('/cycles/:id', async (c) => {
      const before = await findCycle(db(), uuidParam(c, 'id'));
      assertEditable(before);
      const input = await parseJson(c, cycleUpdateSchema);
      const updated = await audited(db(), c.get('admin').user.id, async (tx, audit) => {
        const [row] = await tx
          .update(programmeAdmissionCycles)
          .set(input)
          .where(eq(programmeAdmissionCycles.id, before.id))
          .returning();
        await audit({
          action: 'admission_cycle.update',
          entityType: 'admission_cycle',
          entityId: before.id,
          before,
          after: row,
        });
        return row!;
      });
      return c.json(await describeCycle(db(), updated));
    })
    .delete('/cycles/:id', async (c) => {
      const before = await findCycle(db(), uuidParam(c, 'id'));
      assertEditable(before);
      await audited(db(), c.get('admin').user.id, async (tx, audit) => {
        const requirements = await loadTree(tx, before.id);
        await tx.delete(programmeAdmissionCycles).where(eq(programmeAdmissionCycles.id, before.id));
        await audit({
          action: 'admission_cycle.delete',
          entityType: 'admission_cycle',
          entityId: before.id,
          before: { ...before, requirements },
        });
      });
      return c.body(null, 204);
    })
    .put('/cycles/:id/requirements', async (c) => {
      const before = await findCycle(db(), uuidParam(c, 'id'));
      assertEditable(before);
      const { requirements } = await parseJson(c, requirementsInputSchema);
      await audited(db(), c.get('admin').user.id, async (tx, audit) => {
        const previous = await loadTree(tx, before.id);
        await replaceRequirementTree(tx, before.id, requirements);
        await audit({
          action: 'admission_cycle.requirements',
          entityType: 'admission_cycle',
          entityId: before.id,
          before: previous,
          after: await loadTree(tx, before.id),
        });
      });
      // Saved even with issues so work can continue; issues block verification and publishing.
      return c.json(await describeCycle(db(), await findCycle(db(), before.id)));
    })
    .post('/cycles/:id/new-version', async (c) => {
      const source = await findCycle(db(), uuidParam(c, 'id'));
      if (isEditable(source))
        throw new ConflictError('This cycle is still a draft; edit it directly');
      const draft = await findOpenDraft(db(), source.programmeId, source.academicYear);
      if (draft) {
        throw new ConflictError(
          `A draft for ${source.academicYear} already exists (version ${draft.version}); edit that instead`,
        );
      }

      const created = await audited(db(), c.get('admin').user.id, async (tx, audit) => {
        const [row] = await tx
          .insert(programmeAdmissionCycles)
          .values({
            programmeId: source.programmeId,
            academicYear: source.academicYear,
            version: await nextVersion(tx, source.programmeId, source.academicYear),
            supersedesCycleId: source.id,
            applicationOpensOn: source.applicationOpensOn,
            applicationDeadline: source.applicationDeadline,
            applicationUrl: source.applicationUrl,
            notes: source.notes,
            status: 'draft',
          })
          .returning();
        await replaceRequirementTree(tx, row!.id, await loadTree(tx, source.id));
        await audit({
          action: 'admission_cycle.new_version',
          entityType: 'admission_cycle',
          entityId: row!.id,
          after: { ...row, copiedFrom: source.id },
        });
        return row!;
      });
      return c.json(await describeCycle(db(), created), 201);
    })
    .post('/cycles/:id/status', async (c) => {
      const before = await findCycle(db(), uuidParam(c, 'id'));
      const { status } = await parseJson(c, statusChangeSchema);
      const changes = transition(before.status, status);

      if (before.publishedAt && PRE_PUBLICATION.includes(status)) {
        throw new ConflictError(
          'This cycle has been published and cannot change; create a new version',
        );
      }
      if (status === 'verified' || status === 'published') {
        const issues = validateRequirementTree(
          await loadTree(db(), before.id),
          await loadCatalogue(db()),
        );
        if (issues.length > 0) {
          throw new ConflictError('Fix the requirement problems first', toIssues(issues));
        }
      }
      if (
        status === 'verified' &&
        !(await isCurrentlyVerified(db(), 'programme_admission_cycle', before.id))
      ) {
        throw new ConflictError(
          'Add a verification record with a source before marking this verified',
        );
      }

      const updated = await audited(db(), c.get('admin').user.id, async (tx, audit) => {
        if (status === 'published') {
          // The version being replaced is archived in the same transaction.
          const superseded = await tx
            .update(programmeAdmissionCycles)
            .set({ status: 'archived', archivedAt: new Date() })
            .where(
              and(
                eq(programmeAdmissionCycles.programmeId, before.programmeId),
                eq(programmeAdmissionCycles.academicYear, before.academicYear),
                eq(programmeAdmissionCycles.status, 'published'),
                ne(programmeAdmissionCycles.id, before.id),
              ),
            )
            .returning({ id: programmeAdmissionCycles.id });
          for (const { id } of superseded) {
            await audit({
              action: 'admission_cycle.status',
              entityType: 'admission_cycle',
              entityId: id,
              before: { status: 'published' },
              after: { status: 'archived', supersededBy: before.id },
            });
          }
        }
        const [row] = await tx
          .update(programmeAdmissionCycles)
          .set(changes)
          .where(eq(programmeAdmissionCycles.id, before.id))
          .returning();
        await audit({
          action: 'admission_cycle.status',
          entityType: 'admission_cycle',
          entityId: before.id,
          before: { status: before.status },
          after: { status: row!.status },
        });
        return row!;
      });
      return c.json(await describeCycle(db(), updated));
    })
    .post('/cycles/:id/preview', async (c) => {
      // Sample results are evaluated in memory only: not stored, logged or audited.
      const cycle = await findCycle(db(), uuidParam(c, 'id'));
      const { results } = await parseJson(c, previewRequestSchema);
      const catalogue = await loadCatalogue(db());
      const problems = validateStudentResults(results, catalogue);
      if (problems.length > 0) {
        throw new ValidationError(
          problems.map((p) => ({ path: `results.${p.subjectCode}`, message: p.message })),
        );
      }
      return c.json<PreviewResponse>(
        evaluateEligibility(await loadTree(db(), cycle.id), results, catalogue),
      );
    });
}
