export class ContractError extends Error {
  public constructor(message = 'Remote response does not satisfy the published contract') {
    super(message);
    this.name = 'ContractError';
  }
}

const MAX_TIMER_DELAY_MS = 2_147_483_647;
const HTTP_DATE_PATTERNS = [
  /^[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT$/,
  /^[A-Z][a-z]+, \d{2}-[A-Z][a-z]{2}-\d{2} \d{2}:\d{2}:\d{2} GMT$/,
  /^[A-Z][a-z]{2} [A-Z][a-z]{2} {1,2}\d{1,2} \d{2}:\d{2}:\d{2} \d{4}$/,
];

export function parseRetryAfterMs(value: string | null, nowMs = Date.now()): number | null {
  if (value === null) return null;

  const normalized = value.trim();
  if (normalized.length === 0) return null;

  if (/^\d+$/.test(normalized)) {
    const delayMs = Number(normalized) * 1000;
    return Number.isFinite(delayMs) ? Math.min(delayMs, MAX_TIMER_DELAY_MS) : null;
  }

  if (!HTTP_DATE_PATTERNS.some((pattern) => pattern.test(normalized)) || !Number.isFinite(nowMs)) {
    return null;
  }
  const retryAtMs = Date.parse(normalized);
  if (!Number.isFinite(retryAtMs)) return null;
  return Math.min(MAX_TIMER_DELAY_MS, Math.max(0, retryAtMs - nowMs));
}

export class HttpStatusError extends Error {
  public readonly status: number;
  public readonly code: string | null;
  public readonly retryAfterMs: number | null;

  public constructor(status: number, code: string | null, retryAfterMs: number | null = null) {
    super(`Request failed with status ${status}`);
    this.name = 'HttpStatusError';
    this.status = status;
    this.code = code;
    this.retryAfterMs =
      typeof retryAfterMs === 'number' && Number.isFinite(retryAfterMs) && retryAfterMs >= 0
        ? retryAfterMs
        : null;
  }
}

export class TransportError extends Error {
  public constructor(message = 'Request failed before receiving a response') {
    super(message);
    this.name = 'TransportError';
  }
}

export class TransportTimeoutError extends TransportError {
  public constructor(message = 'Request timed out before receiving a response') {
    super(message);
    this.name = 'TransportTimeoutError';
  }
}
