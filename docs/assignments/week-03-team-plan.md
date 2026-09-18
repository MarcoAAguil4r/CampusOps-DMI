# Semana 3 - reparto tecnico del equipo

El reparto conserva una responsabilidad comun: cada integrante debe revisar
los cambios integrados, ejecutar una comprobacion y registrar su evidencia con
su identidad Git real. El integrante 1 tiene la coordinacion tecnica y una
carga ligeramente mayor.

| Integrante | Responsabilidades | Entregables verificables | Carga |
|---|---|---|---:|
| Integrante 1 - coordinacion CI y seguridad | Integrar el workflow en la raiz, revisar permisos minimos, ejecutar `make setup`, `make feedback`, `make verify-week-03` y el escaneo de secretos; consolidar el reporte de seguridad y coordinar el cierre | `.github/workflows/week-03-ci-amenazas-feedback.yml`, `reports/week-03/security.json`, evidencia de comandos y revision final | 40% |
| Integrante 2 - modelo de amenazas | Mantener activos, fronteras, amenazas priorizadas, controles, verificacion y riesgo residual; contrastar el modelo con `docs/CAMPUSOPS.md` y `docs/CAMPUSOPS_API.md` | `docs/threat-model.md`, revision de amenazas P1-P4 y prueba asociada | 30% |
| Integrante 3 - pruebas y evidencias | Ejecutar la prueba publica, documentar un fallo obligatorio y su diagnostico corregido; preparar la evidencia de decision y reunir las señales individuales sin inventar resultados | `course-tests/public/week-03.test.ts` revisada sin alterar controles, `evidence/week-03/engineering.json`, borrador de `individual.json` | 30% |

## Secuencia de integracion

1. Integrante 2 actualiza el modelo y enlaza cada amenaza con un control y una
   prueba concreta.
2. Integrante 1 ejecuta el flujo completo sobre la rama integrada y conserva
   los resultados reales, incluidos los fallos declarados.
3. Integrante 3 revisa la evidencia, completa los registros individuales con
   tres `studentId` y SHAs completos reales, y verifica que no haya secretos.
4. Los tres revisan `git status`, acuerdan el SHA evaluado y solo despues
   crean `week-03-final` y ejecutan `make evidence-week-03`.

## Regla de evidencia

No se deben reutilizar SHAs, nombres, comandos o resultados como si fueran
aportaciones nuevas. Cada miembro agrega su propio commit, un archivo tecnico
real y una prueba o revision observable antes de completar
`evidence/week-03/individual.json`.