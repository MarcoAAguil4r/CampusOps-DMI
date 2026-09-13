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
