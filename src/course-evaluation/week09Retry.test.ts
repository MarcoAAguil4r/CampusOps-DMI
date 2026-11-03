import { planRetry } from './index';

describe('planRetry', () => {
  test('honors bounded Retry-After only for retryable failures', () => {
    expect(planRetry({ method: 'GET', status: 429, attempt: 1, retryAfterMs: 800 })).toEqual({
      retry: true,
      delayMs: 800,
      requiresStableIdempotencyKey: false,
    });
    expect(planRetry({ method: 'GET', status: 503, attempt: 3, retryAfterMs: Number.POSITIVE_INFINITY }))
      .toEqual({ retry: true, delayMs: 1000, requiresStableIdempotencyKey: false });
    expect(planRetry({ method: 'GET', status: 400, attempt: 1 })).toEqual({
      retry: false,
      delayMs: 0,
      requiresStableIdempotencyKey: false,
    });
    expect(planRetry({ method: 'GET', status: 429, attempt: 1, retryAfterMs: 60_000 })).toEqual({
      retry: false,
      delayMs: 0,
      requiresStableIdempotencyKey: false,
    });
  });

  test('stops at attempt four and prevents POST replay without a stable key', () => {
    expect(planRetry({ method: 'GET', status: 'timeout', attempt: 4 })).toMatchObject({ retry: false, delayMs: 0 });
    expect(planRetry({ method: 'POST', status: 503, attempt: 1 })).toEqual({
      retry: false,
      delayMs: 0,
      requiresStableIdempotencyKey: true,
    });
    expect(planRetry({ method: 'POST', status: 'timeout', attempt: 1, idempotencyKey: ' op-001 ' }))
      .toEqual({ retry: true, delayMs: 250, requiresStableIdempotencyKey: false });
  });
});
