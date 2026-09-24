import { getCourseBackendBaseUrl } from '../infrastructure/ApiConfig';

export type BackendHealth = Readonly<{
  ok: true;
  service: 'dmi-controlled-backend';
  contractVersion: 1;
}>;

export async function getBackendHealth(
  baseUrl?: string,
): Promise<BackendHealth> {
  const response = await fetch(`${getCourseBackendBaseUrl(baseUrl)}/health`);
  if (!response.ok) {
    throw new Error(`Backend health failed with ${response.status}`);
  }
  const payload: unknown = await response.json();
  if (
    typeof payload !== 'object' ||
    payload === null ||
    !('ok' in payload) ||
    payload.ok !== true ||
    !('contractVersion' in payload) ||
    payload.contractVersion !== 1
  ) {
    throw new Error('Backend health contract mismatch');
  }
  return payload as BackendHealth;
}
