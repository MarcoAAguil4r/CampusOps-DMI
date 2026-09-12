# Semana 2 — Preparar el repositorio y entregar

Continúen en el mismo repositorio público y sobre la rama principal registrada.
Combinen el paquete de semana 2 con el proyecto existente; no reinicien el
starter ni borren el historial. Mantengan React Native, Expo, TypeScript y las
versiones fijadas.

Los reportes requieren `schemaVersion: 1`, `week: 2`, `commitSha`,
`generatedAt` ISO 8601 y `checks`. Cada check debe incluir `id`, `status`,
`scenarioType`, `command` y `evidence`, incluyendo al menos un caso límite o
de falla.

`evidence/week-02/engineering.json` debe incluir una decisión sustantiva, al
menos dos alternativas, trade-off, `requirementIds` entre AC-01 y AC-05 y
verificaciones con comando, resultado y evidencia.

`evidence/week-02/individual.json` debe tener `teamId` y exactamente tres
integrantes. Cada registro necesita identidad, SHA propio, archivo técnico,
prueba o revisión, predicción, comando, resultado observado y explicación.

Orden de comprobación:

```bash
make feedback
make verify-week-02
make public-test-week-02
```

Después guarden la evidencia, creen el commit final, creen el tag y validen:

```bash
git tag -a week-02-final -m "DMI week 02 final"
make evidence-week-02
git rev-list -n 1 week-02-final
```

Entreguen la URL del repositorio, el tag y el SHA completo. No suban
credenciales, datos personales reales ni respuestas del quiz.