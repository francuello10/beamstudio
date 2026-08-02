# Estado actual y arquitectura auditada

**Baseline:** `d349cf18894dc48b3a3fe72e8b60adb3c3703187`  
**Regla:** este documento describe lo observado en código y lo reportado por el usuario; no afirma que una función esté validada en hardware salvo que exista evidencia.

## 1. Mapa de procesos

```text
┌────────────────────────────────────────────────────────────┐
│ Electron Main                                              │
│ BrowserWindow · IPC · DMX state · profiles · drivers       │
│ dynamic scenes · programs · Ambilight handlers · Gemini    │
└──────────────┬─────────────────────────────────────────────┘
               │ contextBridge / IPC
┌──────────────▼─────────────────────────────────────────────┐
│ Renderer                                                   │
│ React pages · Zustand · Web Audio · WebGL2 · screen capture│
└──────────────┬─────────────────────────────────────────────┘
               │
               ├── D2XX Worker (Windows)
               ├── Serial Worker (Linux)
               └── Art-Net
```

## 2. Componentes principales

| Ruta | Responsabilidad | Riesgo |
|---|---|---|
| `src/main/index.js` | Orquestación general | Monolito y múltiples loops |
| `src/main/dmxWorker.js` | D2XX | Hardware crítico |
| `src/main/serialWorker.js` | Serial Linux | Hardware crítico |
| `src/preload/index.js` | API segura al renderer | Debe mantenerse sincronizado |
| `src/renderer/src/App.jsx` | Navegación y lifecycle de páginas | Cleanup al cambiar de modo |
| `hooks/useSystemAudio.js` | Captura y DSP | Bug de scope, fuente ambigua |
| `hooks/useGpuAmbilight.js` | Captura y 3 zonas | Wayland, async, estado residual |
| `hooks/useFluidSimulation.js` | WebGL2 Fluid | Performance y context loss |
| `pages/DynamicScenesPageV2.jsx` | Selección y reactividad | Doble propietario |
| `store/audioStore.js` | Telemetría | 60 Hz y renders |
| `store/dmxStore.js` | Estado lógico de salida | Sincronía con main |
| `services/DmxScheduler.js` | Envío desacoplado | Verificar uso real |
| `services/geminiService.js` | IA | Congelado |
| `utils/aiRuntime.js` | Compilación de escenas IA | Seguridad y robustez |


## 2.1 Hallazgos heredados de GStack

La revisión GStack previa fue absorbida como evidencia histórica. Los hallazgos técnicos que siguen vigentes se tratan así:

| Hallazgo | Estado actual | Tarea dueña |
|---|---|---|
| `CHANNEL_MAP` residual en `startDynamicScene()` | Riesgo DMX real, validado por código | `BS-001` |
| `energies` fuera de scope en `useSystemAudio()` | Riesgo de runtime en audio DSP | `BS-002` |
| `removeAllListeners` en cleanup de preload | Puede cortar listeners de otros consumidores | `BS-000` |
| Falta de scripts `test`/`lint`/`check` | El repo solo expone `dev`, `build`, `dist` | `BS-000` |
| Persistencia de fixtures/settings | Debe verificarse contra el código actual antes de cambiar | `BS-000`, `BS-001` |
| Extracción de módulos desde `main/index.js` | Deseable, pero peligrosa antes de evidencia | Post-M0 o slices chicas luego de checks |

Esto evita duplicar planes: GStack queda como origen de hallazgos, Revival queda como plan operativo.

## 3. Estado por módulo

### 3.1 DMX core

**Verificado en código**

- SharedArrayBuffer para universo.
- drivers separados por plataforma;
- worker para D2XX;
- worker para serial;
- fallback Art-Net;
- perfiles P06/P01/P02;
- fixture patch persistente en userData;
- dimmer, RGB, flash y macros;
- telemetría de Hz;
- `backgroundThrottling: false`.

**Pendiente de hardware**

- estabilidad real con Ubuntu actual;
- permisos `/dev/ttyUSB0`;
- reconexión;
- coexistencia con otras apps;
- comportamiento al cerrar;
- perfiles después de último refactor.

