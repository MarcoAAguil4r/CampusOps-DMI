import type { BackendHealthPort } from '../domain/ports/BackendHealthPort';

export class CampusOpsApplication {
  public constructor(private readonly backendHealth: BackendHealthPort) {}

  checkBackendHealth(): Promise<void> {
    return this.backendHealth.check();
  }
}
