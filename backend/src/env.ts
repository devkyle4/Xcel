import { z } from 'zod';

/** Cloudflare's documented test secret: always passes. Only allowed outside production. */
export const TURNSTILE_TEST_SECRET = '1x0000000000000000000000000000000AA';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    DATABASE_URL: z.url(),
    /** Secret for HMAC-keyed rate limiting. Generate with: openssl rand -base64 48 */
    APP_SECRET: z.string().min(32, 'APP_SECRET must be at least 32 characters'),
    /** Cloudflare Turnstile secret for the mentor request form. */
    TURNSTILE_SECRET_KEY: z.string().min(1).optional(),
    /** Resend API key. Without it, emails go to an in-memory outbox (development only). */
    RESEND_API_KEY: z.string().min(1).optional(),
    /** Sender for mentor emails, e.g. "Xcel <mentors@yourdomain>" on a domain verified with Resend. */
    MAIL_FROM: z.string().min(3).optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;
    for (const key of ['TURNSTILE_SECRET_KEY', 'RESEND_API_KEY', 'MAIL_FROM'] as const) {
      if (!env[key])
        ctx.addIssue({ code: 'custom', path: [key], message: `${key} is required in production` });
    }
  });

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

export function getEnv(): Env {
  cached ??= envSchema.parse(process.env);
  return cached;
}
