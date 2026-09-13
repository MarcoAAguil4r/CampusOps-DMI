import { IncidentApplication } from './IncidentApplication';
import type { Incident } from '../domain/incidents';
import type { IncidentRepository } from '../domain/ports/IncidentRepository';

class StubIncidentRepository implements IncidentRepository {
  public constructor(private readonly incidents: readonly Incident[]) {}

  async list(): Promise<readonly Incident[]> {
    return this.incidents;
  }

  async findById(id: string): Promise<Incident | null> {
    return this.incidents.find((incident) => incident.id === id) ?? null;
  }
}

const stubIncident: Incident = {
  id: 'stub-001',
  title: 'Incidencia desde stub',
  description: 'Datos ficticios de una implementación alternativa.',
  category: 'maintenance',
  status: 'open',
  location: { source: 'manual', label: 'Zona ficticia de prueba' },
};

test('uses an alternative IncidentRepository implementation', async () => {
  const application = new IncidentApplication(new StubIncidentRepository([stubIncident]));

  await expect(application.listIncidents()).resolves.toEqual([stubIncident]);
  await expect(application.getIncidentDetail('stub-001')).resolves.toBe(stubIncident);
  await expect(application.getIncidentDetail('missing')).resolves.toBeNull();
});
