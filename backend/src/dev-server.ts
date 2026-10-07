// Local development only. Production runs src/vercel.ts as a serverless function.
import { serve } from '@hono/node-server';
import { createApp } from './app';

const port = Number(process.env.PORT ?? 3001);

serve({ fetch: createApp().fetch, port }, (info) => {
  console.log(`API listening on http://localhost:${info.port}/api`);
});
