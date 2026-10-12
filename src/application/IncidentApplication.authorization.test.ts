import { IncidentApplication, authorizationFromIdentity } from './IncidentApplication';
import { IncidentAuthorizationError, IncidentAuthorizationService } from './IncidentAuthorizationService';
import type { Incident } from '../domain/incidents';
import type { IncidentAuthContext } from '../domain/authorization';
import type { IncidentRepository, NewRemoteIncidentInput } from '../domain/ports/IncidentRepository';

class RecordingRepository implements IncidentRepository {
  public createCalls = 0;

  async list(): Promise<readonly Incident[]> {
    return [];
  }

  async findById(): Promise<Incident | null> {
    return null;
  }

  async create(input: NewRemoteIncidentInput): Promise<Incident> {
    this.createCalls += 1;
    return {
      id: 'created-1',
      title: input.description,
      description: input.description,
      category: input.category,
      status: 'open',
      location: { source: 'manual', label: input.location },
    };
  }
}

const assignedContext: IncidentAuthContext = {
  reporterId: 'reporter-1',
  assignedTechnicianId: 'technician-1',
  status: 'assigned',
};

const resolvedContext: IncidentAuthContext = {
  reporterId: 'reporter-1',
  assignedTechnicianId: 'technician-1',
  status: 'resolved',
};

describe('IncidentApplication authorization integration', () => {
  test('reporter can create; repository is only called when allowed', async () => {
    const repo = new RecordingRepository();
    const auth = authorizationFromIdentity({
      actorId: 'reporter-1',
      role: 'reporter',
      authToken: 'course-valid-token',
    });
    const app = new IncidentApplication(repo, undefined, auth);

    expect(app.getActor()).toEqual({ role: 'reporter', actorId: 'reporter-1' });

    await expect(
      app.createIncident({
        category: 'connectivity',
        description: 'Sin red en lab ficticio',
        location: 'Edificio A',
        idempotencyKey: 'create-key-001',
      }),
    ).resolves.toMatchObject({ id: 'created-1', status: 'open' });

    expect(repo.createCalls).toBe(1);
  });

  test('technician cannot create — blocked before repository', async () => {
    const repo = new RecordingRepository();
    const app = new IncidentApplication(
      repo,
      undefined,
      new IncidentAuthorizationService('technician', 'technician-1'),
    );

    await expect(
      app.createIncident({
        category: 'connectivity',
        description: 'Intento no autorizado',
        location: 'Edificio A',
        idempotencyKey: 'create-key-002',
      }),
    ).rejects.toBeInstanceOf(IncidentAuthorizationError);

    expect(repo.createCalls).toBe(0);
  });

  test('displaced technician cannot start assigned incident', () => {
    const app = new IncidentApplication(
      new RecordingRepository(),
      undefined,
      authorizationFromIdentity({ actorId: 'technician-2', role: 'technician' }),
    );

    expect(() => app.assertIncidentAction('start', assignedContext)).toThrow(
      IncidentAuthorizationError,
    );
  });

  test('assigned technician may start; coordinator may close', () => {
    const techApp = new IncidentApplication(
      new RecordingRepository(),
      undefined,
      authorizationFromIdentity({ actorId: 'technician-1', role: 'technician' }),
    );
    expect(() => techApp.assertIncidentAction('start', assignedContext)).not.toThrow();

    const coordApp = new IncidentApplication(
      new RecordingRepository(),
      undefined,
      authorizationFromIdentity({ actorId: 'coordinator-1', role: 'coordinator' }),
    );
    expect(() => coordApp.assertIncidentAction('close', resolvedContext)).not.toThrow();
    expect(() => coordApp.assertIncidentAction('reopen', resolvedContext)).not.toThrow();
  });

  test('reporter cannot close — operation blocked', () => {
    const app = new IncidentApplication(
      new RecordingRepository(),
      undefined,
      authorizationFromIdentity({ actorId: 'reporter-1', role: 'reporter' }),
    );

    expect(() => app.assertIncidentAction('close', resolvedContext)).toThrow(
      IncidentAuthorizationError,
    );
  });

  test('identity actorId aligns with X-Course-Actor fixture names', () => {
    const identity = {
      actorId: 'technician-1',
      role: 'technician' as const,
      authToken: 'course-valid-token',
    };
    const auth = authorizationFromIdentity(identity);
    expect(auth.getActor().actorId).toBe(identity.actorId);
    expect(auth.getActor().role).toBe(identity.role);
    expect(identity.authToken).toBe('course-valid-token');
  });
});
