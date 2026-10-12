import { coordinateRefresh } from '../../src/course-evaluation';

test('coalesces concurrent 401s into one refresh and retries each request once', () => {
  const summary = coordinateRefresh([
    { type: 'request401', requestId: 'a', generation: 0 },
    { type: 'request401', requestId: 'b', generation: 0 },
    { type: 'request401', requestId: 'c', generation: 0 },
    { type: 'refreshSucceeded', generation: 1, token: 'course-token-1' },
  ]);
  expect(summary).toEqual({
    status: 'authenticated',
    activeGeneration: 1,
    refreshCalls: 1,
    retriedRequestIds: ['a', 'b', 'c'],
    persistedToken: 'course-token-1',
  });
});

test('logout removes persisted session state', () => {
  expect(coordinateRefresh([{ type: 'logout' }]).persistedToken).toBeNull();
});

test('failed refresh returns to anonymous without retrying pending requests', () => {
  expect(
    coordinateRefresh([
      { type: 'request401', requestId: 'a', generation: 0 },
      { type: 'request401', requestId: 'b', generation: 0 },
      { type: 'refreshFailed', generation: 0 },
      { type: 'request401', requestId: 'c', generation: 0 },
    ]),
  ).toEqual({
    status: 'anonymous',
    activeGeneration: null,
    refreshCalls: 1,
    retriedRequestIds: [],
    persistedToken: null,
  });
});

test('does not refresh the same request again after its one retry receives 401', () => {
  expect(
    coordinateRefresh([
      { type: 'request401', requestId: 'a', generation: 0 },
      { type: 'refreshSucceeded', generation: 1, token: 'course-token-1' },
      { type: 'request401', requestId: 'a', generation: 1 },
    ]),
  ).toEqual({
    status: 'anonymous',
    activeGeneration: null,
    refreshCalls: 1,
    retriedRequestIds: ['a'],
    persistedToken: null,
  });
});

test('retries a request using the newer token when its 401 belongs to an older generation', () => {
  expect(
    coordinateRefresh([
      { type: 'request401', requestId: 'a', generation: 0 },
      { type: 'refreshSucceeded', generation: 1, token: 'course-token-1' },
      { type: 'request401', requestId: 'b', generation: 0 },
    ]),
  ).toEqual({
    status: 'authenticated',
    activeGeneration: 1,
    refreshCalls: 1,
    retriedRequestIds: ['a', 'b'],
    persistedToken: 'course-token-1',
  });
});

test('logout invalidates an in-flight refresh result', () => {
  expect(
    coordinateRefresh([
      { type: 'request401', requestId: 'a', generation: 0 },
      { type: 'logout' },
      { type: 'refreshSucceeded', generation: 1, token: 'course-token-1' },
    ]),
  ).toEqual({
    status: 'anonymous',
    activeGeneration: null,
    refreshCalls: 1,
    retriedRequestIds: [],
    persistedToken: null,
  });
});

test('invalid refresh responses fail closed and do not retry requests', () => {
  expect(
    coordinateRefresh([
      { type: 'request401', requestId: 'a', generation: 0 },
      { type: 'refreshSucceeded', generation: 0, token: '' },
      { type: 'request401', requestId: 'b', generation: 0 },
    ]),
  ).toEqual({
    status: 'anonymous',
    activeGeneration: null,
    refreshCalls: 1,
    retriedRequestIds: [],
    persistedToken: null,
  });
});
