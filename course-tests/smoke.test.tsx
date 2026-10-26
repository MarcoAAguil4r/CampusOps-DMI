import { fireEvent, render, waitFor } from '@testing-library/react-native';

import App from '../App';

jest.mock('expo-sqlite', () => {
  const rows = new Map<string, { incident_json: string; status: string; updated_at: string }>();
  let schemaVersion = 0;
  const executor = {
    execAsync: jest.fn(async (source: string) => {
      if (source.startsWith('PRAGMA user_version = ')) {
        schemaVersion = Number(source.slice('PRAGMA user_version = '.length));
      }
    }),
    getFirstAsync: jest.fn(async (source: string, ...params: unknown[]) => {
      if (source === 'PRAGMA user_version') return { user_version: schemaVersion };
      if (source.includes('COUNT(*)')) return { count: rows.size };
      if (source.includes('WHERE id = ?')) {
        const row = rows.get(String(params[0]));
        return row
          ? { id: String(params[0]), status: row.status, incident_json: row.incident_json }
          : null;
      }
      return null;
    }),
    getAllAsync: jest.fn(async () =>
      [...rows.entries()]
        .sort(([, left], [, right]) => left.updated_at.localeCompare(right.updated_at))
        .map(([id, row]) => ({ id, status: row.status, incident_json: row.incident_json })),
    ),
    runAsync: jest.fn(async (source: string, ...params: unknown[]) => {
      const [id, status, incidentJson, updatedAt] = params;
      if (
        typeof id !== 'string' ||
        typeof status !== 'string' ||
        typeof incidentJson !== 'string' ||
        typeof updatedAt !== 'string'
      ) {
        throw new Error('Invalid values passed to the SQLite test double');
      }
      if (!source.includes('INSERT OR IGNORE') || !rows.has(id)) {
        rows.set(id, { incident_json: incidentJson, status, updated_at: updatedAt });
      }
      return { changes: 1, lastInsertRowId: rows.size };
    }),
  };
  const database = {
    ...executor,
    withExclusiveTransactionAsync: jest.fn(async (task: (transaction: typeof executor) => Promise<void>) => {
      const snapshot = new Map(rows);
      const previousSchemaVersion = schemaVersion;
      try {
        await task(executor);
      } catch (error) {
        rows.clear();
        snapshot.forEach((row, id) => rows.set(id, row));
        schemaVersion = previousSchemaVersion;
        throw error;
      }
    }),
    closeAsync: jest.fn(async () => undefined),
  };

  return { openDatabaseAsync: jest.fn(async () => database) };
});

jest.mock('../src/api/courseBackend', () => ({
  getBackendHealth: jest.fn().mockResolvedValue({
    ok: true,
    service: 'dmi-controlled-backend',
    contractVersion: 1,
  }),
}));

test('renders the reproducible baseline and resolves backend state', async () => {
  const view = await render(<App />);
  expect(view.getByText('CampusOps')).toBeTruthy();
  await waitFor(() => expect(view.getByTestId('backend-status').props.children.join('')).toContain('available'));
});

test('shows a fictitious incident list and its selected detail', async () => {
  const view = await render(<App />);

  await waitFor(() => expect(view.getByText('Luz intermitente')).toBeTruthy());
  fireEvent.press(view.getByTestId('incident-inc-001'));

  await waitFor(() => {
    expect(view.getByText('Una luminaria del aula ficticia requiere revisión.')).toBeTruthy();
    expect(view.getByText('Ubicación: Edificio académico ficticio A')).toBeTruthy();
  });
});

test('application bootstrap sends only redacted telemetry to the console', async () => {
  const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

  try {
    await render(<App />);

    await waitFor(() => {
      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          incidentId: expect.any(String),
          status: 'success',
          durationMs: expect.any(Number),
          token: '[REDACTED]',
          reporterId: '[REDACTED]',
          location: '[REDACTED]',
        }),
      );
    });
  } finally {
    logSpy.mockRestore();
  }
});
