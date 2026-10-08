import {
  type EligibilityBundle,
  type Paginated,
  type ScholarshipSummary,
  validateRequirementTree,
} from '@xcel/shared';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../../app';
import { getDatabase } from '../client';
import { removeDemo, seedDemo } from './demo';
import { seed } from './seed';

const database = getDatabase();
const app = createApp();

afterAll(async () => {
  await database.sql.end();
});

describe('demo data', () => {
  it('loads valid, published demo content once', async () => {
    await seed(database);
    expect(await seedDemo(database)).toEqual({ created: true });
    expect(await seedDemo(database)).toEqual({ created: false });

    const bundle = (await (
      await app.request('/api/eligibility/requirements')
    ).json()) as EligibilityBundle;
    const demo = bundle.programmes.filter((p) => p.university.slug.startsWith('demo-'));
    expect(demo.map((p) => p.name).sort()).toEqual([
      'BA Education',
      'BSc Computer Science',
      'HND Civil Engineering',
    ]);
    for (const programme of demo) {
      expect(
        validateRequirementTree(programme.requirements, bundle.catalogue),
        programme.name,
      ).toEqual([]);
    }

    const list = (await (
      await app.request('/api/scholarships?q=demo')
    ).json()) as Paginated<ScholarshipSummary>;
    // Search results are ordered by relevance, so compare without order.
    expect(list.items.map((s) => [s.slug, s.availability]).sort()).toEqual([
      ['demo-merit-scholarship', 'open'],
      ['demo-regional-bursary', 'closed'],
      ['demo-women-in-stem-award', 'upcoming'],
    ]);
  });

  it('removes only the demo data, keeping history protection in place', async () => {
    const before =
      await database.sql`SELECT count(*)::int AS n FROM scholarships WHERE slug NOT LIKE 'demo-%'`;
    expect(await removeDemo(database)).toEqual({ removed: true });
    expect(await removeDemo(database)).toEqual({ removed: false });

    const left = await database.sql`
      SELECT (SELECT count(*) FROM universities WHERE slug LIKE 'demo-%')::int AS unis,
             (SELECT count(*) FROM scholarships WHERE slug LIKE 'demo-%')::int AS schols,
             (SELECT count(*) FROM sources WHERE title = 'Demo admissions brochure 2026/2027')::int AS sources`;
    expect(left[0]).toEqual({ unis: 0, schols: 0, sources: 0 });
    const after =
      await database.sql`SELECT count(*)::int AS n FROM scholarships WHERE slug NOT LIKE 'demo-%'`;
    expect(after[0]!.n).toBe(before[0]!.n);

    // The triggers are back on: published cycles still cannot be deleted.
    const enabled = await database.sql`
      SELECT count(*)::int AS n FROM pg_trigger
      WHERE tgname IN ('programme_cycles_freeze', 'requirement_groups_freeze', 'requirement_rules_freeze')
        AND tgenabled = 'O'`;
    expect(enabled[0]!.n).toBe(3);
  });
});
