import type {
  NewPendingOperationInput,
  PendingOperation,
  SQLitePendingOperationsRepository,
} from '../infrastructure/SQLitePendingOperationsRepository';

/** Result of attempting to apply one pending operation on the server. */
export type SyncAttemptResult =
  | Readonly<{ outcome: 'confirmed' }>
  | Readonly<{ outcome: 'conflict' }>
  | Readonly<{ outcome: 'error'; reason: string }>
  | Readonly<{ outcome: 'timeout' }>;

export type PendingSyncTransport = Readonly<{
  /**
   * Sends the durable operation to the backend.
   * Must return 'confirmed' only when the server accepted the effect.
   */
  submit(operation: PendingOperation): Promise<SyncAttemptResult>;
}>;

export type SyncOneResult = Readonly<{
  operationId: string;
  outcome: SyncAttemptResult['outcome'];
  stillInQueue: boolean;
}>;

/**
 * Integrates the durable queue with a sync transport.
 * Removes a queue entry only when the transport reports confirmation.
 */
export class PendingOperationSyncService {
  public constructor(
    private readonly queue: SQLitePendingOperationsRepository,
    private readonly transport: PendingSyncTransport,
  ) {}

  public enqueue(input: NewPendingOperationInput): Promise<PendingOperation> {
    return this.queue.enqueue(input);
  }

  public listPending(): Promise<readonly PendingOperation[]> {
    return this.queue.listPending();
  }

  /**
   * Retry path: same operationId + same content is idempotent at enqueue;
   * then submit once. Queue is conserved on error/timeout/conflict.
   */
  public async syncOne(operationId: string): Promise<SyncOneResult> {
    const operation = await this.queue.findById(operationId);
    if (!operation) {
      return { operationId, outcome: 'error', stillInQueue: false };
    }

    const result = await this.transport.submit(operation);

    if (result.outcome === 'confirmed') {
      await this.queue.removeConfirmed(operationId);
      return { operationId, outcome: 'confirmed', stillInQueue: false };
    }

    if (result.outcome === 'conflict') {
      await this.queue.markConflict(operationId);
      return { operationId, outcome: 'conflict', stillInQueue: true };
    }

    // error | timeout → keep pending, do not remove
    return { operationId, outcome: result.outcome, stillInQueue: true };
  }
}
