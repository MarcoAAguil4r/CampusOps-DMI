import type { SessionPort, UserSession } from '../domain/ports/SessionPort';

export class InMemorySessionAdapter implements SessionPort {
  public constructor(private session: UserSession | null) {}

  async getCurrentSession(): Promise<UserSession | null> {
    return this.session;
  }

  async saveCurrentSession(session: UserSession): Promise<void> {
    this.session = session;
  }

  async clearCurrentSession(): Promise<void> {
    this.session = null;
  }
}
