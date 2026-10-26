import type { SQLiteBindValue, SQLiteRunResult } from 'expo-sqlite';
import type { SQLiteDatabasePort, SQLiteExecutorPort } from './SQLiteDatabasePort';
import { CAMPUSOPS_SCHEMA_VERSION, migrateCampusOpsDatabase } from './CampusOpsDatabaseMigrations';

type DatabaseState = {
  version: number;
  tables: Set<string>;
  indexes: Set<string>;
  incidents: Map<string, string>;
};

function cloneState(state: DatabaseState): DatabaseState {
  return {
    version: state.version,
    tables: new Set(state.tables),
    indexes: new Set(state.indexes),
    incidents: new Map(state.incidents),
  };
}

class MemorySQLiteExecutor implements SQLiteExecutorPort {
  public constructor(
    public readonly state: DatabaseState,
    protected readonly injectedFailure?: string,
  ) {}

  public async execAsync(source: string): Promise<void> {
    if (source === 'PRAGMA foreign_keys = ON') return;
    if (source.startsWith('PRAGMA user_version = ')) {
      this.state.version = Number(source.slice('PRAGMA user_version = '.length));
      return;
    }
    if (source.includes('CREATE TABLE incidents')) {
      this.state.tables.add('incidents');
      return;
    }
    if (source.includes('CREATE TABLE pending_operations')) {
      this.state.tables.add('pending_operations');
      return;
    }
    if (source.includes('CREATE INDEX pending_operations_incident_id_idx')) {
      if (this.injectedFailure === 'CREATE INDEX pending_operations_incident_id_idx') {
        throw new Error('Injected migration failure');
      }
      this.state.indexes.add('pending_operations_incident_id_idx');
      return;
    }
    throw new Error(`Unexpected SQL in migration test: ${source}`);
  }

  public async getFirstAsync<T>(source: string, ..._params: SQLiteBindValue[]): Promise<T | null> {
    if (source === 'PRAGMA user_version') {
      return { user_version: this.state.version } as T;
    }
    return null;
  }

  public async getAllAsync<T>(_source: string, ..._params: SQLiteBindValue[]): Promise<T[]> {
    return [];
  }

  public async runAsync(_source: string, ..._params: SQLiteBindValue[]): Promise<SQLiteRunResult> {
    return { changes: 0, lastInsertRowId: 0 };
  }
}

class MemorySQLiteDatabase extends MemorySQLiteExecutor implements SQLiteDatabasePort {
  public constructor(state: DatabaseState, injectedFailure?: string) {
    super(state, injectedFailure);
  }

  public async withExclusiveTransactionAsync(
    task: (transaction: SQLiteExecutorPort) => Promise<void>,
  ): Promise<void> {
    const transaction = new MemorySQLiteExecutor(cloneState(this.state), this.injectedFailure);
    await task(transaction);
    this.state.version = transaction.state.version;
    this.state.tables = transaction.state.tables;
    this.state.indexes = transaction.state.indexes;
    this.state.incidents = transaction.state.incidents;
  }
}

function createState(version: number): DatabaseState {
  return {
    version,
    tables: version >= 1 ? new Set(['incidents']) : new Set(),
    indexes: new Set(),
    incidents: new Map(),
  };
}

test('creates the current schema from an empty database and is safe to repeat', async () => {
  const database = new MemorySQLiteDatabase(createState(0));

  await migrateCampusOpsDatabase(database);
  expect(database.state.version).toBe(CAMPUSOPS_SCHEMA_VERSION);
  expect(database.state.tables).toEqual(new Set(['incidents', 'pending_operations']));
  expect(database.state.indexes).toEqual(new Set(['pending_operations_incident_id_idx']));

  await migrateCampusOpsDatabase(database);
  expect(database.state.version).toBe(CAMPUSOPS_SCHEMA_VERSION);
});

test('upgrades schema 1 without changing existing incident data', async () => {
  const state = createState(1);
  const incident = JSON.stringify({ id: 'campus-inc-001', status: 'assigned' });
  state.incidents.set('campus-inc-001', incident);
  const database = new MemorySQLiteDatabase(state);

  await migrateCampusOpsDatabase(database);

  expect(database.state.version).toBe(2);
  expect(database.state.tables).toContain('incidents');
  expect(database.state.tables).toContain('pending_operations');
  expect(database.state.incidents.get('campus-inc-001')).toBe(incident);
});

test('rolls back schema and version when a migration step fails', async () => {
  const state = createState(1);
  const incident = JSON.stringify({ id: 'campus-inc-001', status: 'assigned' });
  state.incidents.set('campus-inc-001', incident);
  const database = new MemorySQLiteDatabase(state, 'CREATE INDEX pending_operations_incident_id_idx');

  await expect(migrateCampusOpsDatabase(database)).rejects.toThrow('Injected migration failure');

  expect(database.state.version).toBe(1);
  expect(database.state.tables).toEqual(new Set(['incidents']));
  expect(database.state.indexes).toEqual(new Set());
  expect(database.state.incidents.get('campus-inc-001')).toBe(incident);
});

test('rejects a database schema newer than this application supports', async () => {
  const database = new MemorySQLiteDatabase(createState(CAMPUSOPS_SCHEMA_VERSION + 1));

  await expect(migrateCampusOpsDatabase(database)).rejects.toThrow('newer than supported');
  expect(database.state.version).toBe(CAMPUSOPS_SCHEMA_VERSION + 1);
});
