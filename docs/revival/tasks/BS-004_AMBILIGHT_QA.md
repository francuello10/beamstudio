---
id: BS-004
title: "Ambilight: reparación, calibración y soak test"
status: proposed
priority: P1
size: M
milestone: M0
depends_on: ["BS-002", "BS-003"]
owner:
branch:
pr:
absorbs: ["old BS-007"]
---

# BS-004 — Ambilight: reparación, calibración y soak test

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
- Smoothing configurable.
- Error UI claro.
- Separar extracción de color de modulación por audio.
- Soak test.

## Criterios de aceptación

- [ ] Captura una fuente válida.
- [ ] Las zonas corresponden al orden físico.
- [ ] Audio modulation se puede apagar.
- [ ] No compite con SceneEngine.
- [ ] Error de permisos/captura se informa claramente.
- [ ] Soak de 30 minutos sin leaks visibles.

## Pruebas manuales

- [ ] Capturar pantalla completa.
- [ ] Capturar ventana si está disponible.
- [ ] Cambiar de fuente.
- [ ] Activar/desactivar audio modulation.
- [ ] Reproducir patrones de color L/C/R.
- [ ] Minimizar/restaurar.

## Archivos probables

- `src/renderer/src/hooks/useGpuAmbilight.js`
- `src/renderer/src/pages/AmbilightPage.jsx`
- `src/renderer/src/store/dmxStore.js`
- `src/main/index.js`
- `src/preload/index.js`

## Fuera de alcance

- Projection mapping.
- Visuales nuevos.
- Captura multi-monitor avanzada.
