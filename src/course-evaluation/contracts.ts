import type { SessionAuthEvent } from '../domain/ports/SessionAuthEvent';

export type JsonObject = Readonly<Record<string, unknown>>;

export type ParseResult =
  | Readonly<{ ok: true; value: { id: string; version: number; status: string; payload: JsonObject | null } }>
  | Readonly<{ ok: false; error: 'contract' }>;

export type AuthEvent = SessionAuthEvent;

export type SyncRecord = Readonly<{ id: string; version: number; fields: JsonObject }>;

export type RemoteResponse = Readonly<{ requestId: string; value?: unknown; error?: string }>;

export type PermissionEvent = 'granted' | 'paused' | 'revoked' | 'resumed' | 'denied_permanently';
