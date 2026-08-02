---
id: BS-007
title: "Now Playing provider-neutral y spikes Spotify/Tidal"
status: in-progress
priority: P2
size: M
milestone: M3
depends_on: ["BS-002", "BS-003"]
owner: Fran Cuello
branch: main
pr:
started_at: 2026-08-02
absorbs: ["old BS-011"]
---

# BS-007 — Now Playing provider-neutral y spikes Spotify/Tidal

## Objetivo

Obtener título, artista, portada, estado y progreso sin usar esa metadata como fuente del DSP.

## Por qué existe

La señal musical debe seguir siendo audio del sistema. Metadata mejora UX y automatización, pero no debe bloquear escenas.

## Evidencia del estado actual

- Existe una ruta básica `get-system-media`/`playerctl`, pero no hay contrato formal.
- Ubuntu permite consultar reproductores compatibles mediante MPRIS/DBus.
- Spotify ofrece APIs de playback/metadata, pero sus políticas requieren revisión para sincronización visual.
- Tidal requiere un spike separado.
- **Ajuste de alcance respecto al "Alcance" original (importante, leer antes de tocar audio):** el ítem "Separar metadata de `AudioFrame`" de este doc sugería que hoy la metadata de Now Playing influye indebidamente en el comportamiento audio-reactive. Se investigó antes de tocar código: `src/renderer/src/hooks/useSystemAudio.js` usa `playbackPaused` (derivado de pollear `get-system-media`/MPRIS) para congelar la salida audio-reactive cuando el usuario pausa la música, evitando que la salida quede "viva" (parpadeando/pulsando) antes de que el detector de silencio crudo lo note. Esa línea es un fix real, deliberado y muy reciente de otro agente activo en este mismo repo compartido, en los commits `b01e457` ("fix(audio): freeze output on paused music") y `8a98e23` ("fix(audio): honor paused media playback"). Revertirlo ahora deshace ese fix real, y `useSystemAudio.js` está bajo desarrollo paralelo activo (múltiples commits recientes) — tocarlo arriesga tanto una regresión real como un choque de merge.
- Por eso, este slice **NO modifica** `src/renderer/src/hooks/useSystemAudio.js`, `src/renderer/src/audio/AudioFrame.js`, `src/renderer/src/audio/AudioAnalyzer.js`, `src/renderer/src/audio/AudioReactiveRenderer.js`, `src/renderer/src/pages/AudioPage.jsx` ni nada bajo `src/renderer/src/audio/`. El comportamiento existente de `playbackPaused` influyendo en `silence` queda exactamente igual. En cambio, "separar metadata de `AudioFrame`" se interpretó y construyó como: un contrato `NowPlaying` real e independiente, con su propio poller y su propio store, que **no** lee ni escribe nada de `useSystemAudio.js`/`AudioFrame.js` — decoupled en el sentido de "flujo de datos propio", no en el sentido de "reescribir el flujo existente".
- Primer slice activo en `main`: contrato `NowPlaying` (`src/renderer/src/metadata/NowPlaying.js`), store dedicado (`src/renderer/src/metadata/nowPlayingStore.js`) y poller independiente (`src/renderer/src/hooks/useNowPlaying.js`), consumidos únicamente por una card de solo lectura en `SystemPage.jsx`.
- `getLinuxMedia()` en `src/main/index.js` se extendió de forma aditiva: el format string de `playerctl metadata` ahora pide también `{{position}}`, `{{mpris:length}}` y `{{mpris:artUrl}}`, agregando `positionSec`/`durationSec`/`artUrl` al objeto devuelto sin tocar `title`/`artist`/`playbackStatus` (los únicos campos que `useSystemAudio.js` y `geminiService.js` ya consumen). Unidades verificadas empíricamente en esta máquina con un reproductor MPRIS real corriendo (playerctl v2.4.1): `{{position}}` y `{{mpris:length}}` son microsegundos (ej. `position=4096000` coincidió con `playerctl position` reportando `4.096000` segundos para el mismo track). `mpris:artUrl` devolvió una URL válida para Spotify vía playerctl en esta máquina, pero no está garantizado para todo reproductor MPRIS — por eso `artwork` en el contrato queda `null` cuando no viene un string real.
- `window.dmx.getSystemMedia()` se mantiene intacto; se agregó un alias `window.nowPlaying.getSystemMedia()` en `src/preload/index.js` sobre el mismo canal IPC `get-system-media`, sólo para que consumidores nuevos no tengan que pasar por el namespace `dmx`.
- Degradación: si `getSystemMedia()` devuelve `null` o la promesa rechaza, `useNowPlaying` asienta el store en `createEmptyNowPlaying()` (`state: 'no-player'`) y sigue polleando en el siguiente intervalo — nunca deja datos viejos en pantalla ni rompe el loop por un intento fallido.
- **Fase 2 (portada/álbum/progreso en UI + overlay proyector)**: `getLinuxMedia()` se extendió otra vez de forma aditiva agregando `{{xesam:album}}` al final del format string de `playerctl metadata` (`title`/`artist`/`position`/`mpris:length`/`mpris:artUrl` mantienen su posición y semántica exacta), devolviendo `album` (string trim, `''` si no viene). El contrato `NowPlaying` (`createEmptyNowPlaying`/`createNowPlaying`) y `useNowPlaying.js` ahora threadean ese campo igual que `title`/`artist`. La card "Now Playing" de `SystemPage.jsx` se enriqueció (sin reescribirse) con portada (`nowPlaying.artwork`, con fallback a un ícono `Music` de `lucide-react` cuando no hay imagen), nombre de álbum (sólo si no está vacío) y una barra de progreso delgada con etiquetas `mm:ss / mm:ss` (helper local `formatSeconds`, sin dependencia nueva) que refleja el cadence de polleo existente de `useNowPlaying` (1.5s) — no se agregó interpolación cliente-side, coherente con la arquitectura "poll and reflect" ya establecida.
- **Nuevo: overlay "Now Playing" en la salida del proyector.** Se agregó el toggle IPC `projector:setNowPlayingOverlay`/`projector:nowPlayingOverlayChanged`, relayado en `src/main/index.js` exactamente igual que `projector:setBlackout`/`projector:setTestPattern` (one-way send desde la ventana principal, broadcast a `projectorWindow`). `src/preload/index.js` expone `setNowPlayingOverlay`/`onNowPlayingOverlayChanged` en `projectorAPI` con el mismo patrón send/subscribe-con-unsubscribe que `setBlackout`/`onBlackout`. `ProjectorPage.jsx` suma un botón "NOW PLAYING" junto a BLACKOUT/TEST PATTERN. `ProjectorApp.jsx` corre su **propio** `useNowPlaying()` (hook sin modificar) — `get-system-media` es una query stateless que cualquier ventana puede invocar directamente, así que no hizo falta relay de datos estilo `AudioFrame`, sólo el toggle booleano — y renderiza el nuevo `src/renderer/src/output/NowPlayingOverlay.jsx` (componente presentacional plano, sin WebGL/canvas, mismo espíritu que `TestPatternOverlay` en el mismo archivo) con la misma precedencia que el test pattern: `nowPlayingOverlay && !blackout` (blackout siempre gana). El overlay muestra portada grande (340px), título, artista, álbum y barra de progreso sobre fondo oscuro/glass; si `state === 'no-player'` muestra "Sin reproductor activo" en vez de una card vacía/rota.
- **Confirmación explícita sobre compositor/autor:** se corrió `playerctl metadata` en esta máquina contra una sesión real y activa de Spotify. Los campos MPRIS disponibles confirmados son: `mpris:trackid`, `mpris:length`, `mpris:artUrl`, `xesam:album`, `xesam:albumArtist`, `xesam:artist`, `xesam:autoRating`, `xesam:discNumber`, `xesam:title`, `xesam:trackNumber`, `xesam:url`. **No existe ningún campo de compositor/autor de canción (songwriter/composer) en MPRIS** — la integración MPRIS de Spotify no expone ese dato en absoluto (obtenerlo requeriría la Web API real de Spotify con OAuth, fuera de alcance según la sección "Fuera de alcance" de este doc). Este campo se dejó deliberadamente afuera de `NowPlaying.js`, de la card de `SystemPage.jsx` y del `NowPlayingOverlay.jsx` — no se fabricó ni se adivinó ningún dato de autoría en ningún lugar de este diff.

