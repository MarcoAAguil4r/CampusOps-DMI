import type { IncidentCategory } from '../campusops/contracts';
import type { Incident } from '../domain/incidents';
import type { IncidentRepository, NewRemoteIncidentInput } from '../domain/ports/IncidentRepository';
import { parseRemoteResource } from '../course-evaluation';
import { ContractError } from './httpErrors';
import type { CampusOpsApiClient } from './CampusOpsApiClient';

const CATEGORY_LABELS: Readonly<Record<IncidentCategory, string>> = {
  electrical: 'Falla electrica',
  laboratory: 'Incidencia de laboratorio',
  water: 'Fuga de agua',
  connectivity: 'Problema de conectividad',
  equipment: 'Equipo descompuesto',
  safety: 'Riesgo de seguridad',
  maintenance: 'Mantenimiento requerido',
};

function isIncidentCategory(value: unknown): value is IncidentCategory {
  return typeof value === 'string' && Object.hasOwn(CATEGORY_LABELS, value);
}

function toDomainIncident(dto: { id: string; status: string; payload: Readonly<Record<string, unknown>> | null }): Incident {
  if (dto.payload === null) throw new ContractError('Incident payload must not be null for a resolved incident');

  const { category, description, location } = dto.payload;
  if (!isIncidentCategory(category)) throw new ContractError('Unknown incident category in remote payload');
  if (typeof description !== 'string' || description.trim().length === 0) {
    throw new ContractError('Incident description missing in remote payload');
  }
  if (typeof location !== 'string' || location.trim().length === 0) {
    throw new ContractError('Incident location missing in remote payload');
  }

  const validStatuses = ['open', 'assigned', 'in_progress', 'resolved', 'closed'];
  if (!validStatuses.includes(dto.status)) throw new ContractError('Unknown incident status in remote payload');

  return {
    id: dto.id,
    title: CATEGORY_LABELS[category],
    description,
    category,
    status: dto.status as Incident['status'],
    location: { source: 'manual', label: location },
  };
}

export class RemoteIncidentRepository implements IncidentRepository {
  public constructor(private readonly client: CampusOpsApiClient) {}

  async list(): Promise<readonly Incident[]> {
    const raw = await this.client.request({ method: 'GET', path: '/v1/incidents' });
    if (typeof raw !== 'object' || raw === null || !('items' in raw) || !Array.isArray((raw as { items: unknown }).items)) {
      throw new ContractError('Incident list envelope is malformed');
    }

    const items: Incident[] = [];
    for (const entry of (raw as { items: unknown[] }).items) {
      const parsed = parseRemoteResource(entry);
      if (!parsed.ok) throw new ContractError('Incident list item does not satisfy the published contract');
      items.push(toDomainIncident(parsed.value));
    }
    return items;
  }

  async findById(id: string): Promise<Incident | null> {
    const raw = await this.client.request({ method: 'GET', path: `/v1/incidents/${encodeURIComponent(id)}` });
    const parsed = parseRemoteResource(raw);
    if (!parsed.ok) throw new ContractError('Incident detail does not satisfy the published contract');
    return toDomainIncident(parsed.value);
  }

  async create(input: NewRemoteIncidentInput): Promise<Incident> {
    const idempotencyKey = `create-${input.category}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const raw = await this.client.request({
      method: 'POST',
      path: '/v1/incidents',
      body: input,
      idempotencyKey,
    });

    if (typeof raw !== 'object' || raw === null || !('incident' in raw)) {
      throw new ContractError('Create-incident envelope is malformed');
    }

    const parsed = parseRemoteResource((raw as { incident: unknown }).incident);
    if (!parsed.ok) throw new ContractError('Created incident does not satisfy the published contract');
    return toDomainIncident(parsed.value);
  }
}
