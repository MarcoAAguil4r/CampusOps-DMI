export interface BackendHealthPort {
  check(): Promise<void>;
}

export class CampusOpsApplication {
  public constructor(private readonly backendHealth: BackendHealthPort) {}

  checkBackendHealth(): Promise<void> {
    return this.backendHealth.check();
  }
}
