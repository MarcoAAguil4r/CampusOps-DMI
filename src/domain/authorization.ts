import type { CampusRole, IncidentStatus } from '../campusops/contracts';

/**
 * Client-side authorization for CampusOps profiles.
 * Mirrors the teaching backend rules in course-backend/campusops.mjs so the app
 * validates permissions before calling the API (hiding UI is not enough).
 *
 * Does not handle login, refresh, or token storage — those belong to Integrante 1.
 */

export type IncidentAction =
  | 'create'
  | 'view'
  | 'assign'
  | 'prioritize'
  | 'start'
  | 'resolve'
  | 'close'
  | 'reopen'
  | 'comment'
  | 'add_evidence';

export type IncidentAuthContext = Readonly<{
  reporterId: string;
  assignedTechnicianId: string | null;
  status: IncidentStatus;
}>;

export type AuthorizationDecision = Readonly<{
  allowed: boolean;
  reason: 'allowed' | 'forbidden' | 'unknown_action' | 'unknown_role';
}>;

const COORDINATOR_ACTIONS: ReadonlySet<IncidentAction> = new Set([
  'assign',
  'prioritize',
  'close',
  'reopen',
]);

const TECHNICIAN_ACTIONS: ReadonlySet<IncidentAction> = new Set(['start', 'resolve']);

const SHARED_ACTIONS: ReadonlySet<IncidentAction> = new Set(['comment', 'add_evidence']);

const ALL_ACTIONS: ReadonlySet<IncidentAction> = new Set([
  'create',
  'view',
  ...COORDINATOR_ACTIONS,
  ...TECHNICIAN_ACTIONS,
  ...SHARED_ACTIONS,
]);

/**
 * Visibility rule (same as backend `visible`):
 * - coordinator: all incidents
 * - reporter: only incidents they reported
 * - technician: only incidents assigned to them
 */
export function canViewIncident(
  role: CampusRole,
  actorId: string,
  incident: Readonly<{ reporterId: string; assignedTechnicianId: string | null }>,
): boolean {
  if (role === 'coordinator') return true;
  if (role === 'reporter') return incident.reporterId === actorId;
  if (role === 'technician') return incident.assignedTechnicianId === actorId;
  return false;
}

/**
 * Whether the actor may perform `action` on the given incident context.
 * `create` does not require an incident context (pass null).
 */
export function authorizeIncidentAction(
  role: CampusRole,
  actorId: string,
  action: IncidentAction,
  incident: IncidentAuthContext | null,
): AuthorizationDecision {
  if (!ALL_ACTIONS.has(action)) {
    return { allowed: false, reason: 'unknown_action' };
  }

  if (action === 'create') {
    if (role !== 'reporter') return { allowed: false, reason: 'forbidden' };
    return { allowed: true, reason: 'allowed' };
  }

  if (incident === null) {
    return { allowed: false, reason: 'forbidden' };
  }

  if (action === 'view') {
    return canViewIncident(role, actorId, incident)
      ? { allowed: true, reason: 'allowed' }
      : { allowed: false, reason: 'forbidden' };
  }

  if (COORDINATOR_ACTIONS.has(action)) {
    if (role !== 'coordinator') return { allowed: false, reason: 'forbidden' };
    return { allowed: true, reason: 'allowed' };
  }

  if (TECHNICIAN_ACTIONS.has(action)) {
    if (role !== 'technician' || !canViewIncident(role, actorId, incident)) {
      return { allowed: false, reason: 'forbidden' };
    }
    return { allowed: true, reason: 'allowed' };
  }

  if (SHARED_ACTIONS.has(action)) {
    if (!canViewIncident(role, actorId, incident)) {
      return { allowed: false, reason: 'forbidden' };
    }
    return { allowed: true, reason: 'allowed' };
  }

  return { allowed: false, reason: 'unknown_action' };
}

/**
 * Actions the UI may offer for this role + incident.
 * Always re-check with authorizeIncidentAction before executing.
 */
export function listAllowedActions(
  role: CampusRole,
  actorId: string,
  incident: IncidentAuthContext | null,
): readonly IncidentAction[] {
  const candidates: IncidentAction[] =
    incident === null
      ? ['create']
      : [
          'view',
          'assign',
          'prioritize',
          'start',
          'resolve',
          'close',
          'reopen',
          'comment',
          'add_evidence',
        ];

  return candidates.filter(
    (action) => authorizeIncidentAction(role, actorId, action, incident).allowed,
  );
}
