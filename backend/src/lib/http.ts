import type { Context } from 'hono';
import type { z } from 'zod';

export type Issue = { path: string; message: string };

export class ValidationError extends Error {
  constructor(public readonly issues: Issue[]) {
    super('Invalid request');
  }
}

export class NotFoundError extends Error {
  constructor(message = 'Not found') {
    super(message);
  }
}

/** Parses query parameters with a zod schema, throwing ValidationError (400) on failure. */
export function parseQuery<S extends z.ZodType>(c: Context, schema: S): z.output<S> {
  const result = schema.safeParse(c.req.query());
  if (!result.success) {
    throw new ValidationError(
      result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  }
  return result.data;
}

/**
 * Lets Vercel's CDN cache a public response for `seconds` and serve it stale
 * while revalidating. Browsers always revalidate. Only for responses that
 * contain no personal data.
 */
export function cachePublicly(c: Context, seconds: number) {
  c.header(
    'Cache-Control',
    `public, max-age=0, s-maxage=${seconds}, stale-while-revalidate=${seconds * 5}`,
  );
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Reads a UUID path parameter; anything malformed is simply not found. */
export function uuidParam(c: Context, name: string): string {
  const value = c.req.param(name) ?? '';
  if (!UUID_PATTERN.test(value)) throw new NotFoundError();
  return value;
}

export function paginate({ page, pageSize }: { page: number; pageSize: number }) {
  return { limit: pageSize, offset: (page - 1) * pageSize };
}

/** Resolves a `select({ total: count() })` query to its number. */
export async function countOf(query: PromiseLike<{ total: number }[]>): Promise<number> {
  return (await query)[0]?.total ?? 0;
}

/** Parses a JSON request body with a zod schema, throwing ValidationError (400) on failure. */
export async function parseJson<S extends z.ZodType>(c: Context, schema: S): Promise<z.output<S>> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new ValidationError([{ path: '', message: 'Request body must be valid JSON' }]);
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new ValidationError(
      result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  }
  return result.data;
}

/** The request conflicts with the current state, e.g. a disallowed status change (409). */
export class ConflictError extends Error {
  constructor(
    message: string,
    public readonly issues?: Issue[],
  ) {
    super(message);
  }
}

/** Postgres error code from a database error, looking through Drizzle's wrapper. */
export function pgErrorCode(error: unknown): string | undefined {
  for (let e: unknown = error; e && typeof e === 'object'; e = (e as { cause?: unknown }).cause) {
    const code = (e as { code?: unknown }).code;
    if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) return code;
  }
  return undefined;
}
