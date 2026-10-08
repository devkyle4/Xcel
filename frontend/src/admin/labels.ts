import type { PublishStatus, VerificationStatus } from '@xcel/shared';

export const PUBLISH_STATUS_LABELS: Record<PublishStatus, string> = {
  draft: 'Draft',
  needs_verification: 'Needs verification',
  verified: 'Verified',
  published: 'Published',
  unpublished: 'Unpublished',
  archived: 'Archived',
};

export const VERIFICATION_STATUS_LABELS: Record<VerificationStatus, string> = {
  pending: 'Pending',
  verified: 'Verified',
  rejected: 'Could not verify',
};
