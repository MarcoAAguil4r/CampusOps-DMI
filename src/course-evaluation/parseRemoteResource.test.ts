import { parseRemoteResource } from './index';

describe('parseRemoteResource', () => {
  test('accepts a valid resource and ignores future envelope fields', () => {
    const input = {
      id: 'campus-inc-001',
      version: 0,
      status: 'open',
      payload: { category: 'connectivity' },
      futureField: 'ignored',
    };

    expect(parseRemoteResource(input)).toEqual({
      ok: true,
      value: {
        id: 'campus-inc-001',
        version: 0,
        status: 'open',
        payload: { category: 'connectivity' },
      },
    });
  });

  test('accepts a null payload without inventing domain data', () => {
    expect(parseRemoteResource({ id: 'r-2', version: 3, status: 'closed', payload: null })).toEqual({
      ok: true,
      value: { id: 'r-2', version: 3, status: 'closed', payload: null },
    });
  });

  test.each([
    null,
    undefined,
    [],
    'resource',
    {},
    { id: ' ', version: 1, status: 'open', payload: null },
    { id: 'r-1', version: 1, status: ' ', payload: null },
    { id: 'r-1', version: -1, status: 'open', payload: null },
    { id: 'r-1', version: 1.5, status: 'open', payload: null },
    { id: 'r-1', version: 1, status: 'open' },
    { id: 'r-1', version: 1, status: 'open', payload: 'not-an-object' },
    { id: 'r-1', version: 1, status: 'open', payload: [] },
  ])('rejects an invalid resource envelope %#', (input) => {
    expect(parseRemoteResource(input)).toEqual({ ok: false, error: 'contract' });
  });

  test('returns a contract error rather than throwing for unreadable input', () => {
    const input = new Proxy({}, { getPrototypeOf: () => { throw new Error('unreadable'); } });

    expect(parseRemoteResource(input)).toEqual({ ok: false, error: 'contract' });
  });
});