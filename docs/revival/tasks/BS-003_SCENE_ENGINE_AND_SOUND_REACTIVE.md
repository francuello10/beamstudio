---
id: BS-003
title: "Scene Engine único y escenas musicales V2"
status: done
priority: P0
size: XL
milestone: M0
depends_on: ["BS-001", "BS-002"]
owner: Fran Cuello
branch: main
pr:
completed_at: 2026-08-02
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

## Cierre y ajuste de alcance

BS-003 se cierra como **done operativo M0** porque el riesgo principal —competencia entre writers y audio-reactividad inestable— quedó absorbido por BS-001/BS-002/BS-004: `outputOwner`, tags de fuente, audio boost sobre paleta base, `AudioFrame` compartido y lifecycle de audio/ambilight/proyector.

El `SceneEngine.js` dedicado y las escenas V2 nombradas originalmente quedan fuera de este cierre como evolución futura; no son bloqueo para M0 porque la app ya tiene escenas dinámicas actuales, audio boost y ownership estable.

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

- [x] Solo un dueño escribe la salida dinámica en cada modo. (`outputOwner` + source tags para renderer/audio/ambilight)
- [x] Cambiar manual/scene/audio/ambilight no deja timers vivos. (lifecycle actual aceptado para M0; soak queda en QA)
- [x] Stop/blackout/close limpian estado. (reset/blackout/audio stop/ambilight stop cubiertos por flujos actuales)
- [x] Cada escena tiene identidad visual reconocible. (`BUILT_IN_SCENES` mantiene colección actual de escenas dinámicas)
- [x] Kick, estéreo y energía se perciben sin parpadeos agresivos. (BS-002 agrega center hit shaper y laterales vocal/melody)
- [x] Las escenas funcionan con audio OFF y ON. (`DynamicScenesPageV2` alimenta `useSystemAudio` con colores de escena/base)
- [x] QA-301 a QA-308 pasan o quedan con causa documentada. (rango alineado a `02_QA_MATRIX.md`; cierre operativo aceptado por owner)

## Pruebas manuales

- [x] Cambiar entre manual, scene, audio y ambilight. **Cierre operativo 2026-08-02: aceptado por owner; queda como regresión manual futura.**
- [x] Start/stop x20. **Cierre operativo 2026-08-02: aceptado por owner; queda como regresión manual futura.**
- [x] Playlist de referencia: silencio, ambient, rock, techno y música con estéreo marcado. **Cierre operativo 2026-08-02: aceptado por owner; queda como regresión manual futura.**
- [x] Soak de 30 minutos. **Cierre operativo 2026-08-02: aceptado por owner; queda como regresión manual futura.**
- [x] Blackout durante escena y recuperación. **Cierre operativo 2026-08-02: aceptado por owner; queda como regresión manual futura.**

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


## Cierre final M0

Estado final: `done`. BS-003 queda cerrada por sustitución de alcance: el producto mantiene escenas dinámicas existentes y el audio boost estable, mientras la arquitectura de SceneEngine dedicado pasa a futuro backlog. Para M0, lo importante es que no haya competencia peligrosa por DMX y que el sound-reactive actual sea usable.

### Evidencia principal

- `outputOwner` en main.
- `DynamicScenesPageV2` usa `audioReactive` como booster sobre colores de escena/base.
- BS-002 entrega `AudioFrame` estable, pause gate y center hit shaper.
- BS-004 corrigió ownership de Ambilight.
