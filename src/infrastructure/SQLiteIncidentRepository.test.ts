import type { SQLiteBindValue, SQLiteRunResult } from 'expo-sqlite';
import type { Incident } from '../domain/incidents';
import type { SQLiteDatabasePort, SQLiteExecutorPort } from './SQLiteDatabasePort';
import { SQLiteIncidentRepository } from './SQLiteIncidentRepository';

type StoredRow = Readonly<{
  id: string;
  status: string;
  incident_json: string;
  updated_at: string;
}>;

class MemorySQLiteDatabase implements SQLiteDatabasePort {
  public readonly rows = new Map<string, StoredRow>();

  public async execAsync(_source: string): Promise<void> {}

  public async getFirstAsync<T>(source: string, ...params: SQLiteBindValue[]): Promise<T | null> {
    if (source.includes('COUNT(*)')) return { count: this.rows.size } as T;
    if (source.includes('WHERE id = ?')) {
      const row = this.rows.get(String(params[0]));
      return row ? ({ id: row.id, status: row.status, incident_json: row.incident_json } as T) : null;
    }
    return null;
  }

  public async getAllAsync<T>(_source: string, ..._params: SQLiteBindValue[]): Promise<T[]> {
    return [...this.rows.values()]
      .sort((left, right) => left.updated_at.localeCompare(right.updated_at) || left.id.localeCompare(right.id))
      .map((row) => ({ id: row.id, status: row.status, incident_json: row.incident_json }) as T);
  }

  public async runAsync(_source: string, ...params: SQLiteBindValue[]): Promise<SQLiteRunResult> {
    const [id, status, incidentJson, updatedAt] = params;
    if (
      typeof id !== 'string' ||
      typeof status !== 'string' ||
      typeof incidentJson !== 'string' ||
      typeof updatedAt !== 'string'
    ) {
      throw new Error('Invalid values passed to the SQLite test double');
    }
    if (!this.rows.has(id)) {
      this.rows.set(id, { id, status, incident_json: incidentJson, updated_at: updatedAt });
    }
    return { changes: 1, lastInsertRowId: this.rows.size };
  }

  public async withExclusiveTransactionAsync(
    task: (transaction: SQLiteExecutorPort) => Promise<void>,
  ): Promise<void> {
    const snapshot = new Map(this.rows);
    try {
      await task(this);
    } catch (error) {
      this.rows.clear();
      snapshot.forEach((row, id) => this.rows.set(id, row));
      throw error;
    }
  }
}

const fixture: Incident = {
  id: 'campus-inc-001',
  title: 'Luz intermitente',
  description: 'Una luminaria del aula ficticia requiere revisión.',
  category: 'electrical',
  status: 'assigned',
  location: { source: 'manual', label: 'Edificio académico ficticio A' },
};

test('keeps seeded incidents available to a new repository instance', async () => {
  const database = new MemorySQLiteDatabase();
  const firstRepository = new SQLiteIncidentRepository(database);
  await firstRepository.seedIfEmpty([fixture]);

  const reopenedRepository = new SQLiteIncidentRepository(database);
  await expect(reopenedRepository.list()).resolves.toEqual([fixture]);
  await expect(reopenedRepository.findById(fixture.id)).resolves.toEqual(fixture);
});

test('uses an idempotency key for local creation and rejects its reuse with different content', async () => {
  const repository = new SQLiteIncidentRepository(new MemorySQLiteDatabase());
  const input = {
    category: 'maintenance' as const,
    description: 'Revisión de un recurso ficticio.',
    location: 'Zona académica ficticia',
    idempotencyKey: 'local-operation-1',
  };

  const created = await repository.create(input);
  await expect(repository.create(input)).resolves.toEqual(created);
  await expect(repository.create({ ...input, description: 'Contenido diferente.' })).rejects.toThrow(
    'already used with different incident content',
  );
});

test('reports malformed persisted incident data instead of fabricating a domain object', async () => {
  const database = new MemorySQLiteDatabase();
  database.rows.set('corrupt', {
    id: 'corrupt',
    status: 'open',
    incident_json: '{invalid-json',
    updated_at: '2026-10-23T00:00:00.000Z',
  });

  await expect(new SQLiteIncidentRepository(database).list()).rejects.toThrow(
    'does not match the CampusOps contract',
  );
});
