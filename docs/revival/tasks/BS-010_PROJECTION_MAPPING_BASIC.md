---
id: BS-010
title: "Projection mapping básico con superficies y presets"
status: proposed
priority: P1
size: XL
milestone: M2
depends_on: ["BS-009"]
owner:
branch:
pr:
---

# BS-010 — Projection mapping básico con superficies y presets

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
- Feather.
- Múltiples superficies.
- Presets.
- Modo edición y modo show.

## Pasos sugeridos

- [ ] Definir modelo MappingPreset.
- [ ] Crear editor de cuatro esquinas.
- [ ] Aplicar homografía/mesh warp.
- [ ] Agregar máscara.
- [ ] Agregar superficies.
- [ ] Guardar presets por display/resolución.
- [ ] Agregar reset y backup.
- [ ] Probar reescalado.
- [ ] Documentar calibración física.

## Criterios de aceptación

- [ ] Una superficie rectangular se calibra.
- [ ] El contenido no sale de la máscara.
- [ ] Preset persiste.
- [ ] Modo show oculta handles.
- [ ] Blackout conserva prioridad.
- [ ] No se requiere escaneo 3D.

## Pruebas manuales

- [ ] Pared.
- [ ] Cuadro/puerta.
- [ ] Dos superficies.
- [ ] Reinicio.
- [ ] Cambio de resolución.

## Archivos probables

- `src/renderer/src/mapping/`
- `src/renderer/src/outputs/MappingOutput.jsx`
- `src/renderer/src/store/mappingStore.js`

## Fuera de alcance

- Calibración automática.
- LiDAR.
- 3D mesh.
- Edge blending multi-proyector.

## Riesgos y notas

- Homografía y WebGL coordinates requieren tests.
- Presets deben versionarse.
- No acoplar mapping a un visual.

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
