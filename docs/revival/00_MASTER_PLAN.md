# BeamStudio — Panorama completo y plan de recuperación

**Repositorio:** `francuello10/beamstudio`  
**Baseline revisado:** `main@d349cf18894dc48b3a3fe72e8b60adb3c3703187`  
**Último cambio relevante del baseline:** 10 de marzo de 2026  
**Fecha de este documento:** 2026-08-01  
**Estado general:** producto experimental funcional por partes, con buena base técnica, documentación optimista y regresiones no verificadas.

---

## 1. Visión del producto

BeamStudio debe convertirse en un motor audiovisual local para una habitación o set personal, capaz de coordinar:

1. iluminación DMX;
2. análisis de audio del sistema;
3. escenas musicales;
4. Ambilight desde pantalla o ventana;
5. visuales WebGL para proyector;
6. projection mapping básico;
7. metadata y control opcional del reproductor.

La visión no requiere que todas las funciones estén dentro de un único “modo inteligente”. El producto debe componerse de proyectos atómicos, conectados mediante contratos simples:

```text
Fuente musical
    │
    ▼
Audio Source Manager
    │
    ▼
Audio DSP → AudioFrame normalizado
    │
    ├── Scene Engine → DMX Output
    ├── Visual Engine → Projector Output
    └── Diagnostics / UI

Fuente de pantalla
    │
    ▼
Ambilight Engine
    │
    └── DMX Output

Metadata del reproductor
    │
    ▼
Now Playing Adapter
    └── UI / presets / registro
```

La prioridad inmediata no es ampliar esta visión. Es recuperar confianza en el código actual.

---

## 2. Objetivo inmediato: “BeamStudio Revival”

El primer milestone debe responder con evidencia a estas preguntas:

- ¿El repositorio instala, compila y ejecuta limpiamente en Ubuntu 24.04?
- ¿El KMTronic transmite de forma estable a las tres barras?
- ¿Los controles manuales respetan direcciones y perfiles?
- ¿Las escenas dinámicas arrancan y se detienen sin excepciones?
- ¿BeamStudio escucha realmente el audio que reproduce Spotify, Tidal o YouTube, y no el micrófono equivocado?
- ¿La reactividad musical responde a kick, energía y estéreo de forma clara?
- ¿Ambilight captura una fuente válida bajo Wayland/PipeWire?
- ¿Fluid Simulation funciona durante una sesión prolongada?
- ¿Cambiar de modo deja un único productor escribiendo DMX?
- ¿Minimizar, restaurar y cerrar la aplicación limpia streams, timers y workers?

Hasta contestar eso, cualquier nueva feature aumenta la incertidumbre.


### 2.1 Revisión GStack absorbida

Antes de este paquete existían dos documentos temporales generados por GStack:

- `TEMP_REVIEW_GSTACK_2026-04-04.md`;
- `TEMP_IMPLEMENTATION_PLAN_GSTACK_AUTOPLAN_2026-04-04.md`.

Sus hallazgos quedan incorporados en Revival, pero su orden de ejecución no queda vigente. GStack proponía empezar por fixes puntuales del hook de audio y cleanup IPC. Revival cambia la prioridad: primero evidencia reproducible, después checks/diagnóstico, después regresión DMX, y recién entonces audio DSP y features.

```text
GStack TEMP docs
    │
    ├── baseline/smoke/checks ───────► BS-000
    ├── preload listener cleanup ─────► BS-000
    ├── CHANNEL_MAP residual ─────────► BS-001
    ├── audio energies bug ───────────► BS-002
    ├── fixture/settings persistence ─► verificar en BS-000/BS-001
    └── main/index.js extraction ─────► post-hardening, slices pequeñas
```

Decisión: `docs/revival/**` es la fuente de verdad. Los `TEMP_*` eran insumos de revisión y pueden eliminarse de la raíz para evitar dos roadmaps compitiendo.

### Definición de terminado de M0

M0 se considera terminado cuando:

