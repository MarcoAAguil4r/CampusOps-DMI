# Modelo de datos local — semana 8

La base local `campusops.db` usa SQLite mediante `expo-sqlite`. Su versión se
registra en `PRAGMA user_version`; la versión actual del esquema es `2`.
`SecureSessionAdapter` conserva por separado los datos mínimos de sesión en
SecureStore. La base no guarda tokens ni credenciales.

## Entidades y relaciones

### `incidents` (esquema 1)

| Campo | Tipo | Regla |
|---|---|---|
| `id` | `TEXT` | Clave primaria; ID local o del backend. |
| `version` | `INTEGER` | Versión base conocida, no negativa; empieza en `0` para los fixtures locales. |
| `status` | `TEXT` | Estado CampusOps permitido. |
| `incident_json` | `TEXT` | Registro serializado con título, descripción, categoría, estado y ubicación. |
| `updated_at` | `TEXT` | Fecha/hora ISO 8601 de la última escritura local. |

### `pending_operations` (esquema 2)

| Campo | Tipo | Regla |
|---|---|---|
| `operation_id` | `TEXT` | Clave primaria e identidad estable para reintentos/idempotencia. |
| `incident_id` | `TEXT` | Referencia a `incidents.id`; una incidencia con operaciones pendientes no se elimina. |
| `actor_id` | `TEXT` | Autor sintético autenticado de la operación; no reemplaza autorización del servidor. |
| `base_version` | `INTEGER` | Versión sobre la que se preparó el cambio, no negativa. |
| `action` | `TEXT` | Acción de dominio que se intentará sincronizar. |
| `payload_json` | `TEXT` | Contenido de la acción en JSON. No incluir tokens ni credenciales. |
| `status` | `TEXT` | `pending` o `conflict`; una falla no confirmada no se borra. |
| `created_at` | `TEXT` | Fecha/hora ISO 8601 usada para ordenar operaciones. |

Cada incidencia puede relacionarse con cero o más operaciones. La clave foránea
de `pending_operations.incident_id` evita dejar operaciones huérfanas, y el
índice `(incident_id, created_at)` permite consultar la cola por incidencia.
La cola se implementará sobre esta tabla; este esquema no marca una operación
como sincronizada antes de que el servidor la confirme.

## Almacenamiento y ciclo de vida

SQLite guarda el estado estructurado en el directorio privado de la aplicación
y sobrevive al cierre/reinicio. Se habilitan claves foráneas. Incidencias
iniciales ficticias sólo se insertan cuando la tabla está vacía. La identidad
de una creación local deriva de su clave de idempotencia; repetir la misma
clave y contenido devuelve el registro existente, y reutilizarla con otro
contenido se rechaza.

Los archivos SQLite de esta entrega no sustituyen SecureStore ni se consideran
cifrados por la aplicación. No guardar datos personales reales, secretos ni
tokens; los actores, ubicaciones y contenido de pruebas deben ser ficticios.
Los reportes/logs no deben registrar contenido de `incident_json` ni
`payload_json`.

## Migración y recuperación

`migrateCampusOpsDatabase` habilita claves foráneas y aplica las versiones
faltantes dentro de una transacción exclusiva:

1. De `user_version = 0` a `1`, crea `incidents`.
2. De `user_version = 1` a `2`, crea `pending_operations` y su índice.
3. Actualiza `user_version` en la misma transacción que cada cambio de esquema.
   La migración no elimina ni reescribe filas existentes.

Una falla aborta la transacción: SQLite revierte tanto los cambios DDL como
`user_version`, y se conserva el esquema anterior para reintentar. Una base con
una versión superior a la soportada se rechaza explícitamente; no se baja ni se
recrea automáticamente. Las pruebas de `CampusOpsDatabaseMigrations.test.ts`
verifican migración nueva, migración desde esquema 1, repetición y rollback
inyectado.
