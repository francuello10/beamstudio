---
id: BS-006
title: "Projection mapping básico con superficies y presets"
status: in-progress
priority: P1
size: XL
milestone: M2
depends_on: ["BS-005"]
owner: Fran Cuello
branch: main
pr:
started_at: 2026-08-02
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
- Primer slice activo en `main`: compositor de quad-warp visual-agnóstico.
  `src/renderer/src/output/ProjectorApp.jsx` ahora renderiza el visual activo
  (`FluidNeonVisual`/`ParticleFieldVisual`) dentro de un contenedor
  `visibility: hidden` y lo pasa como fuente de textura a un nuevo
  `src/renderer/src/mapping/MappingCompositor.jsx`, que es el único
  `<canvas>` realmente visible en pantalla. El compositor sube cada frame el
  canvas del visual activo como textura WebGL2 (`gl.texImage2D` directo sobre
  el `HTMLCanvasElement` vivo) y dibuja un quad warpeado con la proyección de
  Heckbert (unit-square → quad), sin importar en ningún momento un hook o
  detalle interno de un visual específico — solo recibe un
  `HTMLCanvasElement` a través de `visualCanvasRef`.
  `FluidNeonVisual.jsx`/`ParticleFieldVisual.jsx` se envolvieron en
  `React.forwardRef` (cambio mínimo, no tocan `useFluidSimulation.js` ni
  `useParticleField.js`) para exponer su `<canvas>` hacia afuera.
  La superficie por defecto (passthrough, esquinas en `{0,0}/{1,0}/{1,1}/{0,1}`)
  se verificó a mano: cae en la rama afín de Heckbert (`dx3=dy3=0`), con
  `W=1` en las 4 esquinas — sin término de perspectiva, idéntico a "sin
  mapping". Nuevo IPC `mapping:setEditMode` / `mapping:editModeChanged`
  (mismo patrón exacto que `projector:setBlackout`/`onBlackout`) permite
  activar un modo edición desde `ProjectorPage.jsx` (botón "EDIT MAPPING")
  que muestra 4 handles arrastrables (pointer events + `setPointerCapture`)
  sobre las esquinas de la superficie; en modo show no se renderiza ningún
  handle. Blackout y test pattern se preservaron en el mismo orden de DOM
  (sin z-index explícito) para seguir pintando por encima del compositor y
  de los handles de edición. Superficie modelada como un objeto único
  `{ id, corners }` en estado local de `MappingCompositor.jsx` (sin
  persistencia todavía) para que la fase 2 pueda extenderlo a un arreglo de
  superficies sin reescritura.

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

- [x] Se puede crear una superficie quad.
- [x] Las cuatro esquinas son editables.
- [ ] El preset persiste.
- [x] El modo show no muestra controles.
- [x] Mapping no está acoplado a un visual específico.
- [x] Blackout sigue disponible.

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
