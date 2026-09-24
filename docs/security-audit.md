# Auditoría de seguridad — Semana 4

## Hallazgos

| # | Hallazgo | Riesgo | Solución aplicada | Evidencia |
|---|---|---|---|---|
| 1 | Clave de API ficticia escrita directamente en `src/api/courseBackend.ts` | Cualquier persona con acceso al repositorio podría ver la clave; si fuera una clave real, quedaría expuesta permanentemente en el historial de Git | Se movió a una variable de entorno (`EXPO_PUBLIC_DEMO_API_KEY`) leída con `process.env`, y se agregó su nombre (sin valor) a `.env.example` | docs/evidence/api-key-corregida.png |
| 2 | Se imprimía el arreglo completo de incidencias en consola al cargarlas en `src/ui/IncidentApp.tsx` | Un log con el objeto completo puede filtrar datos como ubicaciones exactas o descripciones internas hacia herramientas de logging externas o consolas compartidas | Se reemplazó el log del objeto completo por un conteo (`{ count: result.length }`), sin exponer el contenido de cada incidencia | docs/evidence/console-log-sanitizado.png |
| 3 | Se registraba en consola el objeto de sesión completo (`campusOps`) al iniciar la pantalla principal en `src/ui/IncidentApp.tsx` | Aunque en este proyecto la sesión solo contiene `userId` y `role`, imprimir objetos de sesión completos es un mal hábito que en un proyecto real expondría tokens u otros datos de autenticación en los logs | Se eliminó por completo el `console.log` de la sesión; no hay ninguna razón funcional para imprimirla | docs/evidence/sesion-sin-log.png |

## Hallazgo 1 — Clave de API escrita directamente en el código

### Problema encontrado
En `src/api/courseBackend.ts` se declaraba una constante `DEMO_API_KEY` con un valor de texto plano directamente en el código fuente.

### Riesgo
Cualquier persona con acceso al repositorio (incluyendo el historial de Git) puede ver el valor de la clave. Si en un entorno real esa clave fuera válida, quedaría comprometida de forma permanente, ya que eliminarla del código no la elimina del historial.

### Solución
Se sustituyó el valor literal por una lectura desde variable de entorno mediante `process.env.EXPO_PUBLIC_DEMO_API_KEY`, y se documentó el nombre de la variable (sin valor) en `.env.example` para que cualquier persona que clone el proyecto sepa qué variable debe definir.

### Antes
```ts
const DEMO_API_KEY = 'demo_key_123456'; // dato ficticio, NO es una credencial real
```

### Después
```ts
const DEMO_API_KEY = process.env.EXPO_PUBLIC_DEMO_API_KEY ?? '';
```

### Evidencia
Ver `docs/evidence/api-key-corregida.png` — captura de `Select-String` confirmando el cambio en el archivo real.

## Hallazgo 2 — Información completa impresa en consola

### Problema encontrado
En `src/ui/IncidentApp.tsx`, al cargar la lista de incidencias, se imprimía el arreglo completo (`result`) en consola con `console.log`.

### Riesgo
Imprimir objetos completos en consola puede exponer información que no debería aparecer en logs (ubicaciones, descripciones detalladas, identificadores internos), especialmente si esos logs terminan en herramientas de monitoreo compartidas o consolas de producción accesibles por terceros.

### Solución
Se reemplazó el log del objeto completo por un resumen mínimo, mostrando solamente la cantidad de incidencias cargadas, sin exponer su contenido.

### Antes
```tsx
console.log('Incidencias cargadas:', result);
```

### Después
```tsx
console.log('Incidencias cargadas:', { count: result.length });
```

### Evidencia
Ver `docs/evidence/console-log-sanitizado.png`.

## Hallazgo 3 — Objeto de sesión impreso en consola

### Problema encontrado
En `src/ui/IncidentApp.tsx`, al montar la pantalla principal, se imprimía en consola el objeto `campusOps` (que en una versión con sesión real contendría los datos del usuario autenticado).

### Riesgo
Aunque en este proyecto la sesión (`UserSession`) solo contiene `userId` y `role`, imprimir objetos de sesión completos en consola es una mala práctica que en un sistema con autenticación real expondría tokens, identificadores sensibles u otros datos del usuario en los logs de la aplicación.

### Solución
Se eliminó por completo la línea de `console.log` que imprimía la sesión; no existe ninguna necesidad funcional de registrar ese objeto en consola.

### Antes
```tsx
console.log('Sesion actual del usuario:', campusOps);
campusOps.checkBackendHealth()
```

### Después
```tsx
campusOps.checkBackendHealth()
```

### Evidencia
Ver `docs/evidence/sesion-sin-log.png`.