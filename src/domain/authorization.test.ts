import {
  authorizeIncidentAction,
  canViewIncident,
  listAllowedActions,
  type IncidentAuthContext,
} from './authorization';

const assignedToTech1: IncidentAuthContext = {
  reporterId: 'reporter-1',
  assignedTechnicianId: 'technician-1',
  status: 'assigned',
};

const inProgressTech1: IncidentAuthContext = {
  reporterId: 'reporter-1',
  assignedTechnicianId: 'technician-1',
  status: 'in_progress',
};

const resolvedTech1: IncidentAuthContext = {
  reporterId: 'reporter-1',
  assignedTechnicianId: 'technician-1',
  status: 'resolved',
};

describe('canViewIncident', () => {
  test('coordinator sees every incident', () => {
    expect(canViewIncident('coordinator', 'coordinator-1', assignedToTech1)).toBe(true);
  });

  test('reporter only sees own reports', () => {
    expect(canViewIncident('reporter', 'reporter-1', assignedToTech1)).toBe(true);
    expect(canViewIncident('reporter', 'reporter-2', assignedToTech1)).toBe(false);
  });

  test('technician only sees incidents assigned to them', () => {
    expect(canViewIncident('technician', 'technician-1', assignedToTech1)).toBe(true);
    expect(canViewIncident('technician', 'technician-2', assignedToTech1)).toBe(false);
  });
});

describe('authorizeIncidentAction — create', () => {
  test('only reporter may create', () => {
    expect(authorizeIncidentAction('reporter', 'reporter-1', 'create', null)).toEqual({
      allowed: true,
      reason: 'allowed',
    });
    expect(authorizeIncidentAction('technician', 'technician-1', 'create', null)).toEqual({
      allowed: false,
      reason: 'forbidden',
    });
    expect(authorizeIncidentAction('coordinator', 'coordinator-1', 'create', null)).toEqual({
      allowed: false,
      reason: 'forbidden',
    });
  });
});

describe('authorizeIncidentAction — technician resolves assigned incident', () => {
  test('assigned technician may start and resolve', () => {
    expect(authorizeIncidentAction('technician', 'technician-1', 'start', assignedToTech1)).toEqual({
      allowed: true,
      reason: 'allowed',
    });
    expect(authorizeIncidentAction('technician', 'technician-1', 'resolve', inProgressTech1)).toEqual({
      allowed: true,
      reason: 'allowed',
    });
  });

  test('displaced technician cannot start after reassignment', () => {
    const reassigned: IncidentAuthContext = {
      ...assignedToTech1,
      assignedTechnicianId: 'technician-2',
    };
    expect(authorizeIncidentAction('technician', 'technician-1', 'start', reassigned)).toEqual({
      allowed: false,
      reason: 'forbidden',
    });
  });

  test('technician cannot close or assign', () => {
    expect(authorizeIncidentAction('technician', 'technician-1', 'close', resolvedTech1)).toEqual({
      allowed: false,
      reason: 'forbidden',
    });
    expect(authorizeIncidentAction('technician', 'technician-1', 'assign', assignedToTech1)).toEqual({
      allowed: false,
      reason: 'forbidden',
    });
  });
});

describe('authorizeIncidentAction — coordinator close and reopen', () => {
  test('coordinator may close and reopen', () => {
    expect(authorizeIncidentAction('coordinator', 'coordinator-1', 'close', resolvedTech1)).toEqual({
      allowed: true,
      reason: 'allowed',
    });
    expect(authorizeIncidentAction('coordinator', 'coordinator-1', 'reopen', resolvedTech1)).toEqual({
      allowed: true,
      reason: 'allowed',
    });
  });

  test('coordinator may assign and prioritize', () => {
    expect(authorizeIncidentAction('coordinator', 'coordinator-1', 'assign', assignedToTech1)).toEqual({
      allowed: true,
      reason: 'allowed',
    });
    expect(authorizeIncidentAction('coordinator', 'coordinator-1', 'prioritize', assignedToTech1)).toEqual({
      allowed: true,
      reason: 'allowed',
    });
  });

  test('reporter cannot close or reopen', () => {
    expect(authorizeIncidentAction('reporter', 'reporter-1', 'close', resolvedTech1)).toEqual({
      allowed: false,
      reason: 'forbidden',
    });
    expect(authorizeIncidentAction('reporter', 'reporter-1', 'reopen', resolvedTech1)).toEqual({
      allowed: false,
      reason: 'forbidden',
    });
  });
});

describe('authorizeIncidentAction — shared and view', () => {
  test('reporter cannot view another reporter incident', () => {
    expect(authorizeIncidentAction('reporter', 'reporter-2', 'view', assignedToTech1)).toEqual({
      allowed: false,
      reason: 'forbidden',
    });
  });

  test('visible actors may comment and add evidence', () => {
    expect(authorizeIncidentAction('reporter', 'reporter-1', 'comment', assignedToTech1).allowed).toBe(
      true,
    );
    expect(
      authorizeIncidentAction('technician', 'technician-1', 'add_evidence', assignedToTech1).allowed,
    ).toBe(true);
    expect(
      authorizeIncidentAction('technician', 'technician-2', 'comment', assignedToTech1).allowed,
    ).toBe(false);
  });
});

describe('listAllowedActions', () => {
  test('technician on assigned incident gets start/resolve/comment/evidence/view', () => {
    const allowed = listAllowedActions('technician', 'technician-1', assignedToTech1);
    expect(allowed).toEqual(
      expect.arrayContaining(['view', 'start', 'resolve', 'comment', 'add_evidence']),
    );
    expect(allowed).not.toContain('close');
    expect(allowed).not.toContain('assign');
    expect(allowed).not.toContain('create');
  });

  test('coordinator gets coordination actions', () => {
    const allowed = listAllowedActions('coordinator', 'coordinator-1', resolvedTech1);
    expect(allowed).toEqual(
      expect.arrayContaining(['view', 'assign', 'prioritize', 'close', 'reopen', 'comment', 'add_evidence']),
    );
    expect(allowed).not.toContain('start');
    expect(allowed).not.toContain('resolve');
  });

  test('without incident only create is considered for reporter', () => {
    expect(listAllowedActions('reporter', 'reporter-1', null)).toEqual(['create']);
    expect(listAllowedActions('technician', 'technician-1', null)).toEqual([]);
  });
});
