import { fireEvent, render, waitFor } from '@testing-library/react-native';

import App from '../App';

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
