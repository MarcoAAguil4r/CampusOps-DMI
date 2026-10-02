import { CampusOpsApiClient } from './CampusOpsApiClient';
import { ContractError, HttpStatusError, TransportTimeoutError } from './httpErrors';
import { RemoteIncidentRepository } from './RemoteIncidentRepository';

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

    await expect(repository.findById('r-2')).rejects.toThrow(ContractError);
  });

  test('malformed JSON response is rejected without fabricating data', async () => {
    mockMalformedJson();

    await expect(repository.list()).rejects.toThrow(ContractError);
  });

  test('timeout is represented as a distinct transport error', async () => {
    mockFetchOnce(200, { items: [] }, 5000);

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

    const created = await repository.create({ category: 'water', description: 'Fuga ficticia', location: 'Edificio de prueba B' });

    expect(created).toEqual({
      id: 'campus-inc-200',
      title: 'Fuga de agua',
      description: 'Fuga ficticia',
      category: 'water',
      status: 'open',
      location: { source: 'manual', label: 'Edificio de prueba B' },
    });
  });
});
