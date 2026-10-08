import type { EligibilityBundle, ProgrammeDetail } from '@xcel/shared';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../app';
import { getDatabase } from '../client';
import { KNUST } from './data/knust-2026';
import { UG } from './data/ug-2026';
import { importInstitution, removeInstitution } from './institution-import';
import { seed } from './seed';

const database = getDatabase();
const app = createApp();
const clear = () =>
  database.db.execute(sql`TRUNCATE universities, programmes, programme_admission_cycles CASCADE`);

beforeAll(async () => {
  // Other test files may have created universities with these slugs.
  await clear();
  await seed(database);
});

afterAll(async () => {
  // Leave no programmes behind: other test files count the rules in the database.
  await clear();
  await database.sql.end();
});

describe('university imports', () => {
  it.each([
    ['KNUST', KNUST, 109],
    ['UG', UG, UG.programmes.length],
  ])('loads every %s programme once, published and verified', async (_, data, count) => {
    expect(await importInstitution(database, data)).toEqual({ created: true, programmes: count });
    expect(await importInstitution(database, data)).toEqual({ created: false, programmes: 0 });
  });

  it('serves both universities’ requirements for the browser check', async () => {
    const bundle = (await (
      await app.request('/api/eligibility/requirements')
    ).json()) as EligibilityBundle;
    expect(bundle.programmes.filter((p) => p.university.slug === 'knust')).toHaveLength(109);
    expect(
      bundle.programmes.filter((p) => p.university.slug === 'university-of-ghana'),
    ).toHaveLength(UG.programmes.length);
  });

  it('shows the cut-off, source and campus on a programme page', async () => {
    const list = (await (
      await app.request('/api/programmes?university=university-of-ghana&q=Computer%20Science')
    ).json()) as {
      items: { id: string; name: string }[];
    };
    const cs = list.items.find((p) => p.name === 'BSc. Computer Science')!;
    const detail = (await (
      await app.request(`/api/programmes/${cs.id}`)
    ).json()) as ProgrammeDetail;
    expect(detail).toMatchObject({
      campus: 'Legon',
      facultySchool: 'College of Basic and Applied Sciences',
      cycle: {
        academicYear: '2026/2027',
        notes:
          'Cut-off 7 (first choice), published by UG for 2026/2027 admissions. Fee-paying cut-off: 9. Second-choice cut-off: 8.',
        verification: { source: { url: 'https://admissions.ug.edu.gh/undergraduate/cut-off' } },
      },
    });
    const aggregate = detail.cycle!.requirements!.children.find(
      (c) => c.kind === 'rule' && c.ruleType === 'aggregate_max',
    );
    expect(aggregate).toMatchObject({ params: { maxAggregate: 7, basis: 'cutoff' } });
  });

  it('can remove an import so a corrected dataset can be loaded again (development only)', async () => {
    expect(await removeInstitution(database, 'knust')).toBe(true);
    expect(await removeInstitution(database, 'knust')).toBe(false);
    expect(await importInstitution(database, KNUST)).toEqual({ created: true, programmes: 109 });
    const enabled = await database.sql`
      SELECT count(*)::int AS n FROM pg_trigger
      WHERE tgname IN ('programme_cycles_freeze', 'requirement_groups_freeze', 'requirement_rules_freeze')
        AND tgenabled = 'O'`;
    expect(enabled[0]!.n).toBe(3);
  });
});
