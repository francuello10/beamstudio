---
id: BS-002
title: "Audio Source Manager, DSP estable y AudioFrame"
status: in-progress
priority: P0
size: XL
milestone: M0
depends_on: ["BS-000"]
owner: Fran Cuello
branch: main
pr:
started_at: 2026-08-02
absorbs: ["old BS-003", "old BS-004", "GStack energies bug"]
---

# BS-002 — Audio Source Manager, DSP estable y AudioFrame

## Objetivo

Permitir seleccionar explícitamente la fuente de audio del sistema y producir un único `AudioFrame` confiable para escenas, visuales, diagnóstico y futuro projector output.

## Por qué existe

El sound reactive no puede ser bueno si BeamStudio escucha el micrófono equivocado, una señal inestable o un DSP que puede cortar el loop por una variable fuera de scope.

## Evidencia del estado actual

- `useSystemAudio` usa `getUserMedia` sin `deviceId`.
- Ubuntu/Wayland requiere una fuente monitor de PipeWire/PulseAudio.
- La ruta central calcula `spatial` pero actualiza con `energies` fuera de scope.
- El hook mezcla análisis, React state, colorización y control DMX.
- No existe un contrato único consumido por escenas y visuales.
- Primer slice activo en `main`: selección explícita de `audioinput` persistida en renderer + fix del bug `energies` fuera de scope.
- Segundo slice activo en `main`: `audioFrame` normalizado publicado en `audioStore` para consumo futuro por escenas, Ambilight y visuales.
- Tercer slice activo en `main`: preferencia automática por monitor/loopback + reconexión inicial ante `devicechange` y visibilidad de la fuente activa real en UI.
- Cuarto slice activo en `main`: `AudioFrame.status` publica silencio/clipping y la UI de audio muestra diagnóstico básico de señal.
- Quinto slice activo en `main`: la gestión de fuentes quedó extraída a `src/renderer/src/audio/AudioSourceManager.js` para empezar a desacoplar `useSystemAudio`.
- Sexto slice activo en `main`: los cálculos DSP base quedaron extraídos a `src/renderer/src/audio/AudioAnalyzer.js` para bajar complejidad del hook.
- Séptimo slice activo en `main`: la detección de género estable y la telemetría derivada también quedaron movidas a `AudioAnalyzer`.
- Octavo slice activo en `main`: la colorización/reactividad quedó extraída a `src/renderer/src/audio/AudioReactiveRenderer.js`.
- Noveno slice activo en `main`: Ambilight y Fluid consumen `audioFrame` como contrato principal en lugar de depender de campos sueltos.
- Décimo slice activo en `main`: se corrigió la importación faltante de `useAudioStore` en `useSystemAudio`, validado por el usuario en Linux.
- Onceavo slice activo: la UI de audio se simplificó para mostrar fuente activa, estado de señal, modo y mapeo por slot de fixture/DMX.
- Doceavo slice activo: audio reactive dejó de ser un modo exclusivo y ahora puede modular un look base sólido como REUNIÓN.
- Treceavo slice activo: el RGB manual del Mixer alimenta `audioBaseColors`, por lo que Quick Palettes, ColorWheel y faders RGB funcionan como base para el booster.
- Catorceavo slice activo: la captura de audio hace una segunda enumeración después del permiso para preferir automáticamente monitor/loopback y evitar caer al micrófono por labels ocultas en Linux.
- Quinceavo slice activo: el modo automático rechaza el micrófono; si no hay monitor/loopback, no arranca y muestra error claro.
- Dieciseisavo slice activo: guardar escenas AI ya no apaga el audio boost y la UI distingue Full Music Boost de Bass Boost.
- Diecisieteavo slice activo: `audioBoostLevel` global permite ajustar el nivel del booster y la respuesta por defecto quedó más brusca/punchy.
- Dieciochoavo slice activo: con audio boost activo, el Mixer/ColorWheel actualizan la base RGB sin mandar RGB manual directo que pise la capa audio.
- Diecinueveavo slice activo: el mapeo 3-slot quedó explícito como Slot 2 exclusivo para bass/sub y Slots 1/3 como L/R con incidencia leve de bass.
- Veinteavo slice activo: la UI de Audio y System muestra roles de patch para dejar claro que Slot 2 debe ser la luz física central/bass.

