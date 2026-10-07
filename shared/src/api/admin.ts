import { z } from 'zod';
import type { UserRole } from '../domain';
import { paginationQuerySchema } from './queries';

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 256;

export const loginRequestSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const newPasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH);

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface AuditLogEntry {
  id: number;
  occurredAt: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actor: { id: string; name: string; email: string } | null;
  before: unknown;
  after: unknown;
}

export const auditLogQuerySchema = paginationQuerySchema.extend({
  entityType: z.string().trim().max(64).optional(),
  entityId: z.string().trim().max(64).optional(),
  actorUserId: z.uuid().optional(),
});
