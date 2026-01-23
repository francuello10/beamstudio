# 🛠️ BeamStudio - Developer Documentation

**Repo:** [github.com/francuello10/beamstudio](https://github.com/francuello10/beamstudio)  
**Main Engine:** FTDI D2XX Direct Driver (Ultra-Low Latency)
**Atomic State Architecture:** Industry-Standard Semantic Lexicon (v3.0)

## 🏗️ Architecture & Industry Standards

BeamStudio v3.0 aligns with professional lighting industry standards (MA Lighting, Avolites). The codebase implements an **Atomic State** pattern where high-bandwidth telemetry and low-latency control are strictly decoupled.

### 📡 Semantic Polish (Nomenclature)
- **`dmxUniverseState`**: Central state representing the active DMX Universe (0-511).
- **`dmxFixtures`**: Logical patch representing physical units.
- **`pixelMapBuffer`**: High-frequency color buffer for Ambilight and DSP effects.
- **`audioTelemetryDSP`**: Real-time spectral analysis results.

## 🛡️ Hardware Shielding & Data Integrity

The communication pipeline incorporates a mandatory shielding layer to protect FTDI hardware:
- **Universe Capacity**: Restricted to **33 bytes** (32 channels + 1 Start Code) as per driver constraints.
- **Refresh rate**: Locked at **44Hz** (Standard DMX) to prevent jitter and chip saturation.
- **Defensive JSDoc**: Core transmission functions include `@ai-constraints` to prevent AI agents from breaking hardware timings.

## 📡 DMX Implementation & Data Flow

### Transmission Engine (Main Process)
- **`src/main/index.js`**: Orchestrates the D2XX Worker and Art-Net fallback.
- **`src/main/dmxWorker.js`**: Dedicated high-precision thread for USB communication.
- **Timing**: Calibrated Break (**2.0ms**) and MAB (**0.2ms**) for maximum hardware stability.

### ⏱️ Independent Scheduler (Renderer)
- **`src/renderer/src/services/DmxScheduler.js`**: 
    - Decouples UI reflows from DMX transmission.
    - Implements **Dirty-Checking** to prevent IPC bridge saturation.
    - Ensures non-blocking control of Master Dimmer/Speed even during high-load AI scenes.

### AI Integration
- **Google Gemini 2.0 Flash**: Procedural scene generation with real-time compilation (`aiRuntime.js`).

## 📂 Project Structure
- `src/renderer/src/store/`: Atomic state management (Zustand).
- `src/renderer/src/services/`: Independent transmission and AI engines.
- `src/renderer/src/utils/hardware-specs.js`: Central hardware-driven constants.

---
*BeamStudio: Fusionando la estabilidad del hardware industrial con la estética web moderna.*
