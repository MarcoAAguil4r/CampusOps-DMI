# Semana 9 — requerimientos, ramas y responsabilidades

Actividad: integración resiliente con un servicio de mapas o geocodificación.
El trabajo continúa en el mismo repositorio y equipo. La actividad vale 8
puntos; el quiz individual se entrega por separado.

## Ramas individuales

Cada integrante crea su rama desde la versión integrada de la rama principal,
antes de modificar archivos. No trabajen directamente sobre la rama principal
ni compartan una rama o identidad Git.

| Integrante | Rama | Responsabilidad principal |
|---|---|---|
| Marco | `week9-marco` | Adaptador de ubicación, caché y selección segura de ubicación |
| Dulce | `week9-dulce` | Política de reintentos y repetición idempotente de operaciones |
| David | `week9-david` | Flujo de interfaz, pruebas de integración, reportes y coordinación del cierre |

Si la rama principal del repositorio no se llama `main`, sustituyan ese nombre
en los comandos:

```bash
git switch main
git pull --ff-only origin main
git switch -c week9-marco
```

Para las otras ramas, cada integrante usa su propio nombre: `week9-dulce` o
`week9-david`. Publiquen la rama y abran un pull request; no integren cambios
sin revisar las pruebas y resolver conflictos.

## Requerimientos por integrante

### Marco — adaptador, caché y ubicación válida o manual

- Implementar la integración de mapas o geocodificación detrás de un puerto y
  un adaptador de infraestructura. Mantener la interfaz desacoplada del
  proveedor y no hacer solicitudes HTTP directamente desde la UI.
- Implementar `selectIncidentLocation` en `src/course-evaluation/index.ts`:
  aceptar sólo respuestas con etiqueta no vacía y coordenadas numéricas finitas
  dentro de rango; ante respuesta nula, incompleta, inválida o error representado
  como dato, devolver la etiqueta manual sin inventar coordenadas.
- Implementar y probar caché para que solicitudes repetidas aprovechen datos
  válidos sin impedir la actualización cuando corresponda. Manejar timeout,
  429 y desconexión como resultados no disponibles, no como coordenadas válidas.
- Probar éxito, datos incompletos, coordenadas fuera de rango y datos con tipos
  incorrectos. Conservar evidencia de una ejecución real del adaptador con
  datos ficticios y documentar proveedor, restricciones y caché en
  `docs/resilience-policy.md`.
- Entregar un commit y un pull request con las pruebas del adaptador. Dejar
  claros el SHA, los archivos y los resultados observados para que Dulce y
  David revisen el traspaso.

### Dulce — reintentos acotados e idempotencia

- Implementar `planRetry` en `src/course-evaluation/index.ts`: respetar un
  `Retry-After` válido, aplicar esperas finitas y límites acotados, y no
  reintentar desde el intento 4.
- Permitir reintentar un `POST` sólo si tiene una clave de idempotencia estable.
  Cuando se repita una operación tras timeout o respuesta perdida, conservar
  exactamente la misma clave y el mismo contenido; no generar una operación
  nueva por intento.
- Integrar el plan con el cliente o flujo que ejecuta la solicitud y hacer
  distinguibles los estados de timeout, 429 y otros errores HTTP. No ocultar un
  fallo final ni retirar una operación pendiente como si el servidor la hubiera
  confirmado.
- Probar espera indicada por `Retry-After`, límite de intentos, demora finita,
  `POST` sin clave y repetición de una escritura con respuesta perdida después
  de que el servidor la guardó. Verificar que no se dupliquen eventos ni
  efectos.
- Entregar un commit y pull request con pruebas focalizadas y el resultado real
  del escenario de falla. Revisar también el cambio de Marco, especialmente
  que ambos cambios en `src/course-evaluation/index.ts` queden integrados.

### David — interfaz, integración y cierre verificable

- Integrar en `src/ui/IncidentApp.tsx` el flujo visible de ubicación manual:
  permitir escribir edificio, zona o referencia y continuar cuando el
  proveedor esté lento, no disponible o rechace los datos. Mostrar estados
  comprensibles y no presentar una ubicación o coordenadas como obtenidas si no
  lo fueron.
- Conectar la UI al puerto/adaptador de ubicación integrado, sin duplicar la
  lógica de caché, validación o reintentos. Añadir pruebas de interfaz o de
  integración para la alternativa manual y los estados de error.
- Coordinar la matriz de verificación del equipo: servicio disponible,
  caché, timeout, 429/`Retry-After`, datos inválidos, ubicación manual,
  desconexión y respuesta perdida tras guardar. Ejecutar las pruebas públicas
  de semana 9 y confirmar que las semanas anteriores siguen pasando.
- Consolidar `reports/week-09/fault-injection.json`,
  `reports/week-09/retry-metrics.json`,
  `evidence/week-09/engineering.json` y
  `evidence/week-09/individual.json` con comandos y resultados reales. Cada
  integrante entrega sus propios datos de contribución; David coordina el
  archivo común, pero no atribuye a sí mismo cambios ajenos.
- Revisar los pull requests de Marco y Dulce, ejecutar `make feedback`,
  `make verify-week-09` y `make public-test-week-09`, y coordinar el commit
  exclusivo de `reports/` y `evidence/`, el tag `week-09-final` y
  `make evidence-week-09`.

## Traspasos e integración

1. Los tres parten de la misma versión integrada de la semana anterior y
   trabajan en sus ramas individuales. Marco publica primero el puerto,
   adaptador y selección de ubicación.
2. Dulce integra la rama actualizada y publica después la política de
   reintentos e idempotencia. Como `planRetry` y `selectIncidentLocation`
   comparten `src/course-evaluation/index.ts`, coordinen el cambio de ese archivo
   mediante pull requests secuenciales; no sobrescriban el trabajo integrado.
3. David integra los dos aportes y conecta la interfaz. Cada integrante revisa
   al menos un cambio de otra persona y conserva constancia de la revisión.
4. Cada persona debe tener una aportación técnica verificable, un commit propio
   y una prueba o revisión que pueda explicar. La coordinación y consolidación
   de reportes no sustituyen esa aportación.
5. Si un traspaso falla, corrijan esa etapa antes de construir encima. No
   modifiquen pruebas o workflows para ocultar fallos ni registren resultados
   esperados como si fueran observados.

## Criterios y entrega compartida

- **AC-01 (2.5):** instalación y reproducción de la versión identificada por su
  SHA.
- **AC-02 (2.0):** caché y ubicación manual; `Retry-After`, límites de reintento
  y clave estable para operaciones con efecto.
- **AC-03 (1.5):** evidencia de que no hay bucles, solicitudes descontroladas ni
  efectos duplicados después de perder una respuesta.
- **AC-04 (1.5):** decisión sobre cuándo reintentar, continuar con alternativa
  o informar fallo, conectada con pruebas y resultados.
- **AC-05 (0.5):** aportación individual verificable y explicable de cada
  integrante.

Al terminar, comprueben que los reportes y evidencias reflejan la misma versión
de código. Sigan `docs/assignments/week-09-repository.md` para los comandos,
campos requeridos, commit final, etiqueta y entrega. Cada integrante responde
además el quiz semanal 9 por separado.
