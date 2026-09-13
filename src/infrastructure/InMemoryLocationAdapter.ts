import type { IncidentLocation } from '../campusops/contracts';
import type { LocationPort } from '../domain/ports/LocationPort';

export class InMemoryLocationAdapter implements LocationPort {
  public constructor(private readonly location: IncidentLocation) {}

  async getCurrentLocation(): Promise<IncidentLocation> {
    return this.location;
  }
}
