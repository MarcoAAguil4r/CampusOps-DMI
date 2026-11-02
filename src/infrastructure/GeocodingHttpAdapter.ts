import type { GeocodingPort } from '../domain/ports/GeocodingPort';
import type { IncidentLocation } from '../campusops/contracts';
import { selectIncidentLocation } from '../course-evaluation';
import { ContractError, HttpStatusError, TransportError, TransportTimeoutError } from './httpErrors';

const DEFAULT_ENDPOINT = 'https://nominatim.openstreetmap.org/search';
const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_MIN_REQUEST_INTERVAL_MS = 1000;

export type GeocodingHttpAdapterConfig = Readonly<{
  endpointUrl?: string;
  timeoutMs?: number;
  minimumRequestIntervalMs?: number;
  scenario?: string;
  fetcher?: typeof fetch;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseCoordinate(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function providerCandidate(value: unknown): unknown {
  if (value === null) return null;

  if (Array.isArray(value)) {
    const first = value[0];
    if (first === undefined) return null;
    if (!isRecord(first)) throw new ContractError('Geocoding response item is malformed');
    return {
      label: first.display_name,
      latitude: parseCoordinate(first.lat),
      longitude: parseCoordinate(first.lon),
    };
  }

  if (!isRecord(value)) throw new ContractError('Geocoding response does not satisfy the published contract');
  return {
    label: value.label,
    latitude: value.latitude,
    longitude: value.longitude,
  };
}

export class GeocodingHttpAdapter implements GeocodingPort {
  private readonly endpointUrl: string;
  private readonly timeoutMs: number;
  private readonly minimumRequestIntervalMs: number;
  private readonly scenario: string | undefined;
  private readonly fetcher: typeof fetch;
  private nextRequestAt = 0;

  public constructor(config: GeocodingHttpAdapterConfig = {}) {
    this.endpointUrl = config.endpointUrl ?? process.env.EXPO_PUBLIC_GEOCODING_URL ?? DEFAULT_ENDPOINT;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.minimumRequestIntervalMs = config.minimumRequestIntervalMs ?? DEFAULT_MIN_REQUEST_INTERVAL_MS;
    this.scenario = config.scenario;
    this.fetcher = config.fetcher ?? fetch;
    if (!Number.isFinite(this.timeoutMs) || this.timeoutMs <= 0) {
      throw new RangeError('Geocoding timeout must be a positive finite number');
    }
    if (!Number.isFinite(this.minimumRequestIntervalMs) || this.minimumRequestIntervalMs < 0) {
      throw new RangeError('Geocoding request interval must be a non-negative finite number');
    }
  }

  async geocode(query: string): Promise<IncidentLocation | null> {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length === 0) throw new Error('A non-empty location query is required');

    const url = new URL(this.endpointUrl);
    url.searchParams.set('q', normalizedQuery);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('limit', '1');

    await this.waitForRequestSlot();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    let responseText: string;
    try {
      const headers: Record<string, string> = {
        Accept: 'application/json',
        'User-Agent': 'CampusOps/1.0 (academic project)',
      };
      if (this.scenario !== undefined) headers['X-Course-Scenario'] = this.scenario;

      response = await this.fetcher(url.toString(), { headers, signal: controller.signal });
      if (!response.ok) throw new HttpStatusError(response.status, null);
      responseText = await response.text();
    } catch (error) {
      if (error instanceof HttpStatusError) throw error;
      if (error instanceof Error && error.name === 'AbortError') throw new TransportTimeoutError();
      throw new TransportError();
    } finally {
      clearTimeout(timeout);
    }

    let payload: unknown;
    try {
      payload = responseText.length > 0 ? JSON.parse(responseText) : null;
    } catch {
      throw new ContractError('Geocoding response is not valid JSON');
    }

    const candidate = providerCandidate(payload);
    if (candidate === null) return null;
    const location = selectIncidentLocation(candidate, 'Ubicación no disponible');
    return location.source === 'provider' ? location : null;
  }

  private async waitForRequestSlot(): Promise<void> {
    const now = Date.now();
    const scheduledAt = Math.max(now, this.nextRequestAt);
    this.nextRequestAt = scheduledAt + this.minimumRequestIntervalMs;
    const delayMs = scheduledAt - now;
    if (delayMs > 0) await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
  }
}
