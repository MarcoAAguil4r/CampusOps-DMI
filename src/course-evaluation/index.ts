import type {
  AuthEvent,
  JsonObject,
  ParseResult,
  PermissionEvent,
  RemoteResponse,
  SyncRecord,
} from './contracts';
import type { IncidentLocation } from '../campusops/contracts';
import { coordinateSessionRefresh } from '../application/SessionRefreshCoordinator';

function pending(name: string): never {
  throw new Error(`${name} must be implemented in the assigned week`);
}

export function redactForTelemetry(_input: unknown): unknown {
  const sensitiveKeys = new Set([
    'authorization',
    'password',
    'token',
    'accesstoken',
    'refreshtoken',
    'email',
    'displayname',
    'name',
    'userid',
    'reporterid',
    'technicianid',
    'assignedtechnicianid',
    'location',
    'latitude',
    'longitude',
    'photos',
    'evidence',
    'internalcomments',
    'assignmenthistory',
  ]);

  function isPlainObject(value: object): value is Record<string, unknown> {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function redact(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(redact);
    if (typeof value !== 'object' || value === null || !isPlainObject(value)) return value;

    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => {
        const normalizedKey = key.toLowerCase().replaceAll('_', '').replaceAll('-', '');
        return [key, sensitiveKeys.has(normalizedKey) ? '[REDACTED]' : redact(nestedValue)];
      }),
    );
  }

  return redact(_input);
}

export function parseRemoteResource(_input: unknown): ParseResult {
  try {
    if (!isRecord(_input)) return { ok: false, error: 'contract' };

    const { id, version, status, payload } = _input;
    if (typeof id !== 'string' || id.trim().length === 0) return { ok: false, error: 'contract' };
    if (!Number.isInteger(version) || typeof version !== 'number' || version < 0) {
      return { ok: false, error: 'contract' };
    }
    if (typeof status !== 'string' || status.trim().length === 0) return { ok: false, error: 'contract' };
    if (payload !== null && !isRecord(payload)) return { ok: false, error: 'contract' };

    return { ok: true, value: { id, version, status, payload } };
  } catch {
    return { ok: false, error: 'contract' };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function coordinateRefresh(events: readonly AuthEvent[]) {
  return coordinateSessionRefresh(events);
}

function jsonEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function resolveSync(
  base: SyncRecord,
  local: SyncRecord,
  remote: SyncRecord,
): Readonly<{ kind: 'merged'; fields: JsonObject } | { kind: 'conflict'; fields: readonly string[] }> {
  const baseFields = base.fields;
  const localFields = local.fields;
  const remoteFields = remote.fields;

  const keys = new Set([
    ...Object.keys(baseFields),
    ...Object.keys(localFields),
    ...Object.keys(remoteFields),
  ]);

  const merged: Record<string, unknown> = {};
  const conflicts: string[] = [];

  for (const key of keys) {
    const baseValue = baseFields[key];
    const localValue = localFields[key];
    const remoteValue = remoteFields[key];

    const localChanged = !jsonEqual(localValue, baseValue);
    const remoteChanged = !jsonEqual(remoteValue, baseValue);

    if (localChanged && remoteChanged && !jsonEqual(localValue, remoteValue)) {
      conflicts.push(key);
      continue;
    }

    if (localChanged) {
      merged[key] = localValue;
    } else if (remoteChanged) {
      merged[key] = remoteValue;
    } else {
      merged[key] = baseValue;
    }
  }
  if (conflicts.length > 0) {
    return { kind: 'conflict', fields: [...conflicts].sort() };
  }
  return { kind: 'merged', fields: merged };
}

export function deduplicateOperations<T extends Readonly<{ operationId: string }>>(
  operations: readonly T[],
): readonly T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const operation of operations) {
    if (seen.has(operation.operationId)) continue;
    seen.add(operation.operationId);
    result.push(operation);
  }
  return result;
}

export function planRetry(_input: Readonly<{
  method: 'GET' | 'POST';
  status: number | 'timeout';
  attempt: number;
  retryAfterMs?: number;
  idempotencyKey?: string;
}>): Readonly<{ retry: boolean; delayMs: number; requiresStableIdempotencyKey: boolean }> {
  return pending('planRetry');
}

export function reduceRemoteResponses(_input: Readonly<{
  activeRequestId: string;
  responses: readonly RemoteResponse[];
}>): Readonly<{ state: 'success' | 'error' | 'loading'; value?: unknown; error?: string }> {
  return pending('reduceRemoteResponses');
}

export function reducePermissionLifecycle(
  _events: readonly PermissionEvent[],
): Readonly<{ status: 'available' | 'denied' | 'blocked'; resourceActive: boolean }> {
  return pending('reducePermissionLifecycle');
}

/** Week 09: see docs/CAMPUSOPS_API.md; this is not a completed solution. */
export function selectIncidentLocation(_provider: unknown, _manualLabel: string): IncidentLocation {
  if (typeof _manualLabel !== 'string' || _manualLabel.trim().length === 0) {
    throw new Error('A non-empty manual incident location is required');
  }

  if (!isRecord(_provider)) return { source: 'manual', label: _manualLabel };

  const { label, latitude, longitude } = _provider;
  if (
    typeof label !== 'string' ||
    label.trim().length === 0 ||
    typeof latitude !== 'number' ||
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    typeof longitude !== 'number' ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    return { source: 'manual', label: _manualLabel };
  }

  return { source: 'provider', label: label.trim(), latitude, longitude };
}
