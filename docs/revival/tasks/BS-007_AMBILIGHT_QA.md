---
id: BS-007
title: "Ambilight: reparación, calibración y soak test"
status: proposed
priority: P1
size: M
milestone: M0
depends_on: ["BS-004", "BS-005"]
owner:
branch:
pr:
---

# BS-007 — Ambilight: reparación, calibración y soak test

## Objetivo

Dejar Ambilight como función confiable y separada de sound reactive.

## Por qué existe

El motor existe, pero nunca fue probado a fondo en el entorno actual y contiene deuda de async/state.

## Evidencia del estado actual

- `startAmbilight` es async y la página no siempre lo espera.
- `audioBoost` parece residual.
- PipeWire limita la enumeración tradicional.
- El hook hace downsample 3x1 y aplica smoothing.

## Alcance

- Captura Wayland.
- Orden L/C/R.
- Mono.
- Audio opcional.
- Errores y cleanup.
- Latencia y soak.

## Pasos sugeridos

- [ ] Esperar la promesa de start.
- [ ] Eliminar estados/args muertos.
- [ ] Documentar comportamiento del portal.
- [ ] Crear video patrón por zonas.
- [ ] Calibrar fixture order.
- [ ] Separar color extraction de audio modulation.
- [ ] Mostrar FPS/latencia.
- [ ] Probar stop y track ended.
- [ ] Ejecutar soak.

## Criterios de aceptación

- [ ] Captura funciona o informa limitación concreta.
- [ ] Zonas corresponden a barras físicas.
- [ ] Stop libera stream.
- [ ] Audio OFF no inicia AudioContext.
- [ ] No hay saturación continua.
- [ ] QA-401 a QA-407 pasan.

## Pruebas manuales

- [ ] Patrón rojo/verde/azul.
- [ ] Película con barras negras.
- [ ] Escritorio.
- [ ] Audio ON/OFF.
- [ ] 60 minutos.

## Archivos probables

- `src/renderer/src/hooks/useGpuAmbilight.js`
- `src/renderer/src/pages/AmbilightPage.jsx`
- `src/main/index.js`
- `src/preload/index.js`

## Fuera de alcance

- Rehacer Ambilight estilo Philips.
- Más de tres zonas.
- HDR capture.

## Riesgos y notas

- Wayland depende de portal.
- DRM puede impedir captura de contenido protegido.
- No prometer compatibilidad con toda app.

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
