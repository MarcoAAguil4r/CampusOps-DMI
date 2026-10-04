import type { Incident } from '../incidents';
import type { IncidentCategory } from '../../campusops/contracts';

export type NewRemoteIncidentInput = Readonly<{
  category: IncidentCategory;
  description: string;
  location: string;
  idempotencyKey: string;
}>;

export interface IncidentRepository {
  list(): Promise<readonly Incident[]>;
  findById(id: string): Promise<Incident | null>;
  create(input: NewRemoteIncidentInput): Promise<Incident>;
}
