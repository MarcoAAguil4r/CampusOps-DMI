import { HttpStatusError, parseRetryAfterMs } from './httpErrors';

describe('parseRetryAfterMs', () => {
  const nowMs = Date.parse('Mon, 02 Nov 2026 12:00:00 GMT');

  test('converts delay-seconds and HTTP dates to milliseconds', () => {
    expect(parseRetryAfterMs('3', nowMs)).toBe(3000);
    expect(parseRetryAfterMs('Mon, 02 Nov 2026 12:00:05 GMT', nowMs)).toBe(5000);
  });

  test('returns only bounded finite non-negative delays for missing, invalid, and past values', () => {
    expect(parseRetryAfterMs(null, nowMs)).toBeNull();
    expect(parseRetryAfterMs('', nowMs)).toBeNull();
    expect(parseRetryAfterMs('not-a-date', nowMs)).toBeNull();
    expect(parseRetryAfterMs('999999999999999999999999999', nowMs)).toBe(2_147_483_647);
    expect(parseRetryAfterMs('Mon, 02 Nov 2026 11:59:59 GMT', nowMs)).toBe(0);
    expect(parseRetryAfterMs('Mon, 02 Nov 2026 12:00:05 GMT', Number.NaN)).toBeNull();
  });

  test('keeps the existing HttpStatusError constructor compatible and normalizes invalid delays', () => {
    expect(new HttpStatusError(503, null).retryAfterMs).toBeNull();
    expect(new HttpStatusError(429, null, Number.NaN).retryAfterMs).toBeNull();
    expect(new HttpStatusError(429, null, -1).retryAfterMs).toBeNull();
  });
});
