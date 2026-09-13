import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import type { CampusOpsApplication } from '../application/CampusOpsApplication';
import type { Incident, IncidentApplication } from '../application/IncidentApplication';

type BackendStatus = 'checking' | 'available' | 'offline';

type IncidentAppProps = Readonly<{
  campusOps: CampusOpsApplication;
  incidents: IncidentApplication;
}>;

export function IncidentApp({ campusOps, incidents }: IncidentAppProps) {
  const [backendStatus, setBackendStatus] = useState<BackendStatus>('checking');
  const [items, setItems] = useState<readonly Incident[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);

  useEffect(() => {
    let active = true;
    campusOps.checkBackendHealth()
      .then(() => active && setBackendStatus('available'))
      .catch(() => active && setBackendStatus('offline'));
    incidents.listIncidents().then((result) => active && setItems(result));
    return () => {
      active = false;
    };
  }, [campusOps, incidents]);

  if (selectedIncident) {
    return (
      <View style={styles.screen}>
        <Text style={styles.title}>{selectedIncident.title}</Text>
        <Text>{selectedIncident.description}</Text>
        <Text>Categoría: {selectedIncident.category}</Text>
        <Text>Estado: {selectedIncident.status}</Text>
        <Text>Ubicación: {selectedIncident.location.label}</Text>
        <Pressable accessibilityRole="button" onPress={() => setSelectedIncident(null)} style={styles.button}>
          <Text>Volver a incidencias</Text>
        </Pressable>
        <StatusBar style="auto" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View accessibilityRole="summary" style={styles.card}>
        <Text style={styles.title}>CampusOps</Text>
        <Text>Incidencias del campus · entorno académico </Text>
        <Text testID="backend-status">Backend: {backendStatus}</Text>
      </View>
      {items.map((incident) => (
        <Pressable
          accessibilityRole="button"
          key={incident.id}
          onPress={() => {
            incidents.getIncidentDetail(incident.id).then((detail) => setSelectedIncident(detail));
          }}
          style={styles.incident}
          testID={`incident-${incident.id}`}
        >
          <Text style={styles.incidentTitle}>{incident.title}</Text>
          <Text>{incident.status}</Text>
        </Pressable>
      ))}
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, gap: 12, justifyContent: 'center', padding: 24 },
  card: { gap: 12, padding: 20 },
  title: { fontSize: 24, fontWeight: '700' },
  incident: { gap: 4, padding: 12 },
  incidentTitle: { fontWeight: '600' },
  button: { padding: 12 },
});
