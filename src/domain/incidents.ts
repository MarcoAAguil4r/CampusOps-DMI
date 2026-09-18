import type { IncidentCategory, IncidentLocation, IncidentStatus } from '../campusops/contracts';

export type Incident = Readonly<{
  id: string;
  title: string;
  description: string;
  category: IncidentCategory;
  status: IncidentStatus;
  location: IncidentLocation;
}>;

export type NewIncident = Readonly<{
  id: string;
  title: string;
  description: string;
  category: IncidentCategory;
  location: IncidentLocation;
}>;

const allowedTransitions: Readonly<Record<IncidentStatus, readonly IncidentStatus[]>> = {
  open: ['assigned'],
  assigned: ['in_progress'],
  in_progress: ['resolved'],
  resolved: ['closed'],
  closed: [],
};

export function createIncident(input: NewIncident): Incident {
  if (!input.id.trim() || !input.title.trim() || !input.description.trim() || !input.location.label.trim()) {
    throw new Error('An incident requires an id, title, description, and location');
  }

  return { ...input, title: input.title.trim(), description: input.description.trim(), status: 'open' };
}

export function changeIncidentStatus(incident: Incident, nextStatus: IncidentStatus): Incident {
  if (!allowedTransitions[incident.status].includes(nextStatus)) {
    throw new Error(`Cannot change an incident from ${incident.status} to ${nextStatus}`);
  }

  return { ...incident, status: nextStatus };
}
