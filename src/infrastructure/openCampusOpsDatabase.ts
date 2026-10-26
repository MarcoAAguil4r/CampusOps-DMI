import { openDatabaseAsync } from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import { migrateCampusOpsDatabase } from './CampusOpsDatabaseMigrations';

export async function openCampusOpsDatabase(): Promise<SQLiteDatabase> {
  const database = await openDatabaseAsync('campusops.db');
  try {
    await migrateCampusOpsDatabase(database);
    return database;
  } catch (error) {
    try {
      await database.closeAsync();
    } catch (closeError) {
      throw new AggregateError(
        [error, closeError],
        'CampusOps database initialization failed and its connection could not be closed',
      );
    }
    throw error;
  }
}
