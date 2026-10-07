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

await writeFile(
  `${out}/config.json`,
  JSON.stringify(
    {
      version: 3,
      routes: [
        { src: '^/api(?:/.*)?$', dest: '/api' },
        { handle: 'filesystem' },
        { src: '/.*', dest: '/index.html' },
      ],
    },
    null,
    2,
  ),
);

console.log('Vercel build output written to .vercel/output');
