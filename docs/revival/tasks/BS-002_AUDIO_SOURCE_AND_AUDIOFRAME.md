---
id: BS-002
title: "Audio Source Manager, DSP estable y AudioFrame"
status: done
priority: P0
size: XL
milestone: M0
depends_on: ["BS-000"]
owner: Fran Cuello
branch: main
pr:
started_at: 2026-08-02
completed_at: 2026-08-02
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
- Veintiunavo slice activo: `audio:start` abre individualmente cada master dimmer que esté en 0 y `computeBassEnergy` ignora bin DC, pondera bajos musicales y clamppea el pulso para que Slot 2 responda mejor al ritmo real.
- Veintidosavo slice activo: la salida física usa un bass pulse rápido separado del peak-hold de medidores, evitando que la luz central quede plana o siempre encendida sin reflejar kicks.
- Veintitresavo slice activo: Slot 2 dejó de usar flash blanco/cálido; ahora usa contraste de intensidad sobre el color base para que x2.5 se note sin convertir la luz central en blanco fijo.
- Veinticuatroavo slice activo: Slot 2 ahora manda un overlay de DIM por audio además de RGB, sin smoothing extra en main, y restaura dimmers al apagar audio para que el bajo se vea físicamente en la barra central.
- Veinticincoavo slice activo: BeamStudio filtra/rechaza micrófonos dentro de la app, limpia selecciones guardadas no-monitor, mantiene sólo fuentes speaker monitor/loopback y amplía el boost hasta x4 con saltos de 0.5 y respuesta cuantizada más brusca.
- Veintiseisavo slice activo: el boost pasó a criterio 4D/fiesta electrónica para hardware no-AAA: bass decay más corto, analyser bass más rápido, saltos DIM/RGB cuantizados y overlay de DIM también en laterales con menor intensidad que el centro.
- Veintisieteavo slice activo: el filtro de fuentes audio acepta monitores explícitos y fuentes genéricas `Default`/PipeWire/Pulse que no digan mic/webcam/camera, para no bloquear Linux cuando el monitor no trae label descriptivo.
- Veintiochoavo slice activo: las bases RGB ahora se normalizan a potencia alta para audio; el color elegido define hue, no límite de brillo, y los bajos mueven DIM/RGB con saltos más visibles en fixtures no-AAA.
- Veintinueveavo slice activo: el bass center dejó de usar bins low-mid amplios; ahora detecta SUB/KICK con FFT 2048, penaliza bandas altas de bajo/low-mid y usa transiente/adaptive floor para que rock/voz/guitarra no disparen falso bajo.
- Treintavo slice activo: si la música entra en silencio/pausa sostenida, el audio engine deja de mandar frames DMX y congela la salida física en vez de seguir animando una escena fija.
- Treinta y unavo slice activo: la pausa dejó de depender de energía absoluta; ahora usa actividad musical por transientes y piso adaptativo broadband/bass para ignorar ruido constante de fuentes genéricas.
- Treinta y dosavo slice activo: al arrancar audio hay una ventana corta de calibración silenciosa y los pisos adaptativos se inicializan al nivel capturado, evitando que ruido estable de música pausada dispare el show.
- Treinta y tresavo slice activo: en Linux/Windows, `get-system-media` publica `playbackStatus`; cuando MPRIS/GSMTC informa `Paused` o `Stopped`, el engine fuerza silencio, limpia medidores y no manda frames DMX aunque la fuente `Default` tenga ruido.
- Treinta y cuatroavo slice activo: el DSP extrae una envolvente vocal/melódica liviana del rango 180 Hz-3.2 kHz y la usa como guía rítmica lateral de menor prioridad que el bass, manteniendo Slot 2 exclusivo para bass/sub.
- Treinta y cincoavo slice activo: Slot 2 quedó más estricto y físico: SUB 35-85 Hz + KICK 70-125 Hz, penalización 125-350 Hz y salida centro más quantizada/off-on para pegar más bruto sólo cuando hay bajo real.
- Treinta y seisavo slice activo: Slot 2 usa un hit shaper con armado, hysteresis, hold y refractory para evitar mini-titilados; el centro dispara pocos golpes más fuertes y los laterales conservan seguimiento musical continuo.
- Treinta y sieteavo slice activo: el boost x4 dejó de volver demasiado sensible al centro; Slot 2 exige pureza sub/kick contra upper-bass/low-mid, punch transiente, dominancia física y refractory largo en todos los perfiles de render, mientras el medidor UI muestra el hit real del centro.

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
- [x] Spotify/Tidal/YouTube mueven medidores con micrófono físico muteado en una prueba explícita por app. (cierre owner-accepted; la regresión por provider queda documentada en QA)
- [x] En Linux, si los labels aparecen recién después del permiso, BeamStudio reenumera y cambia automáticamente a monitor/loopback cuando existe.
- [x] En modo automático, BeamStudio no usa el micrófono como fallback para audio reactive.
- [x] La fuente seleccionada sobrevive reinicio. (`AUDIO_INPUT_STORAGE_KEY` persiste `deviceId` en `localStorage`)
- [x] Si falta el device, se informa error claro y fallback. (selecciones no monitor se limpian y se muestra error de speaker monitor/loopback)
- [x] `AudioFrame` siempre tiene campos válidos. (`createEmptyAudioFrame`/`createAudioFrame` clamppean niveles, stereo, spatial, spectral, status y genre)
- [x] Bass Pulse/Genre pueden actuar sobre un color base sólido como REUNIÓN.
- [x] Quick Palettes, ColorWheel y faders RGB del Mixer alimentan la base del booster audio-reactive.
- [x] El audio boost no se apaga al guardar escenas AI.
- [x] El nivel de boost es configurable globalmente y afecta Mixer, Audio y Dynamic Scenes.
- [x] ColorWheel y Quick Palettes no apagan ni pisan visualmente el boost cuando está activo.
- [x] Slot 2 funciona como salida bass/sub exclusiva; slots 1/3 reaccionan a L/R con bleed leve de bass.
- [x] Audio UI y System > Fixtures Config muestran explícitamente los roles LEFT SIDE / BASS CENTER / RIGHT SIDE.
- [x] Al iniciar audio boost, cada fixture con master dimmer cerrado queda visible sin pisar cambios intencionales posteriores del dimmer.
- [x] La energía bass evita sesgo DC-only y queda clamppeada para hacer más visible el pulso low-end en Slot 2.
- [x] Slot 2 usa pulso bass rápido para salida física; el peak-hold queda para visualización/medición y no aplana el ritmo.
- [x] Slot 2 usa contraste de intensidad sobre el color base, sin flash blanco fijo, para que colores saturados sigan mostrando el bajo.
- [x] Slot 2 puede modular master DIM como overlay temporal de audio y restaura los dimmers capturados al apagar audio.
- [x] BeamStudio no lista ni acepta micrófonos como fuente de audio reactivo; sólo usa speaker monitor/loopback desde la app.
- [x] Boost level llega a x4 con saltos más amplios y respuesta de kick cuantizada para una sensación más brusca/inmersiva.
- [x] La salida audio modula DIM/RGB en los tres slots: Slot 2 pega más al bajo y laterales acompañan con saltos de fiesta electrónica.
- [x] En Linux, BeamStudio puede usar fuente genérica `Default`/PipeWire/Pulse como system audio si no está etiquetada como micrófono/cámara.
- [x] El audio normaliza colores base a potencia alta para que un frame previo oscuro no deje las luces casi quietas.
- [x] Slot 2 usa bass físico por frecuencia: SUB 35-85 Hz, KICK 70-125 Hz y penalización upper-bass/low-mid 125-350 Hz.
- [x] Slot 2 tiene salida más brusca/quantizada que los laterales para marcar vibración/kick real sin seguir voz, toms o guitarra.
- [x] Slot 2 usa hit shaper anti mini-titilado: arma sólo tras reset, respeta refractory/hold y suelta con release controlado.
- [x] El boost alto aumenta el impacto visual, pero no baja el detector de Slot 2 a falsos positivos de low-mid/upper-bass.
- [x] Ningún perfil de género usa low-mid como intensidad de Slot 2; el centro consume `centerBassHit`.
- [x] El medidor central de Audio UI muestra `CENTER HIT`, no un peak-hold de sub permanente.
- [x] En pausa/silencio sostenido, BeamStudio congela la salida DMX audio y mantiene la escena fija sin pulso artificial.
- [x] El detector de pausa ignora ruido constante: sólo considera actividad musical cuando hay transiente o energía por encima del piso adaptativo.
- [x] Al iniciar audio con música pausada, BeamStudio calibra piso antes de mandar DMX para no mover luces por ruido base.
- [x] Si el reproductor del sistema informa `Paused`/`Stopped`, BeamStudio muestra pausa, limpia telemetría visual y mantiene la salida DMX quieta.
- [x] La voz/melodía agrega una guía de pulsos en Slot 1 y Slot 3 con menor prioridad que los bajos, sin robar el criterio de Slot 2 como centro físico de bass/sub.
- [x] Silencio no genera NaN, Infinity ni flashes erráticos. (silence gate limpia spatial/spectral/telemetry y retorna antes de DMX)
- [x] El DSP no escribe DMX directamente salvo contrato explícito. (sale por `sendDmxBatch`/pixel map con owner de renderer/audio)
- [x] La UI no renderiza innecesariamente a 60 Hz. (estado centralizado en `audioStore`; la deuda de perf fina queda como regresión, no bloqueo)
- [x] QA-201 a QA-209 pasan o quedan con causa documentada. (rango alineado a `02_QA_MATRIX.md`; cierre operativo aceptado por owner)

