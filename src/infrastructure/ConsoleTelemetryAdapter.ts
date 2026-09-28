import { redactForTelemetry } from '../course-evaluation';
import type { TelemetryPort } from '../domain/TelemetryPort';

export class ConsoleTelemetryAdapter implements TelemetryPort {
  logEvent(event: unknown): void {
    console.log(redactForTelemetry(event));
  }
}
