import { describe, expect, it } from 'vitest';
import { PUBLISH_STATUSES } from './domain';
import { canTransition, PUBLISH_TRANSITIONS, slugify } from './publishing';

describe('publishing workflow', () => {
  it('requires verification before publishing', () => {
    expect(canTransition('draft', 'published')).toBe(false);
    expect(canTransition('needs_verification', 'published')).toBe(false);
    expect(canTransition('verified', 'published')).toBe(true);
  });

  it('can unpublish and republish without re-verifying', () => {
    expect(canTransition('published', 'unpublished')).toBe(true);
    expect(canTransition('unpublished', 'published')).toBe(true);
  });

  it('can archive from anywhere and restore only to draft', () => {
    for (const status of PUBLISH_STATUSES.filter((s) => s !== 'archived')) {
      expect(canTransition(status, 'archived')).toBe(true);
    }
    expect(PUBLISH_TRANSITIONS.archived).toEqual(['draft']);
  });

  it('never allows a transition to the same status', () => {
    for (const status of PUBLISH_STATUSES) expect(canTransition(status, status)).toBe(false);
  });
});

describe('slugify', () => {
  it.each([
    ['University of Ghana', 'university-of-ghana'],
    ['Kwame Nkrumah Univ. of Sci. & Tech.', 'kwame-nkrumah-univ-of-sci-and-tech'],
    ['Université de Lomé', 'universite-de-lome'],
    ['  BSc (Hons) Computer Science  ', 'bsc-hons-computer-science'],
    ['---', ''],
  ])('%s -> %s', (name, slug) => {
    expect(slugify(name)).toBe(slug);
  });

  it('respects the maximum length without a trailing hyphen', () => {
    expect(slugify('a b '.repeat(50), 9)).toBe('a-b-a-b-a');
  });
});
