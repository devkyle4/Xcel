import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.url(),
  /** Secret for HMAC-keyed rate limiting. Generate with: openssl rand -base64 48 */
  APP_SECRET: z.string().min(32, 'APP_SECRET must be at least 32 characters'),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

export function getEnv(): Env {
  cached ??= envSchema.parse(process.env);
  return cached;
}
