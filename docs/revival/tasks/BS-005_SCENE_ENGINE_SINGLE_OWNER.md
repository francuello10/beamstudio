---
id: BS-005
title: "Scene Engine con un único propietario de la salida"
status: proposed
priority: P0
size: L
milestone: M0
depends_on: ["BS-002", "BS-004"]
owner:
branch:
pr:
---

# BS-005 — Scene Engine con un único propietario de la salida

## Objetivo

Eliminar la competencia entre loops y garantizar que una sola entidad compone cada frame dinámico.

## Por qué existe

Main y renderer contienen lógica de escenas. La reactividad musical no puede ser estable si dos productores escriben el mismo universo.

## Evidencia del estado actual

- Main ejecuta escenas a 44 Hz.
- DynamicScenesPage mantiene su propio `requestAnimationFrame`.
- Audio reactive agrega otro flujo.
- `dynamicRendererActive` no constituye por sí solo un contrato de ownership.

## Alcance

- Scene registry único.
- Reloj fijo para DMX.
- Prioridad de modos.
- Lifecycle start/stop.
- Salida semántica SceneFrame.
- Main como adaptador de hardware.

## Pasos sugeridos

- [ ] Inventariar todos los escritores DMX.
- [ ] Definir estados: IDLE, STATIC, PROGRAM, SCENE, AUDIO_SCENE, AMBILIGHT.
- [ ] Definir transición y exclusión mutua.
- [ ] Crear SceneEngine en renderer/service.
- [ ] Migrar una escena como prueba.
- [ ] Deshabilitar/remover loop equivalente del main tras migración.
- [ ] Enviar batches al output adapter.
- [ ] Agregar logs de ownership.
- [ ] Probar cambios rápidos.

## Criterios de aceptación

- [ ] Existe un único owner visible en diagnóstico.
- [ ] No hay dos timers de escena.
- [ ] Cambiar de modo detiene el anterior.
- [ ] Blackout tiene prioridad.
- [ ] Dimmer maestro se aplica al final.
- [ ] Preview y hardware reflejan el mismo frame.
- [ ] QA-307 y QA-308 pasan.

## Pruebas manuales

- [ ] Cambiar entre manual/scene/audio/ambilight.
- [ ] Cambiar 50 veces.
- [ ] Blackout en cada modo.
- [ ] Minimizar.
- [ ] Cerrar app durante escena.

## Archivos probables

- `src/main/index.js`
- `src/preload/index.js`
- `src/renderer/src/scenes/SceneEngine.js`
- `src/renderer/src/pages/DynamicScenesPageV2.jsx`
- `src/renderer/src/store/dmxStore.js`

## Fuera de alcance

- Proyector.
- Nuevas escenas.
- IA.

## Riesgos y notas

- Migración incremental para no romper hardware.
- No mover driver code al renderer.
- Usar batches, no IPC por canal.

## Evidencia de cierre

```md
- Commit:
- PR:
- OS:
- Hardware:
- QA ejecutadas:
- Logs:
- Capturas/video:
- Resultado:
```
