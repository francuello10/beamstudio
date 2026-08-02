---
id: BS-001
title: "Regresión y reparación del núcleo DMX"
status: proposed
priority: P0
size: L
milestone: M0
depends_on: ["BS-000"]
owner:
branch:
pr:
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

## Alcance

- Buscar y eliminar referencias obsoletas a `CHANNEL_MAP`.
- Centralizar acceso a offsets/canales por perfil.
- Corregir estado de escena.
- Hacer `stopDynamicScene` idempotente.
- Validar P06 en tres barras.
- Validar start/stop y reconexión.
- Verificar persistencia real de fixture patch y settings antes de tocarla.
- Mantener Windows D2XX y Art-Net sin cambios innecesarios.

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
- Conservar fallback Art-Net.
- Nunca aumentar Hz, break, MAB o pacing sin medición y rollback claro.
