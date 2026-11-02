Find files matching `**/semana 6/**/*`

Read , lines 1 to 200
Completed with input: {
  "path": "E:\\PROYECTOS\\10° B - DMI\\CampusOps-Semana-01\\semana 6",
  "view_range": [
    1,
    200
  ]
}

Read , lines 1 to 220
Completed with input: {
  "path": "E:\\PROYECTOS\\10° B - DMI\\CampusOps-Semana-01\\semana 6\\INSTALL.md",
  "view_range": [
    1,
    220
  ]
}

Read , lines 1 to 260
Completed with input: {
  "path": "E:\\PROYECTOS\\10° B - DMI\\CampusOps-Semana-01\\semana 6\\docs\\CAMPUSOPS.md",
  "view_range": [
    1,
    260
  ]
}

Read , lines 1 to 220
Completed with input: {
  "path": "E:\\PROYECTOS\\10° B - DMI\\CampusOps-Semana-01\\semana 6\\docs\\CAMPUSOPS_API.md",
  "view_range": [
    1,
    220
  ]
}

Read , lines 1 to 260
Completed with input: {
  "path": "E:\\PROYECTOS\\10° B - DMI\\CampusOps-Semana-01\\semana 6\\docs\\assignments\\week-06.md",
  "view_range": [
    1,
    260
  ]
}

Read , lines 1 to 220
Completed with input: {
  "path": "E:\\PROYECTOS\\10° B - DMI\\CampusOps-Semana-01\\semana 6\\docs\\assignments\\week-06-rubric.md",
  "view_range": [
    1,
    220
  ]
}

Read , lines 1 to 260
Completed with input: {
  "path": "E:\\PROYECTOS\\10° B - DMI\\CampusOps-Semana-01\\semana 6\\docs\\assignments\\week-06-repository.md",
  "view_range": [
    1,
    260
  ]
}

Read , lines 1 to 260
Completed with input: {
  "path": "E:\\PROYECTOS\\10° B - DMI\\CampusOps-Semana-01\\semana 6\\course-tests\\public\\week-06.test.ts",
  "view_range": [
    1,
    260
  ]
}

Added reference "Semana 6 docs"
Completed with input: {
  "items": [
    {
      "type": "file",
      "label": "Semana 6 docs",
      "isArtifact": false,
      "uri": "file:///E:/PROYECTOS/10° B - DMI/CampusOps-Semana-01/semana%206/docs"
    }
  ]
}

Read , lines 1 to 220
Completed with input: {
  "path": "E:\\PROYECTOS\\10° B - DMI\\CampusOps-Semana-01\\semana 6\\.github\\workflows\\week-06-sesion-segura-feedback.yml",
  "view_range": [
    1,
    220
  ]
}

He revisado la carpeta de la semana 6 y el enfoque principal es la sesión segura y la renovación coordinada de tokens. Aquí va un análisis archivo por archivo y luego la división recomendada para 3 integrantes.

Análisis por archivo

- `semana 6/INSTALL.md`
  - Es la guía de instalación y preparación.
  - Explica que hay que fusionar esta carpeta sobre el repositorio actual sin reiniciar el proyecto, revisar conflictos y seguir las instrucciones de las entregas.
  - Importante: no basta con copiar files; hay que conservar el historial y trabajar sobre el repo existente.

- `semana 6/docs/CAMPUSOPS.md`
  - Define el dominio funcional de CampusOps.
  - Explica perfiles: reportante, técnico y coordinador; flujo de incidencias y reglas de permisos.
  - Establece el alcance acumulativo, conflictos, sincronización, privacidad y la relación con semanas anteriores.
  - Es la referencia funcional más completa del proyecto.

- `semana 6/docs/CAMPUSOPS_API.md`
  - Describe el contrato del backend simulado.
  - Define rutas, headers, actores públicos y variantes de respuesta.
  - Es esencial para la autenticación, permisos y validación de respuestas.
  - Expone el concepto clave de esta semana: 401 + refresh compartido + single-flight.

- `semana 6/docs/assignments/week-06.md`
  - Es la actividad formal de esta semana.
  - Indica los objetivos:
    - estados de sesión,
    - perfiles de CampusOps,
    - coordinación de renovación concurrente,
    - manejo de errores y cierre de sesión,
    - requisitos de evidencia y entrega.
  - Define los archivos entregables obligatorios:
    - docs/session-state-machine.mmd
    - reports/week-06/auth-tests.json
    - reports/week-06/concurrency.json
    - evidence/week-06/engineering.json
    - evidence/week-06/individual.json

