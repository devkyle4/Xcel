import type { EligibilityBundle, EligibilityBundleProgramme } from '@xcel/shared';
import { and, asc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { etag } from 'hono/etag';
import type { Db } from '../db/client';
import { programmes, universities } from '../db/schema';
import { cachePublicly } from '../lib/http';
import { loadRequirementTrees } from '../lib/requirements';
import { loadCatalogue } from './catalogue';
import { currentCycles, programmeIsPublic, universityRefColumns } from './programmes';

/**
 * Eligibility is checked in the browser: this serves the published
 * requirements, and no endpoint ever receives a student's results.
 */
export function eligibilityRoutes(db: () => Db) {
  return new Hono().get('/requirements', etag(), async (c) => {
    const current = currentCycles(db());
    const [catalogue, rows] = await Promise.all([
      loadCatalogue(db()),
      db()
        .select({
          id: programmes.id,
          name: programmes.name,
          field: programmes.field,
          degreeType: programmes.degreeType,
          university: universityRefColumns,
          academicYear: current.academicYear,
          cycleId: current.cycleId,
        })
        .from(programmes)
        .innerJoin(universities, eq(universities.id, programmes.universityId))
        .innerJoin(current, eq(current.programmeId, programmes.id))
        .where(and(programmeIsPublic))
        .orderBy(asc(universities.name), asc(programmes.name)),
    ]);

    const trees = await loadRequirementTrees(
      db(),
      rows.map((r) => r.cycleId),
    );
    const bundle: EligibilityBundle = {
      catalogue,
      programmes: rows.map((r): EligibilityBundleProgramme => ({
        ...r,
        requirements: trees.get(r.cycleId) ?? null,
      })),
    };

    cachePublicly(c, 300);
    return c.json(bundle);
  });
}
