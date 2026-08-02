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
- Cleanup completo de streams, tracks, animation frames y AudioContext.

## Criterios de aceptación

- [ ] Spotify/Tidal/YouTube mueven medidores con micrófono muteado.
- [ ] La fuente seleccionada sobrevive reinicio.
- [ ] Si falta el device, se informa error claro y fallback.
- [ ] `AudioFrame` siempre tiene campos válidos.
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