1. existe una instalación limpia reproducible;
2. `npm run build` finaliza sin errores;
3. existe un comando de diagnóstico;
4. los tres fixtures pasan una prueba de regresión;
5. el audio del sistema está seleccionado explícitamente;
6. el DSP no produce excepciones ni valores inválidos;
7. hay un único dueño de la salida dinámica;
8. cuatro escenas musicales son predecibles y calibrables;
9. Ambilight pasa una prueba corta y una prueba prolongada;
10. los resultados quedan documentados en `docs/revival/evidence/`.

---

## 3. Hardware actual

### 3.1 Computadora principal

| Componente | Estado |
|---|---|
| CPU | AMD Ryzen 7 3700X |
| GPU | AMD Radeon RX 6700 XT, 12 GB VRAM |
| RAM | 24 GB |
| Sistemas | Ubuntu 24.04 LTS / Wayland y Windows 11 |
| Uso objetivo | Electron, WebGL2, DSP de audio, DMX y proyección |
| Capacidad esperada | Suficiente para DMX + análisis Web Audio + uno o más visuales WebGL razonables |
| No asumir todavía | Difusión generativa en tiempo real, stems en vivo o ROCm como dependencia crítica |

### 3.2 Iluminación

| Elemento | Configuración |
|---|---|
| Interfaz | KMTronic USB DMX basada en FTDI |
| Fixtures | 3 barras LED American Pro / StickTec |
| Modo principal | `P06`, 7 canales |
| Direcciones | `d001`, `d008`, `d015` |
| Mapa P06 | RGB + función + velocidad + flash + dimmer |
| Transporte Windows | FTDI D2XX mediante worker |
| Transporte Linux | `serialport` por `/dev/ttyUSB*` mediante worker |
| Alternativa futura | Art-Net server/provider en otra máquina |

> El diagrama histórico que describe D2XX directo sobre Ubuntu no coincide con el código actual. En Linux el código elige `serialport`; D2XX queda restringido a Windows.

### 3.3 Video y proyección

| Dispositivo | Rol deseado |
|---|---|
| Samsung QLED 55" 4K | Fondos y Ambilight; puede quedar para una etapa posterior |
| Proyector HY300PRO | Primera salida visual externa y projection mapping básico |
| Monitor/es de trabajo | Control de BeamStudio |
| iPhone con cámara/escaneo | Herramienta opcional futura; no es requisito del MVP |

### 3.4 Audio

| Elemento | Rol |
|---|---|
| Thonet & Vander Ratsel 2.1 | Reproducción y referencia de calibración |
| Spotify / Tidal / YouTube | Fuentes de reproducción externas |
| PipeWire | Ruta esperada para obtener un monitor de la salida de audio en Ubuntu |
| Web Audio API | FFT, bandas, estéreo, energía y detección de transientes |

---

## 4. Estado del repositorio

### 4.1 Datos de Git

- Repositorio privado.
- Rama por defecto: `main`.
- Rama adicional detectada: `fran`, histórica.
- Un único PR histórico, ya integrado.
- Último commit del baseline: `d349cf1`, Fixture Profiles V2.
- El desarrollo importante de audio, Ambilight y Fluid se concentró en enero y febrero de 2026.
- No hay evidencia de una rutina sostenida de PRs pequeños y regresión por hardware.

### 4.2 Stack declarado por `package.json`

- Electron 40.
- Electron Vite 5.
- React 19.
- Zustand 5.
- WebGL2 mediante código propio.
- `serialport` 13.
- `ftdi-d2xx` 1.3.
- Google Generative AI SDK.
- Framer Motion.
- Tailwind CSS.

### 4.3 Huecos de ingeniería observados

El `package.json` solo expone scripts de desarrollo, build y distribución. No aparecen scripts dedicados para:

- lint;
- tests;
- typecheck;
- smoke tests;
- diagnóstico de hardware;
- validación del preload/IPC.

También hay una discordancia de versionado:

- paquete: `1.0.0`;
- documentación: “v3.0”;
- motores internos con nombres “v5”, “v6”, “v7”.

Se debe establecer un único esquema de versión de aplicación y tratar las versiones de motores como implementación interna.

---

## 5. Arquitectura actual

