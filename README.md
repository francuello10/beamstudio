# ⚡ BeamStudio v3.0 - Atomic State DMX Controller

[![GitHub Repo](https://img.shields.io/badge/GitHub-Repo-blue?logo=github)](https://github.com/francuello10/beamstudio)
[![DMX Precision](https://img.shields.io/badge/DMX-Ultra--Precision-red)](https://github.com/francuello10/beamstudio)
[![Background Mode](https://img.shields.io/badge/Background-Anti--Freeze-green)](https://github.com/francuello10/beamstudio)

**BeamStudio** is a next-generation high-fidelity interface for professional DMX512 control. Re-engineered with an **Atomic State Architecture**, it transforms standard hardware into a precision lighting instrument.

---

## 🌟 Professional Features

BeamStudio v3.0 introduces industry-standard workflows and a professional semantic lexicon:

*   **Console Mixer (GrandMaster):** Professional-grade attribute control with built-in Fixture Patch management.
*   **Fixture Profiles (V2 Architecture):** Universal support for different Fixture personalities (P06, P02, P01) with smart overlap detection.
*   **Atomic State Architecture:** Ultra-low latency state management (<2ms) designed for high-bandwidth telemetry.
*   **Background Execution (Anti-Freeze):** Hybrid rendering engine ensures **Audio Reactive** and **Fluid/Ambilight** modes continue running smoothly even when the app is minimized (Freestyler-style).
*   **Hardware Shielding:** Native protection for FTDI chip stability.
*   **Audio Telemetry DSP (Gen 6.1):** True stereo 2.1 spectral analysis.
*   **AI Procedural Scenes:** Generate complex lighting code on-the-fly using Google Gemini 2.0 Flash.
*   **Fluid Simulation (Gen 5.0):** Navier-Stokes WebGL2 engine.
*   **Screen Ambilight (Gen 6.0):** Immersive screen mirroring.

---

## 📡 Professional Nomenclature

The system uses a standardized technical lexicon:
| Concept | Technical Name | Responsibility |
| :--- | :--- | :--- |
| **State** | `dmxUniverseState` | The 512-channel logical buffer. |
| **Patch** | `dmxFixtures` | Logical representation of physical hardware. |
| **Buffer** | `pixelMapBuffer` | High-frequency intermediate color data. |
| **DSP** | `audioTelemetryDSP` | Spectral analysis results for reactive effects (Stereo + Bass). |

---

## 🚀 Installation & Setup

1.  **Drivers:** Install official [FTDI VCP Drivers](https://ftdichip.com/drivers/vcp-drivers/).
2.  **Deployment:** Substantially faster ignition via the **Console Mixer**.
3.  **Activation:** Navigate to **System** and engage the **Ultra-Low Latency D2XX Driver**.

---

## 🛠️ Hardware Requirements
*   **Interface:** KMTronic USB DMX512 or any FTDI D2XX-compatible hardware.
*   **Fixtures:** StickTec 1019 (American Pro) or standard RGB DMX units.
*   **Supported Personalities (Modes):**
    *   **P06 / P01 (7-Ch):** Full Control (RGB + Macros + Flash + Dimmer)
    *   **P02 (4-Ch):** RGB + Master Dimmer
*   **Default Addressing (P6 Mode):**
    *   **Bar 1:** Start `d001` (Ch 1-7)
    *   **Bar 2:** Start `d008` (Ch 8-14)
    *   **Bar 3:** Start `d015` (Ch 15-21)

---

## 📥 Descarga e Instalación

### Instaladores Pre-compilados

Los instaladores están disponibles en [GitHub Releases](https://github.com/francuello10/beamstudio/releases):

**Ubuntu/Debian:**
- `.deb` - Instalador nativo (recomendado)
  ```bash
  sudo dpkg -i beamstudio_1.0.0_amd64.deb
  sudo apt-get install -f  # Si hay dependencias faltantes
  ```
- `.AppImage` - Ejecutable portátil
  ```bash
  chmod +x BeamStudio-1.0.0.AppImage
  ./BeamStudio-1.0.0.AppImage --no-sandbox
  ```

**Windows:**
- `.exe` - Instalador NSIS (disponible en releases)

### Desarrollo

Para compilar desde el código fuente:
```bash
git clone https://github.com/francuello10/beamstudio.git
cd beamstudio
npm install
npm run build
npm run dist
```

## 🔗 Links
*   **Author:** [Fran Cuello](https://github.com/francuello10)
*   **Source:** [GitHub Repository](https://github.com/francuello10/beamstudio)
*   **Releases:** [GitHub Releases](https://github.com/francuello10/beamstudio/releases)
*   **Technical Docs:** [Developer README](README_DEV.md)

---
*Desarrollado con ❤️ por Fran Cuello para setups de alta fidelidad.*
