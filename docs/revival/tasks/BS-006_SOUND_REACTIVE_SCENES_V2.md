---
id: BS-006
title: "Escenas musicales V2 y calibración"
status: proposed
priority: P0
size: L
milestone: M0
depends_on: ["BS-005"]
owner:
branch:
pr:
---

# BS-006 — Escenas musicales V2 y calibración

## Objetivo

Entregar cuatro escenas que reaccionen musicalmente de forma clara, controlable y agradable.

## Por qué existe

El usuario reporta que sound reactive es flojo. El objetivo no es sumar más presets, sino hacer pocos modos realmente confiables.

## Evidencia del estado actual

- Las escenas actuales mezclan género, colores y audio con heurísticas difíciles de probar.
- La sensibilidad se aplica de forma inconsistente.
- No hay playlist de referencia ni criterios de producto.

## Alcance

- Bass Pulse.
- Stereo Flow.
- Techno Chase.
- Ambient Drift.
- Controles de sensibilidad, attack, release e intensidad.
- Presets Soft/Balanced/Punchy.
- Panel de debug.

## Pasos sugeridos

- [ ] Implementar Bass Pulse con bass + transient.
- [ ] Implementar Stereo Flow con L/R y mids/highs.
- [ ] Implementar Techno Chase con onset y cooldown.
- [ ] Implementar Ambient Drift con RMS y paleta.
- [ ] Agregar floor/ceiling y limiter visual.
- [ ] Agregar presets.
- [ ] Crear playlist/lista de señales de referencia.
- [ ] Registrar parámetros finales.
- [ ] Eliminar o marcar escenas legacy no validadas.

## Criterios de aceptación

- [ ] Las cuatro escenas cumplen criterios de producto.
- [ ] Silencio no produce flashes.
- [ ] Sensibilidad se modifica sin código.
- [ ] No hay clipping permanente.
- [ ] Escenas mantienen identidad.
- [ ] QA-301 a QA-308 pasan.
- [ ] Existe video corto de cada escena.

## Pruebas manuales

- [ ] Kick electrónico.
- [ ] Rock.
- [ ] Track suave.
- [ ] Estéreo amplio.
- [ ] Silencio.
- [ ] 60 minutos alternando escenas.

## Archivos probables

- `src/renderer/src/scenes/`
- `src/renderer/src/pages/DynamicScenesPageV2.jsx`
- `src/renderer/src/store/audioStore.js`
- `src/renderer/src/utils/palettes.js`

## Fuera de alcance

- Detector de género ML.
- BPM grid.
- Stems.
- IA generativa.

## Riesgos y notas

- Evitar strobo agresivo por defecto.
- Añadir límites y aviso si existe flash rápido.
- No calibrar solo por percepción visual.

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
