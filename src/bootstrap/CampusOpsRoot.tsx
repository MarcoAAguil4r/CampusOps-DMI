import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { CampusOpsApplication } from '../application/CampusOpsApplication';
import { IncidentApplication } from '../application/IncidentApplication';
import { CourseBackendHealthAdapter } from '../infrastructure/CourseBackendHealthAdapter';
import { ConsoleTelemetryAdapter } from '../infrastructure/ConsoleTelemetryAdapter';
import { fictitiousIncidents } from '../infrastructure/InMemoryIncidentRepository';
import { openCampusOpsDatabase } from '../infrastructure/openCampusOpsDatabase';
import { SQLiteIncidentRepository } from '../infrastructure/SQLiteIncidentRepository';
import { IncidentApp } from '../ui/IncidentApp';

const campusOps = new CampusOpsApplication(new CourseBackendHealthAdapter());

export default function CampusOpsRoot() {
  const [incidents, setIncidents] = useState<IncidentApplication | null>(null);
  const [initializationError, setInitializationError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void openCampusOpsDatabase()
      .then(async (database) => {
        const repository = new SQLiteIncidentRepository(database);
        try {
          await repository.seedIfEmpty(fictitiousIncidents);
        } catch (error) {
          try {
            await database.closeAsync();
          } catch (closeError) {
            throw new AggregateError(
              [error, closeError],
              'CampusOps incident initialization failed and its connection could not be closed',
            );
          }
          throw error;
        }
        if (active) {
          setIncidents(new IncidentApplication(repository, new ConsoleTelemetryAdapter()));
        } else {
          await database.closeAsync();
        }
      })
      .catch((error: unknown) => {
        if (active) setInitializationError(error instanceof Error ? error.message : String(error));
      });

    return () => {
      active = false;
    };
  }, []);

  if (initializationError !== null) {
    return (
      <View>
        <Text>No se pudo inicializar el almacenamiento local: {initializationError}</Text>
      </View>
    );
  }
  if (incidents === null) {
    return <ActivityIndicator accessibilityLabel="Inicializando almacenamiento local" />;
  }

  return <IncidentApp campusOps={campusOps} incidents={incidents} />;
}
