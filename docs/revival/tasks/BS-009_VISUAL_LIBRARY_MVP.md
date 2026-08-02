---
id: BS-009
title: "Biblioteca inicial de visuales para proyector"
status: proposed
priority: P1
size: L
milestone: M1
depends_on: ["BS-008"]
owner:
branch:
pr:
---

# BS-009 — Biblioteca inicial de visuales para proyector

## Objetivo

Entregar un set pequeño de visuales atractivos que consuman AudioFrame y funcionen en el proyector.

## Por qué existe

El valor inmediato para la habitación está en visuales buenos, no en una infraestructura de mapping compleja.

## Evidencia del estado actual

- Fluid Simulation ya existe.
- No existe renderer de output.
- AudioFrame y SceneEngine deben estar disponibles.

## Alcance

- Fluid Neon.
- Particle Field.
- Tunnel/Grid.
- Kaleidoscope/Waves.
- Presets.
- Resolución adaptativa.
- FPS y fallback.

## Pasos sugeridos

- [ ] Adaptar Fluid al OutputApp.
- [ ] Crear interfaz común VisualModule.
- [ ] Implementar tres visuales adicionales.
- [ ] Mapear AudioFrame a parámetros.
- [ ] Agregar intensity/speed/palette.
- [ ] Agregar calidad Low/Medium/High.
- [ ] Gestionar WebGL context lost.
- [ ] Soak test.

## Criterios de aceptación

- [ ] Cuatro visuales disponibles.
- [ ] Todos funcionan con audio OFF y ON.
- [ ] No dependen de React render a 60 Hz.
- [ ] FPS visible.
- [ ] Blackout funciona.
- [ ] 60 minutos sin crash.

## Pruebas manuales

- [ ] Cada visual 10 minutos.
- [ ] Cambio rápido.
- [ ] Audio suave/intenso.
- [ ] Quality modes.
- [ ] Context loss simulado si es posible.

## Archivos probables

- `src/renderer/src/visuals/`
- `src/renderer/src/outputs/OutputApp.jsx`
- `src/renderer/src/hooks/useFluidSimulation.js`

## Fuera de alcance

- IA generativa.
- Video files.
- Shader editor público.

## Riesgos y notas

- HY300PRO tiene resolución/luminosidad limitadas.
- Priorizar contraste y formas legibles.
- Evitar blancos constantes.

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
