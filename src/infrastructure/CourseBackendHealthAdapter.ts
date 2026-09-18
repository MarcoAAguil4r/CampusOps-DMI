import type { BackendHealthPort } from '../domain/ports/BackendHealthPort';
import { getBackendHealth } from '../api/courseBackend';

export class CourseBackendHealthAdapter implements BackendHealthPort {
  async check(): Promise<void> {
    await getBackendHealth();
  }
}
