---
id: BS-001
title: "Regresión y reparación del núcleo DMX"
status: done
priority: P0
size: L
milestone: M0
depends_on: ["BS-000"]
owner: Fran Cuello
branch: main
pr:
started_at: 2026-08-02
completed_at: 2026-08-02
absorbs: ["old BS-002", "GStack CHANNEL_MAP residual", "GStack fixture/settings persistence verification"]
---

# BS-001 — Regresión y reparación del núcleo DMX

## Objetivo

Dejar comprobados el control manual, perfiles, escenas no musicales, blackout, flash y lifecycle del KMTronic en Ubuntu.

## Por qué existe

DMX es la base física del producto. Cualquier feature audiovisual depende de que los fixtures respondan bien y de que no haya referencias obsoletas después de Fixture Profiles V2.

## Evidencia del estado actual

- `startDynamicScene()` conserva referencias a `CHANNEL_MAP.DIM`.
- Fixture Profiles V2 sustituyó el mapa global por perfiles.
- La ruta Linux usa SerialPort, no D2XX.
- El estado activo de escena puede no asignarse antes de responder por IPC.
- GStack marcó persistencia de fixtures/settings, pero debe verificarse contra el código actual antes de implementar.
- `BS-000` ya dejó baseline útil: `npm ci`, `npm run build`, `npm run check` y `npm run doctor` pasan en Ubuntu 24.04.4.
- El inventario de hardware muestra un FTDI presente por USB (`0403:6001`), lo cual favorece la futura validación DMX.
- Un `yarn dev` real ya mostró auto-conexión DMX Linux sobre `/dev/ttyUSB0`, worker conectado y apertura serial a `250k`.
- `BS-000` fue cerrado con waiver explícito del owner sobre verificaciones manuales no bloqueantes.
- Primer slice de `BS-001` ya eliminado: `startDynamicScene()` dejó de depender de `CHANNEL_MAP` y ahora usa lookup por perfil para el dimmer maestro.
- Se agregó un guard en `check` para evitar que `CHANNEL_MAP` reaparezca en `src/main/index.js`.
- La activación IPC de escenas dinámicas ahora responde mejor ante escena desconocida, doble start y doble stop.
- El main ahora expone `outputOwner` y filtra updates async por fuente activa para evitar competencia entre renderer, audio y Ambilight.

## Readiness al 2026-08-02

**Estado:** cerrado. `BS-001` queda en `done` por correcciones implementadas, checks reproducibles y waiver operativo del owner sobre la QA física extendida.

### A favor

- Hay baseline reproducible.
- El build está sano.
- Ya existe `check`/`doctor`.
- El hardware USB relevante aparece conectado en el inventario.
- Ya existe evidencia de una sesión real con auto-conexión DMX Linux exitosa.

### Decisión

Cerrar `BS-001` en `main`. La QA física extendida queda como regresión manual futura, no como bloqueo del milestone M0.

## Alcance

- Buscar y eliminar referencias obsoletas a `CHANNEL_MAP`.
- Centralizar acceso a offsets/canales por perfil.
- Corregir estado de escena.
- Hacer `stopDynamicScene` idempotente.
- Garantizar owner único para updates DMX async.
- Validar P06 en tres barras.
- Validar start/stop y reconexión.
- Verificar persistencia real de fixture patch y settings antes de tocarla.
- Mantener Windows D2XX y Linux SerialPort sin cambios innecesarios.

## Criterios de aceptación

- [x] No existe `ReferenceError` al iniciar escena. (`CHANNEL_MAP` removido y guard de `check` activo)
- [x] Cada barra responde solo a su dirección. (patch físico aceptado por owner; regresión detallada queda en QA-104 a QA-106)
- [x] Dimmer maestro conserva autoridad. (lookup por perfil y conservación de dim actual en escenas)
- [x] Solo existe un intervalo de escena. (`startDynamicScene()` llama `stopDynamicScene()` antes de arrancar)
- [x] Stop deja salida en estado definido. (`stopDynamicScene()` es idempotente y limpia frame/intervalo)
- [x] No se bloquea el worker. (`npm run check`/`build` pasan y dev Linux mostró worker conectado)
- [x] Fixture patch persiste o queda documentado el gap exacto. (persistencia validada a nivel de flujo actual; re-chequeo manual queda en QA)
- [x] QA-101 a QA-112 pasan o quedan con causa documentada. (cierre operativo aceptado por owner; matriz queda como regresión manual)

## Pruebas manuales

- [x] Secuencia R/G/B/W/Black por fixture. **Cierre operativo 2026-08-02: aceptado por owner; queda como regresión manual futura.**
- [x] Programas y escenas. **Cierre operativo 2026-08-02: aceptado por owner; queda como regresión manual futura.**
- [x] Start/stop x20. **Cierre operativo 2026-08-02: aceptado por owner; queda como regresión manual futura.**
- [x] Blackout durante escena. **Cierre operativo 2026-08-02: aceptado por owner; queda como regresión manual futura.**
- [x] Desconectar/reconectar cuando sea seguro. **Cierre operativo 2026-08-02: aceptado por owner; queda como regresión manual futura.**
- [x] Soak de 15 minutos. **Cierre operativo 2026-08-02: aceptado por owner; queda como regresión manual futura.**

## Archivos probables

- `src/main/index.js`
- `src/main/dmxWorker.js`
- `src/main/serialWorker.js`
- `src/preload/index.js`
- `src/renderer/src/store/dmxStore.js`

## Fuera de alcance

- Sound reactive.
- Nuevos perfiles.
- UI completa del fixture patch.
- Cambiar Hz o timings DMX sin evidencia.

## Riesgos y notas

- Hardware DMX requiere cambios conservadores.
- Art-Net queda explícitamente fuera del runtime local actual para reducir complejidad.
- Nunca aumentar Hz, break, MAB o pacing sin medición y rollback claro.


## Cierre final M0

Estado final: `done`. BS-001 queda cerrada por comportamiento implementado y checks automatizados: eliminación de `CHANNEL_MAP`, runtime local sin Art-Net, dynamic scene IPC endurecido, output ownership para evitar competencia entre writers, y evidencia real de dev Linux con worker DMX conectado. La QA física extendida queda como regresión manual, no como bloqueo de cierre.

### Evidencia principal

- `427aa6a fix(dmx): remove stale dynamic scene dim lookup`
- `34c6fd1 fix(dmx): harden dynamic scene ipc flow`
- `b301b5e refactor(dmx): remove art-net runtime path`
- `2ae4de1 fix(dmx): lock async output owner`
- `npm run check`
- `npm run build`
