import type { SQLiteDatabasePort, SQLiteExecutorPort } from './SQLiteDatabasePort';

export const CAMPUSOPS_SCHEMA_VERSION = 2;

const incidentsSchema = `
  CREATE TABLE incidents (
    id TEXT PRIMARY KEY NOT NULL,
    version INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0),
    status TEXT NOT NULL CHECK (status IN ('open', 'assigned', 'in_progress', 'resolved', 'closed')),
    incident_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`;

const pendingOperationsSchema = `
  CREATE TABLE pending_operations (
    operation_id TEXT PRIMARY KEY NOT NULL,
    incident_id TEXT NOT NULL REFERENCES incidents(id) ON DELETE RESTRICT,
    actor_id TEXT NOT NULL,
    base_version INTEGER NOT NULL CHECK (base_version >= 0),
    action TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'conflict')),
    created_at TEXT NOT NULL
  )
`;

async function readSchemaVersion(database: SQLiteExecutorPort): Promise<number> {
  const result = await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  if (!result || !Number.isInteger(result.user_version) || result.user_version < 0) {
    throw new Error('Could not read the CampusOps database schema version');
  }
  return result.user_version;
}

export async function migrateCampusOpsDatabase(database: SQLiteDatabasePort): Promise<void> {
  await database.execAsync('PRAGMA foreign_keys = ON');
  await database.withExclusiveTransactionAsync(async (transaction) => {
    let version = await readSchemaVersion(transaction);
    if (version > CAMPUSOPS_SCHEMA_VERSION) {
      throw new Error(
        `CampusOps database schema ${version} is newer than supported schema ${CAMPUSOPS_SCHEMA_VERSION}`,
      );
    }

    if (version < 1) {
      await transaction.execAsync(incidentsSchema);
      await transaction.execAsync('PRAGMA user_version = 1');
      version = 1;
    }

    if (version < 2) {
      await transaction.execAsync(pendingOperationsSchema);
      await transaction.execAsync(
        'CREATE INDEX pending_operations_incident_id_idx ON pending_operations (incident_id, created_at)',
      );
      await transaction.execAsync('PRAGMA user_version = 2');
    }
  });
}
