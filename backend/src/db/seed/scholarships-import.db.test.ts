import type { Paginated, ScholarshipDetail, ScholarshipSummary } from '@xcel/shared';
import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../../app';
import { getDatabase } from '../client';
import { scholarships } from '../schema';
import { GHANA_UNDERGRADUATE_SCHOLARSHIPS } from './data/ghana-undergraduate-scholarships';
import { importScholarships } from './scholarships-import';

const database = getDatabase();
const app = createApp();

afterAll(async () => {
  await database.sql.end();
});

describe('researched scholarship import', () => {
  it('records every scholarship with an official https source', () => {
    for (const s of GHANA_UNDERGRADUATE_SCHOLARSHIPS) {
      expect(s.source.url, s.slug).toMatch(/^https:\/\//);
      expect(s.requirements.length, s.slug).toBeGreaterThan(0);
      expect(s.logoUrl, s.slug).toMatch(/^\/logos\/[a-z0-9-]+\.(webp|svg)$/);
    }
  });

  it('imports once, publishes verified records and keeps unverified ones as drafts', async () => {
    const first = await importScholarships(database, GHANA_UNDERGRADUATE_SCHOLARSHIPS);
    expect(first.imported).toHaveLength(GHANA_UNDERGRADUATE_SCHOLARSHIPS.length);
    expect(first.drafts).toEqual(['getfund-local-undergraduate-scholarship']);
    const second = await importScholarships(database, GHANA_UNDERGRADUATE_SCHOLARSHIPS);
    expect(second.imported).toEqual([]);

    const [getfund] = await database.db
      .select({ status: scholarships.status })
      .from(scholarships)
      .where(eq(scholarships.slug, 'getfund-local-undergraduate-scholarship'));
    expect(getfund?.status).toBe('draft');
    expect(
      (await app.request('/api/scholarships/getfund-local-undergraduate-scholarship')).status,
    ).toBe(404);

    const algeria = (await (
      await app.request('/api/scholarships/algeria-ghana-government-scholarship')
    ).json()) as ScholarshipDetail;
    expect(algeria).toMatchObject({
      availability: 'closed',
      requirements: expect.arrayContaining(['WASSCE aggregate of 13 or better']),
      verification: { source: { url: expect.stringContaining('scholarships.gov.gh') } },
    });

    // Closed by the provider without a published closing date: never shown as open.
    const thrive = (await (
      await app.request('/api/scholarships/thrive-and-shine-steam-scholarship')
    ).json()) as ScholarshipDetail;
    expect(thrive).toMatchObject({ availability: 'closed', closesOn: null, studyLevels: [] });

    const fawe = (await (
      await app.request('/api/scholarships/fawe-ghana-mastercard-foundation-bursary')
    ).json()) as ScholarshipDetail;
    expect(fawe).toMatchObject({
      availability: 'closed',
      closesOn: '2026-09-15',
      studyLevels: ['diploma'],
      officialUrl: expect.stringContaining('fawegh.org'),
    });

    // Open in rounds with no fixed closing date: shown as open, with the provider logo.
    const ashesiMcf = (await (
      await app.request('/api/scholarships/mastercard-foundation-scholars-ashesi')
    ).json()) as ScholarshipDetail;
    expect(ashesiMcf).toMatchObject({
      availability: 'open',
      closesOn: null,
      logoUrl: '/logos/mastercard-foundation.webp',
      officialUrl: 'https://ashesi.edu.gh/how-to-apply/',
    });

    const gnpc = (await (
      await app.request('/api/scholarships/gnpc-foundation-local-scholarship')
    ).json()) as ScholarshipDetail;
    expect(gnpc.availability).toBe('unknown');

    const list = (await (
      await app.request('/api/scholarships?studyLevel=undergraduate&pageSize=50')
    ).json()) as Paginated<ScholarshipSummary>;
    expect(list.items.map((s) => s.slug)).toEqual(
      expect.arrayContaining([
        'mtn-bright-scholarship',
        'gsa-local-tertiary-scholarship',
        'ashesi-need-based-scholarships',
      ]),
    );
  });
});
