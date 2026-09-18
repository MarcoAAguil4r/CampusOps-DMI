import type { Incident } from '../domain/incidents';
import type { IncidentRepository } from '../domain/ports/IncidentRepository';

export type { Incident } from '../domain/incidents';

export class IncidentApplication {
  public constructor(private readonly incidents: IncidentRepository) {}

  listIncidents(): Promise<readonly Incident[]> {
    return this.incidents.list();
  }

  getIncidentDetail(id: string): Promise<Incident | null> {
    return this.incidents.findById(id);
  }
}
