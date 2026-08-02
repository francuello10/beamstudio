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
- Sexto slice activo en `main`: segunda visual, Particle Field. Se extrajo `src/renderer/src/visuals/glUtils.js` (helpers WebGL2 genéricos `compileShader`/`createProgram`, copia independiente del patrón de `useFluidSimulation.js`, sin importar ni tocar ese archivo) para que las próximas 2 visuales (Tunnel/Grid, Kaleidoscope) lo reutilicen. Se agregó `src/renderer/src/hooks/useParticleField.js`: un campo de ~4000 partículas renderizadas con `gl.POINTS` (blending aditivo + pase de fade por cuadro para el rastro/glow), simuladas en CPU en typed arrays con wrap toroidal (sin altas/bajas de partículas). Mapeo de `AudioFrame`: `levels.bass` dispara ráfagas de relanzamiento de partículas por transiente (media móvil + umbral) y un pulso de tamaño global suavizado (ataque rápido/release lento, sin parpadeo); `spectral` (16 bandas) define el hue de partículas al refrescarse/ráfaga, ponderado hacia magenta/violeta en graves y cian en agudos (paleta neon, no la rueda RGB completa); `spatial.left/right` sesga el punto de ráfaga y el drift horizontal ambiente; `levels.volume` sube el piso de brillo ambiente; `status.silence` no bloquea el drift ambiente (el campo sigue vivo con audio OFF); `status.clipping` recorta aún más los techos de brillo/tamaño para nunca llegar a blanco puro. A diferencia de `useFluidSimulation` (que la app mantiene siempre montado por una particularidad de reinicialización), este hook libera sus recursos GL por completo en `stop()` para soportar montar → iniciar → detener → desmontar → remontar sin fugas, ya que `ProjectorApp.jsx` desmonta/remonta el componente activo al cambiar de visual. Se agregó `ParticleFieldVisual.jsx` (mismo patrón que `FluidNeonVisual.jsx`), entrada `particleField` en `visualRegistry.js` y en `VISUAL_COMPONENTS` de `ProjectorApp.jsx`; `ProjectorPage.jsx` no requirió cambios (ya itera `VISUALS` genéricamente). `npm run check` y `npm run build` pasan.

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
- [ ] Cuatro visuales disponibles. (Fluid Neon y Particle Field en este slice; Tunnel/Grid y Kaleidoscope/Waves quedan para slices futuros)
- [ ] Todos funcionan con audio OFF y ON. (depende de las 4 visuales; Fluid Neon y Particle Field ya lo cumplen, faltan las 2 restantes)
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
