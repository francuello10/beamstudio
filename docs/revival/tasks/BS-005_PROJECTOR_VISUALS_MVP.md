---
id: BS-005
title: "Projector Output MVP y biblioteca inicial de visuales"
status: proposed
priority: P1
size: XL
milestone: M1
depends_on: ["BS-003"]
owner:
branch:
pr:
absorbs: ["old BS-008", "old BS-009"]
---

# BS-005 — Projector Output MVP y biblioteca inicial de visuales

## Objetivo

Abrir una salida fullscreen independiente en el HY300PRO y entregar un set pequeño de visuales atractivos que consuman `AudioFrame`.

## Por qué existe

Antes de projection mapping se necesita una salida visual robusta. El valor inmediato para la habitación está en visuales buenos, no en una infraestructura de mapping compleja.

## Evidencia del estado actual

- La aplicación solo crea una BrowserWindow principal.
- Fluid Simulation ya existe dentro de la UI.
- No hay OutputManager ni selector de display.
- `AudioFrame` y `SceneEngine` deben estar disponibles.

## Alcance

- Enumeración de displays.
- ProjectorWindow fullscreen.
- Selector de display.
- Blackout.
- Patrón de calibración.
- Recuperación si el display desaparece.
- Rol `projector` por query/hash.
- Fluid Neon, Particle Field, Tunnel/Grid y Kaleidoscope/Waves.
- Presets simples.
- Mapeo de `AudioFrame` a parámetros visuales.

## Criterios de aceptación

- [ ] Se abre salida fullscreen en HY300PRO.
- [ ] La UI principal controla output sin mostrar controles en el proyector.
- [ ] Blackout funciona.
- [ ] Patrón de test cubre bordes y centro.
- [ ] Cuatro visuales disponibles.
- [ ] Todos funcionan con audio OFF y ON.
- [ ] No se mandan frames de video pesados por IPC.
- [ ] 10 minutos por visual sin degradación obvia.

## Pruebas manuales

- [ ] Conectar/desconectar HY300PRO.
- [ ] Seleccionar display correcto.
- [ ] Fullscreen, blackout y patrón de test.
- [ ] Probar cada visual con playlist de referencia.
- [ ] Cerrar output y reabrir.

## Archivos probables

- `src/main/index.js`
- `src/preload/index.js`
- `src/renderer/src/output/`
- `src/renderer/src/visuals/`
- `src/renderer/src/hooks/useFluidSimulation.js`
- `src/renderer/src/store/audioStore.js`

## Fuera de alcance

- Projection mapping.
- ComfyUI/StreamDiffusion.
- Multi-projector.
- Captura NDI/shared memory.
- Edición avanzada de visuales.
