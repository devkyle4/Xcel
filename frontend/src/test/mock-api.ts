type Handler = unknown | ((url: URL, init?: RequestInit) => unknown);

/**
 * Replaces fetch with canned API responses keyed by "METHOD /api/path".
 * Unknown paths answer 404. Returns the mock so tests can inspect every
 * request the page made.
 */
export function mockApi(routes: Record<string, Handler>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost');
    const handler = routes[`${init?.method ?? 'GET'} ${url.pathname}`];
    if (handler === undefined) return Response.json({ error: 'Not found' }, { status: 404 });
    const body = typeof handler === 'function' ? handler(url, init) : handler;
    return body instanceof Response ? body : Response.json(body);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
