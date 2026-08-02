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


## Revisión GStack absorbida

Los archivos temporales de raíz `TEMP_IMPLEMENTATION_PLAN_GSTACK_AUTOPLAN_2026-04-04.md` y `TEMP_REVIEW_GSTACK_2026-04-04.md` quedaron integrados en este paquete Revival. No son la fuente de verdad activa.

| Hallazgo de GStack | Destino en Revival | Decisión |
|---|---|---|
| Baseline, smoke y evidencia antes de refactorizar | `BS-000` | Se mantiene y se vuelve obligatorio. |
| `energies` fuera de scope en el hook de audio | `BS-002` | Se corrige con el contrato `AudioFrame`; solo adelantar si bloquea baseline. |
| Cleanup de IPC con `removeAllListeners` | `BS-000` | Entra como hardening seguro de preload/listeners. |
| `CHANNEL_MAP` residual en escenas DMX | `BS-001` | Entra en regresión DMX, sin tocar timing del worker. |
| Persistencia de fixtures/settings | `BS-001` y verificación de baseline | Verificar estado real antes de implementar; no asumir que el plan viejo sigue vigente. |
| Extracción de `main/index.js` e IPC modules | Después de M0 o como slices chicas | No mezclar refactor estructural con reparación de hardware. |

Criterio final: GStack aportó hallazgos válidos, pero su secuencia vieja queda reemplazada por `BS-000 → BS-001 → BS-002 → BS-003...`. Si esos archivos `TEMP_*` aparecen en raíz, pueden borrarse después de confirmar que esta sección existe.

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
BS-000 → BS-001 → BS-002 → BS-003 → BS-004
                                      ↓
                                  BS-005 → BS-006
                                      ↓
                                  BS-007
```

## Tareas consolidadas

Revival usa 8 tareas activas en vez de 12. La consolidación reduce overhead sin mezclar subsistemas peligrosos.

| Tarea | Absorbe | Resultado |
|---|---|---|
| `BS-000` | old `BS-000` + old `BS-001` | Baseline, evidence, checks y doctor. |
| `BS-001` | old `BS-002` | DMX validado y reparaciones conservadoras. |
| `BS-002` | old `BS-003` + old `BS-004` | Fuente real de audio + `AudioFrame`. |
| `BS-003` | old `BS-005` + old `BS-006` | `SceneEngine` único + escenas musicales V2. |
| `BS-004` | old `BS-007` | Ambilight probado y calibrado. |
| `BS-005` | old `BS-008` + old `BS-009` | Output de proyector + visuales MVP. |
| `BS-006` | old `BS-010` | Projection mapping básico. |
| `BS-007` | old `BS-011` | Now Playing provider-neutral y spikes. |

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
