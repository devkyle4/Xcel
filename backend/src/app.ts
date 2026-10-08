import type { ApiError } from '@xcel/shared';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { secureHeaders } from 'hono/secure-headers';
import { DrizzleQueryError } from 'drizzle-orm';
import { type Database, getDatabase, pingDatabase as defaultPing } from './db/client';
import { ConflictError, NotFoundError, pgErrorCode, ValidationError } from './lib/http';
import { adminRoutes } from './modules/admin';
import { type CaptchaVerifier, getCaptchaVerifier } from './lib/captcha';
import { getMailer, type Mailer } from './lib/mailer';
import { catalogueRoutes } from './modules/catalogue';
import { mentorRoutes } from './modules/mentors';
import { eligibilityRoutes } from './modules/eligibility';
import { programmeRoutes } from './modules/programmes';
import { reportRoutes } from './modules/reports';
import { scholarshipRoutes } from './modules/scholarships';
import { universityRoutes } from './modules/universities';
import { healthRoutes } from './routes/health';

export interface AppDeps {
  getDatabase: () => Database;
  pingDatabase: () => Promise<boolean>;
  getMailer: () => Mailer;
  getCaptchaVerifier: () => CaptchaVerifier;
}

export function createApp(overrides: Partial<AppDeps> = {}) {
  const deps: AppDeps = {
    getDatabase,
    pingDatabase: defaultPing,
    getMailer,
    getCaptchaVerifier,
    ...overrides,
  };
  const db = () => deps.getDatabase().db;

  const app = new Hono().basePath('/api');

  app.use(secureHeaders());
  app.route('/health', healthRoutes(deps.pingDatabase));
  app.route('/', catalogueRoutes(db));
  app.route('/universities', universityRoutes(db));
  app.route('/programmes', programmeRoutes(db));
  app.route('/scholarships', scholarshipRoutes(db));
  app.route('/eligibility', eligibilityRoutes(db));
  app.route('/reports', reportRoutes(db));
  app.route(
    '/mentors',
    mentorRoutes(db, { mailer: deps.getMailer, verifyCaptcha: deps.getCaptchaVerifier }),
  );
  app.route('/admin', adminRoutes(db));

  app.notFound((c) => c.json<ApiError>({ error: 'Not found' }, 404));
  app.onError((err, c) => {
    if (err instanceof ValidationError) {
      return c.json<ApiError>({ error: err.message, issues: err.issues }, 400);
    }
    if (err instanceof NotFoundError) return c.json<ApiError>({ error: err.message }, 404);
    if (err instanceof ConflictError) {
      return c.json<ApiError>(
        { error: err.message, ...(err.issues && { issues: err.issues }) },
        409,
      );
    }
    if (err instanceof HTTPException) return err.getResponse();
    if (pgErrorCode(err) === '23505') {
      return c.json<ApiError>({ error: 'A record with these details already exists' }, 409);
    }
    // Raised by database triggers protecting history, e.g. editing a published cycle.
    if (pgErrorCode(err) === '23000') {
      return c.json<ApiError>({ error: 'This change is not allowed for this record' }, 409);
    }
    // Log only the error, never request bodies, query strings or query parameters.
    console.error(loggableError(err));
    return c.json<ApiError>({ error: 'Internal server error' }, 500);
  });

  return app;
}

/**
 * Drizzle's query errors carry the SQL parameters, which can hold record
 * values; log the underlying database error instead.
 */
export function loggableError(err: unknown): unknown {
  if (err instanceof DrizzleQueryError) {
    return err.cause ?? new Error('Database query failed');
  }
  return err;
}
