import { DatabaseSync } from 'node:sqlite';
import type { SQLiteBindValue, SQLiteRunResult } from 'expo-sqlite';
import { resolveSync } from '../course-evaluation';
import { migrateCampusOpsDatabase } from '../infrastructure/CampusOpsDatabaseMigrations';
import type { SQLiteDatabasePort, SQLiteExecutorPort } from '../infrastructure/SQLiteDatabasePort';
import { SQLitePendingOperationsRepository } from '../infrastructure/SQLitePendingOperationsRepository';
import { PendingOperationSyncService } from './PendingOperationSyncService';

type NodeSQLiteBindValue = Exclude<SQLiteBindValue, boolean | ArrayBuffer> | Uint8Array;

function toNodeSQLiteBindValue(value: SQLiteBindValue): NodeSQLiteBindValue {
  if (typeof value === 'boolean') return Number(value);
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  return value;
}

function createDatabase(): Readonly<{ database: SQLiteDatabasePort; sqlite: DatabaseSync }> {
  const sqlite = new DatabaseSync(':memory:');
  const executor: SQLiteExecutorPort = {
    execAsync: async (source) => {
      sqlite.exec(source);
    },
    getFirstAsync: async <T>(source: string, ...params: SQLiteBindValue[]) => {
      const row = sqlite.prepare(source).get(...params.map(toNodeSQLiteBindValue));
      return row ? (row as T) : null;
    },
    getAllAsync: async <T>(source: string, ...params: SQLiteBindValue[]) =>
      sqlite.prepare(source).all(...params.map(toNodeSQLiteBindValue)) as T[],
    runAsync: async (source: string, ...params: SQLiteBindValue[]): Promise<SQLiteRunResult> => {
      const result = sqlite.prepare(source).run(...params.map(toNodeSQLiteBindValue));
      return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) };
    },
  };
  return {
    sqlite,
    database: {
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
    },
  };
}

test('integrates migration, durable queue, conflict preservation, confirmation and JSON field merge', async () => {
  const { database, sqlite } = createDatabase();
  try {
    await migrateCampusOpsDatabase(database);
    await database.runAsync(
      `INSERT INTO incidents (id, version, status, incident_json, updated_at) VALUES (?, 1, 'assigned', ?, ?)`,
      'campus-inc-001',
      JSON.stringify({ id: 'campus-inc-001' }),
      '2026-10-25T00:00:00.000Z',
    );
    const queue = new SQLitePendingOperationsRepository(database);
    const input = {
      operationId: 'op-start-001',
      incidentId: 'campus-inc-001',
      actorId: 'technician-1',
      baseVersion: 1,
      action: 'start',
      payload: { work: { assignedTechnicianId: 'technician-1', status: 'in_progress' } },
    } as const;

    const [first, duplicate] = await Promise.all([
      queue.enqueue(input),
      queue.enqueue({ ...input, payload: { ...input.payload } }),
    ]);
    expect(duplicate).toEqual(first);
    await expect(queue.listPending()).resolves.toHaveLength(1);

    let outcome: 'conflict' | 'confirmed' = 'conflict';
    const sync = new PendingOperationSyncService(queue, { submit: async () => ({ outcome }) });
    await expect(sync.syncOne(input.operationId)).resolves.toEqual({
      operationId: input.operationId,
      outcome: 'conflict',
      stillInQueue: true,
    });
    expect((await queue.findById(input.operationId))?.status).toBe('conflict');

    outcome = 'confirmed';
    await expect(sync.syncOne(input.operationId)).resolves.toEqual({
      operationId: input.operationId,
      outcome: 'confirmed',
      stillInQueue: false,
    });
    await expect(queue.findById(input.operationId)).resolves.toBeNull();

    const base = { id: 'campus-inc-001', version: 1, fields: { title: 'A', priority: 1 } };
    const local = { id: 'campus-inc-001', version: 1, fields: { title: 'Local', priority: 1 } };
    const remote = { id: 'campus-inc-001', version: 2, fields: { title: 'A', priority: 2 } };
    const before = JSON.stringify([base, local, remote]);
    expect(resolveSync(base, local, remote)).toEqual({
      kind: 'merged',
      fields: { title: 'Local', priority: 2 },
    });
    expect(JSON.stringify([base, local, remote])).toBe(before);
  } finally {
    sqlite.close();
  }
});
