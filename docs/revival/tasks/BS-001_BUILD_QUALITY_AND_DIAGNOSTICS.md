---
id: BS-001
title: "Quality gates mínimos y modo diagnóstico"
status: proposed
priority: P0
size: M
milestone: M0
depends_on: ["BS-000"]
owner:
branch:
pr:
---

# BS-001 — Quality gates mínimos y modo diagnóstico

## Objetivo

Agregar controles mínimos para detectar errores antes de probar hardware y exponer un panel/resultado de diagnóstico útil.

## Por qué existe

El repo solo ofrece scripts de dev/build/dist. La aplicación necesita checks repetibles y visibilidad de drivers, streams y loops.

## Evidencia del estado actual

- No hay scripts de lint/test/check dedicados en `package.json`.
- Existe logger, pero no un resumen de salud.
- El audit histórico ya no cubre el código actual.
- Hay archivos de configuración timestamped y logs en raíz que deben clasificarse.

## Alcance

- Script `check` no destructivo.
- Lint básico o análisis estático compatible con JS actual.
- Comando/panel `doctor`.
- Información de driver, puerto, audio y WebGL.
- Manejo global de errores/rechazos.
- Política de logs.

## Pasos sugeridos

- [ ] Definir scripts `check`, `lint` y `doctor`.
- [ ] Agregar captura de `uncaughtException` y `unhandledRejection` sin ocultar fallos.
- [ ] Reportar plataforma, versión, driver, puerto y estado worker.
- [ ] Reportar dispositivos de audio disponibles.
- [ ] Reportar WebGL vendor/renderer de forma opcional.
- [ ] Clasificar archivos raíz duplicados antes de borrar.
- [ ] Actualizar README con comandos reales.

## Criterios de aceptación

- [ ] `npm run check` es reproducible.
- [ ] `npm run doctor` genera JSON o texto copiable.
- [ ] Los errores asíncronos aparecen en log.
- [ ] No se filtran tokens o secretos.
- [ ] Build sigue pasando.
- [ ] No se cambia comportamiento DMX.

## Pruebas manuales

- [ ] Ejecutar doctor con hardware conectado y desconectado.
- [ ] Forzar un error controlado y comprobar log.
- [ ] QA-002, QA-003, QA-004.

## Archivos probables

- `package.json`
- `src/main/index.js`
- `src/main/logger.js`
- `src/preload/index.js`
- `src/renderer/src/pages/SystemPage.jsx`

## Fuera de alcance

- Refactor del main.
- Telemetry cloud.
- Sentry.

## Riesgos y notas

- ESLint puede descubrir deuda amplia; no convertir esta tarea en limpieza total.
- El diagnóstico debe funcionar aunque falte hardware.

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
