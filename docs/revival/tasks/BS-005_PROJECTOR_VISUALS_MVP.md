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
- Séptimo slice activo en `main`: tercera visual, Tunnel/Grid. Se agregó `src/renderer/src/hooks/useTunnelGrid.js`: a diferencia de Particle Field, esta visual es un único pase de fragment shader de pantalla completa (sin simulación CPU ni buffers por objeto) que calcula coordenadas polares desde el centro de pantalla y mapea el radio a una coordenada de "profundidad" creciente en el tiempo, dibujando anillos concéntricos (bandas de profundidad) y rayos radiales (bandas de ángulo) como líneas neon con glow — la técnica estándar de "túnel infinito" de demoscene, elegida por ser más simple y barata que un enfoque geométrico/de partículas para este efecto en particular. Mapeo de `AudioFrame`: `levels.bass` controla la velocidad de avance (término continuo + envolvente de kick por transiente, misma idea de media móvil + umbral que Particle Field, implementada de forma independiente) y comprime el espaciado de los anillos en los golpes; `spectral` (16 bandas) define un hue base suavizado dentro de la misma familia neon (HUE_LOW/HUE_HIGH) más un jitter de hue por anillo calculado en el shader (hash determinístico del índice de anillo), cubriendo tanto rotación de hue como variación de color por anillo; `spatial.left/right` sesga la dirección/velocidad de rotación y desplaza suavemente el punto de fuga horizontal (ancho estéreo); `spatial.center` da un boost extra de brillo a los rayos (mapeo adicional no exigido por la spec mínima); `levels.volume` sube el piso de brillo ambiente; `status.silence` nunca se chequea para congelar nada — avance, rotación y anillos tienen una base ambiente siempre activa; `status.clipping` recorta más los techos de boost de velocidad, pulso de anillos y brillo general, seguido de la convención anti-flash-blanco existente. Se agregó `TunnelGridVisual.jsx` (mismo patrón que `ParticleFieldVisual.jsx`, incluyendo `mergeRefs` para que `MappingCompositor.jsx` lo lea como fuente de textura), entrada `tunnelGrid` en `visualRegistry.js` y en `VISUAL_COMPONENTS` de `ProjectorApp.jsx`; `ProjectorPage.jsx` no requirió cambios (ya itera `VISUALS` genéricamente). `npm run check` y `npm run build` pasan.
- Octavo slice activo en `main`: cuarta y ÚLTIMA visual, Kaleidoscope, completando el set de 4 visuales planeadas. Se agregó `src/renderer/src/hooks/useKaleidoscope.js`: igual que Tunnel/Grid, un único pase de fragment shader de pantalla completa (sin simulación CPU ni buffers por objeto ni asset de imagen/textura externo) que pliega el ángulo polar de pantalla en una cuña repetida (`abs(mod(angle, wedge) - wedge/2)`, la matemática clásica de kaleidoscopio de dos espejos: cada cuña queda además simétrica internamente, duplicando la simetría visible), y colorea esa coordenada de cuña plegada con un patrón procedural de ondas seno en capas con domain-warping (una onda modula la fase de otra), en el mismo espíritu que la matemática de anillos/rayos de Tunnel/Grid pero adaptada a la coordenada de cuña en vez de a una coordenada de profundidad radial. Mapeo de `AudioFrame`: `levels.bass` suma un término continuo a la velocidad de flujo del patrón y a la velocidad de rotación ambiente, más una envolvente de kick por transiente (media móvil + umbral, misma idea que Particle Field/Tunnel Grid, implementada de forma independiente) que dispara un "punch" de zoom breve (el radio se contrae momentáneamente) y un boost de brillo; `spectral` (16 bandas) define el mismo hue base suavizado de la familia neon (HUE_LOW/HUE_HIGH) que además se hace variar por el ángulo de cuña plegado y el valor del patrón, para un flujo de color coherente pero siempre cambiante; `spatial.left/right` sesga la dirección/velocidad de rotación (mismo patrón que Tunnel Grid); `levels.volume` suma un término continuo tanto al piso de brillo ambiente como a la velocidad de flujo; `status.silence` nunca se chequea para congelar nada — flujo, rotación y el conteo de pliegues mantienen una base ambiente siempre activa, así que el kaleidoscopio nunca se congela ni se apaga con audio OFF; `status.clipping` recorta más los techos del punch de zoom y del brillo general, siguiendo la misma convención anti-flash-blanco existente. Como floreo opcional (no exigido por la spec), el conteo de pliegues (fold count) deriva lentamente entre 6 y 12 en un ciclo largo independiente del audio, con un pequeño empujón adicional de la media de graves suavizada. Se agregó `KaleidoscopeVisual.jsx` (mismo patrón que `TunnelGridVisual.jsx`, incluyendo `mergeRefs` para que `MappingCompositor.jsx` lo lea como fuente de textura), entrada `kaleidoscope` en `visualRegistry.js` y en `VISUAL_COMPONENTS` de `ProjectorApp.jsx` (se actualizaron ambos comentarios que mencionaban "la próxima visual" ya que las 4 planeadas están completas); `ProjectorPage.jsx` no requirió cambios (ya itera `VISUALS` genéricamente). `npm run check` y `npm run build` pasan.

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
- [x] Cuatro visuales disponibles. (Fluid Neon, Particle Field, Tunnel/Grid y Kaleidoscope; las 4 visuales planeadas están completas)
- [x] Todos funcionan con audio OFF y ON. (las 4 visuales — Fluid Neon, Particle Field, Tunnel/Grid y Kaleidoscope — mantienen movimiento/color ambiente sin audio y reaccionan con audio ON, verificado por inspección de código)
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
