---
id: BS-004
title: "Ambilight: reparación, calibración y soak test"
status: in-progress
priority: P1
size: M
milestone: M0
depends_on: ["BS-002", "BS-003"]
owner: Fran Cuello
branch: main
pr:
started_at: 2026-08-02
absorbs: ["old BS-007"]
---

# BS-004 — Ambilight: reparación, calibración y soak test

## Objetivo

Dejar Ambilight como función confiable y separada de sound reactive.

## Por qué existe

El motor existe, pero nunca fue probado a fondo en el entorno actual y contiene deuda de async/state.

## Evidencia del estado actual

- `startAmbilight` es async y la página no siempre lo espera.
- `audioBoost` parece residual.
- PipeWire limita la enumeración tradicional.
- El hook hace downsample 3x1 y aplica smoothing.
- Primer slice activo en `main`: se corrigió un bug crítico de ownership — `ambilight:start` reclamaba `dmxState.outputOwner = 'ambilight'`, pero `useGpuAmbilight.js` mandaba cada frame a `sendPixelMapBuffer(colors)` sin `source`, cayendo al default `'renderer'`. `isAsyncOutputSourceAllowed('renderer')` comparaba contra `'ambilight'` y rechazaba **todos** los frames en silencio. Ahora `dispatchPixelMapUpdate` pasa `'ambilight'` explícitamente en los dos call sites del hook (loop de `process()` y el frame de apagado en `stop()`), verificado de punta a punta: `ambilight:start` → `setOutputOwner('ambilight')` → hook manda `source: 'ambilight'` → `isAsyncOutputSourceAllowed('ambilight')` → `true` → los colores llegan a los fixtures. `ambilight:stop` ya liberaba el ownership correctamente vía `clearOutputOwner('ambilight')`, no requirió cambios.
- Segundo slice activo en `main`: se destapó la UI de error, que era dead code por partida doble. `useGpuAmbilight.js`'s `start()` ahora relanza (`throw`) el error tras el cleanup interno en vez de tragarlo, para que el `try/catch` de `AmbilightPage.jsx` pueda reaccionar. `ambilight:getSources` en `src/main/index.js` ahora devuelve `{ sources, error }` en lugar de solo un array, distinguiendo "enumeración lanzó una excepción real" de "enumeración OK pero cero fuentes" (típico de permisos de portal Wayland/PipeWire no otorgados). Además se descubrió que `captureError` nunca se renderizaba en el JSX (bug adicional no listado originalmente en el audit) — se agregó el banner de error visible en la página.
- Tercer slice activo en `main`: `handleStart` en `AmbilightPage.jsx` ahora hace `await startAmbilight(id)` en vez de dispararlo sin esperar, y se agregó un guard `isStarting` (seteado sincrónicamente al hacer click, liberado en `finally`) que bloquea el botón IGNITE SYSTEM y hace no-op al handler durante el gap async entre el click y que `capturing` pase a `true`, evitando el doble-click que pisaba el `MediaStream` anterior.
- Cuarto slice activo en `main`: se eliminó el estado `audioBoost`/`setAudioBoost` (siempre `false`, `setAudioBoost` nunca se llamaba en todo el codebase) y la rama de overlay de boost-percent en el monitor de extracción que nunca renderizaba. También se quitó `energyFactor` del destructure de `useSystemAudio`, que quedaba sin uso tras remover el overlay.
- Quinto slice activo en `main`: el factor de smoothing (LERP) dejó de estar hardcodeado (`0.15` fijo) — `useGpuAmbilight.js` ahora expone `smoothingFactor`/`setSmoothingFactor` (default `0.15`, sin cambiar el comportamiento por defecto) y `AmbilightPage.jsx` agrega un slider (rango 0.05–0.5, paso 0.01) siguiendo la misma convención visual que el slider de `audioBoostLevel` en `AudioPage.jsx`.
- Sexto slice activo en `main`: se separó la extracción de color de la modulación por audio dentro de `useGpuAmbilight.js`. `extractZoneColors(video, ctx, isMono)` hace únicamente el downsample GPU 3x1 y arma los colores crudos L/C/R; `applyAudioModulation(rawColors, audioMode, boostFactor)` aplica los multiplicadores STEREO/EQ (o devuelve los colores sin tocar si el modo es OFF). `process()` ahora las llama en secuencia seguido del paso de LERP. Es un split a nivel función, mismo archivo, sin cambios de comportamiento.
- Séptimo slice activo en `main`: se destapó, vía reporte en vivo del usuario + screenshot (fuente con `name` vacío en el `<select>`), que el flujo clásico de Electron pre-Wayland — enumerar con `desktopCapturer.getSources()` en el main process y elegir un `sourceId` para pasarle a `getUserMedia({ video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId } } })` — está roto en GNOME/Wayland real: PipeWire no expone títulos de ventana/pantalla reales a las apps (privacidad a nivel compositor), así que `desktopCapturer.getSources()` devolvía entradas `name: ''` y 0 o 1 entradas genéricas `"window:"`, sin fuentes `"screen:"` por monitor. El dropdown quedaba vacío/inusable. Cambio de arquitectura para Linux: en vez de enumerar y preseleccionar, `useGpuAmbilight.js`'s `start()` ahora detecta `window.platform === 'linux'` (flag nuevo expuesto como string plano vía `contextBridge.exposeInMainWorld('platform', process.platform)` en `src/preload/index.js`) y llama directo a `navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })` — sin `sourceId`, sin constraints `mandatory`/`chromeMediaSource` (son específicos de la extensión Electron+desktopCapturer, no aplican a la API estándar). Con el flag `enable-features=WebRTCPipeWireCapturer` ya seteado en `src/main/index.js` (confirmado, antes de `app.whenReady()`), esto dispara el picker nativo del xdg-desktop-portal del compositor — un diálogo real del SO donde el usuario elige pantalla/ventana — sin enumeración custom. El `MediaStream` resultante se asigna a `video.srcObject` exactamente igual que el de `getUserMedia`, sin cambios en el pipeline de extracción de frames. `AmbilightPage.jsx`: en Linux el `<select>` del dropdown se reemplaza por un mensaje explicativo ("Wayland: se te va a pedir elegir la pantalla al iniciar") y el botón refresh se oculta (el `useEffect` de montaje ya no llama a `refreshSources()` en Linux, para no disparar un banner de error falso de "no se encontraron fuentes" con una enumeración que ese flujo ya no consume); `handleStart` ya no gatea el click de IGNITE SYSTEM detrás de un `sourceId` preseleccionado cuando `isLinux` es true. Manejo de errores: si el usuario cancela el picker nativo, `getDisplayMedia()` rechaza con `NotAllowedError` — un resultado normal y esperado (el usuario decidió no compartir pantalla ahora), no un crash; el catch de `handleStart` distingue ese caso y setea un `captureError` calmo ("Elección de pantalla cancelada — iniciá de nuevo cuando quieras compartir una pantalla.") en vez del mensaje genérico de fallo. `ambilight:getSources`/`desktopCapturer` en `src/main/index.js` se dejó intacto — sigue siendo el flujo usado en Windows/macOS/X11, donde si funciona. `npm run check` y `npm run build` pasan ambos. **Pendiente:** no se pudo marcar "Captura una fuente válida" como hecho — falta que el usuario haga el click-through real del diálogo nativo del SO (un diálogo interactivo del sistema operativo no se puede automatizar ni verificar por inspección de código desde este slice).

