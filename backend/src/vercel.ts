// Vercel serverless entry. Bundled by scripts/build-vercel.mjs into a single function.
// getRequestListener adapts the Hono fetch handler to Node's (req, res) signature.
import { getRequestListener } from '@hono/node-server';
import { createApp } from './app';

export default getRequestListener(createApp().fetch);
