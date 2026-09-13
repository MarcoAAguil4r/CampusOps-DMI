import type { BackendHealthPort } from '../application/CampusOpsApplication';
import { getBackendHealth } from '../api/courseBackend';

export class CourseBackendHealthAdapter implements BackendHealthPort {
  async check(): Promise<void> {
    await getBackendHealth();
  }
}
