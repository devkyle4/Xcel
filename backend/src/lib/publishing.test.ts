import { describe, expect, it } from 'vitest';
import { ConflictError } from './http';
import { transition } from './publishing';
import { uniqueSlug } from './slug';

describe('transition', () => {
  const now = new Date('2026-10-07T12:00:00Z');

  it('stamps publication and archival times', () => {
    expect(transition('verified', 'published', now)).toEqual({
      status: 'published',
      publishedAt: now,
    });
    expect(transition('published', 'archived', now)).toEqual({
      status: 'archived',
      archivedAt: now,
    });
    expect(transition('archived', 'draft', now)).toEqual({ status: 'draft', archivedAt: null });
  });

  it('rejects transitions the workflow does not allow', () => {
    expect(() => transition('draft', 'published')).toThrow(ConflictError);
  });
});

describe('uniqueSlug', () => {
  it('adds a number until the slug is free', async () => {
    const taken = new Set(['university-of-ghana', 'university-of-ghana-2']);
    expect(await uniqueSlug('University of Ghana', async (s) => taken.has(s))).toBe(
      'university-of-ghana-3',
    );
  });

  it('needs a name with letters or numbers', async () => {
    await expect(uniqueSlug('***', async () => false)).rejects.toMatchObject({
      issues: [{ path: 'slug', message: expect.stringMatching(/Enter a slug/) }],
    });
  });
});
