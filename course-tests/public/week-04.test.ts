import { redactForTelemetry } from '../../src/course-evaluation';

test('CampusOps redacts personal and incident-sensitive data while preserving technical context', () => {
  const result = redactForTelemetry({
    request: { headers: { authorization: 'Bearer course-token', accept: 'application/json' } },
    profile: { email: 'person@campusops.test', displayName: 'Persona ficticia' },
    incidentId: 'campus-inc-001',
    location: 'Zona ficticia',
    photos: ['synthetic-photo-1'],
    internalComments: ['Nota interna ficticia'],
  });
  expect(result).toEqual({
    request: { headers: { authorization: '[REDACTED]', accept: 'application/json' } },
    profile: { email: '[REDACTED]', displayName: '[REDACTED]' },
    incidentId: 'campus-inc-001',
    location: '[REDACTED]',
    photos: '[REDACTED]',
    internalComments: '[REDACTED]',
  });
});

test('redacts nested list values with normalized keys without mutating the input', () => {
  const input = {
    events: [
      {
        authorization: 'Bearer synthetic-token',
        profile: { user_id: 'synthetic-user', displayName: 'Persona ficticia' },
        incident: {
          correlationId: 'trace-01',
          assignment_history: [{ technicianId: 'synthetic-technician' }],
          coordinates: { latitude: 19.4, longitude: -99.1 },
          evidence: [{ photo: 'synthetic-photo' }],
          internal_comments: ['Nota ficticia'],
          name: 'Nombre ficticio',
          password: 'synthetic-password',
          'refresh-token': 'synthetic-refresh-token',
        },
      },
      { attempt: 2, durationMs: 15, status: 'failed' },
    ],
  };
  const original = JSON.stringify(input);

  expect(redactForTelemetry(input)).toEqual({
    events: [
      {
        authorization: '[REDACTED]',
        profile: { user_id: '[REDACTED]', displayName: '[REDACTED]' },
        incident: {
          correlationId: 'trace-01',
          assignment_history: '[REDACTED]',
          coordinates: { latitude: '[REDACTED]', longitude: '[REDACTED]' },
          evidence: '[REDACTED]',
          internal_comments: '[REDACTED]',
          name: '[REDACTED]',
          password: '[REDACTED]',
          'refresh-token': '[REDACTED]',
        },
      },
      { attempt: 2, durationMs: 15, status: 'failed' },
    ],
  });
  expect(JSON.stringify(input)).toBe(original);
});
