import { Hono } from 'hono';
import { csrf } from 'hono/csrf';
import type { Db } from '../../db/client';
import { type AdminEnv, requireRole } from '../../lib/auth/middleware';
import { auditLogRoutes } from './audit-logs';
import { adminAuthRoutes } from './auth';
import { programmeAdminRoutes } from './programmes';
import { settingsAdminRoutes } from './settings';
import { sourceAdminRoutes } from './sources';
import { facultySchoolAdminRoutes, universityAdminRoutes } from './universities';
import { verificationRoutes } from './verification';

/**
 * Everything under /api/admin. Authorization is enforced here on the server:
 * apart from the auth endpoints, every route requires an admin session, so
 * unknown admin paths answer 401 rather than revealing what exists.
 */
export function adminRoutes(db: () => Db) {
  const admin = new Hono<AdminEnv>();

  admin.use('*', async (c, next) => {
    await next();
    c.header('Cache-Control', 'no-store');
  });
  // Rejects cross-site form posts; the session cookie is also SameSite=Strict.
  admin.use('*', csrf());

  admin.route('/auth', adminAuthRoutes(db));

  admin.use('*', requireRole(db, 'admin'));
  admin.route('/audit-logs', auditLogRoutes(db));
  admin.route('/universities', universityAdminRoutes(db));
  admin.route('/faculty-schools', facultySchoolAdminRoutes(db));
  admin.route('/programmes', programmeAdminRoutes(db));
  admin.route('/sources', sourceAdminRoutes(db));
  admin.route('/verification', verificationRoutes(db));
  admin.route('/settings', settingsAdminRoutes(db));

  return admin;
}
