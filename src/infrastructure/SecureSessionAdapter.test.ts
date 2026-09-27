import type { SecureStorePort } from './SecureSessionAdapter';
import { SecureSessionAdapter } from './SecureSessionAdapter';
import * as SecureStore from 'expo-secure-store';

function createStorage(initialValue: string | null = null) {
  let storedValue = initialValue;
  const storage: SecureStorePort = {
    getItemAsync: jest.fn(async () => storedValue),
    setItemAsync: jest.fn(async (_key, value) => {
      storedValue = value;
    }),
    deleteItemAsync: jest.fn(async () => {
      storedValue = null;
    }),
  };

  return { storage, getStoredValue: () => storedValue };
}

test('stores only the validated session fields in device-protected storage', async () => {
  const { storage, getStoredValue } = createStorage();
  const adapter = new SecureSessionAdapter(storage);
  const attemptedSession = {
    userId: 'technician-1',
    role: 'technician' as const,
    accessToken: 'synthetic-token-must-not-be-persisted',
  };

  await adapter.saveCurrentSession(attemptedSession);

  expect(getStoredValue()).toBe(JSON.stringify({ userId: 'technician-1', role: 'technician' }));
  expect(storage.setItemAsync).toHaveBeenCalledWith(
    'campusops.session.v1',
    JSON.stringify({ userId: 'technician-1', role: 'technician' }),
    { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY },
  );
  await expect(adapter.getCurrentSession()).resolves.toEqual({
    userId: 'technician-1',
    role: 'technician',
  });
});

test.each(['{invalid-json', '{"userId":"user-1","role":"owner"}', 'null'])(
  'deletes invalid stored session data (%s)',
  async (storedValue) => {
    const { storage } = createStorage(storedValue);
    const adapter = new SecureSessionAdapter(storage);

    await expect(adapter.getCurrentSession()).resolves.toBeNull();
    expect(storage.deleteItemAsync).toHaveBeenCalledWith('campusops.session.v1');
  },
);

test('clears the persisted session and rejects invalid values without storing them', async () => {
  const { storage } = createStorage();
  const adapter = new SecureSessionAdapter(storage);
  const invalidSession = { userId: 'user-1', role: 'unknown' } as unknown as Parameters<
    typeof adapter.saveCurrentSession
  >[0];

  await adapter.clearCurrentSession();
  expect(storage.deleteItemAsync).toHaveBeenCalledWith('campusops.session.v1');
  await expect(adapter.saveCurrentSession(invalidSession)).rejects.toThrow('Invalid session');
  expect(storage.setItemAsync).not.toHaveBeenCalled();
});