## Alcance

- Contrato `NowPlaying`.
- Adapter MPRIS/playerctl primero.
- Spotify spike.
- Tidal spike.
- YouTube navegador como caso de prueba.
- Separar metadata de `AudioFrame`.
- Política de tokens y permisos.

## Criterios de aceptación

- [x] Audio reactive funciona sin provider (cierto por construcción: este slice nunca toca `useSystemAudio.js` ni el resto de `src/renderer/src/audio/`).
- [x] MPRIS/playerctl devuelve metadata cuando está disponible (handler existente + `useNowPlaying`/`nowPlayingStore` como consumidor formal, con `title`/`artist`/`playbackStatus` sin cambios y `positionSec`/`durationSec`/`artUrl` nuevos y aditivos).
- [x] Si no hay metadata, la app degrada sin romper escenas (estado `no-player` limpio ante `null`/rechazo; como este slice no toca DMX/escenas, no hay nada que romper).
- [x] Spotify/Tidal quedan como spikes con política documentada antes de integrar (ver sección "Spike Spotify/Tidal" abajo).
- [x] No se guardan tokens en plaintext (no existe ningún token en este diff — no hay OAuth implementado).

## Pruebas manuales

- [ ] Spotify desktop.
- [ ] Tidal desktop.
- [ ] YouTube en navegador.
- [ ] VLC o reproductor MPRIS compatible.
- [ ] Sin reproductor activo.

