# Auditoría de seguridad — Semana 4

**Fecha:** 2026-09-24  
**Rama:** `week4/security-audit-marco`  
**Proyecto:** CampusOps

## Objetivo y alcance

Se reviso el codigo del cliente, el backend didactico, los adaptadores de sesion, el contrato de integracion y la documentacion de amenazas. El alcance se concentro en exposicion accidental de credenciales, tokens, datos de usuarios, ubicaciones, evidencias y registros tecnicos.

No se usaron datos reales. Los identificadores de actores y tokens que aparecen en el backend (`course-valid-token`, `course-refresh-0` y similares) estan declarados por el contrato como fixtures publicos de pruebas, por lo que no se reportan como secretos filtrados.

## Metodologia y evidencia

- Inspeccion de `src/api`, `src/infrastructure`, `src/course-evaluation`, `src/ui` y `course-backend`.
- Busqueda de referencias a tokens, autorizacion, secretos, variables de entorno, `fetch`, HTTP, almacenamiento local y logs.
- Revisión de `SECURITY.md`, `docs/threat-model.md` y `docs/CAMPUSOPS_API.md`.
- Verificacion del estado inicial con `git status --short --branch`.
- No se encontro uso de `console.log`, `console.warn` o `console.error` en el codigo revisado.

## Hallazgos

| # | Hallazgo | Riesgo | Solución aplicada | Evidencia |
|---|---|---|---|---|
| 1 | El backend y la URL predeterminada usan HTTP sin TLS | Si se reutiliza fuera del laboratorio, tokens y datos de incidencias podrían viajar sin cifrado y ser interceptados | Se mantuvo restringido al backend didáctico local y se documentó que no debe exponerse a Internet. TLS obligatorio queda pendiente para producción | `src/api/courseBackend.ts`, `course-backend/server.mjs`, `docs/CAMPUSOPS_API.md` |
| 2 | El backend respondía CORS con `*` | Un origen no autorizado podía intentar solicitudes desde el navegador si el servicio se exponía o usaba autenticación real | Se reemplazó `*` por el origen configurable `COURSE_BACKEND_CORS_ORIGIN`, con valor local seguro en `.env.example` | `course-backend/server.mjs`, `.env.example` |
| 3 | `redactForTelemetry` estaba pendiente de implementar | Una futura telemetría que registrara payloads sin sanitizar podía revelar tokens, ubicaciones, evidencias o datos personales | Se implementó redacción recursiva de campos sensibles, preservando contexto técnico y sin mutar la entrada | `src/course-evaluation/index.ts`, `course-tests/public/week-04.test.ts` |

## Hallazgo 1 — Transporte HTTP sin TLS

### Problema encontrado

El cliente y el backend didáctico utilizan `http://` para trabajar localmente. La URL predeterminada está definida en `src/api/courseBackend.ts` y el servidor anuncia una dirección HTTP.

### Riesgo

Si esta configuración se reutilizara fuera de una red de laboratorio, tokens y datos de incidencias podrían viajar sin cifrado y ser interceptados.

### Solución

Este riesgo no se habilitó para producción: el backend se mantiene como simulador local y la documentación indica que no debe exponerse a Internet. Un despliegue real todavía debe incorporar TLS y una URL `https://`.

### Antes

```ts
const DEFAULT_URL = 'http://127.0.0.1:4310';
```

### Después

```text
Backend didáctico aislado en localhost.
Despliegue real: pendiente de HTTPS/TLS.
```

### Evidencia

[docs/CAMPUSOPS_API.md](CAMPUSOPS_API.md) documenta el aislamiento del simulador y [course-backend/server.mjs](../course-backend/server.mjs) muestra que se trata de un servidor HTTP local.

## Hallazgo 2 — CORS abierto

### Problema encontrado

El backend respondía `access-control-allow-origin: *`, permitiendo cualquier origen en las respuestas CORS.

### Riesgo

Si el servicio se expusiera o utilizara autenticación real, un sitio no autorizado podría intentar solicitudes desde el navegador del usuario.

### Solución

Se reemplazó el comodín por el origen configurable `COURSE_BACKEND_CORS_ORIGIN`. El valor de ejemplo permite únicamente `http://localhost:8081`.

### Antes

```js
'access-control-allow-origin': '*',
```

### Después

```js
const corsOrigin = process.env.COURSE_BACKEND_CORS_ORIGIN ?? 'http://localhost:8081';
// ...
'access-control-allow-origin': corsOrigin,
```

### Evidencia

