import type { SessionPort, UserSession } from '../domain/ports/SessionPort';

export class InMemorySessionAdapter implements SessionPort {
  public constructor(private readonly session: UserSession | null) {}

  async getCurrentSession(): Promise<UserSession | null> {
    return this.session;
  }
}
