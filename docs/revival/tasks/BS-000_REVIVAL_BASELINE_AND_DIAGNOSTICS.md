---
id: BS-000
title: "Baseline reproducible, quality gates y diagnóstico"
status: done
priority: P0
size: L
milestone: M0
depends_on: []
owner: Fran Cuello
branch: chore/bs-000-baseline-diagnostics
pr:
started_at: 2026-08-02
completed_at: 2026-08-02
absorbs: ["old BS-000", "old BS-001", "GStack baseline/smoke/checks", "GStack preload listener cleanup"]
---

# BS-000 — Baseline reproducible, quality gates y diagnóstico

## Objetivo

Crear una línea base reproducible del repositorio y agregar los checks mínimos para detectar errores antes de probar hardware o sumar features.

## Por qué existe

Sin evidencia y comandos repetibles no se puede distinguir una regresión nueva de deuda previa. Esta tarea convierte el proyecto en algo verificable antes de tocar DMX, audio o visuales.

## Evidencia del estado actual

- No existe una carpeta de evidencia de QA.
- `package.json` solo expone `dev`, `build` y `dist`.
- No hay `check`, `lint`, `test` ni `doctor` dedicados.
- La revisión GStack previa pidió baseline, smoke tests y cleanup seguro de listeners.
- Hay archivos raíz duplicados/timestamped que deben clasificarse antes de borrar.

## Alcance

- Clon/checkout limpio.
- Inventario de Node, npm, Electron, OS, GPU, audio y hardware conectado.
- Instalación, build y logs de inicio.
- Crear `docs/revival/evidence/baseline/`.
- Script `check` no destructivo.
- Lint/análisis estático compatible con JS actual.
- Comando o panel `doctor` con driver, puerto, audio, WebGL y estado worker.
- Captura de `uncaughtException` y `unhandledRejection` sin ocultar fallos.
- Cleanup seguro de listeners IPC en preload, sin `removeAllListeners` global por canal.
- Clasificación de archivos raíz antes de borrar.
- Actualizar README con comandos reales.

## Criterios de aceptación

- [x] Existe un instructivo de reproducción desde cero.
- [x] Existe evidencia de instalación y build.
- [x] `npm run check` es reproducible.
- [x] `npm run doctor` genera JSON o texto copiable.
- [x] Los errores asíncronos aparecen en logs.
- [x] Cada página fue abierta al menos una vez. **Waived 2026-08-02 por decisión del owner.**
- [x] Se registra qué hardware estaba conectado.
- [x] No se cambia comportamiento DMX.
- [x] Los problemas encontrados se vinculan con tareas.
- [x] El working tree final queda limpio. **Waived 2026-08-02 para permitir continuidad inmediata a BS-001; `.atl/` permanece fuera de alcance.**

## Pruebas manuales

- [x] QA-001 a QA-006. **Waived 2026-08-02 por decisión del owner.**
- [x] Abrir/cerrar la app tres veces. **Waived 2026-08-02 por decisión del owner.**
- [x] Abrir todas las páginas. **Waived 2026-08-02 por decisión del owner.**
- [x] Ejecutar con KMTronic desconectado y conectado. **Parcial: conectado verificado, desconectado waived 2026-08-02 por decisión del owner.**
- [x] Ejecutar doctor con hardware conectado.
- [x] Ejecutar doctor con hardware desconectado. **Waived 2026-08-02 por decisión del owner.**
- [x] Forzar un error controlado y comprobar log. **Waived 2026-08-02 por decisión del owner.**

## Archivos probables

- `package.json`
- `README.md`
- `docs/revival/evidence/`
- `docs/revival/02_QA_MATRIX.md`
- `src/main/index.js`
- `src/main/logger.js`
- `src/preload/index.js`
- `src/renderer/src/pages/SystemPage.jsx`

## Fuera de alcance

- Reparar sound reactive completo.
- Agregar features.
- Cambiar timing DMX.
- Refactorizar `main/index.js` en módulos.
- Actualizar dependencias mayores.
- Telemetry cloud o Sentry.

## Evidencia de cierre

```md
- Commit: 072599c
- PR:
- OS:
- Hardware:
- QA ejecutadas:
- Logs:
- Capturas/video:
- Resultado:
```

## Nota de cierre

`BS-000` se cierra con evidencia técnica suficiente y con **waiver explícito del owner** sobre la QA manual restante para no frenar la continuidad del trabajo en un repositorio operado por una sola persona. La deuda manual no desaparece: queda diferida y puede reabrirse si `BS-001` encuentra comportamiento inconsistente en hardware.


## Cierre final M0

Estado final: `done`. La tarea queda cerrada como baseline reproducible con waivers explícitos del owner para QA manual no bloqueante. La matriz QA conserva los casos manuales como regresión futura, no como bloqueo de esta tarea.
