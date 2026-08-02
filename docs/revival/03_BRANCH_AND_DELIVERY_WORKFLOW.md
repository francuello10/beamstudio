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
git switch -c chore/revival-baseline
```

Cerrar BS-000 y BS-001 antes de abrir ramas de features.

## 3. Convención de ramas

```text
chore/bs-000-revival-baseline
chore/bs-001-quality-diagnostics
fix/bs-002-dmx-regression
feat/bs-003-audio-source-manager
fix/bs-004-audio-dsp
refactor/bs-005-scene-engine
feat/bs-006-sound-scenes-v2
fix/bs-007-ambilight-qa
feat/bs-008-projector-output
feat/bs-009-visual-library
feat/bs-010-projection-mapping
feat/bs-011-now-playing
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
