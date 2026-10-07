import type { PublishStatus } from './domain';

/**
 * Allowed publishing-workflow transitions:
 * Draft -> Needs verification -> Verified -> Published, with Unpublished and
 * Archived. Publishing always passes through Verified.
 */
export const PUBLISH_TRANSITIONS: Readonly<Record<PublishStatus, readonly PublishStatus[]>> = {
  draft: ['needs_verification', 'archived'],
  needs_verification: ['verified', 'draft', 'archived'],
  verified: ['published', 'needs_verification', 'archived'],
  published: ['unpublished', 'archived'],
  unpublished: ['published', 'needs_verification', 'archived'],
  archived: ['draft'],
};

export function canTransition(from: PublishStatus, to: PublishStatus): boolean {
  return PUBLISH_TRANSITIONS[from].includes(to);
}

/** URL-safe slug from a name, e.g. "Université de Lomé" -> "universite-de-lome". */
export function slugify(name: string, maxLength = 80): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, maxLength)
    .replace(/^-+|-+$/g, '');
}
