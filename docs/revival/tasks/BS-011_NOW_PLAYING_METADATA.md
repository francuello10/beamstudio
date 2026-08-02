---
id: BS-011
title: "Now Playing provider-neutral y spikes Spotify/Tidal"
status: proposed
priority: P2
size: M
milestone: M3
depends_on: ["BS-006"]
owner:
branch:
pr:
---

# BS-011 — Now Playing provider-neutral y spikes Spotify/Tidal

## Objetivo

Obtener título, artista, portada, estado y progreso sin usar esa metadata como fuente del DSP.

## Por qué existe

La señal musical debe seguir siendo audio del sistema. Metadata mejora UX y automatización, pero no debe bloquear escenas.

## Evidencia del estado actual

- No hay integración actual.
- Ubuntu permite consultar reproductores compatibles mediante MPRIS/DBus.
- Spotify ofrece APIs de playback/metadata, pero sus políticas requieren revisión para sincronización visual.
- Tidal requiere un spike separado.

## Alcance

- Contrato NowPlaying.
- Adapter MPRIS primero.
- Spotify spike.
- Tidal spike.
- Fallback manual.
- Cache y rate limits.
- Policy gate.

## Pasos sugeridos

- [ ] Definir `NowPlayingState`.
- [ ] Probar MPRIS/playerctl con Spotify y Tidal desktop.
- [ ] Agregar adapter local.
- [ ] Separar metadata de AudioFrame.
- [ ] Investigar OAuth Spotify y scopes mínimos.
- [ ] Documentar restricciones antes de integrar.
- [ ] Investigar Tidal oficialmente.
- [ ] Agregar UI opcional.
- [ ] No bloquear app si no hay metadata.

## Criterios de aceptación

- [ ] Audio reactive funciona sin provider.
- [ ] Metadata aparece cuando existe.
- [ ] Cambio de track se refleja.
- [ ] No se guarda token en texto plano.
- [ ] No se distribuye una integración sin revisión de términos.
- [ ] Fallback indica estado desconocido.

## Pruebas manuales

- [ ] Spotify desktop.
- [ ] Tidal desktop.
- [ ] YouTube en navegador.
- [ ] Player cerrado.
- [ ] Cambio de canción.

## Archivos probables

- `src/renderer/src/now-playing/`
- `src/main/integrations/`
- `src/preload/index.js`
- `src/renderer/src/components/NowPlaying.jsx`

## Fuera de alcance

- Capturar audio desde APIs.
- Streaming propio.
- Sincronización cloud.

## Riesgos y notas

- Políticas pueden cambiar.
- MPRIS depende del cliente.
- OAuth aumenta superficie de seguridad.

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