## Alcance

- Enumerar inputs de audio.
- Seleccionar fuente por `deviceId`.
- Persistir preferencia.
- Reconexión y fallback.
- Medidores para silencio, clipping, L/R/bass y fuente activa.
- Corregir bug de scope `energies`.
- Definir contrato `AudioFrame`.
- Separar análisis de presentación.
- Noise floor, normalización y valores válidos ante silencio.
- Reducir renders React de alta frecuencia.
- Modular colores base sólidos con Bass Pulse/Genre sin reemplazar conceptualmente el look activo.
- Tratar audio reactive como booster sobre el RGB manual/base, no como una paleta mutuamente excluyente.
- Cleanup completo de streams, tracks, animation frames y AudioContext.

## Criterios de aceptación

- [x] Audio mueve medidores en Linux con la fuente activa validada por el usuario.
- [ ] Spotify/Tidal/YouTube mueven medidores con micrófono físico muteado en una prueba explícita por app.
- [x] En Linux, si los labels aparecen recién después del permiso, BeamStudio reenumera y cambia automáticamente a monitor/loopback cuando existe.
- [x] En modo automático, BeamStudio no usa el micrófono como fallback para audio reactive.
- [ ] La fuente seleccionada sobrevive reinicio.
- [ ] Si falta el device, se informa error claro y fallback.
- [ ] `AudioFrame` siempre tiene campos válidos.
- [x] Bass Pulse/Genre pueden actuar sobre un color base sólido como REUNIÓN.
- [x] Quick Palettes, ColorWheel y faders RGB del Mixer alimentan la base del booster audio-reactive.
- [x] El audio boost no se apaga al guardar escenas AI.
- [x] El nivel de boost es configurable globalmente y afecta Mixer, Audio y Dynamic Scenes.
- [x] ColorWheel y Quick Palettes no apagan ni pisan visualmente el boost cuando está activo.
- [x] Slot 2 funciona como salida bass/sub exclusiva; slots 1/3 reaccionan a L/R con bleed leve de bass.
- [x] Audio UI y System > Fixtures Config muestran explícitamente los roles LEFT SIDE / BASS CENTER / RIGHT SIDE.
- [ ] Silencio no genera NaN, Infinity ni flashes erráticos.
- [ ] El DSP no escribe DMX directamente salvo contrato explícito.
- [ ] La UI no renderiza innecesariamente a 60 Hz.
- [ ] QA-201 a QA-214 pasan o quedan con causa documentada.

## Pruebas manuales

- [ ] Seleccionar monitor PipeWire/PulseAudio.
- [ ] Reproducir Spotify, Tidal desktop, YouTube navegador y archivo local.
- [ ] Mutear micrófono físico y comprobar señal.
- [ ] Desconectar salida o reiniciar PipeWire.
- [ ] Probar silencio, volumen bajo, volumen alto y estéreo extremo.
- [ ] Soak de 30 minutos con logs.

## Archivos probables

- `src/renderer/src/hooks/useSystemAudio.js`
- `src/renderer/src/audio/AudioSourceManager.js`
- `src/renderer/src/audio/AudioFrame.js`
- `src/renderer/src/audio/AudioAnalyzer.js`
- `src/renderer/src/store/audioStore.js`
- `src/main/index.js`
- `src/preload/index.js`

## Fuera de alcance

- OAuth Spotify/Tidal.
- Capturar audio desde APIs de providers.
- Nuevas escenas visuales.
- Projection mapping.
- Guardar audio.