### 5.1 Proceso principal

`src/main/index.js` concentra:

- inicialización Electron;
- creación de ventana;
- driver D2XX;
- driver SerialPort;
- workers;
- estado DMX;
- perfiles de fixture;
- escenas dinámicas;
- programas internos;
- flashes;
- Ambilight IPC;
- IA/Gemini;
- configuración;
- telemetría.

Es un archivo de alta criticidad y demasiadas responsabilidades. No conviene dividirlo de inmediato mediante un refactor masivo. Primero debe quedar cubierto por pruebas manuales y contratos.

### 5.2 Preload

`src/preload/index.js` actúa como puente IPC con `contextIsolation: true` y `nodeIntegration: false`. Es una buena frontera, pero cada nueva función debe:

1. agregarse al main;
2. exponerse expresamente en preload;
3. consumirse desde renderer;
4. tener manejo de error y cleanup.

### 5.3 Renderer

`App.jsx` monta una sola página activa:

- Console Mixer;
- Programs;
- Dynamic Scenes;
- Audio;
- Ambilight;
- Fluid Simulation;
- System.

Esto evita que todas las páginas estén montadas simultáneamente, pero no garantiza por sí solo que cada hook cierre streams y loops al desmontarse.

### 5.4 Estado

- `dmxStore`: estado lógico de universo, fixtures y pixel map.
- `audioStore`: telemetría de alta frecuencia, modos y respuestas espectrales.
- `configStore`: configuración y página activa.

`audioStore` recibe actualizaciones frecuentes. Los componentes deben usar selectores mínimos o lecturas imperativas para evitar renders de React a 60 Hz cuando no son necesarios.

### 5.5 Flujo DMX

```text
UI / escena
   │
   ▼
Zustand / IPC
   │
   ▼
Main DMX state (SharedArrayBuffer)
   │
   ├── D2XX worker — Windows
   └── Serial worker — Linux
   │
   ▼
KMTronic → barras
```

### 5.6 Flujo de audio actual

```text
getUserMedia(audio constraints)
   │
   ▼
AudioContext
   ├── analyser Left
   ├── analyser Right
   └── analyser Bass
   │
   ▼
useSystemAudio
   ├── React state
   ├── audioStore
   ├── colores DMX
   └── callbacks
```

El problema fundamental es que `getUserMedia` no selecciona explícitamente una fuente. En Ubuntu, “audio predeterminado” no implica “salida del sistema”. Para Spotify/Tidal debe seleccionarse un monitor de PipeWire/PulseAudio o una ruta virtual equivalente.

---

## 6. Funcionalidades actuales: realidad vs. expectativa

| Subsistema | Existe en código | Estado real | Acción |
|---|---:|---|---|
| Mixer manual DMX | Sí | Reportado como funcional | Regresión obligatoria |
| Perfiles P06/P01/P02 | Sí | Cambio más reciente; no validado integralmente | Probar todos los caminos afectados |
| D2XX Windows | Sí | No es el entorno principal actual | Mantener sin romper |
| Serial Linux | Sí | Ruta principal esperada | Validar puerto, permisos y estabilidad |
| Art-Net | No en runtime local | Diferido para futuro server/provider | No aplica en M0 |
| Programas internos | Sí | No auditados recientemente | Probar |
| Escenas dinámicas | Sí | Riesgo alto de regresión | Reparar primero |
| Sound reactive | Sí | Usuario reporta respuesta floja | Rehacer entrada y calibración |
| Ambilight | Sí | No probado de forma confiable | QA después de audio |
| Fluid Simulation | Sí | Motor WebGL2 existente | Validar y reutilizar |
| IA de escenas | Parcial/oculta | Modelos y documentación antiguos | Congelar |
| Salida a proyector | No dedicada | Solo preview interno | Construir en M1 |
| Projection mapping | No | Pendiente | Construir en M2 |
| Spotify/Tidal metadata | No | Pendiente | M3 |
| Separación de stems | No | Idea futura | Fuera de alcance actual |

---

## 7. Hallazgos críticos de la auditoría

### 7.1 Referencia obsoleta a `CHANNEL_MAP`

