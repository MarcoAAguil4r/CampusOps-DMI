import {
  IncidentAuthorizationError,
  IncidentAuthorizationService,
} from './IncidentAuthorizationService';
import type { IncidentAuthContext } from '../domain/authorization';

const incident: IncidentAuthContext = {
  reporterId: 'reporter-1',
  assignedTechnicianId: 'technician-1',
  status: 'assigned',
};

describe('IncidentAuthorizationService', () => {
  test('assertAllowed lets assigned technician start', () => {
    const auth = new IncidentAuthorizationService('technician', 'technician-1');
    expect(() => auth.assertAllowed('start', incident)).not.toThrow();
  });

  test('assertAllowed blocks displaced technician', () => {
    const auth = new IncidentAuthorizationService('technician', 'technician-2');
    expect(() => auth.assertAllowed('start', incident)).toThrow(IncidentAuthorizationError);
    try {
      auth.assertAllowed('start', incident);
    } catch (error) {
      expect(error).toBeInstanceOf(IncidentAuthorizationError);
      expect((error as IncidentAuthorizationError).code).toBe('forbidden');
      expect((error as IncidentAuthorizationError).action).toBe('start');
    }
  });

  test('coordinator can close resolved work', () => {
    const auth = new IncidentAuthorizationService('coordinator', 'coordinator-1');
    const resolved: IncidentAuthContext = { ...incident, status: 'resolved' };
    expect(() => auth.assertAllowed('close', resolved)).not.toThrow();
    expect(() => auth.assertAllowed('reopen', resolved)).not.toThrow();
  });

  test('reporter cannot create is inverted — reporter can create', () => {
    const reporter = new IncidentAuthorizationService('reporter', 'reporter-1');
    expect(() => reporter.assertAllowed('create', null)).not.toThrow();
    const tech = new IncidentAuthorizationService('technician', 'technician-1');
    expect(() => tech.assertAllowed('create', null)).toThrow(IncidentAuthorizationError);
  });

  test('exposes actor and allowed action list for UI gating', () => {
    const auth = new IncidentAuthorizationService('coordinator', 'coordinator-1');
    expect(auth.getActor()).toEqual({ role: 'coordinator', actorId: 'coordinator-1' });
    expect(auth.allowedActions(incident)).toContain('assign');
    expect(auth.canView(incident)).toBe(true);
  });
});
