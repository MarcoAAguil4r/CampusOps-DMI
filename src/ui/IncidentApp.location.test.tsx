import { selectIncidentLocation } from '../course-evaluation';

test('UI path: provider failure keeps manual label without inventing coordinates', () => {
  const manual = 'Edificio B · planta baja';
  const chosen = selectIncidentLocation({ status: 429 }, manual);
  expect(chosen).toEqual({ source: 'manual', label: manual });
  expect(chosen).not.toHaveProperty('latitude');
});

test('UI path: valid provider is accepted', () => {
  expect(
    selectIncidentLocation({ label: 'Zona de prueba', latitude: 19.4, longitude: -99.1 }, 'Manual'),
  ).toEqual({
    source: 'provider',
    label: 'Zona de prueba',
    latitude: 19.4,
    longitude: -99.1,
  });
});
