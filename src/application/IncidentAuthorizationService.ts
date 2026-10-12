import type { CampusRole } from '../campusops/contracts';
import {
  authorizeIncidentAction,
  canViewIncident,
  listAllowedActions,
  type AuthorizationDecision,
  type IncidentAction,
  type IncidentAuthContext,
} from '../domain/authorization';

/**
 * Application-layer gate for incident operations by CampusOps profile.
 * Call before repository/API mutations so forbidden actions fail closed in the client.
 * Independent of session refresh / token coordination (Integrante 1).
 */
export class IncidentAuthorizationService {
  public constructor(
    private readonly role: CampusRole,
    private readonly actorId: string,
  ) {}

  getActor(): Readonly<{ role: CampusRole; actorId: string }> {
    return { role: this.role, actorId: this.actorId };
  }

  canView(incident: Readonly<{ reporterId: string; assignedTechnicianId: string | null }>): boolean {
    return canViewIncident(this.role, this.actorId, incident);
  }

  authorize(
    action: IncidentAction,
    incident: IncidentAuthContext | null,
  ): AuthorizationDecision {
    return authorizeIncidentAction(this.role, this.actorId, action, incident);
  }

  /**
   * Throws if the action is not allowed — use at the start of command handlers.
   */
  assertAllowed(action: IncidentAction, incident: IncidentAuthContext | null): void {
    const decision = this.authorize(action, incident);
    if (!decision.allowed) {
      throw new IncidentAuthorizationError(action, this.role, this.actorId, decision.reason);
    }
  }

  allowedActions(incident: IncidentAuthContext | null): readonly IncidentAction[] {
    return listAllowedActions(this.role, this.actorId, incident);
  }
}

export class IncidentAuthorizationError extends Error {
  public readonly code = 'forbidden' as const;

  public constructor(
    public readonly action: IncidentAction,
    public readonly role: CampusRole,
    public readonly actorId: string,
    public readonly reason: AuthorizationDecision['reason'],
  ) {
    super(`Actor ${actorId} (${role}) is not allowed to perform "${action}" (${reason})`);
    this.name = 'IncidentAuthorizationError';
  }
}
