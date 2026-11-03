import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import type { GeocodingPort } from '../domain/ports/GeocodingPort';
import type { Incident } from '../application/IncidentApplication';
import { IncidentApp } from './IncidentApp';

const sampleIncident = {
  id: 'campus-inc-001',
  title: 'Luz intermitente',
  description: 'Una luminaria del aula ficticia requiere revisión.',
  category: 'electrical',
  status: 'open',
  location: { source: 'manual' as const, label: 'Edificio académico ficticio A' },
} as Incident;

function createDeps() {
  const campusOps = {
    checkBackendHealth: jest.fn(async () => undefined),
  };
  const incidents = {
    listIncidents: jest.fn(async () => [sampleIncident] as const),
    getIncidentDetail: jest.fn(async () => sampleIncident),
  };
  return { campusOps, incidents };
}

test('renders provider location when geocoding port returns valid coordinates', async () => {
  const { campusOps, incidents } = createDeps();
  const geocoding: GeocodingPort = {
    geocode: jest.fn(async () => ({
      source: 'provider' as const,
      label: 'Zona de prueba',
      latitude: 19.4,
      longitude: -99.1,
    })),
  };

  render(
    <IncidentApp campusOps={campusOps as never} incidents={incidents as never} geocoding={geocoding} />,
  );

  await waitFor(() => {
    expect(screen.getByTestId('incident-campus-inc-001')).toBeTruthy();
  });
  fireEvent.press(screen.getByTestId('incident-campus-inc-001'));

  await waitFor(() => {
    expect(screen.getByTestId('request-provider-location')).toBeTruthy();
  });
  expect(screen.getByText('Ubicación: Edificio académico ficticio A')).toBeTruthy();

  fireEvent.press(screen.getByTestId('request-provider-location'));

  await waitFor(() => {
    expect(screen.getByText(/Zona de prueba/)).toBeTruthy();
  });
  expect(geocoding.geocode).toHaveBeenCalled();
});

test('allows manual reference without coordinates when provider fails', async () => {
  const { campusOps, incidents } = createDeps();
  const geocoding: GeocodingPort = {
    geocode: jest.fn(async () => null),
  };

  render(
    <IncidentApp campusOps={campusOps as never} incidents={incidents as never} geocoding={geocoding} />,
  );

  await waitFor(() => {
    expect(screen.getByTestId('incident-campus-inc-001')).toBeTruthy();
  });
  fireEvent.press(screen.getByTestId('incident-campus-inc-001'));

  await waitFor(() => {
    expect(screen.getByTestId('request-provider-location')).toBeTruthy();
  });
  expect(screen.getByText('Ubicación: Edificio académico ficticio A')).toBeTruthy();

  fireEvent.press(screen.getByTestId('request-provider-location'));

  await waitFor(() => {
    expect(screen.getByText(/Proveedor no disponible|referencia manual/i)).toBeTruthy();
  });

  fireEvent.changeText(screen.getByTestId('manual-location-input'), 'Edificio B · planta baja');

  await waitFor(() => {
    expect(screen.getByTestId('manual-location-input').props.value).toBe(
      'Edificio B · planta baja',
    );
  });

  fireEvent.press(screen.getByTestId('confirm-manual-location'));

  await waitFor(() => {
    expect(screen.getByText(/Ubicación manual: Edificio B/)).toBeTruthy();
  });
  expect(geocoding.geocode).toHaveBeenCalled();
});
