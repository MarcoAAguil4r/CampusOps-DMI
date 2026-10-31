# Semana 8 — integrantes, ramas y responsabilidades

El equipo trabaja en el mismo repositorio y se integra sobre la rama principal
registrada con el docente. Antes de empezar, cada persona debe crear su rama
desde la versión integrada de semana 6, usar su identidad Git individual y
publicar su trabajo mediante un pull request. No creen otro repositorio ni
registren nombres, matrículas, commits o resultados de otra persona.

## Ramas del equipo

| Integrante | Rama que debe crear | Área principal |
|---|---|---|
| Integrante 1 | `feature/week-08-integrante-1-persistencia-migracion` | Modelo local, persistencia y migración segura |
| Integrante 2 | `feature/week-08-integrante-2-cola-sincronizacion` | Cola durable, sincronización, conflictos e idempotencia |
| Integrante 3 | `feature/week-08-integrante-3-pruebas-entrega` | Integración, pruebas de aceptación, reportes y cierre |

Cada integrante debe crear y usar su rama antes de modificar el proyecto. Si el
equipo acuerda otros nombres de rama, mantengan una rama individual por
integrante y actualicen esta tabla antes de comenzar. Integren primero la base
común; revisen cada pull request y resuelvan conflictos sin descartar trabajo.

## Requerimientos por integrante

### Integrante 1 — persistencia y migraciones

- Definir el modelo local en `docs/data-model.md`: entidades, relaciones,
  almacenamiento elegido, versión de esquema y estructura de las operaciones
  pendientes (`operationId`, incidencia, autor, contenido y versión base).
- Implementar o integrar el esquema persistente y sus migraciones, conservando
  los datos existentes y la cola.
- Probar una migración válida y una falla inyectada. La transacción debe
  revertirse o recuperarse de forma controlada, sin dejar datos o esquema a
  medias.
- Verificar y documentar el estado antes de migrar, después de una falla y
  después de la recuperación. Agregar pruebas automatizadas donde corresponda.
- Entregar un commit propio y el SHA de su rama para revisión del Integrante 2.

### Integrante 2 — cola durable y sincronización

- Implementar la cola de cambios sin conexión sobre el almacenamiento
  persistente. La identidad y el contenido de cada operación deben sobrevivir
  al reinicio de la aplicación.
- Integrar `resolveSync` y `deduplicateOperations` con la lógica real de
  CampusOps. Combinar cambios independientes; comparar por contenido JSON;
  reportar campos incompatibles en orden alfabético; conservar la primera
  operación de cada `operationId` sin mutar entradas.
- Manejar el caso concurrente de inicio local sin conexión y reasignación
  remota: conservar la intención local y la asignación remota, informar el
  conflicto y no descartar la operación pendiente.
- Reutilizar la misma identidad y contenido al reintentar. Retirar de la cola
  sólo operaciones confirmadas; errores, timeouts y conflictos no son
  confirmación.
- Documentar en `docs/sync-policy.md` qué se combina, qué requiere resolución,
  cómo se conserva la autorización y cuándo se elimina una operación.
- Entregar un commit propio y el SHA de su rama para revisión del Integrante 3.

### Integrante 3 — integración, verificación y evidencia

- Revisar la integración de persistencia y sincronización; completar las
  pruebas del contrato público y comprobar que los adaptadores de
  `src/course-evaluation/index.ts` llaman a la lógica real.
- Coordinar la matriz de casos: reinicio, migración válida/fallida y rollback,
  conflicto de reasignación, combinación de cambios independientes y
  repetición/deduplicación de operaciones.
- Registrar los comandos y resultados observados en
  `reports/week-08/migration-tests.json`. No declarar como ejecutado un
  resultado esperado.
- Preparar `evidence/week-08/engineering.json` con la decisión de política,
  al menos dos alternativas, beneficio/costo, requisitos AC-01 a AC-05 y
  verificaciones reales. Reunir en `evidence/week-08/individual.json` tres
  registros auténticos, uno por integrante; cada persona aporta su propio SHA,
  archivo técnico y prueba o revisión.
- Ejecutar y coordinar el cierre de equipo descrito en la guía de entrega;
  comprobar los archivos y los resultados antes de fijar la etiqueta final.

## Traspasos y criterios compartidos

1. Todos parten de la misma versión integrada de semana 6. El Integrante 1
   entrega primero el modelo y las migraciones; el Integrante 2 integra sobre
   esa base; el Integrante 3 valida el conjunto. Las ramas siguen siendo
   independientes y cada cambio se revisa antes de integrarse.
2. Los tres integrantes deben aportar trabajo técnico comprobable y entender el
   resultado. La distribución no sustituye las responsabilidades compartidas
   de revisar, ejecutar las pruebas y completar la evidencia individual.
3. Los criterios de la semana son: **AC-01**, instalación y reproducción;
   **AC-02**, persistencia, recuperación y sincronización íntegra; **AC-03**,
   rollback y ausencia de pérdidas/duplicados; **AC-04**, decisión técnica
   vinculada a verificaciones; **AC-05**, aportación individual verificable.
4. Antes de cerrar, comprueben la actividad y la rúbrica de semana 8. Ejecuten
   `make feedback`, `make verify-week-08` y `make public-test-week-08`; guarden
   los reportes y evidencias en el commit final exclusivo de `reports/` y
   `evidence/`. Después creen `week-08-final` y ejecuten
   `make evidence-week-08`, tal como indica
   `docs/assignments/week-08-repository.md`.
