---
id: BS-005
title: "Projector Output MVP y biblioteca inicial de visuales"
status: in-progress
priority: P1
size: XL
milestone: M1
depends_on: ["BS-003"]
owner: Fran Cuello
branch: main
pr:
started_at: 2026-08-02
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
- Primer slice activo en `main`: `createProjectorWindow`/`closeProjectorWindow` en `src/main/index.js` abren una `BrowserWindow` fullscreen sin frame en el display elegido (o el no-primario/primario como fallback), cargando el renderer con `?role=projector`; se agregaron los IPC `projector:listDisplays`, `projector:open`, `projector:close`, `projector:setBlackout` y `projector:setTestPattern`, más recuperación automática si el display usado se desconecta (`screen.on('display-removed')`) y broadcast de `projector:statusChanged`/`projector:displaysChanged` al resto de ventanas.
- Segundo slice activo en `main`: `src/renderer/src/main.jsx` decide entre `<App/>` y el nuevo `<ProjectorApp/>` según el query param `role`; `src/renderer/src/output/ProjectorApp.jsx` monta el motor Fluid Neon existente (`useFluidSimulation`, sin modificar su implementación) a pantalla completa, con overlays de blackout (negro puro) y patrón de test (grid + marcas de borde + crosshair central) controlados por IPC desde el proyector.
- Tercer slice activo en `main`: `src/renderer/src/pages/ProjectorPage.jsx` agrega el panel de control del operador (selector de display con refresh, abrir/cerrar proyector, toggles de blackout y test pattern, y lectura de estado de conexión), enlazado al sidebar y al router de `App.jsx` como una página más.
- Cuarto slice activo en `main`: fix de aislamiento DMX (bug detectado post-slice-2). `useFluidSimulation` reclama ownership global de DMX (`window.dmx.setDynamicRendererActive`) y envía color por `window.ambilight.setColorsAsync`, lo cual robaba el output DMX del proceso principal apenas montaba `ProjectorApp`. Se resolvió a nivel de preload, no tocando `useFluidSimulation.js`/`dmxStore.js`: `createProjectorWindow` en `src/main/index.js` ahora pasa `additionalArguments: ['--beamstudio-role=projector']` en `webPreferences`, y `src/preload/index.js` detecta ese flag (`isProjectorWindow`) para NO exponer `window.dmx`, `window.ambilight`, `window.scene`, `window.theme`, `window.ai` ni `window.windowOps` en la ventana del proyector (sí se exponen `electron`, `audio` y `projector`). Como los llamados en `useFluidSimulation.js` usan optional chaining, quedan en no-op silencioso ahí — el secuestro de ownership DMX pasa a ser estructuralmente imposible en vez de accidentalmente seguro.
- Quinto slice activo en `main`: relay de `AudioFrame` y selector de visuales. Cada `BrowserWindow` es un proceso de renderer independiente, así que el `useAudioStore` del proyector nunca recibía análisis de audio en vivo (`useSystemAudio` solo corre en la ventana principal). Se agregó un relay por IPC: `src/renderer/src/App.jsx` se suscribe a `useAudioStore` (form de 1 argumento, sin middleware `subscribeWithSelector`) y reenvía cada `audioFrame` vía `window.audio.broadcastFrame`; `src/main/index.js` reenvía `audio:frameBroadcast` a todas las ventanas salvo la emisora; `ProjectorApp.jsx` lo consume con `window.audio.onFrameBroadcast` y lo escribe con la acción existente `setAudioData`. Además se agregó la plomería de selección de visual (`projector:setVisual`/`projector:visualChanged`, estado `activeVisual` en `ProjectorApp.jsx`, componente extraído `FluidNeonVisual` en `src/renderer/src/visuals/`, y selector mínimo en `ProjectorPage.jsx`) para que las próximas 3 visuales se agreguen como una rama más sin tocar la estructura.

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

- [ ] Se abre salida fullscreen en HY300PRO. (no verificable sin hardware; lógica de `createProjectorWindow` implementada y validada solo por inspección de código)
- [x] La UI principal controla output sin mostrar controles en el proyector.
- [x] Blackout funciona. (verificado por inspección de código/IPC; falta prueba con segundo display físico)
- [x] Patrón de test cubre bordes y centro.
- [ ] Cuatro visuales disponibles. (solo Fluid Neon en este slice; Particle Field, Tunnel/Grid y Kaleidoscope/Waves quedan para slices futuros)
- [ ] Todos funcionan con audio OFF y ON. (depende de las 4 visuales; no aplicable aún con solo 1 implementada)
- [x] No se mandan frames de video pesados por IPC.
- [ ] 10 minutos por visual sin degradación obvia. (requiere soak test en hardware real, no verificable por inspección de código)

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
