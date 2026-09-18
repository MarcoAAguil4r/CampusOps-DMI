import type { Incident } from '../incidents';

export interface IncidentRepository {
  list(): Promise<readonly Incident[]>;
  findById(id: string): Promise<Incident | null>;
}
