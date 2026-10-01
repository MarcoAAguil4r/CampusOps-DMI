# Semana 5 — contrato de datos de incidencias

Este documento fija el límite entre el backend y la aplicación para la consulta de lista, consulta de detalle y creación de incidencias. La API completa, los perfiles y los escenarios de prueba están en [CAMPUSOPS_API.md](CAMPUSOPS_API.md).

## Entorno y encabezados

Ejecuta el servicio local con `make run-backend`; comprueba su estado con `npm run backend:self-test`. La base URL es `http://127.0.0.1:4310`; en el emulador Android se usa `http://10.0.2.2:4310`. No expongas el simulador a Internet.

Las solicitudes de incidencias envían:

| Encabezado | Uso |
|---|---|
| `Authorization: Bearer course-valid-token` | Sesión sintética del backend de curso; no es una credencial de producción. |
| `X-Course-Actor: <actorId>` | Actor de prueba seleccionado: `reporter-1`, `reporter-2`, `technician-1`, `technician-2` o `coordinator-1`. |
| `X-Course-Scenario: <scenario>` | Opcional; selecciona una respuesta controlada para pruebas, como `success`, `nullable`, `malformed`, `server_error` o `slow`. |
| `Idempotency-Key: <stable-key>` | Obligatorio al crear; conservar la misma clave y el mismo contenido al reintentar una operación. |

Los identificadores y tokens anteriores son fixtures públicos, no autenticación real. La app no debe tratar el rol enviado por el cliente como autorización; el servicio aplica permisos según el actor.

## Endpoints de incidencias

| Operación | Solicitud | Respuesta nominal |
|---|---|---|
| Consultar lista | `GET /v1/incidents` | `200 { "items": [<RemoteResourceDto>, ...] }`; puede devolver una lista vacía. El contenido depende del perfil autorizado. |
| Consultar detalle | `GET /v1/incidents/{id}` | `200 <RemoteResourceDto>` si el recurso existe y es visible para el actor. |
| Crear incidencia | `POST /v1/incidents` con JSON `{ "category": "connectivity", "description": "Falla ficticia", "location": "Edificio de prueba A" }` | `201 { "incident": <RemoteResourceDto>, "operationId": "<key>", "duplicate": false }`. Un reintento idéntico puede responder `200` con `duplicate: true`. |

Las categorías permitidas son `electrical`, `laboratory`, `water`, `connectivity`, `equipment`, `safety` y `maintenance`. `description` y `location` deben ser cadenas no vacías. La creación sólo está permitida para el perfil reportante. No se deben usar datos reales de personas o ubicaciones.

## DTO de recurso remoto

```json
{
  "id": "campus-inc-001",
  "version": 1,
  "status": "assigned",
  "payload": {
    "category": "connectivity",
    "description": "Falla de prueba",
    "location": "Edificio de prueba A"
  }
}
```

`parseRemoteResource(input)` recibe `unknown` y acepta únicamente un objeto con `id` y `status` como cadenas no vacías, `version` como entero no negativo y `payload` como objeto JSON o `null`. Rechaza arreglos como sobre o payload. Las propiedades futuras del sobre se ignoran para permitir evolución compatible. Un `payload: null` es válido y debe mantenerse como nulo: el cliente no debe fabricar datos de dominio para reemplazarlo.

El DTO describe el transporte. La capa de aplicación debe convertirlo al modelo de dominio sólo después de validar el sobre y los campos que necesita el flujo. Los objetos de dominio no deben depender de campos de transporte innecesarios.

## Errores y respuestas no nominales

La capa cliente debe distinguir estos resultados para que la UI pueda recuperarse correctamente:

| Categoría | Ejemplo | Tratamiento |
|---|---|---|
| Error de contrato | JSON no parseable, sobre inválido o campo requerido con tipo incorrecto | Rechazar la respuesta; no construir ni persistir un recurso parcial. |
| Error HTTP | `401`, `403`, `404`, `409`, `422`, `429` o `500` | Conservar el estado HTTP y, si existe, un código seguro del servidor; no exponer el cuerpo crudo ni datos sensibles en logs. |
| Timeout o conexión | El servidor es lento, la solicitud se aborta o no hay conexión | Representar como error de transporte, distinto de un `500`; no asumir que una escritura no se ejecutó si se perdió la respuesta. |

El backend didáctico ofrece respuestas controladas mediante `X-Course-Scenario`, incluidas `nullable`, `malformed`, `server_error`, `rate_limited` y `slow`. Las pruebas deben usar estos escenarios o dobles deterministas, no depender de Internet público. Los logs siguen las reglas de sanitización de las semanas anteriores.