- `semana 6/docs/assignments/week-06-rubric.md`
  - Contiene la evaluación.
  - Explica que AC-01 a AC-03 son automáticos, y AC-04 y AC-05 son semiautomáticos.
  - Da los criterios reales de calificación: sesión efectiva, refresh único, logout seguro, justificación técnica y aporte individual.

- `semana 6/docs/assignments/week-06-repository.md`
  - Es la guía de entrega.
  - Explica el flujo de Git, tag, SHA, pruebas obligatorias y el orden correcto:
    - make feedback
    - make verify-week-06
    - make public-test-week-06
    - commit solo de reportes/evidencias
    - crear tag week-06-final
    - make evidence-week-06
  - Es clave para no cometer errores de entrega ni de versión.

- `semana 6/course-tests/public/week-06.test.ts`
  - Tiene las pruebas públicas mínimas.
  - Verifica dos cosas concretas:
    - que varios 401 concurrentes se coalescen en un solo refresh,
    - que logout elimina el estado persistido.
  - Es el test “núcleo” que define la lógica esperada.

- `semana 6/.github/workflows/week-06-sesion-segura-feedback.yml`
  - Indica la validación automatizada.
  - Ejecuta make setup, build de Android Expo, make verify-week-06, make public-test-week-06, make evidence-week-06 y sube artefactos de evidencia.
  - Sirve como feedback de calidad antes de la entrega final.

Conclusión del análisis:
La semana 6 está concentrada en 4 pilares:
- sesión segura,
- tokens y refresh,
- autorización por perfil,
- evidencias y validación de entrega.

División recomendada de los requerimientos entre 3 integrantes

1. Integrante 1 — Sesión, refresh y single-flight
Responsabilidad principal:
- Implementar el estado de sesión y la máquina de estados.
- Manejar login, sesión válida, expiración, renovación y logout.
- Garantizar que varios 401 compartan una sola renovación (single-flight).
- Limitar reintentos y prevenir bucles.
- Evitar que el token quede persistido luego del cierre.
- Implementar la lógica real de coordinateRefresh.

Requisitos que cubre:
- “Definan los estados de sesión”
- “Coordinen la renovación concurrente”
- “Prueben errores y cierre de sesión”
- Validación del caso público de concurrent 401s
- AC-02 y AC-03

Entregables esperados:
- código de sesión,
- diagrama Mermaid,
- reportes de concurrencia,
- pruebas de logout y de refresh compartido.

2. Integrante 2 — Autorización por perfil y validación del backend
Responsabilidad principal:
- Integrar reportante / técnico / coordinador.
- Validar permisos reales en las operaciones.
- Asegurar que el técnico solo maneje incidencias asignadas y que coordinación maneje cierre/reapertura.
- Conectar las decisiones con la lógica del backend simulado y los headers Authorization/X-Course-Actor.
- Revisión de autorización previa a cada acción.

Requisitos que cubre:
- “Apliquen los perfiles de CampusOps”
- Autorización de operaciones según rol
- Contratos de API de /v1/incidents
- Evidencia de login + autorización + fallo de sesión

Entregables esperados:
- pruebas de auth,
- validaciones de permiso y autorización,
- parte del JSON de auth-tests.json.

3. Integrante 3 — Evidencias, QA y entrega final
Responsabilidad principal:
- Coordinar la verificación de pruebas y entrega.
- Ejecutar make feedback, make verify-week-06 y make public-test-week-06.
- Construir y revisar los JSON de evidencias:
  - reports/week-06/auth-tests.json
  - reports/week-06/concurrency.json
  - evidence/week-06/engineering.json
  - evidence/week-06/individual.json
- Mantener la documentación técnica y la decisión de renovación.
- Preparar el tag week-06-final y verificar el SHA final.

Requisitos que cubre:
- Reportes y evidencias requeridos
- Justificación técnica y decisión
- AC-04 y AC-05
- Orden de entrega y validación final

Recomendación práctica:
- El primer integrante debe liderar la parte “lógica de negocio y seguridad”,
- el segundo la parte “autorización y permisos”,
- el tercero la parte “verificación, evidencia y cumplimiento de entrega”.

Si quieres, te puedo convertir esta división en una propuesta más formal para el equipo, por ejemplo:
- “Integrante 1: Seguridad de sesión”
- “Integrante 2: Permisos y roles”
- “Integrante 3: Evidencias y QA”
con una lista de tareas concretas por archivo y por commit esperado.