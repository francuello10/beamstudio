---
id: BS-003
title: "Audio Source Manager y captura real del sistema"
status: proposed
priority: P0
size: L
milestone: M0
depends_on: ["BS-001"]
owner:
branch:
pr:
---

# BS-003 — Audio Source Manager y captura real del sistema

## Objetivo

Permitir seleccionar explícitamente la fuente de audio y comprobar que BeamStudio escucha la salida del sistema en Ubuntu.

## Por qué existe

El sound reactive no puede ser bueno si la señal de entrada es el micrófono, una fuente equivocada o una señal con nivel impredecible.

## Evidencia del estado actual

- `useSystemAudio` usa `getUserMedia` sin `deviceId`.
- Electron loopback string está soportado actualmente en Windows, no debe asumirse en Linux.
- Ubuntu/Wayland requiere una fuente monitor de PipeWire/PulseAudio.
- No existe selector persistente de audio.

## Alcance

- Enumeración de inputs.
- Selección por `deviceId`.
- Persistencia de preferencia.
- Reconexión y fallback.
- Panel de señal.
- Fuente de test interna.
- Mensajes específicos de permisos.

## Pasos sugeridos

- [ ] Crear servicio/hook `AudioSourceManager`.
- [ ] Pedir permiso y volver a enumerar para obtener labels.
- [ ] Mostrar fuentes monitor de forma identificable.
- [ ] Guardar `deviceId` y etiqueta.
- [ ] Usar constraints con deviceId exacto.
- [ ] Detectar desaparición del dispositivo.
- [ ] Agregar señal de test con OscillatorNode o archivo local.
- [ ] Exponer sample rate, channels, track settings y estado.

## Criterios de aceptación

- [ ] Spotify/Tidal/YouTube mueven medidores con micrófono muteado.
- [ ] El usuario sabe qué fuente está activa.
- [ ] La selección persiste.
- [ ] Un dispositivo ausente produce error accionable.
- [ ] Stop libera tracks.
- [ ] QA-201 a QA-209 aplicables pasan.

## Pruebas manuales

- [ ] Reproducir música con micrófono muteado.
- [ ] Cambiar entre micrófono y monitor.
- [ ] Desconectar salida o reiniciar PipeWire.
- [ ] Stop/start x10.
- [ ] Silencio.

## Archivos probables

- `src/renderer/src/audio/AudioSourceManager.js`
- `src/renderer/src/hooks/useSystemAudio.js`
- `src/renderer/src/pages/AudioPage.jsx`
- `src/renderer/src/store/audioStore.js`

## Fuera de alcance

- OAuth Spotify.
- Metadata.
- Separación de stems.
- Grabación.

## Riesgos y notas

- Los IDs pueden cambiar entre sesiones.
- Wayland/PipeWire depende de configuración del sistema.
- No guardar audio.

## Evidencia de cierre

```md
- Commit:
- PR:
- OS:
- Hardware:
- QA ejecutadas:
- Logs:
- Capturas/video:
- Resultado:
```
