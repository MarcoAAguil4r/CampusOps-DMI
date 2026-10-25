import { DatabaseSync } from 'node:sqlite';
import type { SQLiteBindValue, SQLiteRunResult } from 'expo-sqlite';
import type { SQLiteDatabasePort, SQLiteExecutorPort } from './SQLiteDatabasePort';
import { migrateCampusOpsDatabase } from './CampusOpsDatabaseMigrations';
import { SQLitePendingOperationsRepository } from './SQLitePendingOperationsRepository';

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

test('pending operation survives reopen with same identity and payload', async () => {
  const database = createDatabase();
  await migrateCampusOpsDatabase(database);
  await seedIncident(database);

  const queue = new SQLitePendingOperationsRepository(database);
  const enqueued = await queue.enqueue({
    operationId: 'op-start-001',
    incidentId: 'campus-inc-001',
    actorId: 'technician-1',
    baseVersion: 1,
    action: 'start',
    payload: {
      work: { assignedTechnicianId: 'technician-1', status: 'in_progress' },
      note: 'Inicio sin conexión',
      photoRef: 'local-photo-pending-001',
    },
  });

  expect(enqueued.operationId).toBe('op-start-001');
  expect(enqueued.status).toBe('pending');

  // "Reopen": new repository on the same DB (simulates process restart)
  const reopened = new SQLitePendingOperationsRepository(database);
  const listed = await reopened.listPending();
  expect(listed).toHaveLength(1);
  expect(listed[0]?.operationId).toBe('op-start-001');
  expect(listed[0]?.payload).toEqual(enqueued.payload);
  expect(listed[0]?.actorId).toBe('technician-1');
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
  expect(stored?.payload).toEqual({
    work: { assignedTechnicianId: 'technician-1', status: 'in_progress' },
  });

  const stillListed = await queue.listPending();
  expect(stillListed.some((op) => op.operationId === 'op-start-002')).toBe(true);
});

test('only removeConfirmed deletes; markConflict does not', async () => {
  const database = createDatabase();
  await migrateCampusOpsDatabase(database);
  await seedIncident(database);

  const queue = new SQLitePendingOperationsRepository(database);
  await queue.enqueue({
    operationId: 'op-note-003',
    incidentId: 'campus-inc-001',
    actorId: 'technician-1',
    baseVersion: 1,
    action: 'comment',
    payload: { text: 'Nota offline' },
  });

  await queue.markConflict('op-note-003');
  expect(await queue.findById('op-note-003')).not.toBeNull();

  await queue.removeConfirmed('op-note-003');
  expect(await queue.findById('op-note-003')).toBeNull();
});
