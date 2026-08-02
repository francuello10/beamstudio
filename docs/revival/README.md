# BeamStudio Revival — Índice de trabajo

**Repositorio:** `francuello10/beamstudio`  
**Baseline auditado:** `main@d349cf18894d`  
**Fecha del plan:** 2026-08-01  
**Objetivo inmediato:** comprobar, estabilizar y documentar todo lo que BeamStudio ya debería hacer antes de agregar nuevas funciones.

## Cómo usar este paquete

Copiar la carpeta `docs/revival/` dentro de la raíz del repositorio y abrir:

1. [`00_MASTER_PLAN.md`](./00_MASTER_PLAN.md): panorama completo, prioridades y roadmap.
2. [`01_CURRENT_STATE_AND_ARCHITECTURE.md`](./01_CURRENT_STATE_AND_ARCHITECTURE.md): inventario técnico y hallazgos del código.
3. [`02_QA_MATRIX.md`](./02_QA_MATRIX.md): pruebas manuales y evidencia requerida.
4. [`03_BRANCH_AND_DELIVERY_WORKFLOW.md`](./03_BRANCH_AND_DELIVERY_WORKFLOW.md): estrategia para trabajar una tarea por rama/PR.
5. [`tasks/`](./tasks/): tareas atómicas listas para ejecutar.

## Regla principal

> No agregar projection mapping, integración de proveedores musicales, IA local ni nuevos efectos hasta cerrar el milestone **M0 — Revival**.

La prioridad no es “modernizar por modernizar”. La prioridad es demostrar que cada subsistema existente:

- arranca;
- produce la salida correcta;
- no compite con otro loop;
- se detiene limpiamente;
- informa errores;
- se puede probar de forma repetible.

## Milestones

| Milestone | Resultado |
|---|---|
| **M0 — Revival** | Repo reproducible, DMX confiable, audio del sistema real, escenas musicales sólidas y Ambilight validado. |
| **M1 — Projector Visuals** | Salida fullscreen independiente en el HY300PRO con visuales reactivos. |
| **M2 — Projection Mapping** | Calibración, quad warp, máscaras y presets por superficie. |
| **M3 — Integraciones** | Metadata “Now Playing”, controles opcionales y experimentos posteriores. |

## Orden obligatorio sugerido

```text
BS-000 → BS-001 → BS-002 → BS-003 → BS-004 → BS-005 → BS-006 → BS-007
                                                                  ↓
                                         BS-008 → BS-009 → BS-010
                                                                  ↓
                                                              BS-011
```

## Estado de las tareas

Todos los documentos comienzan con `status: proposed`. Al iniciar una tarea:

```yaml
status: in-progress
owner: <nombre>
branch: <rama>
started_at: YYYY-MM-DD
```

Al terminar:

```yaml
status: done
pr: <número o URL>
completed_at: YYYY-MM-DD
evidence: <ruta a logs, capturas o video>
```
