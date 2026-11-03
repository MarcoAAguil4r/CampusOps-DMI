import { CampusOpsApiClient } from './CampusOpsApiClient';
import { HttpStatusError } from './httpErrors';

function response(status: number, body: unknown, headers: HeadersInit = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    text: async () => JSON.stringify(body),
  } as Response;
}

describe('CampusOpsApiClient retry integration', () => {
  afterEach(() => jest.restoreAllMocks());

  test('replays an idempotent POST with the same content and key after 429', async () => {
    const calls: RequestInit[] = [];
    global.fetch = jest.fn((_url: RequestInfo | URL, init?: RequestInit) => {
      calls.push(init ?? {});
      return Promise.resolve(calls.length === 1
        ? response(429, { code: 'rate_limited' }, { 'Retry-After': '2' })
        : response(201, { ok: true }));
    });
    const client = new CampusOpsApiClient({ baseUrl: 'http://example.test', actorId: 'reporter-1' });
    const waits: number[] = [];

    await expect(client.requestWithRetry(
      { method: 'POST', path: '/v1/incidents', body: { description: 'Ficticia' }, idempotencyKey: 'op-429-1' },
      async (delayMs) => { waits.push(delayMs); },
    )).resolves.toEqual({ ok: true });

    expect(waits).toEqual([2000]);
    expect(calls.map((call) => call.body)).toEqual([
      JSON.stringify({ description: 'Ficticia' }),
      JSON.stringify({ description: 'Ficticia' }),
    ]);
    expect(calls.map((call) => (call.headers as Record<string, string>)['Idempotency-Key']))
      .toEqual(['op-429-1', 'op-429-1']);
  });

  test('does not replay a POST without a stable key', async () => {
    global.fetch = jest.fn().mockResolvedValue(response(503, { code: 'unavailable' }));
    const client = new CampusOpsApiClient({ baseUrl: 'http://example.test', actorId: 'reporter-1' });

    await expect(client.requestWithRetry({ method: 'POST', path: '/v1/incidents', body: {} }))
      .rejects.toBeInstanceOf(HttpStatusError);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('does not retry before a Retry-After value beyond the 30 second budget', async () => {
    global.fetch = jest.fn().mockResolvedValue(response(429, { code: 'rate_limited' }, { 'Retry-After': '60' }));
    const client = new CampusOpsApiClient({ baseUrl: 'http://example.test', actorId: 'reporter-1' });

    await expect(client.request({ method: 'GET', path: '/v1/incidents' })).rejects.toMatchObject({ status: 429 });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