La prueba HTTP devolvió `access-control-allow-origin=http://localhost:3000` cuando se configuró ese origen. La salida completa está en [docs/evidence/cors-restringido.txt](evidence/cors-restringido.txt).

## Hallazgo 3 — Telemetría sin sanitización

### Problema encontrado

`redactForTelemetry` estaba pendiente y lanzaba un error. Implementar telemetría usando directamente el objeto original podría exponer tokens, ubicaciones, evidencias o datos personales.

### Riesgo

Los registros técnicos podrían conservar información privada y quedar visibles para personas o servicios que tengan acceso a logs.

### Solución

Se implementó una redacción recursiva que reemplaza campos sensibles por `[REDACTED]`, conserva campos técnicos permitidos y no muta el objeto de entrada.

### Antes

```ts
export function redactForTelemetry(_input: unknown): unknown {
	return pending('redactForTelemetry');
}
```

### Después

```ts
export function redactForTelemetry(_input: unknown): unknown {
	// Recorre objetos y listas; las claves sensibles reciben [REDACTED].
	return redact(_input);
}
```

### Evidencia

La prueba pública de Semana 4 terminó con `Test Suites: 1 passed, 1 total`. La salida completa está en [docs/evidence/telemetria-sanitizada.txt](evidence/telemetria-sanitizada.txt).

## Revision de categorias solicitadas

| Categoria | Resultado de la revision | Evidencia |
|---|---|---|
| A. Credenciales o secretos en el codigo | No se encontraron credenciales reales. Los tokens `course-valid-token`, `course-refresh-0` y sus variantes son fixtures publicos del contrato didactico. | `course-backend/server.mjs`, `docs/CAMPUSOPS_API.md` y `course-backend/README.md` los identifican como valores de prueba. No aparecen claves privadas ni contrasenas reales. |
| B. Informacion sensible en consola | No se encontraron `console.log`, `console.warn` ni `console.error` en el codigo revisado. | La busqueda sobre el repositorio excluyendo dependencias y artefactos no devolvio logs de payloads, usuarios, tokens o respuestas. |
| C. Datos personales almacenados innecesariamente | No se encontraron nombres, correos, contrasenas ni perfiles reales almacenados. Las sesiones e incidencias se mantienen en adaptadores en memoria y los datos son ficticios. | `src/infrastructure/InMemorySessionAdapter.ts` y `src/infrastructure/InMemoryIncidentRepository.ts`. No se usa `AsyncStorage`, `SecureStore` ni `localStorage`. |
| D. Informacion sensible en mensajes de error | No se encontro un mensaje que incluya contrasenas, tokens, URLs de bases de datos o datos personales. | `src/api/courseBackend.ts` solo expone el codigo HTTP en el error de salud; `course-backend/server.mjs` devuelve codigos genericos como `invalid_request` y `unauthorized`. |
| E. Archivos sensibles en el repositorio | No existe un archivo `.env` versionado. `.env` esta excluido y solo se conserva `.env.example` con una URL local sin credenciales. | `.gitignore`, `.env.example`, `git ls-files` y `git status --short --branch`. |

### SA-01 - Transporte HTTP y endpoint configurable sin garantia de TLS

**Severidad:** Media en despliegue real; baja en el simulador local.  
**Estado:** Riesgo conocido, pendiente de tratamiento para produccion.

**Evidencia:**

- `src/api/courseBackend.ts` define `http://127.0.0.1:4310` como URL predeterminada.
- `docs/CAMPUSOPS_API.md` permite configurar una IP de desarrollo autorizada y advierte que el simulador no debe exponerse a Internet.
- `course-backend/server.mjs` inicia el servidor con HTTP y anuncia su direccion con `http://`.

**Impacto:** Si esta configuracion se reutiliza fuera de una red de laboratorio, un token o datos de incidencias enviados por una futura ruta autenticada podrian viajar sin cifrado y ser interceptados.

**Recomendacion:** Mantener HTTP exclusivamente para pruebas locales. En cualquier despliegue real, exigir una URL `https://`, terminar TLS delante del servicio y rechazar configuraciones no seguras fuera de desarrollo. No incluir credenciales de produccion en variables publicas de Expo.

### SA-02 - CORS permitia cualquier origen en el backend didactico

**Severidad:** Media en despliegue real; baja en el simulador local.  
**Estado:** Corregido en esta rama para el backend didactico.

**Evidencia:**

- `course-backend/server.mjs` ahora responde con el valor de `COURSE_BACKEND_CORS_ORIGIN` y no con `*`.
- `.env.example` define el origen local permitido sin credenciales.

