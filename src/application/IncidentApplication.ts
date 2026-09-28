import type { Incident } from '../domain/incidents';
import type { IncidentRepository } from '../domain/ports/IncidentRepository';
import type { TelemetryPort } from '../domain/TelemetryPort';

export type { Incident } from '../domain/incidents';

export class IncidentApplication {
  public constructor(
    private readonly incidents: IncidentRepository,
    private readonly telemetry?: TelemetryPort,
  ) {}

  async listIncidents(): Promise<readonly Incident[]> {
    const startedAt = Date.now();
    const incidents = await this.incidents.list();

    this.telemetry?.logEvent({
      incidentId: incidents[0]?.id ?? 'none',
      status: 'success',
      durationMs: Date.now() - startedAt,
      token: 'fake-telemetry-token',
      reporterId: 'fake-reporter',
      location: { latitude: 19, longitude: -98 },
    });

    return incidents;
  }

  getIncidentDetail(id: string): Promise<Incident | null> {
    return this.incidents.findById(id);
  }
}
