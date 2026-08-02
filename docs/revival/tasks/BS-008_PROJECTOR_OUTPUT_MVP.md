---
id: BS-008
title: "Salida fullscreen independiente para proyector"
status: proposed
priority: P1
size: L
milestone: M1
depends_on: ["BS-006"]
owner:
branch:
pr:
---

# BS-008 — Salida fullscreen independiente para proyector

## Objetivo

Abrir una ventana de output sin UI en el HY300PRO y controlarla desde BeamStudio.

## Por qué existe

Antes de mapping se necesita una salida visual robusta, seleccionable y recuperable.

## Evidencia del estado actual

- La aplicación solo crea una BrowserWindow principal.
- Fluid existe dentro de la UI.
- No hay OutputManager ni selector de display.

## Alcance

- Enumeración de displays.
- ProjectorWindow.
- Fullscreen.
- Blackout.
- Patrón de calibración.
- Estado y reconexión.
- Renderer por rol.

## Pasos sugeridos

- [ ] Crear OutputManager en main.
- [ ] Exponer displays por preload.
- [ ] Crear rol `projector` por query/hash.
- [ ] Abrir ventana en bounds elegidos.
- [ ] Ocultar cursor y UI.
- [ ] Agregar fullscreen/blackout/close.
- [ ] Agregar patrón grid.
- [ ] Manejar display removed.
- [ ] Guardar display preferido.

## Criterios de aceptación

- [ ] HY300PRO aparece en selector.
- [ ] Output abre en display correcto.
- [ ] No muestra sidebar/header.
- [ ] Blackout es inmediato.
- [ ] Cerrar output no cierra controller.
- [ ] QA-601 a QA-604 pasan.

## Pruebas manuales

- [ ] Abrir/cerrar x10.
- [ ] Cambiar fullscreen.
- [ ] Desconectar/reconectar.
- [ ] Controller minimizado.
- [ ] Grid.

## Archivos probables

- `src/main/outputs/ProjectorWindowManager.js`
- `src/main/index.js`
- `src/preload/index.js`
- `src/renderer/src/outputs/OutputApp.jsx`
- `src/renderer/src/pages/SystemPage.jsx`

## Fuera de alcance

- Projection mapping.
- TV dual output.
- Multi-proyector.

## Riesgos y notas

- Wayland positioning puede depender del compositor.
- No mandar video por IPC.
- Persistir IDs con fallback.

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
