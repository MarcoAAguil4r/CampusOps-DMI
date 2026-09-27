import * as SecureStore from 'expo-secure-store';
import type { CampusRole } from '../campusops/contracts';
import type { SessionPort, UserSession } from '../domain/ports/SessionPort';

const SESSION_KEY = 'campusops.session.v1';
const VALID_ROLES = new Set<CampusRole>(['reporter', 'technician', 'coordinator']);
export type SecureStorePort = Pick<typeof SecureStore, 'getItemAsync' | 'setItemAsync' | 'deleteItemAsync'>;

function isUserSession(value: unknown): value is UserSession {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;

  const session = value as Record<string, unknown>;
  return (
    typeof session.userId === 'string' &&
    session.userId.trim().length > 0 &&
    typeof session.role === 'string' &&
    VALID_ROLES.has(session.role as CampusRole)
  );
}

export class SecureSessionAdapter implements SessionPort {
  public constructor(private readonly secureStore: SecureStorePort = SecureStore) {}

  async getCurrentSession(): Promise<UserSession | null> {
    const serialized = await this.secureStore.getItemAsync(SESSION_KEY);
    if (serialized === null) return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(serialized);
    } catch {
      await this.secureStore.deleteItemAsync(SESSION_KEY);
      return null;
    }

    if (!isUserSession(parsed)) {
      await this.secureStore.deleteItemAsync(SESSION_KEY);
      return null;
    }

    return { userId: parsed.userId, role: parsed.role };
  }

  async saveCurrentSession(session: UserSession): Promise<void> {
    if (!isUserSession(session)) throw new TypeError('Invalid session');

    await this.secureStore.setItemAsync(
      SESSION_KEY,
      JSON.stringify({ userId: session.userId, role: session.role }),
      { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY },
    );
  }

  async clearCurrentSession(): Promise<void> {
    await this.secureStore.deleteItemAsync(SESSION_KEY);
  }
}