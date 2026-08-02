---
id: BS-002
title: "Regresión y reparación del núcleo DMX"
status: proposed
priority: P0
size: L
milestone: M0
depends_on: ["BS-000", "BS-001"]
owner:
branch:
pr:
---

# BS-002 — Regresión y reparación del núcleo DMX

## Objetivo

Dejar comprobados el control manual, perfiles, escenas no musicales, blackout, flash y lifecycle del KMTronic en Ubuntu.

## Por qué existe

Es la base física del producto. El refactor de perfiles dejó referencias obsoletas y pudo romper rutas que antes funcionaban.

## Evidencia del estado actual

- `startDynamicScene()` conserva una referencia a `CHANNEL_MAP.DIM`.
- Fixture Profiles V2 sustituyó el mapa global por perfiles.
- La ruta Linux usa SerialPort, no D2XX.
- El estado activo de escena puede no asignarse antes de responder por IPC.

## Alcance

- Eliminar referencias obsoletas.
- Centralizar acceso a canales por perfil.
- Corregir estado de escena.
- Validar P06 en tres barras.
- Validar start/stop y reconexión.
- Mantener Windows D2XX y Art-Net sin cambios innecesarios.

## Pasos sugeridos

- [ ] Buscar todas las referencias `CHANNEL_MAP`.
- [ ] Crear helpers seguros para offset/dimmer por perfil.
- [ ] Asegurar que `startDynamicScene` asigne estado.
- [ ] Hacer `stopDynamicScene` idempotente.
- [ ] Comprobar que reset no deja timers.
- [ ] Probar canales de cada fixture.
- [ ] Probar blackout y restauración.
- [ ] Probar 15 minutos.
- [ ] Documentar permisos Linux/udev si son necesarios.

## Criterios de aceptación

- [ ] No existe `ReferenceError` al iniciar escena.
- [ ] Cada barra responde solo a su dirección.
- [ ] Dimmer maestro conserva autoridad.
- [ ] Solo existe un intervalo de escena.
- [ ] Stop deja salida en estado definido.
- [ ] No se bloquea el worker.
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

## Riesgos y notas

- Hardware DMX requiere cambios conservadores.
- Nunca aumentar Hz o timings sin evidencia.
- Conservar fallback Art-Net.

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
