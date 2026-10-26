import { DatabaseSync } from 'node:sqlite';
import type { SQLiteBindValue, SQLiteRunResult } from 'expo-sqlite';
import type { SQLiteDatabasePort, SQLiteExecutorPort } from './SQLiteDatabasePort';
import { migrateCampusOpsDatabase } from './CampusOpsDatabaseMigrations';

type NodeSQLiteBindValue = Exclude<SQLiteBindValue, boolean | ArrayBuffer> | Uint8Array;

function toNodeSQLiteBindValue(value: SQLiteBindValue): NodeSQLiteBindValue {
  if (typeof value === 'boolean') return Number(value);
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  return value;
}

function createDatabase(failOn?: string): Readonly<{ database: SQLiteDatabasePort; sqlite: DatabaseSync }> {
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
  const database: SQLiteDatabasePort = {
    ...executor,
    withExclusiveTransactionAsync: async (task) => {
      sqlite.exec('BEGIN EXCLUSIVE');
      try {
        const transaction: SQLiteExecutorPort = failOn
          ? {
              ...executor,
              execAsync: async (source) => {
                if (source.includes(failOn)) throw new Error('Injected SQLite migration failure');
                await executor.execAsync(source);
              },
            }
          : executor;
        await task(transaction);
        sqlite.exec('COMMIT');
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  };

  return { database, sqlite };
}

test('migrates a real SQLite database and enforces operation-to-incident relationships', async () => {
  const { database, sqlite } = createDatabase();
  try {
    await migrateCampusOpsDatabase(database);
    sqlite
      .prepare(
        `INSERT INTO incidents (id, version, status, incident_json, updated_at)
         VALUES (?, 1, 'assigned', ?, ?)`,
      )
      .run('campus-inc-001', '{"id":"campus-inc-001"}', '2026-10-23T00:00:00.000Z');
    sqlite
      .prepare(
        `INSERT INTO pending_operations
         (operation_id, incident_id, actor_id, base_version, action, payload_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        'operation-1',
        'campus-inc-001',
        'technician-1',
        1,
        'start',
        '{"status":"in_progress"}',
        '2026-10-23T00:00:01.000Z',
      );

    expect(() =>
      sqlite
        .prepare(
          `INSERT INTO pending_operations
           (operation_id, incident_id, actor_id, base_version, action, payload_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          'orphan-operation',
          'missing-incident',
          'technician-1',
          1,
          'start',
          '{}',
          '2026-10-23T00:00:02.000Z',
        ),
    ).toThrow(/FOREIGN KEY constraint failed/);
    expect(sqlite.prepare('SELECT operation_id FROM pending_operations').all()).toEqual([
      { operation_id: 'operation-1' },
    ]);
  } finally {
    sqlite.close();
  }
});

test('a real SQLite transaction rolls back partial schema changes after an injected migration failure', async () => {
  const { database, sqlite } = createDatabase('CREATE INDEX pending_operations_incident_id_idx');
  try {
    sqlite.exec(`
      CREATE TABLE incidents (
        id TEXT PRIMARY KEY NOT NULL,
        version INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL,
        incident_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      PRAGMA user_version = 1;
    `);
    sqlite
      .prepare(
        'INSERT INTO incidents (id, version, status, incident_json, updated_at) VALUES (?, 1, ?, ?, ?)',
      )
      .run(
        'campus-inc-001',
        'assigned',
        '{"id":"campus-inc-001"}',
        '2026-10-23T00:00:00.000Z',
      );

    await expect(migrateCampusOpsDatabase(database)).rejects.toThrow('Injected SQLite migration failure');

    expect(sqlite.prepare('PRAGMA user_version').get()).toEqual({ user_version: 1 });
    expect(sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(
      'pending_operations',
    )).toBeUndefined();
    expect(
      sqlite.prepare('SELECT id, incident_json FROM incidents').get(),
    ).toEqual({ id: 'campus-inc-001', incident_json: '{"id":"campus-inc-001"}' });
  } finally {
    sqlite.close();
  }
});
