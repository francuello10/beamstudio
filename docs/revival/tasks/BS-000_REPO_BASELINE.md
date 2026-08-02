---
id: BS-000
title: "Baseline reproducible y fotografía del repositorio"
status: proposed
priority: P0
size: M
milestone: M0
depends_on: []
owner:
branch:
pr:
---

# BS-000 — Baseline reproducible y fotografía del repositorio

## Objetivo

Crear una línea base reproducible del repo, del entorno y del comportamiento actual sin intentar arreglar todo en el mismo cambio.

## Por qué existe

Sin una fotografía confiable no se puede distinguir una regresión nueva de un problema previo. Esta tarea transforma afirmaciones históricas en evidencia.

## Evidencia del estado actual

- `main` apunta al commit `d349cf18894d` al momento de la auditoría.
- El último desarrollo relevante tiene varios meses.
- Solo se detectaron dos ramas y un PR histórico.
- No existe una carpeta de evidencia de QA.

## Alcance

- Clon/checkout limpio.
- Inventario de Node, npm, Electron, OS, GPU y audio.
- Instalación y build.
- Captura de logs de inicio.
- Inventario de funciones visibles.
- Registro de qué funciona, falla o no puede probarse.

## Pasos sugeridos

- [ ] Crear rama `chore/bs-000-revival-baseline`.
- [ ] Guardar salida de `git status`, `git log -1`, `node -v`, `npm -v`.
- [ ] Ejecutar `npm ci` desde entorno limpio.
- [ ] Ejecutar build y desarrollo.
- [ ] Crear `docs/revival/evidence/baseline/`.
- [ ] Registrar errores de consola/main.
- [ ] No aplicar fixes funcionales salvo que impidan capturar la línea base; documentarlos.

## Criterios de aceptación

- [ ] Existe un instructivo de reproducción desde cero.
- [ ] Existe evidencia del build.
- [ ] Cada página fue abierta al menos una vez.
- [ ] Se registra qué hardware estaba conectado.
- [ ] El working tree final está limpio.
- [ ] Los problemas encontrados se vinculan con tareas.

## Pruebas manuales

- [ ] QA-001 a QA-006.
- [ ] Abrir/cerrar la app tres veces.
- [ ] Abrir todas las páginas.
- [ ] Ejecutar con KMTronic desconectado y conectado.

## Archivos probables

- `package.json`
- `README.md`
- `docs/revival/evidence/`
- `docs/revival/02_QA_MATRIX.md`

## Fuera de alcance

- Reparar sound reactive.
- Agregar features.
- Actualizar dependencias mayores.

## Riesgos y notas

- Dependencias nativas pueden requerir rebuild.
- Wayland y permisos pueden modificar el resultado.
- No confundir warning con fallo.

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
