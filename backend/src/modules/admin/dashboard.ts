import type { AdminDashboard } from '@xcel/shared';
import { count, inArray } from 'drizzle-orm';
import type { AnyPgColumn, PgTable } from 'drizzle-orm/pg-core';
import { Hono } from 'hono';
import type { Db } from '../../db/client';
import {
  mentors,
  programmeAdmissionCycles,
  programmes,
  scholarships,
  universities,
  userReports,
} from '../../db/schema';
import type { AdminEnv } from '../../lib/auth/middleware';
import { getSettings } from '../../lib/settings';
import { countOverdueScholarships } from './scholarships';
import { staleRecords } from './verification';

async function countByStatus(db: Db, table: PgTable, status: AnyPgColumn) {
  const rows = await db.select({ status, total: count() }).from(table).groupBy(status);
  return Object.fromEntries(rows.map((r) => [r.status as string, r.total]));
}

/** Record counts for the admin dashboard (SRS section 16). */
export function dashboardRoutes(db: () => Db) {
  return new Hono<AdminEnv>().get('/', async (c) => {
    const [unis, progs, cycles, schols, mentorCounts, openReports, overdue, settings] =
      await Promise.all([
        countByStatus(db(), universities, universities.status),
        countByStatus(db(), programmes, programmes.status),
        countByStatus(db(), programmeAdmissionCycles, programmeAdmissionCycles.status),
        countByStatus(db(), scholarships, scholarships.status),
        countByStatus(db(), mentors, mentors.status),
        db().$count(userReports, inArray(userReports.status, ['open', 'under_review'])),
        countOverdueScholarships(db()),
        getSettings(db()),
      ]);
    const stale = await staleRecords(db(), settings.staleAfterDays);
    return c.json<AdminDashboard>({
      universities: unis,
      programmes: progs,
      admissionCycles: cycles,
      scholarships: { ...schols, overdue },
      mentors: {
        active: mentorCounts.active ?? 0,
        inactive: mentorCounts.inactive ?? 0,
        archived: mentorCounts.archived ?? 0,
      },
      openReports,
      staleRecords: stale.length,
    });
  });
}
