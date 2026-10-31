import type { GeocodingPort } from '../domain/ports/GeocodingPort';
import type { IncidentLocation } from '../campusops/contracts';

const DEFAULT_TTL_MS = 5 * 60 * 1000;
const DEFAULT_MAX_ENTRIES = 100;

type CacheEntry = Readonly<{
  location: IncidentLocation;
  expiresAt: number;
}>;

export type CachedGeocodingAdapterConfig = Readonly<{
  ttlMs?: number;
  maxEntries?: number;
}>;

export class CachedGeocodingAdapter implements GeocodingPort {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly inFlight = new Map<string, Promise<IncidentLocation | null>>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;

  public constructor(
    private readonly geocoding: GeocodingPort,
    config: CachedGeocodingAdapterConfig = {},
  ) {
    this.ttlMs = config.ttlMs ?? DEFAULT_TTL_MS;
    this.maxEntries = config.maxEntries ?? DEFAULT_MAX_ENTRIES;
    if (!Number.isFinite(this.ttlMs) || this.ttlMs <= 0) {
      throw new RangeError('Geocoding cache TTL must be a positive finite number');
    }
    if (!Number.isInteger(this.maxEntries) || this.maxEntries <= 0) {
      throw new RangeError('Geocoding cache capacity must be a positive integer');
    }
  }

  async geocode(query: string): Promise<IncidentLocation | null> {
    const key = query.trim().replace(/\s+/g, ' ').toLowerCase();
    const cached = this.cache.get(key);
    if (cached !== undefined) {
      if (cached.expiresAt > Date.now()) return cached.location;
      this.cache.delete(key);
    }

    const pending = this.inFlight.get(key);
    if (pending !== undefined) return pending;

    const request = this.geocoding.geocode(query).then((location) => {
      if (location?.source === 'provider') this.store(key, location);
      return location;
    });
    this.inFlight.set(key, request);

    try {
      return await request;
    } finally {
      if (this.inFlight.get(key) === request) this.inFlight.delete(key);
    }
  }

  private store(key: string, location: IncidentLocation): void {
    while (this.cache.size >= this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey === undefined) break;
      this.cache.delete(oldestKey);
    }
    this.cache.set(key, { location, expiresAt: Date.now() + this.ttlMs });
  }
}
