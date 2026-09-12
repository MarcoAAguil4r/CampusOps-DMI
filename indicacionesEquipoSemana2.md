## 1. Reglas Generales del Repositorio

*   **No copiar la carpeta `__MACOSX` ni archivos `.DS_Store` o `._*`**. Son metadatos de sistema sin utilidad.
*   **Combinar, no sobrescribir**. El contenido de la carpeta del maestro (`week-02-arquitectura-justificable`) debe volcarse directamente en la raíz del proyecto. No creen una subcarpeta nueva ni borren el trabajo de la Semana 1 (`EVIDENCE_CONTRACT.md`, carpetas `week-01`, etc.).
*   **Limpieza de la raíz**. Actualmente hay archivos no rastreados (como `failure.json`); déjenlos intactos o sepárenlos de los commits de esta semana.

**Archivos del maestro que debemos mover a la raíz:**
*   `INSTALL.md`
*   `CAMPUSOPS.md` y `CAMPUSOPS_API.md`
*   `week-02.test.ts`
*   `.github/workflows/week-02-arquitectura-justificable-feedback.yml`
*   Todo el contenido de `docs/assignments/` (`week-02.md`, `week-02-rubric.md`, `week-02-repository.md`).

---

## 2. Regla de Arquitectura (Obligatoria)

El código de la aplicación debe respetar estrictamente esta estructura de dependencias:
`UI -> application -> domain <- infrastructure`

**Importante:** La capa de UI no debe importar directamente ningún archivo de infraestructura.

---

## 3. Secuencia de Trabajo

Las tareas están encadenadas. Nadie puede empezar su bloque hasta que el anterior entregue su commit y su SHA correspondiente.

### Integrante 1: Base Arquitectónica
*Bloquea al Integrante 2. Al terminar, pasa tu SHA y la lista de archivos modificados.*

*   Combina los archivos válidos del paquete del maestro hacia la raíz y resuelve cualquier conflicto con la semana 1.
*   Crea `docs/adr/ADR-001-architecture.md` (compara al menos dos alternativas y define los cuatro límites de la arquitectura).
*   Crea el diagrama en `docs/architecture.mmd` asegurando que no haya flechas de UI hacia infraestructura.
*   Define los contratos y tipos iniciales en código (incidencias, sesión, persistencia, proveedores).
*   **Validaciones antes de tu commit:**
    *   `make verify-week-02`
    *   `npm run typecheck`
    *   `npm run lint`

### Integrante 2: Esqueleto Ejecutable
*Comienza solo con el commit del Integrante 1. Al terminar, pasa tu SHA al Integrante 3.*

*   Implementa la estructura de carpetas basada en el ADR.
*   Desarrolla el dominio de incidencias (reglas básicas) y las interfaces (repositorio, sesión, proveedor de ubicación).
*   Crea adaptadores ficticios (en memoria) para hacer pruebas; no uses credenciales ni datos reales.
*   Implementa la vista de lista y el detalle de incidencias en `App.tsx` (o en componentes separados).
*   Agrega pruebas para el flujo principal y verifica la sustitución de dependencias.
*   Revisa manualmente que no haya imports directos de infraestructura en la UI.
*   **Validaciones antes de tu commit:**
    *   `npm test -- --runInBand`
    *   `npm run typecheck`
    *   `make public-test-week-02`

### Integrante 3: Auditoría, Evidencia y Entrega
*Comienza solo con el commit del Integrante 2.*

*   Compara el diagrama `.mmd` con los imports reales del código. Detecta y corrige al menos una contradicción arquitectónica (real o controlada).
*   Genera y completa `reports/week-02/dependencies.json`.
*   Completa los archivos de evidencia (`evidence/week-02/engineering.json` y `evidence/week-02/individual.json`).
*   Verifica que el JSON individual tenga los datos exactos de los 3 integrantes: un SHA propio, un archivo técnico, una prueba o revisión, y la explicación de su aporte. Usa salidas de comandos reales, no suposiciones.
*   **Validaciones finales:**
    *   `make feedback`
    *   `make verify-week-02`
    *   `make public-test-week-02`
    *   `make evidence-week-02`
*   Revisa `git status --short`. Si todo está limpio y en orden, crea el tag de entrega:
    ```bash
    git tag -a week-02-final -m "DMI week 02 final"
    git rev-list -n 1 week-02-final
    ```