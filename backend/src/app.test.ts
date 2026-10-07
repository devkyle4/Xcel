import { describe, expect, it } from 'vitest';
import { createApp } from './app';

describe('GET /api/health', () => {
  it('reports ok when the database is reachable', async () => {
    const app = createApp({ pingDatabase: async () => true });
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok', database: 'ok' });
  });

  it('reports degraded with 503 when the database is unreachable', async () => {
    const app = createApp({ pingDatabase: async () => false });
    const res = await app.request('/api/health');
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: 'degraded', database: 'unreachable' });
  });
});

describe('unknown routes', () => {
  it('returns a JSON 404', async () => {
    const app = createApp({ pingDatabase: async () => true });
    const res = await app.request('/api/nope');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Not found' });
  });
});
