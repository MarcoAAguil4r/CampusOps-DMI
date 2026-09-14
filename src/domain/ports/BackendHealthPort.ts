export interface BackendHealthPort {
  check(): Promise<void>;
}