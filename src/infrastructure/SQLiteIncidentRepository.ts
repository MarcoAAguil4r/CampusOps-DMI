import { createIncident } from '../domain/incidents';
import type { Incident } from '../domain/incidents';
import type { IncidentCategory, IncidentLocation, IncidentStatus } from '../campusops/contracts';
import type { IncidentRepository, NewRemoteIncidentInput } from '../domain/ports/IncidentRepository';
import type { SQLiteDatabasePort } from './SQLiteDatabasePort';

const categories = new Set<IncidentCategory>([
  'electrical',
  'laboratory',
  'water',
  'connectivity',
  'equipment',
  'safety',
  'maintenance',
]);
const statuses = new Set<IncidentStatus>(['open', 'assigned', 'in_progress', 'resolved', 'closed']);

type StoredIncident = Readonly<{ id: string; status: string; incident_json: string }>;
type StoredIncidentCount = Readonly<{ count: number }>;

export class InvalidStoredIncidentError extends Error {
  public constructor() {
    super('Stored incident data does not match the CampusOps contract');
    this.name = 'InvalidStoredIncidentError';
  }
}

export class LocalIncidentIdempotencyError extends Error {
  public constructor() {
    super('The local idempotency key was already used with different incident content');
    this.name = 'LocalIncidentIdempotencyError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isIncidentCategory(value: unknown): value is IncidentCategory {
  return typeof value === 'string' && categories.has(value as IncidentCategory);
}

function isIncidentStatus(value: unknown): value is IncidentStatus {
  return typeof value === 'string' && statuses.has(value as IncidentStatus);
}

function parseLocation(value: unknown): IncidentLocation {
  if (!isRecord(value) || typeof value.label !== 'string' || value.label.trim().length === 0) {
    throw new InvalidStoredIncidentError();
  }
  if (value.source === 'manual') {
    return { source: 'manual', label: value.label };
  }
  if (
    value.source === 'provider' &&
    typeof value.latitude === 'number' &&
    Number.isFinite(value.latitude) &&
    value.latitude >= -90 &&
    value.latitude <= 90 &&
    typeof value.longitude === 'number' &&
    Number.isFinite(value.longitude) &&
    value.longitude >= -180 &&
    value.longitude <= 180
  ) {
    return {
      source: 'provider',
      label: value.label,
      latitude: value.latitude,
      longitude: value.longitude,
    };
  }
  throw new InvalidStoredIncidentError();
}

function parseIncident(serialized: string): Incident {
  let value: unknown;
  try {
    value = JSON.parse(serialized);
  } catch {
    throw new InvalidStoredIncidentError();
  }

  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    value.id.trim().length === 0 ||
    typeof value.title !== 'string' ||
    typeof value.description !== 'string' ||
    !isIncidentCategory(value.category) ||
    !isIncidentStatus(value.status)
  ) {
    throw new InvalidStoredIncidentError();
  }

  return {
    id: value.id,
    title: value.title,
    description: value.description,
    category: value.category,
    status: value.status,
    location: parseLocation(value.location),
  };
}

function sameIncidentContent(left: Incident, right: Incident): boolean {
  return (
    left.id === right.id &&
    left.title === right.title &&
    left.description === right.description &&
    left.category === right.category &&
    left.status === right.status &&
    left.location.source === right.location.source &&
    left.location.label === right.location.label &&
    left.location.latitude === right.location.latitude &&
    left.location.longitude === right.location.longitude
  );
}

function parseStoredIncident(row: StoredIncident): Incident {
  const incident = parseIncident(row.incident_json);
  if (row.id !== incident.id || row.status !== incident.status) {
    throw new InvalidStoredIncidentError();
  }
  return incident;
}

export class SQLiteIncidentRepository implements IncidentRepository {
  public constructor(private readonly database: SQLiteDatabasePort) {}

  public async list(): Promise<readonly Incident[]> {
    const rows = await this.database.getAllAsync<StoredIncident>(
      'SELECT id, status, incident_json FROM incidents ORDER BY updated_at, id',
    );
    return rows.map(parseStoredIncident);
  }

  public async findById(id: string): Promise<Incident | null> {
    const row = await this.database.getFirstAsync<StoredIncident>(
      'SELECT id, status, incident_json FROM incidents WHERE id = ?',
      id,
    );
    return row ? parseStoredIncident(row) : null;
  }

  public async create(input: NewRemoteIncidentInput): Promise<Incident> {
    if (!input.idempotencyKey.trim()) {
      throw new Error('A stable idempotency key is required for a local incident');
    }
    const incident = createIncident({
      id: `local-${input.idempotencyKey}`,
      title: input.description,
      description: input.description,
      category: input.category,
      location: { source: 'manual', label: input.location },
    });
    const serialized = JSON.stringify(incident);

    await this.database.runAsync(
      `INSERT OR IGNORE INTO incidents (id, version, status, incident_json, updated_at)
       VALUES (?, 0, ?, ?, ?)`,
      incident.id,
      incident.status,
      serialized,
      new Date().toISOString(),
    );

    const stored = await this.findById(incident.id);
    if (!stored) throw new Error('The local incident was not persisted');
    if (!sameIncidentContent(stored, incident)) throw new LocalIncidentIdempotencyError();
    return stored;
  }

  public async seedIfEmpty(incidents: readonly Incident[]): Promise<void> {
    await this.database.withExclusiveTransactionAsync(async (transaction) => {
      const result = await transaction.getFirstAsync<StoredIncidentCount>(
        'SELECT COUNT(*) AS count FROM incidents',
      );
      if (!result || !Number.isInteger(result.count) || result.count < 0) {
        throw new Error('Could not inspect the local incident store');
      }
      if (result.count > 0) return;

      const timestamp = new Date().toISOString();
      for (const incident of incidents) {
        await transaction.runAsync(
          `INSERT INTO incidents (id, version, status, incident_json, updated_at)
           VALUES (?, 0, ?, ?, ?)`,
          incident.id,
          incident.status,
          JSON.stringify(incident),
          timestamp,
        );
      }
    });
  }
}
