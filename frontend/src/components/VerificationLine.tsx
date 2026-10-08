import type { VerificationInfo } from '@xcel/shared';
import { formatDate } from '../lib/format';

/** "Verified on {date} · Source: {link}" (SRS 10). */
export function VerificationLine({ verification }: { verification: VerificationInfo | null }) {
  if (!verification) {
    return (
      <p className="text-sm">
        This information has not yet been verified against an official source.
      </p>
    );
  }
  const { source } = verification;
  return (
    <p className="text-sm">
      Verified on {formatDate(verification.verifiedAt)}
      {source && (
        <>
          {' · Source: '}
          {source.url ? (
            <a href={source.url} target="_blank" rel="noopener noreferrer">
              {source.title} <span className="sr-only">(opens in a new tab)</span>
            </a>
          ) : (
            source.title
          )}
        </>
      )}
    </p>
  );
}
