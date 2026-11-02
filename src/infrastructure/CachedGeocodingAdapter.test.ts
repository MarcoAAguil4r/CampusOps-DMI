import type { IncidentLocation } from '../campusops/contracts';
import type { GeocodingPort } from '../domain/ports/GeocodingPort';
import { CachedGeocodingAdapter } from './CachedGeocodingAdapter';

const providerLocation: IncidentLocation = {
  source: 'provider',
  label: 'Zona ficticia',
  latitude: 19,
  longitude: -99,
};

describe('CachedGeocodingAdapter', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  test('caches successful results by normalized query', async () => {
    const geocoding: GeocodingPort = { geocode: jest.fn().mockResolvedValue(providerLocation) };
    const adapter = new CachedGeocodingAdapter(geocoding);

    await expect(adapter.geocode(' Zona Ficticia ')).resolves.toEqual(providerLocation);
    await expect(adapter.geocode('zona ficticia')).resolves.toEqual(providerLocation);

    expect(geocoding.geocode).toHaveBeenCalledTimes(1);
  });

  test('shares an in-flight lookup and does not cache unavailable results', async () => {
    let resolveLookup: ((value: IncidentLocation | null) => void) | undefined;
    const geocoding: GeocodingPort = {
      geocode: jest.fn()
        .mockImplementationOnce(
        () =>
          new Promise<IncidentLocation | null>((resolve) => {
            resolveLookup = resolve;
          }),
        )
        .mockResolvedValue(null),
    };
    const adapter = new CachedGeocodingAdapter(geocoding);
    const first = adapter.geocode('Zona ficticia');
    const second = adapter.geocode('Zona ficticia');
    resolveLookup?.(null);

    await expect(first).resolves.toBeNull();
    await expect(second).resolves.toBeNull();
    await adapter.geocode('Zona ficticia');

    expect(geocoding.geocode).toHaveBeenCalledTimes(2);
  });

  test('expires cached results and evicts the oldest entry at capacity', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-30T12:00:00Z'));
    const geocoding: GeocodingPort = { geocode: jest.fn().mockResolvedValue(providerLocation) };
    const adapter = new CachedGeocodingAdapter(geocoding, { ttlMs: 1000, maxEntries: 1 });

    await adapter.geocode('Primera zona');
    await adapter.geocode('Segunda zona');
    await adapter.geocode('primera zona');
    expect(geocoding.geocode).toHaveBeenCalledTimes(3);

    jest.advanceTimersByTime(1001);
    await adapter.geocode('primera zona');
    expect(geocoding.geocode).toHaveBeenCalledTimes(4);
  });
});
