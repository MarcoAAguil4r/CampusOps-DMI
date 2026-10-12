import type { CampusRole } from '../campusops/contracts';
import type { Incident } from '../domain/incidents';
import type { IncidentAction, IncidentAuthContext } from '../domain/authorization';
import type { IncidentRepository, NewRemoteIncidentInput } from '../domain/ports/IncidentRepository';
import type { TelemetryPort } from '../domain/TelemetryPort';
import {
  IncidentAuthorizationError,
  IncidentAuthorizationService,
} from './IncidentAuthorizationService';

export type { Incident } from '../domain/incidents';

/**
 * Identity used for Authorization + X-Course-Actor on the teaching backend.
 * actorId must match the fixture actor (e.g. technician-1); role must match that actor's profile.
 */
export type CourseActorIdentity = Readonly<{
  actorId: string;
  role: CampusRole;
  /** Bearer token sent as Authorization; default course fixture token when omitted at the client. */
  authToken?: string;
}>;

/**
 * Builds the authorization gate from the same identity the HTTP client will send
 * as X-Course-Actor (actorId) and the role from session/login.
 */
export function authorizationFromIdentity(identity: CourseActorIdentity): IncidentAuthorizationService {
  return new IncidentAuthorizationService(identity.role, identity.actorId);
}

export class IncidentApplication {
  private readonly authorization: IncidentAuthorizationService | null;

  public constructor(
    private readonly incidents: IncidentRepository,
    private readonly telemetry?: TelemetryPort,
    authorization?: IncidentAuthorizationService | null,
  ) {
    this.authorization = authorization ?? null;
  }

  /**
   * Actor bound to this application instance (session + X-Course-Actor).
   * Null when authorization was not wired (legacy call sites / stubs).
   */
  getActor(): Readonly<{ role: CampusRole; actorId: string }> | null {
    return this.authorization?.getActor() ?? null;
  }

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

  /**
   * Creates an incident only if the bound actor is allowed to `create` (reporter).
   * Call this instead of the repository directly so UI cannot bypass permissions.
   */
  async createIncident(input: NewRemoteIncidentInput): Promise<Incident> {
    this.requireAuthorization().assertAllowed('create', null);
    return this.incidents.create(input);
  }

  /**
   * Gates a lifecycle action (start, resolve, close, reopen, assign, …) before any remote call.
   * `context` must reflect the incident's reporter, assignee and status (same fields the backend uses).
   */
  assertIncidentAction(action: IncidentAction, context: IncidentAuthContext): void {
    this.requireAuthorization().assertAllowed(action, context);
  }

  /**
   * Returns allowed actions for the current actor on the given incident context (for UI + server-side checks).
   */
  allowedActionsFor(context: IncidentAuthContext | null): readonly IncidentAction[] {
    return this.requireAuthorization().allowedActions(context);
  }

  private requireAuthorization(): IncidentAuthorizationService {
    if (this.authorization === null) {
      throw new IncidentAuthorizationError('view', 'reporter', 'unbound', 'forbidden');
    }
    return this.authorization;
  }
}
