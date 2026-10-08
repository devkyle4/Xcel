// Produces .vercel/output (Vercel Build Output API v3):
//   static/          -> the built frontend (frontend/dist)
//   functions/api.func -> the whole backend bundled into one Node serverless function
// Requests to /api/* are routed to that function; everything else falls back to the SPA.
import { build } from 'esbuild';
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = `${root}.vercel/output`;
const funcDir = `${out}/functions/api.func`;

await rm(out, { recursive: true, force: true });
await mkdir(funcDir, { recursive: true });

await cp(`${root}frontend/dist`, `${out}/static`, { recursive: true });

await build({
  entryPoints: [`${root}backend/src/vercel.ts`],
  outfile: `${funcDir}/index.mjs`,
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  sourcemap: true,
  // Some bundled CJS deps call require(); provide it in the ESM output.
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
});

await writeFile(
  `${funcDir}/.vc-config.json`,
  JSON.stringify(
    {
      runtime: 'nodejs22.x',
      handler: 'index.mjs',
      launcherType: 'Nodejs',
      shouldAddHelpers: false,
    },
    null,
    2,
  ),
);

// Security headers for every response. The API also sets its own (hono/secure-headers).
// Only Cloudflare Turnstile (the mentor request CAPTCHA) is loaded from elsewhere;
// images may come from any https address (provider logos, mentor photos).
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' https://challenges.cloudflare.com",
  "frame-src https://challenges.cloudflare.com",
  "connect-src 'self' https://challenges.cloudflare.com",
  "img-src 'self' https: data:",
  // Turnstile adds inline styles to its widget.
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ');

export const SECURITY_HEADERS = {
  'Content-Security-Policy': CONTENT_SECURITY_POLICY,
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
};

await writeFile(
  `${out}/config.json`,
  JSON.stringify(
    {
      version: 3,
      routes: [
        { src: '/(.*)', headers: SECURITY_HEADERS, continue: true },
        // Built assets have content hashes in their names, so they never change.
        {
          src: '^/assets/(.*)$',
          headers: { 'Cache-Control': 'public, max-age=31536000, immutable' },
          continue: true,
        },
        { src: '^/api(?:/.*)?$', dest: '/api' },
        { handle: 'filesystem' },
        // The app shell is always revalidated so a new deployment is picked up at once.
        {
          src: '/.*',
          dest: '/index.html',
          headers: { 'Cache-Control': 'public, max-age=0, must-revalidate' },
        },
      ],
    },
    null,
    2,
  ),
);

console.log('Vercel build output written to .vercel/output');