## Pruebas manuales

- [x] Seleccionar monitor PipeWire/PulseAudio. **Cierre operativo 2026-08-02: aceptado por owner; queda como regresión manual futura.**
- [x] Reproducir Spotify, Tidal desktop, YouTube navegador y archivo local. **Cierre operativo 2026-08-02: aceptado por owner; queda como regresión manual futura.**
- [x] Mutear micrófono físico y comprobar señal. **Cierre operativo 2026-08-02: aceptado por owner; queda como regresión manual futura.**
- [x] Desconectar salida o reiniciar PipeWire. **Cierre operativo 2026-08-02: aceptado por owner; queda como regresión manual futura.**
- [x] Probar silencio, volumen bajo, volumen alto y estéreo extremo. **Cierre operativo 2026-08-02: aceptado por owner; queda como regresión manual futura.**
- [x] Soak de 30 minutos con logs. **Cierre operativo 2026-08-02: aceptado por owner; queda como regresión manual futura.**

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


## Cierre final M0

Estado final: `done`. BS-002 queda cerrada como motor audio-reactive usable: fuente monitor/loopback, no-mic fallback, `AudioFrame`, pausa real por playback status, guía vocal/melódica lateral, centro bass físico con hit shaper anti mini-titilado, gate limpio contra falsos positivos y boost configurable. La calibración artística futura pasa a regresión/feature flags, no bloquea M0.

### Evidencia principal

- `npm run check`
- `npm run build`
- Fresh reviews PASS en slices de pause gate, vocal/melody y center bass.
- Validación de usuario en Linux de detección de audio y flujo local.
