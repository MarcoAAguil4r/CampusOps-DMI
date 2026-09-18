# CampusOps - modelo de amenazas inicial

Este modelo corresponde a la version de Semana 3 y usa solamente actores,
incidencias, ubicaciones y evidencias sinteticas.

## Activos

| ID | Activo | Impacto si se compromete |
|---|---|---|
| A-01 | Sesiones, tokens y perfiles sinteticos | Suplantacion y acceso fuera del rol |
| A-02 | Incidencias, asignaciones, estados e historial | Consulta o alteracion de trabajo ajeno |
| A-03 | Ubicaciones, fotografias y notas de incidencias | Exposicion de informacion operativa |
| A-04 | Cola offline, claves de idempotencia y conflictos | Perdida, duplicacion o imposicion de cambios |
| A-05 | Registros tecnicos y credenciales de configuracion | Filtracion de datos o acceso al servicio |

## Fronteras de confianza

| ID | Frontera | Control esperado |
|---|---|---|
| F-01 | App movil -> API CampusOps | TLS en despliegue real, autenticacion y autorizacion en el servicio |
| F-02 | Actor autenticado -> recursos de otro perfil | El servidor deriva el actor y valida rol, asignacion y transicion |
| F-03 | Cola local/offline -> sincronizacion remota | Version base, clave de idempotencia y manejo explicito de 409 |
| F-04 | API/servicio de ubicacion -> app | Adaptador valida tipos, coordenadas y errores antes de persistir |
| F-05 | Aplicacion -> logs y CI | Sanitizacion; nunca registrar tokens, ubicaciones, fotos ni datos personales |

## Amenazas priorizadas y verificación

| Prioridad | Amenaza | Activo/frontera | Control | Verificacion | Riesgo residual |
|---|---|---|---|---|---|
| P1 | Un tecnico consulta o modifica una incidencia ajena manipulando la app | A-02; F-02 | Autorizacion en API por actor, rol, asignacion vigente y transicion; responder 403 sin mutar el recurso | `npm test -- --ci --runInBand course-tests/public/week-03.test.ts`; pruebas de contrato para lista, detalle y accion con actor incompatible | Un token valido comprometido sigue requiriendo revocacion y expiracion en semanas posteriores |
| P2 | Una reasignacion antigua se impone despues de un cambio remoto | A-02/A-04; F-03 | Version base, conflicto 409, cola persistente e idempotencia; conservar la intencion pendiente y notificar el conflicto | `npm run test:smoke`; prueba de sincronizacion con `X-Course-Scenario` y reintento de la misma clave | La resolucion de conflictos puede requerir intervencion del coordinador |
| P3 | Una ubicacion o respuesta externa malformada se guarda como valida | A-03; F-04 | Validar etiqueta, coordenadas finitas y rangos; ofrecer ubicacion manual sin inventar coordenadas | Pruebas de `invalid_coordinates`, `incomplete`, `timeout` y etiqueta manual sintetica | La ubicacion manual puede ser imprecisa y depender de la entrada del usuario |
| P4 | Logs o artefactos exponen tokens, fotos, ubicaciones o datos personales | A-03/A-05; F-05 | Sanitizar campos sensibles y usar datos ficticios; escaneo de secretos obligatorio en CI | `npm run audit:ci`; busqueda de secretos del evaluador y revision de artefactos descargados | Metadatos tecnicos y tiempos pueden revelar informacion operacional limitada |

## Decision de prioridad

Se atiende primero P1 porque una autorizacion defectuosa permite consultar o
alterar directamente incidencias ajenas y puede convertir en irrelevantes los
controles de sincronizacion, ubicacion y registros. El control elegido vive en
el servicio, no solo en la interfaz: una prueba negativa que recibe 403 y
conserva el recurso demuestra una reduccion observable del riesgo.

## Alcance y limites

El modelo no usa datos reales ni sustituye pruebas de almacenamiento seguro,
permisos nativos o distribucion. Esas comprobaciones permanecen en los hitos
correspondientes. Las observaciones de CI deben conservar comando, estado,
escenario y evidencia en los reportes de `reports/week-03/`.