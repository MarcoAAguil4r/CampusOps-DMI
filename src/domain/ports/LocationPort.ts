import type { IncidentLocation } from '../../campusops/contracts';

export interface LocationPort {
  getCurrentLocation(): Promise<IncidentLocation>;
}
