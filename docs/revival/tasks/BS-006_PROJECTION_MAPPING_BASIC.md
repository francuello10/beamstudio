---
id: BS-006
title: "Projection mapping básico con superficies y presets"
status: proposed
priority: P1
size: XL
milestone: M2
depends_on: ["BS-005"]
owner:
branch:
pr:
absorbs: ["old BS-010"]
---

# BS-006 — Projection mapping básico con superficies y presets

## Objetivo

Mapear visuales a una o varias superficies mediante calibración 2D.

## Por qué existe

El MVP de habitación no requiere escaneo 3D. Un editor 2D robusto aporta más valor con menos complejidad.

## Evidencia del estado actual

- No existe mapping actual.
- El proyector será fijo o semiestable.
- La salida fullscreen ya debe existir.

## Alcance

- Grid.
- Quad warp.
- Máscaras poligonales.
- Feather básico.
- Múltiples superficies.
- Presets por habitación.
- Modo edición vs modo show.
- Guardado/carga.

## Criterios de aceptación

- [ ] Se puede crear una superficie quad.
- [ ] Las cuatro esquinas son editables.
- [ ] El preset persiste.
- [ ] El modo show no muestra controles.
- [ ] Mapping no está acoplado a un visual específico.
- [ ] Blackout sigue disponible.

## Pruebas manuales

- [ ] Calibrar una pared rectangular.
- [ ] Calibrar una superficie no rectangular.
- [ ] Guardar, cerrar y restaurar.
- [ ] Probar dos visuales.
- [ ] Probar blackout durante mapping.

## Archivos probables

- `src/renderer/src/mapping/`
- `src/renderer/src/output/`
- `src/renderer/src/store/`

## Fuera de alcance

- 3D mapping con Blender.
- Splash embebido.
- LiDAR/camera calibration.
- Edge blending avanzado.
- Más de un proyector.
