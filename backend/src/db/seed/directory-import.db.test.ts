import { type UniversityDetail, universityCreateSchema } from '@xcel/shared';
import { eq, inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../../app';
import { getDatabase } from '../client';
import { sources, universities, verificationRecords } from '../schema';
import { DIRECTORY_SOURCE, GHANA_UNIVERSITIES } from './data/ghana-universities';
import { importUniversityDirectory } from './directory-import';

const database = getDatabase();
const app = createApp();
const slugs = GHANA_UNIVERSITIES.map((u) => u.slug);

/** Removes what this test imported, so other test files see the database as before. */
async function cleanUp() {
  const rows = await database.db
    .select({ id: universities.id })
    .from(universities)
    .where(inArray(universities.slug, [...slugs, 'test-existing-university']));
  const ids = rows.map((r) => r.id);
  if (ids.length) {
    await database.db.delete(verificationRecords).where(inArray(verificationRecords.entityId, ids));
    await database.db.delete(universities).where(inArray(universities.id, ids));
  }
  await database.db.delete(sources).where(eq(sources.url, DIRECTORY_SOURCE.url));
}

afterAll(async () => {
  await cleanUp();
  await database.sql.end();
});

describe('Ghana university directory', () => {
  it('passes the same checks as the admin API, with unique slugs and names', () => {
    for (const { gtecCategory: _, nameNote: __, ...u } of GHANA_UNIVERSITIES) {
      expect(universityCreateSchema.safeParse(u).success, u.slug).toBe(true);
      if (u.websiteUrl) expect(u.websiteUrl, u.slug).toMatch(/^https:\/\/[a-z0-9.-]+\.edu\.gh$/);
    }
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(new Set(GHANA_UNIVERSITIES.map((u) => u.name.toLowerCase())).size).toBe(slugs.length);
    // KNUST and UG are loaded with their programmes by the university importer.
    expect(slugs).not.toContain('knust');
    expect(GHANA_UNIVERSITIES.map((u) => u.name)).not.toContain('University of Ghana');
  });

  it('imports once, published and verified, without touching universities already present', async () => {
    await cleanUp();
    // An existing record with the same name as one in the list is left alone.
    await database.db.insert(universities).values({
      slug: 'test-existing-university',
      name: 'University of Cape Coast',
      institutionType: 'public_university',
      town: 'Edited by an admin',
    });

    const first = await importUniversityDirectory(database, GHANA_UNIVERSITIES);
    expect(first.skipped).toEqual(['ucc']);
    expect(first.imported).toHaveLength(GHANA_UNIVERSITIES.length - 1);
    expect((await importUniversityDirectory(database, GHANA_UNIVERSITIES)).imported).toEqual([]);

    const [ucc] = await database.db
      .select({ town: universities.town })
      .from(universities)
      .where(eq(universities.name, 'University of Cape Coast'));
    expect(ucc?.town).toBe('Edited by an admin');

    const utas = (await (await app.request('/api/universities/utas')).json()) as UniversityDetail;
    expect(utas).toMatchObject({
      name: 'University of Technology and Applied Sciences, Navrongo',
      region: 'upper_east',
      websiteUrl: 'https://utas.edu.gh',
      programmes: [],
      verification: { source: { url: DIRECTORY_SOURCE.url } },
    });
  });
});
