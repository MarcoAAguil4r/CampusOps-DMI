import { CampusOpsApplication } from '../application/CampusOpsApplication';
import { IncidentApplication } from '../application/IncidentApplication';
import { CourseBackendHealthAdapter } from '../infrastructure/CourseBackendHealthAdapter';
import { fictitiousIncidents, InMemoryIncidentRepository } from '../infrastructure/InMemoryIncidentRepository';
import { IncidentApp } from '../ui/IncidentApp';

const campusOps = new CampusOpsApplication(new CourseBackendHealthAdapter());
const incidents = new IncidentApplication(new InMemoryIncidentRepository(fictitiousIncidents));

export default function CampusOpsRoot() {
  return <IncidentApp campusOps={campusOps} incidents={incidents} />;
}
