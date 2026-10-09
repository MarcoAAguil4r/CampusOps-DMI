import type { SessionAuthEvent } from '../domain/ports/SessionAuthEvent';

export type SessionRefreshState = Readonly<{
  status: 'anonymous' | 'authenticated';
  activeGeneration: number | null;
  refreshCalls: number;
  retriedRequestIds: readonly string[];
  persistedToken: string | null;
}>;

export function coordinateSessionRefresh(events: readonly SessionAuthEvent[]): SessionRefreshState {
  let status: SessionRefreshState['status'] = 'anonymous';
  let activeGeneration: number | null = null;
  let refreshCalls = 0;
  let persistedToken: string | null = null;
  let pendingGeneration: number | null = null;
  let sessionInvalidated = false;
  const pendingRequestIds = new Set<string>();
  const retriedRequestIds: string[] = [];
  const retriedRequestIdSet = new Set<string>();

  function clearSession(): void {
    status = 'anonymous';
    activeGeneration = null;
    persistedToken = null;
    pendingGeneration = null;
    pendingRequestIds.clear();
  }

  for (const event of events) {
    if (event.type === 'logout') {
      clearSession();
      sessionInvalidated = true;
      continue;
    }

    if (sessionInvalidated) continue;

    if (event.type === 'request401') {
      const { requestId, generation } = event;
      if (
        typeof requestId !== 'string' ||
        requestId.length === 0 ||
        !Number.isInteger(generation) ||
        generation === undefined ||
        generation < 0
      ) {
        continue;
      }

      if (activeGeneration === null) {
        activeGeneration = generation;
        status = 'authenticated';
      }

      if (generation < activeGeneration) {
        if (persistedToken !== null && !retriedRequestIdSet.has(requestId)) {
          retriedRequestIdSet.add(requestId);
          retriedRequestIds.push(requestId);
        }
        continue;
      }

      if (generation !== activeGeneration) continue;

      if (retriedRequestIdSet.has(requestId)) {
        clearSession();
        sessionInvalidated = true;
        continue;
      }

      if (pendingGeneration === null) {
        pendingGeneration = generation;
        refreshCalls += 1;
      }
      if (pendingGeneration === generation) pendingRequestIds.add(requestId);
      continue;
    }

    if (event.type === 'refreshSucceeded') {
      const generation = event.generation;
      if (pendingGeneration === null) continue;
      if (
        activeGeneration === null ||
        !Number.isInteger(generation) ||
        generation === undefined ||
        generation <= activeGeneration ||
        typeof event.token !== 'string' ||
        event.token.length === 0
      ) {
        clearSession();
        sessionInvalidated = true;
        continue;
      }

      activeGeneration = generation;
      persistedToken = event.token;
      status = 'authenticated';
      for (const requestId of pendingRequestIds) {
        if (!retriedRequestIdSet.has(requestId)) {
          retriedRequestIdSet.add(requestId);
          retriedRequestIds.push(requestId);
        }
      }
      pendingRequestIds.clear();
      pendingGeneration = null;
      continue;
    }

    if (
      pendingGeneration !== null &&
      (event.generation === undefined || event.generation === pendingGeneration)
    ) {
      clearSession();
      sessionInvalidated = true;
    }
  }

  return {
    status,
    activeGeneration,
    refreshCalls,
    retriedRequestIds,
    persistedToken,
  };
}