Fixture Profiles V2 reemplazó el mapa global por `FIXTURE_PROFILES`, pero `startDynamicScene()` todavía usa una referencia equivalente a:

```js
dmxState.channels[f.startChannel - 1 + CHANNEL_MAP.DIM]
```

El mapa global fue removido del diseño. Esto puede producir `ReferenceError` al iniciar una escena dinámica y es un candidato directo a explicar por qué un modo “que debería andar” no funciona.

**Acción:** buscar todas las referencias restantes y resolver el acceso mediante el perfil de cada fixture.

### 7.2 Estado de escena no asignado

`startDynamicScene(sceneId)` inicia el intervalo, pero el fragmento auditado no muestra una asignación clara de:

```js
dmxState.dynamicScene = sceneId
```

El handler IPC devuelve ese campo, por lo que la respuesta puede informar `null` aunque exista un loop activo.

**Acción:** convertir la transición de estado en una operación atómica y comprobable.

### 7.3 Variable `energies` fuera de alcance

En la ruta central de `useSystemAudio`, se calcula `spatial` y `spectral`, pero luego se invoca la actualización legacy con `energies`, variable declarada en otra rama del flujo.

Efectos posibles:

- excepción en runtime;
- corte del loop de análisis;
- Fluid/Ambilight sin telemetría;
- reactividad aparentemente débil o intermitente.

**Corrección mínima:**

```js
setAudioTelemetryDSP(spatial)
onAudioUpdate?.(spatial)
```

La corrección final debe eliminar duplicación y definir un único `AudioFrame`.

### 7.4 Fuente de audio incorrecta o ambigua

El hook usa `getUserMedia` sin `deviceId`. Eso suele obtener una entrada de captura, no necesariamente el audio que sale por los parlantes.

**Acción:** crear `AudioSourceManager`, enumerar dispositivos y guardar la fuente seleccionada.

En Linux, el loopback de `setDisplayMediaRequestHandler` de Electron no debe asumirse: la documentación oficial indica que el modo string `loopback` está soportado actualmente en Windows. Para Ubuntu se debe trabajar con una fuente monitor disponible por PipeWire/PulseAudio.

### 7.5 Dos propietarios potenciales de escenas

`DynamicScenesPageV2`:

- solicita al main que inicie una escena dinámica;
- también mantiene un loop de renderer;
- al activar audio inicia otro loop de análisis y modificación.

El main conserva su propio intervalo de escena a 44 Hz. Aunque algunas rutas intentan marcar `dynamicRendererActive`, no hay un contrato suficientemente claro que garantice un solo escritor.

**Acción:** unificar el dueño de escenas. El main debe ser adaptador de salida, no un segundo compositor en competencia.

### 7.6 Ambilight con deuda de estado y errores asíncronos

Hallazgos:

- `startAmbilight(id)` es asíncrono y desde la página se llama sin `await`; el `try/catch` local puede no capturar el rechazo.
- `audioBoost` parece un estado residual sin un control efectivo.
- el hook recibe un argumento extra que ya no utiliza;
- existen suscripciones de alta frecuencia que pueden causar renders innecesarios;
- la UI describe “GPU” de forma más ambiciosa que la implementación real de `OffscreenCanvas` 2D + `getImageData`.

### 7.7 IA y modelos desactualizados

El main expone una lista fija de modelos antiguos y la UI de generación está comentada. No debe repararse ahora.

**Decisión:** congelar IA hasta completar M0–M2.

### 7.8 Documentación demasiado optimista

El antiguo audit report calificó el sistema con A-, pero:

- es anterior a varias capas posteriores;
- no contempla las regresiones de Fixture Profiles;
- no demuestra pruebas reales sobre hardware;
- mezcla “implementado” con “validado”.

Los nuevos documentos separan:

- **verificado en código**;
- **reportado por usuario**;
- **validado en hardware**;
- **pendiente**.

---

## 8. Decisiones de arquitectura

### ADR-001 — Audio independiente del proveedor

BeamStudio no debe depender de Spotify o Tidal para obtener la señal.