## Spike Spotify/Tidal (documentación, sin integración)

Esto es un spike time-boxed con política documentada, no una integración real. `Fuera de alcance` de este doc explícitamente excluye "OAuth completo antes de revisar políticas", así que no hay llamadas a APIs de Spotify/Tidal, ni flujo OAuth, ni almacenamiento de tokens en este diff.

### Spotify

- **Superficie de API**: para polling simple, `GET /me/player/currently-playing` (Spotify Web API) alcanza para título/artista/progreso/estado. Para eventos en tiempo real dentro de un contexto web reproduciendo audio, existe el Web Playback SDK, pero no aplica directo a un consumidor Electron que sólo lee metadata (no reproduce audio vía Spotify).
- **OAuth**: para una app de escritorio Electron distribuida, el flujo correcto es **Authorization Code with PKCE** — sin client secret embebido en el binario distribuido. El flujo "Authorization Code" clásico (con secret) no es apropiado para un binario que un usuario puede descompilar/inspeccionar.
- **Scopes mínimos**: `user-read-currently-playing` y/o `user-read-playback-state` cubren título/artista/progreso/estado de reproducción; no se necesita ningún scope de escritura/control (play/pause/seek están fuera de alcance de este feature).
- **Políticas/ToS**: Spotify aplica rate limits sobre su Web API (cuotas por app/usuario) y tiene requisitos de developer terms sobre atribución de marca y uso de datos que no pude verificar con precisión sin acceso web en vivo en este entorno — no voy a inventar detalles específicos de política que no puedo confirmar ahora mismo. Antes de cualquier integración real, un spike dedicado debe leer los Developer Terms y Design Guidelines vigentes de Spotify directamente.

### Tidal

- El acceso a la API pública de Tidal está más restringido/gateado a partners que el de Spotify — no hay garantía de que hoy exista un camino de acceso equivalente al de Spotify para una app de terceros. Esto queda marcado como incertidumbre alta, no como "funcionará igual que Spotify". Un spike real de Tidal necesita primero confirmar disponibilidad pública de API vigente antes de intentar cualquier implementación.

### Política de almacenamiento de tokens (para cuando se implemente OAuth real — NO implementado ahora)

- Los tokens (access/refresh) de cualquier integración OAuth futura de Spotify/Tidal deben guardarse usando el módulo `safeStorage` de Electron (`safeStorage.encryptString`/`decryptString`), respaldado por el keychain del SO (DPAPI en Windows, Keychain en macOS, libsecret en Linux) — nunca como JSON plano.
- Esto contrasta deliberadamente con cómo se persisten `fixtures.json` (`FIXTURES_PATH`, `src/main/index.js:19`) y `mapping-presets.json` (`MAPPING_PRESETS_PATH`, `src/main/index.js:39`): esos son config de app no-secreta, plaintext JSON está bien ahí. Un token OAuth no es config de app, es una credencial — plaintext JSON no sería aceptable para eso.
- Esta sección queda como referencia concreta de política para un futuro follow-up de BS-007 que implemente OAuth real.
- **Confirmación explícita**: no existe almacenamiento de tokens en texto plano en ningún lugar de este diff — trivialmente cierto porque no se implementó OAuth. Esto satisface el criterio de aceptación "No se guardan tokens en plaintext".

## Archivos probables

- `src/main/index.js`
- `src/preload/index.js`
- `src/renderer/src/metadata/`
- `src/renderer/src/store/`

## Fuera de alcance

- Capturar audio desde APIs.
- DRM bypass.
- Sincronización visual basada en metadata.
- OAuth completo antes de revisar políticas.
- **Letras sincronizadas estilo karaoke** — pedido explícitamente por el owner como feature futura "nice to have", no para este slice. MPRIS no expone letras en absoluto; requeriría una fuente externa nueva (la opción más viable sin fricción/sin auth es lrclib.net, con timing por línea; Musixmatch tiene API pero con términos restrictivos). Además, a diferencia de portada/metadata, las letras son contenido con copyright — cualquier implementación futura debe elegir una fuente con licencia/términos claros, no scrapear texto de letras arbitrariamente.
