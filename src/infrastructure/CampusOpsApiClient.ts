import { ContractError, HttpStatusError, TransportTimeoutError } from './httpErrors';

export type CampusOpsApiClientConfig = Readonly<{
  baseUrl: string;
  actorId: string;
  authToken?: string;
  timeoutMs?: number;
}>;

type JsonRequestInit = Readonly<{
  method: 'GET' | 'POST';
  path: string;
  body?: unknown;
  idempotencyKey?: string;
}>;

const DEFAULT_TIMEOUT_MS = 5000;

export class CampusOpsApiClient {
  public constructor(private readonly config: CampusOpsApiClientConfig) {}

    async request(init: JsonRequestInit): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs ?? DEFAULT_TIMEOUT_MS);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.config.authToken ?? 'course-valid-token'}`,
      'X-Course-Actor': this.config.actorId,
    };
    if (init.idempotencyKey) headers['Idempotency-Key'] = init.idempotencyKey;

    const requestInit: RequestInit = {
      method: init.method,
      headers,
      signal: controller.signal,
    };
    if (init.body !== undefined) requestInit.body = JSON.stringify(init.body);

    let response: Response;
    try {
      response = await fetch(`${this.config.baseUrl}${init.path}`, requestInit);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') throw new TransportTimeoutError();
      throw error;
    } finally {
      clearTimeout(timeout);
    }

    let parsedBody: unknown;
    try {
      const text = await response.text();
      parsedBody = text.length > 0 ? JSON.parse(text) : null;
    } catch {
      if (!response.ok) throw new HttpStatusError(response.status, null);
      throw new ContractError('Response body is not valid JSON');
    }

    if (!response.ok) {
      const code =
        parsedBody !== null && typeof parsedBody === 'object' && 'code' in parsedBody
          ? String((parsedBody as Record<string, unknown>).code)
          : null;
      throw new HttpStatusError(response.status, code);
    }

    return parsedBody;
  }
}