**Impacto:** Si el backend se expone a Internet o se conecta a autenticacion real, cualquier sitio podria intentar realizar solicitudes desde el navegador del usuario. Esto amplía la superficie para abuso y no es una politica adecuada para datos privados.

**Recomendacion:** Mantener una lista de origenes permitidos por entorno y conservar la autorizacion en el servidor. El backend didactico debe seguir aislado de Internet como indica su documentacion.

### SA-03 - Sanitizacion de telemetria de Semana 4

**Severidad:** Alta si se agregan logs o telemetria que reciban payloads sin sanitizar; actualmente no se observo un flujo de logs activo que exponga datos.

**Estado:** Corregido en esta rama.

**Evidencia:**

- `src/course-evaluation/index.ts` implementa `redactForTelemetry` con recorrido recursivo.
- `docs/CAMPUSOPS_API.md` exige redactar tokens, identificadores de usuario, ubicaciones, fotos, evidencias, comentarios internos y otros campos sensibles.
- `docs/threat-model.md` identifica la frontera F-05: nunca registrar tokens, ubicaciones, fotos ni datos personales.

**Impacto previo:** Cualquier llamada a esa funcion fallaba en ejecucion. Si un desarrollador registraba el objeto original como alternativa, podia enviar a logs datos privados, tokens o ubicaciones.

**Recomendacion:** Mantener las pruebas para objetos anidados, listas, claves con guion o guion bajo y campos tecnicos permitidos. Los logs deben recibir solo la salida redactada.

## Controles confirmados

- El proyecto usa datos sinteticos y el contrato identifica explicitamente los tokens de prueba como no secretos.
- `InMemorySessionAdapter` no persiste sesiones ni tokens en almacenamiento permanente.
- El backend limita el cuerpo de las solicitudes a 131072 bytes.
- Las rutas protegidas del contrato validan un token de prueba y el dominio CampusOps contempla autorizacion por actor, rol y asignacion.
- `SECURITY.md` documenta que la auditoria de dependencias actual reporta cero vulnerabilidades conocidas en el lockfile y exige volver a auditar antes de liberar.
- No se encontraron credenciales reales, claves privadas ni datos personales reales en los archivos revisados.

## Priorizacion

1. Mantener y ampliar las pruebas de `redactForTelemetry` antes de incorporar nueva telemetria o logging de payloads.
2. Mantener el backend didactico aislado y local durante las pruebas.
3. Antes de cualquier despliegue real, exigir TLS y restringir CORS a origenes conocidos.
4. Repetir `npm audit --omit=dev --audit-level=critical` despues de cambios de dependencias.

## Evidencia de las correcciones

### Correccion 1: sanitizacion de telemetria

Comando ejecutado:

```text
npm test -- --ci --runInBand course-tests/public/week-04.test.ts
```

Resultado:

```text
PASS  course-tests/public/week-04.test.ts
Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
```

La prueba confirma que `redactForTelemetry` reemplaza los campos sensibles anidados y conserva `incidentId` y otros datos tecnicos permitidos.

Archivo de evidencia: [telemetria-sanitizada.txt](evidence/telemetria-sanitizada.txt)

### Correccion 2: CORS restringido

Se inicio el backend con `COURSE_BACKEND_CORS_ORIGIN=http://localhost:3000` y se consulto `/health` enviando ese origen.

Resultado:

```text
status=200
access-control-allow-origin=http://localhost:3000
```

El encabezado coincide con el origen configurado y ya no es `*`.

Archivo de evidencia: [cors-restringido.txt](evidence/cors-restringido.txt)

### Comprobacion de archivos sensibles

Comando ejecutado:

```text
git status --short --branch
git ls-files --error-unmatch .env
```

Resultado relevante:

```text
## week4/security-audit-marco
 M .env.example
 M course-backend/server.mjs
 M src/course-evaluation/index.ts
?? docs/security-audit.md
.env no esta versionado
```

No existe un `.env` agregado al repositorio; `.env.example` contiene solo configuracion local sin credenciales.

Archivo de evidencia: [env-no-versionado.txt](evidence/env-no-versionado.txt)

## Limitaciones

Esta auditoria es estatica y se realizo sobre el simulador y los adaptadores presentes en la rama de Semana 4. No demuestra la seguridad de un despliegue productivo, del almacenamiento seguro nativo, de permisos de camara/ubicacion ni de un proveedor de identidad real. Esos componentes no estan implementados en este proyecto y deben auditarse cuando se incorporen.
