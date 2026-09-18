import { changeIncidentStatus, createIncident } from './incidents';

const draft = {
  id: 'test-incident',
  title: '  Falla ficticia  ',
  description: 'Detalle ficticio',
  category: 'maintenance' as const,
  location: { source: 'manual' as const, label: 'Zona ficticia' },
};

test('creates an open incident with normalized text', () => {
  expect(createIncident(draft)).toMatchObject({ title: 'Falla ficticia', status: 'open' });
});

test('allows only the basic incident lifecycle transitions', () => {
  const incident = createIncident(draft);
  expect(changeIncidentStatus(incident, 'assigned').status).toBe('assigned');
  expect(() => changeIncidentStatus(incident, 'resolved')).toThrow('Cannot change');
});
