import type {
  MentorStatus,
  PublishStatus,
  ReportStatus,
  ScholarshipStatus,
  VerificationStatus,
} from '@xcel/shared';

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

export const SCHOLARSHIP_STATUS_LABELS: Record<ScholarshipStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  expired: 'Expired',
  archived: 'Archived',
};

export const MENTOR_STATUS_LABELS: Record<MentorStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
  archived: 'Archived',
};

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  open: 'Open',
  under_review: 'Under review',
  resolved: 'Resolved',
  dismissed: 'Dismissed',
};
