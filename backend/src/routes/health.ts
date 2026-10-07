import type { HealthResponse } from '@xcel/shared';
import { Hono } from 'hono';

export function healthRoutes(pingDatabase: () => Promise<boolean>) {
  return new Hono().get('/', async (c) => {
    const dbOk = await pingDatabase();
    const body: HealthResponse = {
      status: dbOk ? 'ok' : 'degraded',
      database: dbOk ? 'ok' : 'unreachable',
    };
    return c.json(body, dbOk ? 200 : 503);
  });
}
