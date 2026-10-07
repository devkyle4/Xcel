import type { Db, Executor, Tx } from '../db/client';
import { auditLogs } from '../db/schema';

export interface AuditEntry {
  /** Null for actions run outside a login session, e.g. the admin:create script. */
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
}

/** Fields that must never be written to the audit log. */
const REDACTED_KEYS = new Set(['passwordHash', 'password']);

/** Copies a value for the audit log with secrets replaced by "[redacted]". */
export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, REDACTED_KEYS.has(k) ? '[redacted]' : redact(v)]),
    );
  }
  return value;
}

/** Records an audit entry. Call inside the transaction that makes the change. */
export async function recordAudit(tx: Executor, entry: AuditEntry) {
  await tx.insert(auditLogs).values({
    actorUserId: entry.actorUserId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    before: entry.before === undefined ? null : redact(entry.before),
    after: entry.after === undefined ? null : redact(entry.after),
  });
}

/**
 * Runs an admin write and its audit entries in one transaction: if either
 * fails, neither is saved. Every admin write must go through this.
 */
export function audited<T>(
  db: Db,
  actorUserId: string | null,
  write: (tx: Tx, audit: (entry: Omit<AuditEntry, 'actorUserId'>) => Promise<void>) => Promise<T>,
): Promise<T> {
  return db.transaction((tx) => write(tx, (entry) => recordAudit(tx, { ...entry, actorUserId })));
}
