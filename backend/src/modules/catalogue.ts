import type { AcademicCatalogue, GradeInfo, SubjectInfo } from '@xcel/shared';
import { asc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import type { Db } from '../db/client';
import { grades, subjects } from '../db/schema';
import { cachePublicly } from '../lib/http';

const gradeColumns = {
  code: grades.code,
  label: grades.label,
  rank: grades.rank,
  points: grades.points,
  isPass: grades.isPass,
};

/**
 * Grades and subjects for the eligibility engine. Includes inactive subjects
 * so requirements that still reference them can be evaluated.
 */
export async function loadCatalogue(db: Db): Promise<AcademicCatalogue> {
  const [gradeRows, subjectRows] = await Promise.all([
    db.select(gradeColumns).from(grades).orderBy(asc(grades.rank)),
    db
      .select({ code: subjects.code, name: subjects.name, category: subjects.category })
      .from(subjects)
      .orderBy(asc(subjects.code)),
  ]);
  return { grades: gradeRows, subjects: subjectRows };
}

export function catalogueRoutes(db: () => Db) {
  return new Hono()
    .get('/subjects', async (c) => {
      const rows: SubjectInfo[] = await db()
        .select({
          code: subjects.code,
          name: subjects.name,
          category: subjects.category,
          aliases: subjects.aliases,
        })
        .from(subjects)
        .where(eq(subjects.isActive, true))
        .orderBy(asc(subjects.category), asc(subjects.name));
      cachePublicly(c, 300);
      return c.json(rows);
    })
    .get('/grades', async (c) => {
      const rows: GradeInfo[] = await db()
        .select(gradeColumns)
        .from(grades)
        .orderBy(asc(grades.rank));
      cachePublicly(c, 300);
      return c.json(rows);
    });
}
