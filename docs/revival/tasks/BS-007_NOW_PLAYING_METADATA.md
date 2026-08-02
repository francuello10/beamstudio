---
id: BS-007
title: "Now Playing provider-neutral y spikes Spotify/Tidal"
status: proposed
priority: P2
size: M
milestone: M3
depends_on: ["BS-002", "BS-003"]
owner:
branch:
pr:
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

## Alcance

- Contrato `NowPlaying`.
- Adapter MPRIS/playerctl primero.
- Spotify spike.
- Tidal spike.
- YouTube navegador como caso de prueba.
- Separar metadata de `AudioFrame`.
- Política de tokens y permisos.

## Criterios de aceptación

- [ ] Audio reactive funciona sin provider.
- [ ] MPRIS/playerctl devuelve metadata cuando está disponible.
- [ ] Si no hay metadata, la app degrada sin romper escenas.
- [ ] Spotify/Tidal quedan como spikes con política documentada antes de integrar.
- [ ] No se guardan tokens en plaintext.

## Pruebas manuales

- [ ] Spotify desktop.
- [ ] Tidal desktop.
- [ ] YouTube en navegador.
- [ ] VLC o reproductor MPRIS compatible.
- [ ] Sin reproductor activo.

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
