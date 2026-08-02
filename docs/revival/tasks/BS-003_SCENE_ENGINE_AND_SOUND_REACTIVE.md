---
id: BS-003
title: "Scene Engine único y escenas musicales V2"
status: proposed
priority: P0
size: XL
milestone: M0
depends_on: ["BS-001", "BS-002"]
owner:
branch:
pr:
absorbs: ["old BS-005", "old BS-006"]
---

# BS-003 — Scene Engine único y escenas musicales V2

## Objetivo

Eliminar la competencia entre loops y entregar cuatro escenas musicales que reaccionen de forma clara, controlable y agradable usando `AudioFrame`.

## Por qué existe

Main, renderer y audio reactive pueden escribir el mismo universo DMX. Antes de sumar visuales o projector output, BeamStudio necesita un único compositor dinámico y escenas calibrables.

## Evidencia del estado actual

- Main ejecuta escenas a 44 Hz.
- DynamicScenesPage mantiene su propio `requestAnimationFrame`.
- Audio reactive agrega otro flujo.
- `dynamicRendererActive` no constituye por sí solo un contrato de ownership.
- Las escenas actuales mezclan género, colores y audio con heurísticas difíciles de probar.

## Alcance

- Scene registry único.
- Reloj fijo para DMX sin alterar timing de workers.
- Prioridad de modos y exclusión mutua.
- Lifecycle start/stop idempotente.
- Bass Pulse, Stereo Flow, Techno Chase y Ambient Drift.
- Controles de sensibilidad, attack, release e intensidad.
- Floor/ceiling y limiter visual.
- Playlist de referencia y criterios de calibración.

## Criterios de aceptación

- [ ] Solo un dueño escribe la salida dinámica en cada modo.
- [ ] Cambiar manual/scene/audio/ambilight no deja timers vivos.
- [ ] Stop/blackout/close limpian estado.
- [ ] Cada escena tiene identidad visual reconocible.
- [ ] Kick, estéreo y energía se perciben sin parpadeos agresivos.
- [ ] Las escenas funcionan con audio OFF y ON.
- [ ] QA-301 a QA-318 pasan o quedan con causa documentada.

## Pruebas manuales

- [ ] Cambiar entre manual, scene, audio y ambilight.
- [ ] Start/stop x20.
- [ ] Playlist de referencia: silencio, ambient, rock, techno y música con estéreo marcado.
- [ ] Soak de 30 minutos.
- [ ] Blackout durante escena y recuperación.

## Archivos probables

- `src/main/index.js`
- `src/renderer/src/scenes/SceneEngine.js`
- `src/renderer/src/pages/DynamicScenesPageV2.jsx`
- `src/renderer/src/store/dmxStore.js`
- `src/renderer/src/store/audioStore.js`

## Fuera de alcance

- Projection mapping.
- Projector window.
- IA generativa.
- Reescritura completa del renderer.
- Cambios de timing DMX de bajo nivel.
