import { CampusOpsApiClient } from './CampusOpsApiClient';
import { ContractError, HttpStatusError, TransportError, TransportTimeoutError } from './httpErrors';
import { RemoteIncidentRepository } from './RemoteIncidentRepository';
import { IncidentDomainMappingError } from '../domain/incidents';

function mockFetchOnce(status: number, body: unknown, delayMs = 0): void {
  global.fetch = jest.fn().mockImplementation(
    (_url: string, init?: RequestInit) =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          resolve({
            ok: status >= 200 && status < 300,
            status,
            text: async () => (body === undefined ? '' : JSON.stringify(body)),
          } as Response);
        }, delayMs);

        init?.signal?.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
        });
      }),
  );
}

function mockMalformedJson(): void {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: async () => '{"items": [}',
  } as Response);
}

describe('RemoteIncidentRepository', () => {
  const client = new CampusOpsApiClient({ baseUrl: 'http://127.0.0.1:4310', actorId: 'reporter-1', timeoutMs: 200 });
  const repository = new RemoteIncidentRepository(client);

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('success: maps a valid incident list to domain objects', async () => {
    mockFetchOnce(200, {
      items: [
        {
          id: 'campus-inc-001',
          version: 1,
          status: 'assigned',
          payload: { category: 'connectivity', description: 'Falla ficticia', location: 'Edificio de prueba A' },
        },
      ],
    });

    const result = await repository.list();

    expect(result).toEqual([
      {
        id: 'campus-inc-001',
        title: 'Problema de conectividad',
        description: 'Falla ficticia',
        category: 'connectivity',
        status: 'assigned',
        location: { source: 'manual', label: 'Edificio de prueba A' },
      },
    ]);
  });

  test('payload null is a valid contract state but cannot be converted to a domain incident', async () => {
    mockFetchOnce(200, { id: 'r-2', version: 3, status: 'closed', payload: null });

    const error = await repository.findById('r-2').catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(IncidentDomainMappingError);
    expect(error).not.toBeInstanceOf(ContractError);
  });

  test('malformed JSON response is rejected without fabricating data', async () => {
    mockMalformedJson();

    await expect(repository.list()).rejects.toThrow(ContractError);
  });

  test('timeout is represented as a distinct transport error', async () => {
    mockFetchOnce(200, { items: [] }, 5000);

    await expect(repository.list()).rejects.toThrow(TransportTimeoutError);
  });

  test('connection failure is represented as a transport error, not a raw fetch exception', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('network details should not escape'));

    const error = await repository.list().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(TransportError);
    expect(error).not.toBeInstanceOf(TransportTimeoutError);
    expect((error as Error).message).not.toContain('network details');
  });

  test('timeout remains active while the response body is read', async () => {
    global.fetch = jest.fn((_url: RequestInfo | URL, init?: RequestInit) => Promise.resolve({
      ok: true,
      status: 200,
      text: () => new Promise((resolve, reject) => {
        const fallback = setTimeout(() => resolve('{"items": []}'), 400);
        init?.signal?.addEventListener('abort', () => {
          clearTimeout(fallback);
          reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
        });
      }),
    } as Response));

    await expect(repository.list()).rejects.toThrow(TransportTimeoutError);
  });

  test('server error 500 is represented as a distinguishable HTTP error, not a generic exception', async () => {
    mockFetchOnce(500, { code: 'controlled_failure' });

    const error = await repository.list().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(HttpStatusError);
    expect((error as HttpStatusError).status).toBe(500);
    expect((error as HttpStatusError).code).toBe('controlled_failure');
  });

  test('create sends category, description and location and maps the server response', async () => {
    const idempotencyKey = 'create-water-operation-1';
    mockFetchOnce(201, {
      incident: {
        id: 'campus-inc-200',
        version: 1,
        status: 'open',
        payload: { category: 'water', description: 'Fuga ficticia', location: 'Edificio de prueba B' },
      },
      operationId: 'create-water-1',
      duplicate: false,
    });

    const created = await repository.create({
      category: 'water',
      description: 'Fuga ficticia',
      location: 'Edificio de prueba B',
      idempotencyKey,
    });

    expect(created).toEqual({
      id: 'campus-inc-200',
      title: 'Fuga de agua',
      description: 'Fuga ficticia',
      category: 'water',
      status: 'open',
      location: { source: 'manual', label: 'Edificio de prueba B' },
    });
    expect(global.fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:4310/v1/incidents',
      expect.objectContaining({
        headers: expect.objectContaining({ 'Idempotency-Key': idempotencyKey }),
        body: JSON.stringify({ category: 'water', description: 'Fuga ficticia', location: 'Edificio de prueba B' }),
      }),
    );
  });

  test('retries creation with the same idempotency key and request body', async () => {
    const idempotencyKey = 'create-water-operation-replay';
    const requestInits: RequestInit[] = [];
    const incident = {
      id: 'campus-inc-201',
      version: 1,
      status: 'open',
      payload: { category: 'water', description: 'Fuga ficticia', location: 'Edificio de prueba B' },
    };
    global.fetch = jest.fn((_url: RequestInfo | URL, init?: RequestInit) => {
      requestInits.push(init ?? {});
      const duplicate = requestInits.length > 1;
      return Promise.resolve({
        ok: true,
        status: duplicate ? 200 : 201,
        text: async () => JSON.stringify({ incident, operationId: idempotencyKey, duplicate }),
      } as Response);
    });

    const input = {
      category: 'water' as const,
      description: 'Fuga ficticia',
      location: 'Edificio de prueba B',
      idempotencyKey,
    };
    await repository.create(input);
    await repository.create(input);

    expect(requestInits.map((init) => (init.headers as Record<string, string>)['Idempotency-Key']))
      .toEqual([idempotencyKey, idempotencyKey]);
    expect(requestInits.map((init) => JSON.parse(init.body as string))).toEqual([
      { category: 'water', description: 'Fuga ficticia', location: 'Edificio de prueba B' },
      { category: 'water', description: 'Fuga ficticia', location: 'Edificio de prueba B' },
    ]);
  });
});
