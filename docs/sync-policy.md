# Política de sincronización - semana 8

## Combinar (`resolveSync` → merged)

Se combinan cambios en **campos distintos** respecto a la versión base. La comparación de cada campo usa su contenido JSON (`JSON.stringify`). El resultado `merged` incluye el mapa de campos resultante: se conserva lo que no cambió en la base y se aplican los cambios locales o remotos que no chocan entre sí.

Ejemplo: local modifica `title` y remoto modifica `priority` → 
`{ kind: 'merged', fields: { title: <local>, priority: <remoto>, ... } }`.

## Conflicto (`resolveSync` → conflict)

Si local y remoto modifican el **mismo campo** con valores distintos, se reporta:
`{ kind: 'conflict', fields: [<nombres en orden alfabético>] }`

No se mutan los registros `base`, `local` ni `remote`.

### Caso CampusOps: inicio offline vs reasignación

Partiendo de una incidencia asignada a `technician-1`:
- **Local (sin conexión):** el técnico inicia atención (`work.status = in_progress`, mismo asignado).
- **Remoto:** coordinación reasigna a `technician-2` (`work.assignedTechnicianId` distinto, status `assigned`).

Ambos alteran el campo agregado `work` de formas incompatibles. El resultado es `{ kind: 'conflict', fields: ['work'] }`. Se conserva la intención local en la cola durable (estado `conflict`) y no se sobrescribe automáticamente la asignación remota.

## Identidad e idempotencia

Cada operación pendiente tiene un `operationId` estable. Al reintentar se reutiliza la **misma** identidad y el **mismo** payload.

`deduplicateOperations` recorre la lista en orden, conserva la **primera** aparición de cada `operationId` y omite repeticiones. No muta las entradas originales.

## Autorización

La cola almacena `actorId` como autor sintético de la operación. Eso no sustituye:

- la autorización por perfil de la semana 6 (reporter / technician / coordinator);
- las validaciones del servidor al aplicar el cambio.

Ocultar botones en la UI tampoco sustituye esas comprobaciones.

## Cola durable y retiro

Las operaciones viven en SQLite (`pending_operations`, esquema v2) y sobreviven al reinicio de la aplicación (mismo `operationId`, mismo contenido).

| Situación | Efecto en la cola |
|---|---|
| Error de red / timeout | Se mantiene (`pending`) |
| Conflicto de sincronización | `markConflict` → status `conflict` (no se borra) |
| Confirmación del servidor | `removeConfirmed` → se elimina |

Solo la confirmación del servidor autoriza retirar la operación. Un conflicto o un fallo no son confirmación.

## Vinculación con pruebas

- `course-tests/public/week-08.test.ts` - `resolveSync` (merge, conflicto de campo, conflicto `work`) y `deduplicateOperations`.
- `src/infrastructure/SQLitePendingOperationsRepository.test.ts` - persistencia tras “reabrir”, marca de conflicto sin borrar, borrado solo con `removeConfirmed`.

