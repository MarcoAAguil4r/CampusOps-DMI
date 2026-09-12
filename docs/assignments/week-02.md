# Semana 2 — Organizar el código de CampusOps y justificar la arquitectura

**Actividad:** Arquitectura móvil justificable. **Valor:** 8 puntos.
**Equipo:** 3 integrantes.

## Objetivo

CampusOps tendrá pantallas, reglas de incidencias, sesión, almacenamiento y
servicios de ubicación. Esta semana se separan esas responsabilidades para
probarlas y cambiar un proveedor sin rehacer el proyecto.

## Trabajo requerido

1. Comparar al menos dos alternativas de arquitectura y justificar la elección
   por facilidad de prueba, complejidad y costo de cambiar proveedor.
2. Dibujar los límites `UI`, `application`, `domain` e `infrastructure`, con
   dependencias dirigidas. Incluir perfiles, incidencias, sesión,
   persistencia y proveedores. La UI no depende directamente de infraestructura.
3. Construir un esqueleto ejecutable con lista y detalle de incidencias y datos
   ficticios. Permitir sustituir componentes mediante interfaces.
4. Contrastar diagrama e imports reales, detectar una contradicción,
   corregirla y conservar evidencia de la comprobación.

## Entregables

- `docs/adr/ADR-001-architecture.md`
- `docs/architecture.mmd`
- `reports/week-02/dependencies.json`
- `evidence/week-02/engineering.json`
- `evidence/week-02/individual.json`

El código y las pruebas deben conservar las funciones acumuladas de semanas
anteriores. Ejecuten `make feedback`, `make verify-week-02` y
`make public-test-week-02`; después creen el tag `week-02-final` y ejecuten
`make evidence-week-02`.

No modifiquen pruebas para ocultar fallos ni usen secretos o datos reales.
Cada integrante debe responder el quiz semanal por separado.