import {
  type EligibilityBundle,
  type Paginated,
  type ScholarshipSummary,
  validateRequirementTree,
} from '@xcel/shared';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../../app';
import { getDatabase } from '../client';
import { seedDemo } from './demo';
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
});
