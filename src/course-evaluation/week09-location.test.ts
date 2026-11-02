import { selectIncidentLocation } from './index';

describe('selectIncidentLocation', () => {
  test('accepts finite provider coordinates at the valid boundary', () => {
    expect(selectIncidentLocation({ label: ' Zona ficticia ', latitude: 90, longitude: -180 }, 'Edificio manual')).toEqual({
      source: 'provider',
      label: 'Zona ficticia',
      latitude: 90,
      longitude: -180,
    });
  });

  test.each([
    null,
    new Error('timeout'),
    { label: 'Zona sin coordenadas' },
    { label: 'Latitud fuera de rango', latitude: 90.01, longitude: 0 },
    { label: 'Longitud fuera de rango', latitude: 0, longitude: -180.01 },
    { label: 'NaN', latitude: Number.NaN, longitude: 0 },
    { label: 'Coordenada textual', latitude: '19', longitude: 0 },
    { label: '  ', latitude: 0, longitude: 0 },
  ])('uses the manual location for invalid provider data', (provider) => {
    expect(selectIncidentLocation(provider, 'Edificio manual')).toEqual({
      source: 'manual',
      label: 'Edificio manual',
    });
  });

  test('rejects an empty manual fallback', () => {
    expect(() => selectIncidentLocation(null, '  ')).toThrow('non-empty manual');
  });
});
