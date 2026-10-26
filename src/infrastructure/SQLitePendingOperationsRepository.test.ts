import { DatabaseSync } from 'node:sqlite';
import type { SQLiteBindValue, SQLiteRunResult } from 'expo-sqlite';
import type { SQLiteDatabasePort, SQLiteExecutorPort } from './SQLiteDatabasePort';
import { migrateCampusOpsDatabase } from './CampusOpsDatabaseMigrations';
import {
  PendingOperationIdempotencyError,
  SQLitePendingOperationsRepository,
  type PendingOperation,
} from './SQLitePendingOperationsRepository';
import { PendingOperationSyncService } from '../application/PendingOperationSyncService';

type NodeSQLiteBindValue = Exclude<SQLiteBindValue, boolean | ArrayBuffer> | Uint8Array;

function toNodeSQLiteBindValue(value: SQLiteBindValue): NodeSQLiteBindValue {
  if (typeof value === 'boolean') return Number(value);
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  return value;
}

function createDatabase(): SQLiteDatabasePort {
  const sqlite = new DatabaseSync(':memory:');
  const executor: SQLiteExecutorPort = {
    execAsync: async (source) => {
      sqlite.exec(source);
    },
    getFirstAsync: async <T>(source: string, ...params: SQLiteBindValue[]) => {
      const result = sqlite.prepare(source).get(...params.map(toNodeSQLiteBindValue));
      return result ? (result as T) : null;
    },
    getAllAsync: async <T>(source: string, ...params: SQLiteBindValue[]) =>
      sqlite.prepare(source).all(...params.map(toNodeSQLiteBindValue)) as T[],
    runAsync: async (source: string, ...params: SQLiteBindValue[]): Promise<SQLiteRunResult> => {
      const result = sqlite.prepare(source).run(...params.map(toNodeSQLiteBindValue));
      return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) };
    },
  };
  return {
    ...executor,
    withExclusiveTransactionAsync: async (task) => {
      sqlite.exec('BEGIN EXCLUSIVE');
      try {
        await task(executor);
        sqlite.exec('COMMIT');
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  };
}

async function seedIncident(database: SQLiteDatabasePort, id = 'campus-inc-001'): Promise<void> {
  await database.runAsync(
    `INSERT INTO incidents (id, version, status, incident_json, updated_at)
     VALUES (?, 1, 'assigned', ?, ?)`,
    id,
    JSON.stringify({
      id,
      title: 'Fictitious fixture',
      description: 'Seed for pending operations',
      category: 'maintenance',
      status: 'assigned',
      location: { source: 'manual', label: 'Lab A' },
    }),
    new Date().toISOString(),
  );
}

const baseInput = {
  operationId: 'op-start-001',
  incidentId: 'campus-inc-001',
  actorId: 'technician-1',
  baseVersion: 1,
  action: 'start',
  payload: {
    work: { assignedTechnicianId: 'technician-1', status: 'in_progress' },
    note: 'Inicio sin conexión',
  },
} as const;

test('pending operation survives reopen with same identity and payload', async () => {
  const database = createDatabase();
  await migrateCampusOpsDatabase(database);
  await seedIncident(database);

  const queue = new SQLitePendingOperationsRepository(database);
  const enqueued = await queue.enqueue({ ...baseInput, payload: { ...baseInput.payload } });

  const reopened = new SQLitePendingOperationsRepository(database);
  const listed = await reopened.listPending();
  expect(listed).toHaveLength(1);
  expect(listed[0]?.operationId).toBe(enqueued.operationId);
  expect(listed[0]?.payload).toEqual(enqueued.payload);
});

test('enqueue is idempotent for same operationId and content', async () => {
  const database = createDatabase();
  await migrateCampusOpsDatabase(database);
  await seedIncident(database);

  const queue = new SQLitePendingOperationsRepository(database);
  const first = await queue.enqueue({ ...baseInput, payload: { ...baseInput.payload } });
  const second = await queue.enqueue({ ...baseInput, payload: { ...baseInput.payload } });

  expect(second.operationId).toBe(first.operationId);
  expect(second.createdAt).toBe(first.createdAt);
  expect(await queue.listPending()).toHaveLength(1);
});

test('enqueue rejects same operationId with different content', async () => {
  const database = createDatabase();
  await migrateCampusOpsDatabase(database);
  await seedIncident(database);

  const queue = new SQLitePendingOperationsRepository(database);
  await queue.enqueue({ ...baseInput, payload: { ...baseInput.payload } });

  await expect(
    queue.enqueue({
      ...baseInput,
      payload: { work: { assignedTechnicianId: 'technician-1', status: 'in_progress' }, note: 'OTRO' },
    }),
  ).rejects.toBeInstanceOf(PendingOperationIdempotencyError);

  expect(await queue.listPending()).toHaveLength(1);
});

test('sync removes only after server confirmation; keeps on error timeout conflict', async () => {
  const database = createDatabase();
  await migrateCampusOpsDatabase(database);
  await seedIncident(database);

  const queue = new SQLitePendingOperationsRepository(database);
  await queue.enqueue({
    operationId: 'op-sync-1',
    incidentId: 'campus-inc-001',
    actorId: 'technician-1',
    baseVersion: 1,
    action: 'start',
    payload: { work: { status: 'in_progress' } },
  });

  // timeout → still in queue
  let transportOutcome: 'timeout' | 'error' | 'conflict' | 'confirmed' = 'timeout';
  const service = new PendingOperationSyncService(queue, {
    submit: async (_op: PendingOperation) => {
      if (transportOutcome === 'timeout') return { outcome: 'timeout' };
      if (transportOutcome === 'error') return { outcome: 'error', reason: 'network' };
      if (transportOutcome === 'conflict') return { outcome: 'conflict' };
      return { outcome: 'confirmed' };
    },
  });

  let result = await service.syncOne('op-sync-1');
  expect(result.outcome).toBe('timeout');
  expect(result.stillInQueue).toBe(true);
  expect(await queue.findById('op-sync-1')).not.toBeNull();

  transportOutcome = 'error';
  result = await service.syncOne('op-sync-1');
  expect(result.outcome).toBe('error');
  expect(result.stillInQueue).toBe(true);
  expect(await queue.findById('op-sync-1')).not.toBeNull();

  transportOutcome = 'conflict';
  result = await service.syncOne('op-sync-1');
  expect(result.outcome).toBe('conflict');
  expect(result.stillInQueue).toBe(true);
  expect((await queue.findById('op-sync-1'))?.status).toBe('conflict');

  // confirmed → removed
  transportOutcome = 'confirmed';
  result = await service.syncOne('op-sync-1');
  expect(result.outcome).toBe('confirmed');
  expect(result.stillInQueue).toBe(false);
  expect(await queue.findById('op-sync-1')).toBeNull();
});

test('reassignment conflict keeps local intent and does not remove the operation', async () => {
  const database = createDatabase();
  await migrateCampusOpsDatabase(database);
  await seedIncident(database);

  const queue = new SQLitePendingOperationsRepository(database);
  await queue.enqueue({
    operationId: 'op-start-002',
    incidentId: 'campus-inc-001',
    actorId: 'technician-1',
    baseVersion: 1,
    action: 'start',
    payload: { work: { assignedTechnicianId: 'technician-1', status: 'in_progress' } },
  });

  await queue.markConflict('op-start-002');
  
  const stored = await queue.findById('op-start-002');
  expect(stored?.status).toBe('conflict');
  expect(await queue.listPending()).toHaveLength(1);
});
