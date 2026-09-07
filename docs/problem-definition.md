# Definición del problema — CampusOps

## Problema

En un campus universitario ficticio, estudiantes y personal detectan constantemente incidencias de infraestructura y servicios (fallas eléctricas, daños en laboratorios, fugas de agua, problemas de conectividad, equipos descompuestos, riesgos de seguridad, necesidades de mantenimiento), pero no existe una forma centralizada de reportarlas, clasificarlas, asignarlas a un técnico y dar seguimiento a su resolución. Esto provoca reportes perdidos, falta de claridad sobre quién debe atender cada caso y ausencia de evidencia sobre cómo y cuándo se resolvió. CampusOps busca resolver esto permitiendo que cualquier miembro del campus reporte una incidencia desde la aplicación, y que el personal responsable la clasifique, priorice, asigne, atienda y cierre desde la misma app, incluso en condiciones de conectividad limitada.

## Alcance

### Incluye

- Creación de una incidencia por parte del reportante: categoría, descripción, ubicación y fotografía adjunta.
- Consulta del reportante sobre el estado de sus propios reportes, con posibilidad de agregar información posterior.
- Asignación y reasignación de incidencias a un técnico por parte del coordinador, con priorización.
- Atención de la incidencia por el técnico: inicio de atención, registro de diagnóstico/notas/evidencias, y marcado de resolución.
- Cierre (o reapertura) de una incidencia resuelta por parte del coordinador.
- Flujo de estados con historial: `open` → `assigned` → `in_progress` → `resolved` → `closed`, con posibilidad de reapertura hacia `assigned` cuando exista técnico asignado.
- Operación del técnico sin conexión (consultar, cambiar estado, agregar notas/evidencias) con cola persistente que sobrevive a un reinicio de la app y sincroniza al recuperar conexión, detectando conflictos sin pérdida silenciosa de cambios.
- Control de acceso por perfil (reportante, técnico, coordinador) verificado en el servicio, no solo ocultando botones en la interfaz.

### No incluye

- Pagos, chat en tiempo real, reconocimiento de imágenes por IA, panel web administrativo completo.
- Publicación pública en tiendas de aplicaciones o integración con sistemas institucionales reales.
- Notificaciones push (no es requisito del núcleo).
- Soporte para iOS (Android es la plataforma de referencia; iOS es extensión voluntaria futura).
- Construir la aplicación completa o todas las pantallas en esta semana 1 — solo se define el problema, el alcance y se diagnostica una falla controlada.

## Actores y responsabilidades

- **Reportante:** responsable de registrar una incidencia con categoría, descripción, ubicación y evidencia fotográfica; puede consultar el estado de sus propios reportes y agregar información adicional después de crearlos.
- **Técnico:** responsable de consultar las incidencias que le fueron asignadas, iniciar su atención, registrar diagnóstico/notas/evidencias (incluso sin conexión), y marcarlas como resueltas. No puede modificar una incidencia que ya fue reasignada a otra persona.
- **Coordinador:** responsable de revisar el conjunto de incidencias reportadas, priorizarlas, asignarlas o reasignarlas a un técnico disponible, revisar el historial y evidencias, y cerrar una resolución o reabrir un caso cuando sea necesario.

## Flujo principal

1. El reportante crea una incidencia (categoría, descripción, ubicación, foto). Queda en estado `open`.
2. El coordinador revisa la incidencia, la prioriza y la asigna a un técnico. Pasa a estado `assigned`.
3. El técnico inicia la atención (puede hacerlo sin conexión) y la incidencia pasa a `in_progress`; registra diagnóstico, notas y evidencias conforme avanza.
4. El técnico marca la incidencia como resuelta (`resolved`), documentando la solución aplicada.
5. El coordinador revisa la resolución y la cierra (`closed`), o la reabre hacia `assigned` si considera que no fue resuelta correctamente, conservando el historial completo de cambios.

## Criterios de aceptación verificables

1. Toda incidencia creada por un reportante debe quedar registrada con un identificador único, su categoría, descripción, ubicación y estado inicial `open`, visible para el reportante y el coordinador.
2. Una incidencia no puede pasar al estado `in_progress` si no tiene previamente un técnico asignado (estado `assigned`), y un técnico no puede modificar una incidencia que ya fue reasignada a otra persona mientras él la tenía en curso.
3. El sistema debe conservar y permitir consultar el historial completo de cambios de estado de cada incidencia (open → assigned → in_progress → resolved → closed, incluyendo reaperturas), con la fecha de cada cambio.
4. Un cambio de estado o nota registrado por un técnico sin conexión debe seguir disponible tras reiniciar la aplicación, y al recuperar conexión debe sincronizarse sin duplicar eventos ni perder la operación pendiente, incluso si hubo una reasignación concurrente por parte del coordinador.

