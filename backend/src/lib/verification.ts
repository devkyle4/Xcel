import type { VerifiableEntityType, VerificationInfo } from '@xcel/shared';
import { and, desc, eq, inArray } from 'drizzle-orm';
import type { Db } from '../db/client';
import { sources, verificationRecords } from '../db/schema';

/** Latest successful verification (and its source) for each entity. */
export async function latestVerifications(
  db: Db,
  entityType: VerifiableEntityType,
  entityIds: string[],
): Promise<Map<string, VerificationInfo>> {
  if (entityIds.length === 0) return new Map();

  const rows = await db
    .selectDistinctOn([verificationRecords.entityId], {
      entityId: verificationRecords.entityId,
      verifiedAt: verificationRecords.verifiedAt,
      sourceId: sources.id,
      title: sources.title,
      url: sources.url,
      publisher: sources.publisher,
      academicYear: sources.academicYear,
    })
    .from(verificationRecords)
    .leftJoin(sources, eq(sources.id, verificationRecords.sourceId))
    .where(
      and(
        eq(verificationRecords.entityType, entityType),
        inArray(verificationRecords.entityId, entityIds),
        eq(verificationRecords.status, 'verified'),
      ),
    )
    .orderBy(verificationRecords.entityId, desc(verificationRecords.verifiedAt));

  return new Map(
    rows.map((r) => [
      r.entityId,
      {
        verifiedAt: r.verifiedAt.toISOString(),
        source: r.sourceId
          ? { title: r.title!, url: r.url, publisher: r.publisher, academicYear: r.academicYear }
          : null,
      },
    ]),
  );
}
