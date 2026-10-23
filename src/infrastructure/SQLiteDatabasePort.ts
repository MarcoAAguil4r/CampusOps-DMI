import type { SQLiteBindValue, SQLiteRunResult } from 'expo-sqlite';

export interface SQLiteExecutorPort {
  execAsync(source: string): Promise<void>;
  getFirstAsync<T>(source: string, ...params: SQLiteBindValue[]): Promise<T | null>;
  getAllAsync<T>(source: string, ...params: SQLiteBindValue[]): Promise<T[]>;
  runAsync(source: string, ...params: SQLiteBindValue[]): Promise<SQLiteRunResult>;
}

export interface SQLiteDatabasePort extends SQLiteExecutorPort {
  withExclusiveTransactionAsync(task: (transaction: SQLiteExecutorPort) => Promise<void>): Promise<void>;
}
