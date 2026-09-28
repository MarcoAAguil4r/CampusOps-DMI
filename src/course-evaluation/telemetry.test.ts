import { IncidentApplication } from '../application/IncidentApplication';
import type { Incident } from '../domain/incidents';
import type { IncidentRepository } from '../domain/ports/IncidentRepository';
import { ConsoleTelemetryAdapter } from '../infrastructure/ConsoleTelemetryAdapter';
import { redactForTelemetry } from './index';

const REDACTED = '[REDACTED]';

class StubIncidentRepository implements IncidentRepository {
  public constructor(private readonly incidents: readonly Incident[]) {}

  async list(): Promise<readonly Incident[]> {
    return this.incidents;
  }

  async findById(id: string): Promise<Incident | null> {
    return this.incidents.find((incident) => incident.id === id) ?? null;
  }
}

const incident: Incident = {
  id: 'telemetry-inc-001',
  title: 'Incidencia ficticia',
  description: 'Solo para pruebas de telemetria.',
  category: 'maintenance',
  status: 'open',
  location: { source: 'manual', label: 'Zona ficticia' },
};

test('redacts direct sensitive keys and normalized key variants', () => {
  expect(
    redactForTelemetry({
      token: 'fake',
      password: 'fake',
      email: 'fake@campusops.test',
      access_token: 'fake',
      'REFRESH-TOKEN': 'fake',
      Authorization: 'Bearer fake',
      incidentId: 'telemetry-inc-001',
      correlationId: 'correlation-001',
      status: 'open',
      attempt: 2,
      durationMs: 15,
    }),
  ).toEqual({
    token: REDACTED,
    password: REDACTED,
    email: REDACTED,
    access_token: REDACTED,
    'REFRESH-TOKEN': REDACTED,
    Authorization: REDACTED,
    incidentId: 'telemetry-inc-001',
    correlationId: 'correlation-001',
    status: 'open',
    attempt: 2,
    durationMs: 15,
  });
});

test('redacts nested objects, arrays, and deep mixed structures', () => {
  expect(
    redactForTelemetry({
      metadata: {
        users: [{ access_token: 'fake' }],
        nested: { entries: [{ reporterId: 'fake-reporter' }] },
      },
      incidentId: 'telemetry-inc-001',
    }),
  ).toEqual({
    metadata: {
      users: [{ access_token: REDACTED }],
      nested: { entries: [{ reporterId: REDACTED }] },
    },
    incidentId: 'telemetry-inc-001',
  });
});

test('replaces every sensitive value as a whole and does not mutate input', () => {
  const input = {
    token: 'fake-string',
    userId: 42,
    evidence: { nested: 'fake' },
    photos: ['fake-photo'],
    metadata: { status: 'open' },
  };
  const original = JSON.parse(JSON.stringify(input));

  expect(redactForTelemetry(input)).toEqual({
    token: REDACTED,
    userId: REDACTED,
    evidence: REDACTED,
    photos: REDACTED,
    metadata: { status: 'open' },
  });
  expect(input).toEqual(original);
});

test('preserves null, undefined, primitives, Date, Map, and Set without throwing', () => {
  const date = new Date('2026-01-01T00:00:00.000Z');
  const map = new Map([['safe', 'value']]);
  const set = new Set(['safe']);
  const result = redactForTelemetry({ nullValue: null, undefinedValue: undefined, date, map, set, count: 1 }) as Record<
    string,
    unknown
  >;

  expect(result).toMatchObject({ nullValue: null, undefinedValue: undefined, count: 1 });
  expect(result.date).toBe(date);
  expect(result.map).toBe(map);
  expect(result.set).toBe(set);
});

test('logs a redacted event through IncidentApplication and ConsoleTelemetryAdapter', async () => {
  const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

  try {
    const application = new IncidentApplication(
      new StubIncidentRepository([incident]),
      new ConsoleTelemetryAdapter(),
    );

    await application.listIncidents();

    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith({
      incidentId: 'telemetry-inc-001',
      status: 'success',
      durationMs: expect.any(Number),
      token: REDACTED,
      reporterId: REDACTED,
      location: REDACTED,
    });
  } finally {
    logSpy.mockRestore();
  }
});
