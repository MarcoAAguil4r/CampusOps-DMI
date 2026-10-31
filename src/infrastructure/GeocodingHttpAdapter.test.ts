import { GeocodingHttpAdapter } from './GeocodingHttpAdapter';
import { ContractError, HttpStatusError, TransportTimeoutError } from './httpErrors';

function response(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(payload),
  } as Response;
}

type FetchCall = Readonly<{ input: RequestInfo | URL; init: RequestInit | undefined }>;

function fetchResponse(payload: unknown, status = 200, call?: { value: FetchCall | null }): typeof fetch {
  return async (input, init) => {
    if (call !== undefined) call.value = { input, init };
    return response(payload, status);
  };
}

describe('GeocodingHttpAdapter', () => {
  test('maps Nominatim results to the public provider-location contract', async () => {
    const call: { value: FetchCall | null } = { value: null };
    const fetcher = fetchResponse([{ display_name: 'Zona ficticia', lat: '19.4', lon: '-99.1' }], 200, call);
    const adapter = new GeocodingHttpAdapter({
      endpointUrl: 'https://example.test/search',
      minimumRequestIntervalMs: 0,
      fetcher,
    });

    await expect(adapter.geocode('Zona ficticia')).resolves.toEqual({
      source: 'provider',
      label: 'Zona ficticia',
      latitude: 19.4,
      longitude: -99.1,
    });
    expect(String(call.value?.input)).toContain('q=Zona+ficticia');
    expect(call.value?.init?.headers).toMatchObject({ 'User-Agent': 'CampusOps/1.0 (academic project)' });
  });

  test('supports the controlled CampusOps geocoding response shape', async () => {
    const call: { value: FetchCall | null } = { value: null };
    const adapter = new GeocodingHttpAdapter({
      endpointUrl: 'http://127.0.0.1:4310/v1/geocoding',
      minimumRequestIntervalMs: 0,
      scenario: 'success',
      fetcher: fetchResponse({ label: 'Edificio ficticio', latitude: 0, longitude: 0 }, 200, call),
    });

    await expect(adapter.geocode('Edificio ficticio')).resolves.toMatchObject({
      source: 'provider',
      latitude: 0,
      longitude: 0,
    });
    expect(call.value?.init?.headers).toMatchObject({ 'X-Course-Scenario': 'success' });
  });

  test('returns null when the provider has no matching result', async () => {
    const adapter = new GeocodingHttpAdapter({
      endpointUrl: 'https://example.test/search',
      minimumRequestIntervalMs: 0,
      fetcher: fetchResponse([]),
    });
    const nullable = new GeocodingHttpAdapter({
      endpointUrl: 'http://127.0.0.1:4310/v1/geocoding',
      minimumRequestIntervalMs: 0,
      scenario: 'nullable',
      fetcher: fetchResponse(null),
    });

    await expect(adapter.geocode('Zona inexistente')).resolves.toBeNull();
    await expect(nullable.geocode('Zona ficticia')).resolves.toBeNull();
  });

  test('surfaces rate limits and malformed responses as errors', async () => {
    const limited = new GeocodingHttpAdapter({
      endpointUrl: 'https://example.test/search',
      minimumRequestIntervalMs: 0,
      fetcher: fetchResponse(null, 429),
    });
    const malformed = new GeocodingHttpAdapter({
      endpointUrl: 'https://example.test/search',
      minimumRequestIntervalMs: 0,
      fetcher: fetchResponse({ label: 'Zona sin coordenadas' }),
    });

    await limited.geocode('Zona ficticia').catch((error: unknown) => {
      expect(error).toBeInstanceOf(HttpStatusError);
      if (!(error instanceof HttpStatusError)) throw error;
      expect(error.status).toBe(429);
    });
    await expect(malformed.geocode('Zona ficticia')).resolves.toBeNull();
  });

  test('classifies a network abort as a timeout', async () => {
    const abort = new Error('Aborted');
    abort.name = 'AbortError';
    const adapter = new GeocodingHttpAdapter({
      endpointUrl: 'https://example.test/search',
      minimumRequestIntervalMs: 0,
      fetcher: async () => {
        throw abort;
      },
    });

    await expect(adapter.geocode('Zona ficticia')).rejects.toBeInstanceOf(TransportTimeoutError);
  });

  test('rejects malformed JSON and invalid timeout configuration', async () => {
    const malformedJson = new GeocodingHttpAdapter({
      endpointUrl: 'https://example.test/search',
      minimumRequestIntervalMs: 0,
      fetcher: async () => ({
        ...response(null),
        text: async () => {
          return '{invalid json';
        },
      }) as Response,
    });

    await expect(malformedJson.geocode('Zona ficticia')).rejects.toBeInstanceOf(ContractError);
    expect(() => new GeocodingHttpAdapter({ timeoutMs: 0 })).toThrow(RangeError);
  });
});
