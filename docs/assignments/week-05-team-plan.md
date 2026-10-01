# Semana 5 — plan secuencial de aportaciones del equipo

El trabajo se integra en tres etapas, en este orden. Cada integrante entrega un commit funcional y deja una revisión/prueba de traspaso antes de que empiece la siguiente etapa. No se rellenan reportes con resultados supuestos: cada integrante registra su propia aportación real en `evidence/week-05/individual.json` al cierre.

| Orden | Responsable | Aportación técnica | Traspaso verificable |
|---:|---|---|---|
| 1 | Integrante 1 — contrato y DTO | Definir en `docs/api-contract.md` solicitudes, respuestas, validación y errores para lista, detalle y creación. Implementar `parseRemoteResource` en la lógica compartida y separar con claridad el DTO del modelo de la app; cubrir versión válida, `payload: null`, campos futuros y formatos inválidos. | Commit de contrato/validador; ejecutar typecheck y la prueba pública `course-tests/public/week-05.test.ts`. Dejar anotados el SHA y los casos comprobados para el Integrante 2. |
| 2 | Integrante 2 — cliente e integración | A partir del contrato integrado, implementar la capa cliente/backend para consultar lista, detalle y crear incidencias; conectar la aplicación sin HTTP directo desde la UI. Convertir DTO a modelo de dominio y exponer errores distinguibles para respuesta inválida, timeout y error HTTP, sin filtrar datos sensibles en logs. | Revisar el commit del Integrante 1, integrar su aporte y entregar su propio commit. Ejecutar pruebas de éxito, payload nulo y errores principales; registrar archivos, comando y resultado para el Integrante 3. |
| 3 | Integrante 3 — fallas, evidencia y cierre | Completar y ejecutar las pruebas de contrato y la matriz de fallas (malformado, timeout y 500); documentar los resultados observados en `reports/week-05/contract-tests.json` y `reports/week-05/failure-matrix.json`. Preparar la decisión y alternativas en `evidence/week-05/engineering.json`, reunir tres señales individuales auténticas y coordinar la verificación/tag final. | Revisar los dos commits anteriores, ejecutar `make feedback`, `make verify-week-05` y `make public-test-week-05`; resolver fallos antes de cerrar. Tras completar evidencias y commit exclusivo de reportes/evidencias, crear `week-05-final` y ejecutar `make evidence-week-05`. |

## Reglas de integración

1. El Integrante 1 termina y publica su cambio antes de que el Integrante 2 empiece la integración; el Integrante 2 termina antes del trabajo final del Integrante 3.
2. El siguiente integrante revisa el commit recibido y registra esa revisión en su evidencia individual. Los tres vuelven a revisar el resultado integrado antes del tag.
3. Si un traspaso no pasa su comprobación, se corrige esa etapa antes de continuar. No se construyen capas posteriores sobre contratos o comportamiento que aún cambian.
4. Cada persona usa su identidad Git real. Registra al menos un SHA propio, un archivo técnico y una prueba o revisión real; no compartan una identidad ni inventen comandos o resultados.
5. Las pruebas y reportes conservan los casos de falla observados. El número de commits o archivos no sustituye la aportación individual.

## Requisitos cubiertos

- **AC-01:** reproducción del proyecto, verificación y versión final identificada por SHA/tag.
- **AC-02:** consulta y creación por el cliente, errores distinguibles, UI desacoplada de HTTP y logs sanitizados.
- **AC-03:** rechazo de respuestas corruptas, excepciones controladas y pruebas sin servicios públicos reales.
- **AC-04:** límite DTO/dominio/errores justificado con alternativas, costo/beneficio y comprobaciones.
- **AC-05:** una aportación técnica verificable y explicable por cada integrante.