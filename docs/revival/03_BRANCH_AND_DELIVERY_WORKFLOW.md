# Flujo de ramas, commits y entrega

## 1. Principio

Una tarea atómica por rama. No mezclar:

- reparación DMX;
- rediseño de UI;
- cambio de audio;
- projection mapping;
- actualización de dependencias.

## 2. Rama inicial

Crear desde `main` actualizado:

```bash
git switch main
git pull --ff-only
git switch -c chore/bs-000-baseline-diagnostics
```

Cerrar BS-000 antes de abrir ramas de hardware o features; cerrar BS-001 antes de tocar escenas, audio-reactividad o visuales.

## 3. Convención de ramas

```text
chore/bs-000-baseline-diagnostics
fix/bs-001-dmx-regression
feat/bs-002-audioframe
refactor/bs-003-scene-engine
fix/bs-004-ambilight-qa
feat/bs-005-projector-visuals
feat/bs-006-projection-mapping
feat/bs-007-now-playing
```

## 4. Commits

Formato:

```text
<type>(<scope>): <descripción>
```

Ejemplos:

```text
fix(dmx): remove stale CHANNEL_MAP usage
feat(audio): add explicit system monitor selection
refactor(scenes): enforce single scene output owner
test(qa): document USB regression evidence
```

## 5. Checklist de PR

- [ ] Alcance coincide con una tarea.
- [ ] No incluye archivos incidentales.
- [ ] `npm ci` o instalación existente validada.
- [ ] Build pasa.
- [ ] Pruebas manuales asociadas pasan.
- [ ] No se agregan timers sin cleanup.
- [ ] No se agregan APIs IPC sin preload.
- [ ] Se actualiza documentación.
- [ ] Se adjunta evidencia.
- [ ] Se documentan riesgos pendientes.

## 6. Protección de main

Recomendado:

- PR obligatorio;
- squash merge;
- branch actualizada;
- checks de build;
- no push directo;
- no force push;
- tag solo después de milestone.

## 7. Versionado

Propuesta:

- `0.2.0-revival`: M0;
- `0.3.0-projector`: M1;
- `0.4.0-mapping`: M2;
- `0.5.0-integrations`: M3;
- `1.0.0`: reservar para una versión validada y documentada.

El package actual ya dice 1.0.0; corregirlo requiere una decisión explícita, no un cambio accidental.
