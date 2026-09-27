import { InMemorySessionAdapter } from './InMemorySessionAdapter';

test('supports saving, reading and clearing a session through SessionPort', async () => {
  const adapter = new InMemorySessionAdapter(null);
  const session = { userId: 'technician-1', role: 'technician' as const };

  await expect(adapter.getCurrentSession()).resolves.toBeNull();
  await adapter.saveCurrentSession(session);
  await expect(adapter.getCurrentSession()).resolves.toEqual(session);
  await adapter.clearCurrentSession();
  await expect(adapter.getCurrentSession()).resolves.toBeNull();
});