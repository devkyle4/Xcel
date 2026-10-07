import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import { pingDatabase as defaultPing } from './db/client';
import { healthRoutes } from './routes/health';

export interface AppDeps {
  pingDatabase: () => Promise<boolean>;
}

export function createApp(deps: AppDeps = { pingDatabase: defaultPing }) {
  const app = new Hono().basePath('/api');

  app.use(secureHeaders());
  app.route('/health', healthRoutes(deps.pingDatabase));

  app.notFound((c) => c.json({ error: 'Not found' }, 404));
  app.onError((err, c) => {
    // Log only the error, never request bodies — they may contain student data.
    console.error(err);
    return c.json({ error: 'Internal server error' }, 500);
  });

  return app;
}
