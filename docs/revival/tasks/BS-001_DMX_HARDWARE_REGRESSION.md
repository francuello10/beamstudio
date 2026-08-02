---
id: BS-001
title: "Regresión y reparación del núcleo DMX"
status: in-progress
priority: P0
size: L
milestone: M0
depends_on: ["BS-000"]
owner: Fran Cuello
branch: fix/bs-001-dmx-regression
pr:
started_at: 2026-08-02
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
- `BS-000` todavía no cerró las verificaciones manuales de páginas recorridas, arranque/cierre repetido y prueba con KMTronic desconectado.
- Primer slice de `BS-001` ya eliminado: `startDynamicScene()` dejó de depender de `CHANNEL_MAP` y ahora usa lookup por perfil para el dimmer maestro.
- Se agregó un guard en `check` para evitar que `CHANNEL_MAP` reaparezca en `src/main/index.js`.
- La activación IPC de escenas dinámicas ahora responde mejor ante escena desconocida, doble start y doble stop.

## Readiness al 2026-08-02

**Estado:** en ejecución. `BS-000` fue cerrada el 2026-08-02 con waiver explícito del owner sobre la QA manual restante.

### A favor

- Hay baseline reproducible.
- El build está sano.
- Ya existe `check`/`doctor`.
- El hardware USB relevante aparece conectado en el inventario.
- Ya existe evidencia de una sesión real con auto-conexión DMX Linux exitosa.

### Decisión

Arrancar `BS-001` ahora sobre `fix/bs-001-dmx-regression`. El riesgo manual diferido de `BS-000` queda aceptado por el owner y no bloquea más esta tarea.

## Alcance

- Buscar y eliminar referencias obsoletas a `CHANNEL_MAP`.
- Centralizar acceso a offsets/canales por perfil.
- Corregir estado de escena.
- Hacer `stopDynamicScene` idempotente.
- Validar P06 en tres barras.
- Validar start/stop y reconexión.
- Verificar persistencia real de fixture patch y settings antes de tocarla.
- Mantener Windows D2XX y Linux SerialPort sin cambios innecesarios.

## Criterios de aceptación

- [ ] No existe `ReferenceError` al iniciar escena.
- [ ] Cada barra responde solo a su dirección.
- [ ] Dimmer maestro conserva autoridad.
- [ ] Solo existe un intervalo de escena.
- [ ] Stop deja salida en estado definido.
- [ ] No se bloquea el worker.
- [ ] Fixture patch persiste o queda documentado el gap exacto.
- [ ] QA-101 a QA-112 pasan o quedan con causa documentada.

## Pruebas manuales

- [ ] Secuencia R/G/B/W/Black por fixture.
- [ ] Programas y escenas.
- [ ] Start/stop x20.
- [ ] Blackout durante escena.
- [ ] Desconectar/reconectar cuando sea seguro.
- [ ] Soak de 15 minutos.

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
