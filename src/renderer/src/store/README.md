# BeamStudio Store Architecture

This directory follows an **Atomic State Architecture** designed for ultra-low latency DMX control and high-bandwidth telemetry.

## Stores

### [dmxStore.js](file:///home/fran/projects/beamstudio/src/renderer/src/store/dmxStore.js)
- **Responsibility:** Manages the DMX Universe state (dmxUniverseState) and the physical fixture patch (dmxFixtures).
- **Optimization:** Implements value-diffing at the dispatcher level to prevent redundant IPC saturation.
- **Atomic State:** Designed for 44Hz (Standard DMX) updates.

### [audioStore.js](file:///home/fran/projects/beamstudio/src/renderer/src/store/audioStore.js)
- **Responsibility:** Captures real-time DSP telemetry (audioTelemetryDSP) and visualizer data.
- **Traffic:** Handles high-bandwidth ráfagas at 60Hz.

### [configStore.js](file:///home/fran/projects/beamstudio/src/renderer/src/store/configStore.js)
- **Responsibility:** App settings, theme (Dark/Light), and global configuration.

## Professional Lexicon
- `dmxUniverseState`: The collective state of all DMX channels.
- `dmxFixtures`: The logical representation of physical lighting units.
- `pixelMapBuffer`: Intermediate buffer for LED mapping and Ambilight operations.
- `audioTelemetryDSP`: Real-time frequency analysis data used for reactive effects.
