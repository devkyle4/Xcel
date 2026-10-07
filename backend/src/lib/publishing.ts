import { canTransition, type PublishStatus } from '@xcel/shared';
import { ConflictError } from './http';

/**
 * Column changes for a publishing-workflow transition, or ConflictError if
 * the workflow does not allow it.
 */
export function transition(from: PublishStatus, to: PublishStatus, now = new Date()) {
  if (!canTransition(from, to)) {
    throw new ConflictError(`Cannot change status from ${from} to ${to}`);
  }
  return {
    status: to,
    ...(to === 'published' && { publishedAt: now }),
    ...(to === 'archived' && { archivedAt: now }),
    ...(from === 'archived' && { archivedAt: null }),
  };
}
