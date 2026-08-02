---
id: BS-000
title: "Baseline reproducible, quality gates y diagnóstico"
status: proposed
priority: P0
size: L
milestone: M0
depends_on: []
owner:
branch:
pr:
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

- [ ] Existe un instructivo de reproducción desde cero.
- [ ] Existe evidencia de instalación y build.
- [ ] `npm run check` es reproducible.
- [ ] `npm run doctor` genera JSON o texto copiable.
- [ ] Los errores asíncronos aparecen en logs.
- [ ] Cada página fue abierta al menos una vez.
- [ ] Se registra qué hardware estaba conectado.
- [ ] No se cambia comportamiento DMX.
- [ ] Los problemas encontrados se vinculan con tareas.
- [ ] El working tree final queda limpio.

## Pruebas manuales

- [ ] QA-001 a QA-006.
- [ ] Abrir/cerrar la app tres veces.
- [ ] Abrir todas las páginas.
- [ ] Ejecutar con KMTronic desconectado y conectado.
- [ ] Ejecutar doctor con hardware conectado y desconectado.
- [ ] Forzar un error controlado y comprobar log.

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
- Commit:
- PR:
- OS:
- Hardware:
- QA ejecutadas:
- Logs:
- Capturas/video:
- Resultado:
```