## Alcance

- Captura Wayland.
- Orden L/C/R.
- Mono.
- Audio opcional.
- Smoothing configurable.
- Error UI claro.
- Separar extracción de color de modulación por audio.
- Soak test.

## Criterios de aceptación

- [ ] Captura una fuente válida. (requiere corrida real en sesión Wayland/PipeWire con permisos de pantalla otorgados; no se pudo ejecutar en este slice)
- [ ] Las zonas corresponden al orden físico. (el orden L/C/R de `extractZoneColors` no se modificó, ya era correcto per audit; falta validación física con fixtures reales conectados)
- [x] Audio modulation se puede apagar. (`applyAudioModulation` devuelve `rawColors` sin tocar cuando `audioMode === 'OFF'`, verificado por trazado de código; el toggle ya funcionaba antes del split, ahora vive en una función dedicada)
- [x] No compite con SceneEngine. (Fix 1: Ambilight ahora usa su propio tag `'ambilight'` en vez de reusar `'renderer'`; verificado de punta a punta que `ambilight:start` → `setOutputOwner('ambilight')` → `dispatchPixelMapUpdate(colors, 'ambilight')` → `isAsyncOutputSourceAllowed('ambilight')` → `true`, y que `ambilight:stop` libera el ownership vía `clearOutputOwner('ambilight')`)
- [ ] Error de permisos/captura se informa claramente. (código corregido y trazado: `start()` relanza el error, `ambilight:getSources` distingue error real de cero-fuentes, `captureError` ahora se renderiza en la UI; falta una corrida real donde PipeWire deniegue permisos para confirmar el mensaje en pantalla)
- [ ] Soak de 30 minutos sin leaks visibles. (requiere corrida real de 30 minutos; no ejecutado en este slice)

## Pruebas manuales

- [ ] Capturar pantalla completa.
- [ ] Capturar ventana si está disponible.
- [ ] Cambiar de fuente.
- [ ] Activar/desactivar audio modulation.
- [ ] Reproducir patrones de color L/C/R.
- [ ] Minimizar/restaurar.

## Archivos probables

- `src/renderer/src/hooks/useGpuAmbilight.js`
- `src/renderer/src/pages/AmbilightPage.jsx`
- `src/renderer/src/store/dmxStore.js`
- `src/main/index.js`
- `src/preload/index.js`

## Fuera de alcance

- Projection mapping.
- Visuales nuevos.
- Captura multi-monitor avanzada.
