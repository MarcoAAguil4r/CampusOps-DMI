import type { SQLiteDatabasePort } from './SQLiteDatabasePort';

export type PendingOperationStatus = 'pending' | 'conflict';

export type PendingOperation = Readonly<{
  operationId: string;
  incidentId: string;
  actorId: string;
  baseVersion: number;
  action: string;
  payload: Readonly<Record<string, unknown>>;
  status: PendingOperationStatus;
  createdAt: string;
}>;

export type NewPendingOperationInput = Readonly<{
  operationId: string;
  incidentId: string;
  actorId: string;
  baseVersion: number;
  action: string;
  payload: Readonly<Record<string, unknown>>;
}>;

type StoredPendingOperation = Readonly<{
  operation_id: string;
  incident_id: string;
  actor_id: string;
  base_version: number;
  action: string;
  payload_json: string;
  status: PendingOperationStatus;
  created_at: string;
}>;

export class PendingOperationIdempotencyError extends Error {
  public constructor(operationId: string) {
    super(
      `operationId "${operationId}" already exists with different content; refusing to mutate the durable queue entry`,
    );
    this.name = 'PendingOperationIdempotencyError';
  }
}

function parseRow(row: StoredPendingOperation): PendingOperation {
  const payload = JSON.parse(row.payload_json) as Record<string, unknown>;
  return {
    operationId: row.operation_id,
    incidentId: row.incident_id,
    actorId: row.actor_id,
    baseVersion: row.base_version,
    action: row.action,
    payload,
    status: row.status,
    createdAt: row.created_at,
  };
}

function sameOperationContent(stored: PendingOperation, input: NewPendingOperationInput): boolean {
  return (
    stored.incidentId === input.incidentId &&
    stored.actorId === input.actorId &&
    stored.baseVersion === input.baseVersion &&
    stored.action === input.action &&
    JSON.stringify(stored.payload) === JSON.stringify(input.payload)
  );
}

/**
 * Durable offline change queue on pending_operations (schema v2).
 * Survives app restart. Remove only after server confirmation.
 */
export class SQLitePendingOperationsRepository {
  public constructor(private readonly database: SQLiteDatabasePort) {}

  /**
   * Enqueue with stable operationId.
   * - Same id + same content → return existing (idempotent retry).
   * - Same id + different content → reject (do not mutate).
   */
  public async enqueue(input: NewPendingOperationInput): Promise<PendingOperation> {
    if (!input.operationId.trim()) {
      throw new Error('operationId is required for a durable pending operation');
    }
    if (!input.incidentId.trim()) {
      throw new Error('incidentId is required for a durable pending operation');
    }

    const existing = await this.findById(input.operationId);
    if (existing) {
      if (sameOperationContent(existing, input)) {
        return existing;
      }
      throw new PendingOperationIdempotencyError(input.operationId);
    }

    const createdAt = new Date().toISOString();
    const payloadJson = JSON.stringify(input.payload);

    await this.database.runAsync(
      `INSERT INTO pending_operations (
         operation_id, incident_id, actor_id, base_version, action, payload_json, status, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
      input.operationId,
      input.incidentId,
      input.actorId,
      input.baseVersion,
      input.action,
      payloadJson,
      createdAt,
    );

    const stored = await this.findById(input.operationId);
    if (!stored) throw new Error('The pending operation was not persisted');
    return stored;
  }

  public async findById(operationId: string): Promise<PendingOperation | null> {
    const row = await this.database.getFirstAsync<StoredPendingOperation>(
      `SELECT operation_id, incident_id, actor_id, base_version, action, payload_json, status, created_at
       FROM pending_operations WHERE operation_id = ?`,
      operationId,
    );
    return row ? parseRow(row) : null;
  }

  public async listPending(): Promise<readonly PendingOperation[]> {
    const rows = await this.database.getAllAsync<StoredPendingOperation>(
      `SELECT operation_id, incident_id, actor_id, base_version, action, payload_json, status, created_at
       FROM pending_operations
       WHERE status IN ('pending', 'conflict')
       ORDER BY created_at, operation_id`,
    );
    return rows.map(parseRow);
  }

  public async listByIncident(incidentId: string): Promise<readonly PendingOperation[]> {
    const rows = await this.database.getAllAsync<StoredPendingOperation>(
      `SELECT operation_id, incident_id, actor_id, base_version, action, payload_json, status, created_at
       FROM pending_operations
       WHERE incident_id = ?
       ORDER BY created_at, operation_id`,
      incidentId,
    );
    return rows.map(parseRow);
  }

  /** Marks conflict; does not delete (error/conflict is not confirmation). */
  public async markConflict(operationId: string): Promise<void> {
    const result = await this.database.runAsync(
      `UPDATE pending_operations SET status = 'conflict' WHERE operation_id = ?`,
      operationId,
    );
    if (result.changes === 0) {
      throw new Error(`Pending operation ${operationId} was not found`);
    }
  }

  /**
   * Low-level delete. Prefer PendingOperationSyncService.syncOne so removal
   * only happens after an explicit server confirmation.
   */
  public async removeConfirmed(operationId: string): Promise<void> {
    await this.database.runAsync(`DELETE FROM pending_operations WHERE operation_id = ?`, operationId);
  }
}
