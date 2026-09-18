import type { Incident } from '../domain/incidents';
import type { IncidentRepository } from '../domain/ports/IncidentRepository';

export class InMemoryIncidentRepository implements IncidentRepository {
  public constructor(private readonly incidents: readonly Incident[]) {}

  async list(): Promise<readonly Incident[]> {
    return this.incidents;
  }

  async findById(id: string): Promise<Incident | null> {
    return this.incidents.find((incident) => incident.id === id) ?? null;
  }
}

export const fictitiousIncidents: readonly Incident[] = [
  {
    id: 'inc-001',
    title: 'Luz intermitente',
    description: 'Una luminaria del aula ficticia requiere revisión.',
    category: 'electrical',
    status: 'open',
    location: { source: 'manual', label: 'Edificio académico ficticio A' },
  },
  {
    id: 'inc-002',
    title: 'Equipo sin conexión',
    description: 'Un equipo de práctica ficticio no tiene conectividad.',
    category: 'connectivity',
    status: 'in_progress',
    location: { source: 'manual', label: 'Laboratorio ficticio B' },
  },
];
