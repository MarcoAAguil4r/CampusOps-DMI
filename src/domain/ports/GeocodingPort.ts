import type { IncidentLocation } from '../../campusops/contracts';

export interface GeocodingPort {
  geocode(query: string): Promise<IncidentLocation | null>;
}
