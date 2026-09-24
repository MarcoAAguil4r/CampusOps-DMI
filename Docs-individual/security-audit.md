# Auditoría de seguridad y privacidad — Semana 4

## Hallazgos

| # | Hallazgo | Riesgo | Solución aplicada | Evidencia |
| - | -------- | ------ | ----------------- | --------- |
| 1 | Exclusiones incompletas de archivos de entorno | Un archivo local con credenciales o destinos privados podría añadirse accidentalmente al repositorio. | Se añadieron patrones para `.env.local`, `.env.development` y `.env*.local`, preservando `!.env.example`. | [h1gitignore-corregido.png] |
| 2 | URL de backend integrada en el cliente | Un destino de servicio queda ligado al código distribuido en lugar de configurarse por entorno. | La URL se obtiene ahora de `EXPO_PUBLIC_COURSE_BACKEND_URL`; `.env.example` la documenta vacía. | [h3coursebackend-corregido.png] |
| 3 | Destino de backend sin validación | Una configuración con credenciales, ruta inesperada o HTTP fuera de desarrollo podría dirigir solicitudes a un destino no autorizado. | `ApiConfig` valida origen absoluto, sin credenciales, sin ruta, y exige HTTPS salvo loopback local. | [h2apiconfig-validacion.png] |

---

## Detalle de Hallazgos y Correcciones

### Hallazgo 1 — Exclusiones incompletas de archivos de entorno

**Problema encontrado:** `.gitignore` solo excluía `.env`; las variantes locales habituales no estaban cubiertas.
**Riesgo:** Un archivo de configuración local puede contener valores privados y terminar versionado por error.
**Solución:** Se añadieron las exclusiones necesarias y se mantuvo la excepción de la plantilla pública.
**Antes:**
```text
.env
```
**Después:**
```text
.env
.env.local
.env.development
.env*.local
!.env.example
```

### Hallazgo 2 — URL de backend integrada en el cliente

**Problema encontrado:** `src/api/courseBackend.ts` declaraba una URL de backend como valor predeterminado en código fuente.
**Riesgo:** El destino no se puede separar claramente por entorno y una compilación puede apuntar al servicio equivocado.
**Solución:** Se movió la obtención de la URL a `getCourseBackendBaseUrl()` y se documentó una variable vacía en `.env.example`.
**Antes:**
```typescript
const DEFAULT_URL = 'http://127.0.0.1:4310';

export async function getBackendHealth(baseUrl = process.env.EXPO_PUBLIC_COURSE_BACKEND_URL ?? DEFAULT_URL) {
  const response = await fetch(`${baseUrl}/health`);
}
```
**Después:**
```typescript
export async function getBackendHealth(baseUrl?: string): Promise<BackendHealth> {
  const response = await fetch(`${getCourseBackendBaseUrl(baseUrl)}/health`);
}
```

### Hallazgo 3 — Destino de backend sin validación

**Problema encontrado:** La URL recibida por `getBackendHealth` se concatenaba directamente con `/health` sin comprobar protocolo, credenciales ni componentes adicionales.
**Riesgo:** Una configuración errónea o manipulada podría enviar la solicitud a un origen no seguro o incluir credenciales dentro de la URL.
**Solución:** `src/infrastructure/ApiConfig.ts` acepta únicamente un origen absoluto, elimina rutas y parámetros, rechaza credenciales y exige HTTPS fuera de `localhost` y direcciones loopback.
**Antes:**
```typescript
const response = await fetch(`${baseUrl}/health`);
```
**Después:**
```typescript
const response = await fetch(`${getCourseBackendBaseUrl(baseUrl)}/health`);
```

## Verificación pendiente


