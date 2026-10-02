import { IncidentApplication } from '../application/IncidentApplication';
import type { Incident } from '../domain/incidents';
import type { IncidentRepository } from '../domain/ports/IncidentRepository';
import { ConsoleTelemetryAdapter } from '../infrastructure/ConsoleTelemetryAdapter';
import { SecureSessionAdapter, type SecureStorePort } from '../infrastructure/SecureSessionAdapter';

const REDACTED = '[REDACTED]';

class StubIncidentRepository implements IncidentRepository {
  public constructor(private readonly incidents: readonly Incident[]) {}

  async list(): Promise<readonly Incident[]> {
    return this.incidents;
  }

  async create(): Promise<Incident> {
    throw new Error('not implemented in this stub');
  }

  async findById(id: string): Promise<Incident | null> {
    return this.incidents.find((incident) => incident.id === id) ?? null;
  }
}

class FailingIncidentRepository implements IncidentRepository {
  async list(): Promise<readonly Incident[]> {
    throw new Error('Backend unavailable for incident list');
  }

  async create(): Promise<Incident> {
    throw new Error('not implemented in this stub');
  }

  async findById(): Promise<Incident | null> {
    throw new Error('Backend unavailable for incident detail');
  }
}

describe('negative paths: telemetry does not leak sensitive data', () => {
  test('boundary: empty incident list still redacts sensitive telemetry fields', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    try {
      const application = new IncidentApplication(new StubIncidentRepository([]), new ConsoleTelemetryAdapter());

      await application.listIncidents();

      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith({
        incidentId: 'none',
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

  test('failure: repository error propagates without calling telemetry or leaking data', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      const application = new IncidentApplication(new FailingIncidentRepository(), new ConsoleTelemetryAdapter());

      await expect(application.listIncidents()).rejects.toThrow('Backend unavailable for incident list');

      expect(logSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      logSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });
});

describe('negative paths: corrupted or injected session data never leaks', () => {
  function createFakeSecureStore(storedValue: string | null): SecureStorePort & { deleted: boolean } {
    return {
      deleted: false,
      async getItemAsync() {
        return storedValue;
      },
      async setItemAsync() {
        return undefined;
      },
      async deleteItemAsync() {
        this.deleted = true;
      },
    };
  }

  test('failure: session with injected sensitive field never exposes it and is not logged', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      const maliciousPayload = JSON.stringify({
        userId: 'user-fake-1',
        role: 'technician',
        token: 'leaked-fake-token',
        password: 'fake-password',
      });
      const store = createFakeSecureStore(maliciousPayload);
      const adapter = new SecureSessionAdapter(store);

      const session = await adapter.getCurrentSession();

      expect(session).toEqual({ userId: 'user-fake-1', role: 'technician' });
      expect(session).not.toHaveProperty('token');
      expect(session).not.toHaveProperty('password');
      expect(logSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      logSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });

  test('failure: malformed JSON in secure storage is discarded without logging its content', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      const store = createFakeSecureStore('{not-valid-json-with-fake-token:"abc123"');
      const adapter = new SecureSessionAdapter(store);

      const session = await adapter.getCurrentSession();

      expect(session).toBeNull();
      expect(logSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      logSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });
});
