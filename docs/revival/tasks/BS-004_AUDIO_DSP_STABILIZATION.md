---
id: BS-004
title: "Estabilización del DSP y contrato AudioFrame"
status: proposed
priority: P0
size: L
milestone: M0
depends_on: ["BS-003"]
owner:
branch:
pr:
---

# BS-004 — Estabilización del DSP y contrato AudioFrame

## Objetivo

Corregir errores del hook, normalizar la señal y producir un único frame de audio confiable para todos los consumidores.

## Por qué existe

Actualmente el DSP mezcla análisis, React state, colorización y control DMX. Además existe una variable fuera de alcance que puede cortar el loop.

## Evidencia del estado actual

- La ruta central calcula `spatial` pero actualiza con `energies`.
- El hook mantiene múltiples estados React de alta frecuencia.
- Las curvas están acopladas a nombres de versión y tuning subjetivo.
- No existe un contrato único consumido por escenas y visuales.

## Alcance

- Corregir bug de scope.
- Definir AudioFrame.
- Separar análisis de presentación.
- Noise floor y normalización.
- Transient detector.
- Cleanup idempotente.
- Telemetría sin rerender excesivo.

## Pasos sugeridos

- [ ] Reemplazar la variable inválida.
- [ ] Crear tipo/JSDoc de AudioFrame.
- [ ] Calcular RMS, peak, bandas y estéreo.
- [ ] Agregar noise floor adaptativo con límites.
- [ ] Agregar attack/release configurables.
- [ ] Evitar `setState` por cada muestra salvo UI throttled.
- [ ] Publicar frame en store/service con selector.
- [ ] Agregar guards de NaN/Infinity.
- [ ] Cerrar AudioContext y tracks.
- [ ] Probar con fuente sintética.

## Criterios de aceptación

- [ ] No hay excepciones durante 60 minutos.
- [ ] AudioFrame siempre tiene campos válidos.
- [ ] Silencio converge.
- [ ] Kick produce transient.
- [ ] No hay múltiples AudioContexts activos.
- [ ] Consumidores no conocen detalles de Web Audio.
- [ ] QA-204 a QA-208 pasan.

## Pruebas manuales

- [ ] Oscilador 60 Hz / 1 kHz.
- [ ] Impulsos.
- [ ] Silencio.
- [ ] Track estéreo.
- [ ] Stop/start repetido.
- [ ] Minimizar/restaurar.

## Archivos probables

- `src/renderer/src/hooks/useSystemAudio.js`
- `src/renderer/src/store/audioStore.js`
- `src/renderer/src/audio/AudioFrame.js`
- `src/renderer/src/audio/AudioAnalyzer.js`

## Fuera de alcance

- Clasificación de género avanzada.
- BPM exacto.
- ML.
- Stems.

## Riesgos y notas

- No sobreajustar a un solo equipo.
- Mantener latencia baja.
- Throttling de UI separado del análisis.

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