```text
Spotify / Tidal / YouTube / VLC
               │
               ▼
      salida de audio del SO
               │
               ▼
         monitor PipeWire
               │
               ▼
        AudioSourceManager
```

Metadata y controles serán adaptadores separados.

La Web API de Spotify puede informar playback, pista, progreso y dispositivo, pero su documentación oficial incluye restricciones sobre sincronización con medios visuales. Por eso no debe considerarse la base del motor audiovisual ni incorporarse sin revisar términos para el uso previsto.

### ADR-002 — Un único `AudioFrame`

Contrato propuesto:

```ts
type AudioFrame = {
  timestamp: number
  sourceId: string
  active: boolean
  rms: number
  peak: number
  bass: number
  lowMid: number
  mid: number
  high: number
  transient: number
  stereo: {
    left: number
    center: number
    right: number
    width: number
  }
  spectrum: number[]
}
```

Valores normalizados entre `0` y `1`, salvo `timestamp`.

### ADR-003 — Un único `SceneEngine`

Contrato propuesto:

```ts
type SceneContext = {
  time: number
  delta: number
  audio: AudioFrame
  controls: {
    intensity: number
    speed: number
    sensitivity: number
  }
}

type SceneFrame = {
  fixtures: Array<{
    fixtureId: number
    r: number
    g: number
    b: number
    dim: number
    flash?: number
  }>
  visual?: {
    palette: string
    intensity: number
    speed: number
    parameters: Record<string, number>
  }
}
```

El compositor de escenas debe vivir en renderer/service o worker dedicado, porque luego alimentará tanto DMX como proyector. El main conserva:

- drivers;
- validación;
- transmisión;
- hardware safety;
- persistencia de configuración.

### ADR-004 — Outputs desacoplados

```text
SceneFrame
   ├── DmxOutputAdapter
   └── ProjectorOutputAdapter
```

El proyector no debe recibir frames de video por IPC. Debe renderizar localmente usando estado compacto, audio y parámetros.

### ADR-005 — Refactor incremental

No dividir `src/main/index.js` en una sola tarea. Extraer módulos solamente cuando:

1. el comportamiento actual esté cubierto por una prueba;
2. la extracción tenga alcance acotado;
3. el PR no mezcle reparación funcional y rediseño visual.

---

## 9. Plan de acción

### M0 — Revival

#### BS-000 — Baseline, quality gates y diagnóstico

- instalación limpia;
- build;
- logs;
- inventario;
- snapshot de comportamiento;
- scripts `check`, `lint` y `doctor`;
- captura de errores;
- higiene de archivos;
- cleanup seguro de listeners IPC.

#### BS-001 — Regresión DMX

- reparar Fixture Profiles;
- eliminar `CHANNEL_MAP` residual;
- probar manual;
- probar escenas estáticas/dinámicas;
- probar drivers;
- validar apagado y reconexión;
- verificar persistencia real de fixtures/settings antes de cambiarla.

#### BS-002 — Audio Source Manager y AudioFrame

- enumerar dispositivos;
- elegir monitor de salida;
- persistir selección;
- medidores de diagnóstico;
- reconexión;
- corregir `energies`;
- definir `AudioFrame`;
- normalización;
- silencio;
- cleanup.

#### BS-003 — Scene Engine y Sound Reactive Scenes V2

- eliminar competencia entre main y renderer;
- transiciones de modo;
- lifecycle;
- prioridad de salidas;
- cuatro escenas;
- calibración;
- presets;
- prueba con canciones de referencia.

#### BS-004 — Ambilight QA

- captura Wayland;
- zonas;
- smoothing;
- latencia;
- sesión prolongada;
- errores claros.

### M1 — Projector Visuals

#### BS-005 — Projector Output y Visual Library MVP

- detectar displays;
- ventana fullscreen;
- selector;
- blackout;
- patrón de test;
- reconexión;
- Fluid;
- partículas;
- túnel;
- kaleidoscopio;
- audio reactivo mediante `AudioFrame`.

### M2 — Projection Mapping

#### BS-006 — Mapping básico

