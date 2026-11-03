import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import type { CampusOpsApplication } from '../application/CampusOpsApplication';
import type { Incident, IncidentApplication } from '../application/IncidentApplication';
import type { GeocodingPort } from '../domain/ports/GeocodingPort';
import { selectIncidentLocation } from '../course-evaluation';

type BackendStatus = 'checking' | 'available' | 'offline';

type IncidentAppProps = Readonly<{
  campusOps: CampusOpsApplication;
  incidents: IncidentApplication;
  /** Puerto de geocodificación (Marco). En pruebas se inyecta un doble. */
  geocoding?: GeocodingPort;
}>;

type LocationUiState =
  | Readonly<{ kind: 'idle' }>
  | Readonly<{ kind: 'loading' }>
  | Readonly<{ kind: 'provider'; label: string; latitude: number; longitude: number }>
  | Readonly<{ kind: 'manual_required'; reason: string }>
  | Readonly<{ kind: 'resolved'; source: 'provider' | 'manual'; label: string }>;

export function IncidentApp({ campusOps, incidents, geocoding }: IncidentAppProps) {
  const [backendStatus, setBackendStatus] = useState<BackendStatus>('checking');
  const [items, setItems] = useState<readonly Incident[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [manualLabel, setManualLabel] = useState('');
  const [locationState, setLocationState] = useState<LocationUiState>({ kind: 'idle' });

  useEffect(() => {
    let active = true;
    campusOps
      .checkBackendHealth()
      .then(() => active && setBackendStatus('available'))
      .catch(() => active && setBackendStatus('offline'));
    incidents.listIncidents().then((result) => active && setItems(result));
    return () => {
      active = false;
    };
  }, [campusOps, incidents]);

  async function requestProviderLocation() {
    setLocationState({ kind: 'loading' });
    const fallbackLabel = manualLabel.trim() || 'Referencia pendiente';
    const query = manualLabel.trim() || selectedIncident?.location.label || 'CampusOps';

    let providerResult: unknown = null;
    if (geocoding) {
      try {
        const location = await geocoding.geocode(query);
        if (location?.source === 'provider') {
          providerResult = {
            label: location.label,
            latitude: location.latitude,
            longitude: location.longitude,
          };
        } else {
          providerResult = null;
        }
      } catch {
        providerResult = null;
      }
    }

    const chosen = selectIncidentLocation(providerResult, fallbackLabel);

    if (
      chosen.source === 'provider' &&
      typeof chosen.latitude === 'number' &&
      typeof chosen.longitude === 'number'
    ) {
      setLocationState({
        kind: 'provider',
        label: chosen.label,
        latitude: chosen.latitude,
        longitude: chosen.longitude,
      });
      return;
    }

    setLocationState({
      kind: 'manual_required',
      reason:
        'Proveedor no disponible o datos inválidos. Escribe edificio, zona o referencia manual.',
    });
  }

  function confirmManualLocation() {
    const label = manualLabel.trim();
    if (!label) {
      setLocationState({
        kind: 'manual_required',
        reason: 'La referencia manual no puede estar vacía.',
      });
      return;
    }
    const chosen = selectIncidentLocation(null, label);
    setLocationState({ kind: 'resolved', source: chosen.source, label: chosen.label });
  }

  function clearSelection() {
    setSelectedIncident(null);
    setLocationState({ kind: 'idle' });
    setManualLabel('');
  }

  if (selectedIncident) {
    return (
      <View style={styles.screen}>
        <Text style={styles.title}>{selectedIncident.title}</Text>
        <Text>{selectedIncident.description}</Text>
        <Text>Categoría: {selectedIncident.category}</Text>
        <Text>Estado: {selectedIncident.status}</Text>
        {/* Texto exigido por smoke / AC-01 */}
        <Text>Ubicación: {selectedIncident.location.label}</Text>

        <Text testID="location-ui-status">
          {locationState.kind === 'idle' && 'Ubicación: sin solicitar'}
          {locationState.kind === 'loading' && 'Ubicación: consultando proveedor…'}
          {locationState.kind === 'provider' &&
            `Ubicación proveedor: ${locationState.label} (${locationState.latitude}, ${locationState.longitude})`}
          {locationState.kind === 'manual_required' && `Ubicación: ${locationState.reason}`}
          {locationState.kind === 'resolved' &&
            `Ubicación ${locationState.source}: ${locationState.label}`}
        </Text>

        <Pressable
          accessibilityRole="button"
          testID="request-provider-location"
          onPress={() => {
            void requestProviderLocation();
          }}
          style={styles.button}
        >
          <Text>Obtener ubicación del proveedor</Text>
        </Pressable>

        <TextInput
          testID="manual-location-input"
          accessibilityLabel="Referencia manual de ubicación"
          placeholder="Edificio, zona o referencia"
          value={manualLabel}
          onChangeText={setManualLabel}
          style={styles.input}
        />

        <Pressable
          accessibilityRole="button"
          testID="confirm-manual-location"
          onPress={confirmManualLocation}
          style={styles.button}
        >
          <Text>Continuar con ubicación manual</Text>
        </Pressable>

        <Pressable accessibilityRole="button" onPress={clearSelection} style={styles.button}>
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
  input: { borderWidth: 1, borderColor: '#ccc', padding: 10, borderRadius: 6 },
});
