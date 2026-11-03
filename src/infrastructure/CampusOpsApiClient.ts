import { planRetry } from '../course-evaluation';
import {
  ContractError,
  HttpStatusError,
  parseRetryAfterMs,
  TransportError,
  TransportTimeoutError,
} from './httpErrors';

export type CampusOpsApiClientConfig = Readonly<{
  baseUrl: string;
  actorId: string;
  authToken?: string;
  timeoutMs?: number;
  extraHeaders?: Readonly<Record<string, string>>;
}>;

export type JsonRequestInit = Readonly<{
  method: 'GET' | 'POST';
  path: string;
  body?: unknown;
  idempotencyKey?: string;
}>;

const DEFAULT_TIMEOUT_MS = 5000;

export class CampusOpsApiClient {
  public constructor(private readonly config: CampusOpsApiClientConfig) {}

  private async requestOnce(init: JsonRequestInit): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs ?? DEFAULT_TIMEOUT_MS);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.config.authToken ?? 'course-valid-token'}`,
      'X-Course-Actor': this.config.actorId,
      ...this.config.extraHeaders,
    };
    if (init.idempotencyKey) headers['Idempotency-Key'] = init.idempotencyKey;

    const requestInit: RequestInit = {
      method: init.method,
      headers,
      signal: controller.signal,
    };
    if (init.body !== undefined) requestInit.body = JSON.stringify(init.body);

    let response: Response;
    let responseText: string;
    try {
      response = await fetch(`${this.config.baseUrl}${init.path}`, requestInit);
      responseText = await response.text();
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') throw new TransportTimeoutError();
      throw new TransportError();
    } finally {
      clearTimeout(timeout);
    }

    let parsedBody: unknown;
    try {
      parsedBody = responseText.length > 0 ? JSON.parse(responseText) : null;
    } catch {
      if (!response.ok) throw new HttpStatusError(response.status, null);
      throw new ContractError('Response body is not valid JSON');
    }

    if (!response.ok) {
      const code =
        parsedBody !== null && typeof parsedBody === 'object' && 'code' in parsedBody
          ? String((parsedBody as Record<string, unknown>).code)
          : null;
      throw new HttpStatusError(
        response.status,
        code,
        parseRetryAfterMs(response.headers?.get('Retry-After') ?? null),
      );
    }

    return parsedBody;
  }

  async request(init: JsonRequestInit): Promise<unknown> {
    return this.requestWithRetry(init);
  }

  /**
   * Replays a request only under the shared week-09 policy. `init` is kept
   * unchanged, so POST retries retain their exact body and idempotency key.
   */
  async requestWithRetry(
    init: JsonRequestInit,
    wait: (delayMs: number) => Promise<void> = (delayMs) =>
      new Promise((resolve) => setTimeout(resolve, delayMs)),
  ): Promise<unknown> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await this.requestOnce(init);
      } catch (error) {
        const status: number | 'timeout' | null = error instanceof TransportTimeoutError
          ? 'timeout'
          : error instanceof HttpStatusError
            ? error.status
            : null;
        if (status === null) throw error;

        const retryInput = {
          method: init.method,
          status,
          attempt,
          ...(init.idempotencyKey === undefined ? {} : { idempotencyKey: init.idempotencyKey }),
        };
        const plan = planRetry(
          error instanceof HttpStatusError && error.retryAfterMs !== null
            ? { ...retryInput, retryAfterMs: error.retryAfterMs }
            : retryInput,
        );
        if (!plan.retry) throw error;
        await wait(plan.delayMs);
      }
    }
  }
}