- grid;
- quad warp;
- máscaras;
- superficies;
- presets.

### M3 — Integraciones

#### BS-007 — Now Playing

Prioridad técnica:

1. MPRIS/DBus o `playerctl` en Ubuntu para metadata provider-neutral;
2. adaptador Spotify opcional;
3. spike Tidal;
4. controles opcionales;
5. revisión de políticas antes de distribuir.

---

## 10. Backlog explícitamente postergado

No incluir en M0:

- Ollama;
- Llama/Mistral;
- ComfyUI;
- StreamDiffusion;
- SDXL;
- HTDemucs en tiempo real;
- Whisper;
- escaneo 3D;
- salida TV 4K independiente;
- multi-proyector;
- sincronización de red;
- nueva UI completa;
- migración a TypeScript total;
- nuevos fixtures;
- marketplace de escenas.

Estos temas pueden ser valiosos, pero ahora desvían del problema: el sound reactive es flojo y no existe una línea base confiable.

---

## 11. Estrategia de pruebas

Cada tarea debe producir:

- comandos ejecutados;
- log;
- captura o video cuando corresponda;
- hardware conectado;
- sistema operativo;
- resultado esperado;
- resultado real;
- regresiones encontradas;
- commit/PR.

### Canciones de referencia

Mantener una playlist local o autorizada con al menos:

1. track con kick electrónico claro;
2. track rock con batería y guitarras;
3. track con bajo sostenido;
4. track estéreo amplio;
5. track suave;
6. silencio;
7. ruido o voz.

No codificar presets alrededor de una sola canción.

### Pruebas prolongadas

- 15 minutos para smoke de hardware.
- 60 minutos para soak de audio/DMX/Ambilight.
- minimizar y restaurar durante la prueba;
- cambiar de página;
- detener e iniciar;
- desconectar y reconectar cuando sea seguro.

---

## 12. Métricas mínimas

### Audio

- fuente seleccionada;
- sample rate;
- estado del stream;
- RMS;
- peak;
- bass/mid/high;
- transient;
- clip count;
- frames procesados;
- tiempo desde último frame.

### DMX

- driver;
- dispositivo;
- estado worker;
- Hz objetivo;
- Hz observado;
- último error;
- fixture count;
- último envío.

### Visual

- display;
- resolución;
- FPS;
- WebGL context;
- context lost count;
- último frame.

---

## 13. Criterios de producto para sound reactive

“Se mueve con la música” no es suficiente. Una escena musical se considera buena cuando:

- el kick tiene una respuesta visual reconocible;
- el silencio no genera movimiento falso;
- las secciones suaves bajan intensidad;
- un aumento de energía aumenta la escena de forma progresiva;
- no parpadea por ruido;
- la izquierda y derecha responden cuando la mezcla lo justifica;
- la sensibilidad se calibra sin tocar código;
- la escena conserva identidad visual;
- el dimmer maestro sigue teniendo autoridad;
- la salida no se queda trabada después de detenerla.

---

## 14. Resultado esperado del roadmap

Al cerrar M0:

> BeamStudio será nuevamente una consola confiable: control manual, escenas, audio del sistema, sound reactive y Ambilight comprobados.

Al cerrar M1:

> BeamStudio podrá lanzar visuales fullscreen al HY300PRO usando la misma señal musical.

Al cerrar M2:

> Los visuales podrán adaptarse a superficies de la habitación mediante mapping básico.

Al cerrar M3:

> La interfaz podrá conocer qué se reproduce, sin acoplar el DSP a Spotify o Tidal.

---

## 15. Referencias técnicas externas

- Electron `desktopCapturer`: https://www.electronjs.org/docs/latest/api/desktop-capturer
- Electron `session.setDisplayMediaRequestHandler`: https://www.electronjs.org/docs/latest/api/session
- Spotify playback state: https://developer.spotify.com/documentation/web-api/reference/get-information-about-the-users-current-playback
- Spotify Web Playback SDK: https://developer.spotify.com/documentation/web-playback-sdk/reference

Estas referencias deben revisarse de nuevo al implementar la tarea correspondiente.