### 3.2 Dynamic Scenes

**Verificado en código**

- escenas en main;
- escenas/utilidades en renderer;
- intervalo 44 Hz en main;
- `requestAnimationFrame` en renderer;
- modo audio reactivo;
- estado `dynamicRendererActive`.

**Riesgos**

- `CHANNEL_MAP` residual;
- escena activa posiblemente no reflejada en `dmxState`;
- dos compositores;
- reset agresivo al detener;
- dependencia del dimmer;
- no hay test de exclusión mutua.

### 3.3 Audio

**Verificado en código**

- Web Audio API;
- split estéreo;
- analizadores L/R/Bass;
- bandas espectrales;
- smoothing;
- detector de género heurístico;
- Zustand;
- modos OFF/STEREO/EQ.

**Riesgos**

- fuente predeterminada no equivale a audio del sistema;
- `energies` fuera de scope;
- state updates frecuentes;
- heurísticas con nombres de versión pero sin benchmark;
- calibración acoplada a un equipo;
- género no es prioridad para una reacción sólida;
- falta noise floor adaptativo;
- falta diagnóstico de clipping y silencio.

### 3.4 Ambilight

**Verificado en código**

- enumeración de screen/window;
- captura de desktop;
- OffscreenCanvas 3x1;
- zonas L/C/R;
- smoothing;
- audio modulation;
- envío de colores.

**Riesgos**

- PipeWire devuelve una sola fuente;
- promesas no esperadas;
- mensajes de error genéricos;
- claims de GPU no medidos;
- estado residual;
- no hay calibración de orden físico de fixtures;
- ausencia de black-bar detection en el código actual, aunque commits antiguos lo mencionen.

### 3.5 Fluid Simulation

**Verificado en código**

- WebGL2;
- shaders propios;
- Navier–Stokes;
- presets;
- paletas;
- HDR/bloom;
- audio store;
- canvas interno.

**Pendiente**

- salida externa;
- resolución adaptativa;
- recuperación de WebGL context;
- profiling;
- prueba prolongada;
- contrato estable con AudioFrame.

### 3.6 IA

**Estado**

- SDK instalado;
- handlers IPC;
- lista fija de modelos antiguos;
- UI principal comentada;
- no es parte del camino crítico.

**Decisión**

Congelada hasta M3 o posterior.

## 4. Inconsistencias documentales

| Tema | Documento/claim | Código observado |
|---|---|---|
| D2XX Linux | “D2XX directo” | Linux selecciona SerialPort |
| GPU Ambilight | “GPU accelerated” | downsample 2D + lectura CPU |
| Production ready | release v1.0 | funciones principales sin regresión |
| v3.0 | documentación | package 1.0.0 |
| Gemini 2.0 Flash | documentación | modelo obsoleto/hardcoded |
| audio loopback | commits históricos | hook actual usa entrada por defecto |

## 5. Riesgos de lifecycle

Revisar explícitamente:

- `setInterval`;
- `setTimeout`;
- `requestAnimationFrame`;
- `MediaStreamTrack`;
- `AudioContext`;
- worker threads;
- listeners IPC;
- WebGL resources.

Cada `start()` debe tener un `stop()` idempotente. Cada desmontaje debe invocar cleanup. Ningún modo debe sobrevivir accidentalmente al cambiar de página.

## 6. Arquitectura objetivo incremental

```text
src/
├── main/
│   ├── index.js
│   ├── dmx/
│   │   ├── DmxOutputService.js
│   │   ├── FixtureProfiles.js
│   │   └── drivers/
│   ├── outputs/
│   │   └── ProjectorWindowManager.js
│   └── ipc/
├── preload/
└── renderer/src/
    ├── audio/
    │   ├── AudioSourceManager.js
    │   ├── AudioAnalyzer.js
    │   └── AudioFrame.js
    ├── scenes/
    │   ├── SceneEngine.js
    │   ├── SceneRegistry.js
    │   └── presets/
    ├── visuals/
    ├── mapping/
    └── diagnostics/
```

Esta estructura es objetivo, no requisito de un solo PR.
