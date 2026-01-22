# ⚡ BeamStudio v3.0 - Atomic State DMX Controller

[![GitHub Repo](https://img.shields.io/badge/GitHub-Repo-blue?logo=github)](https://github.com/francuello10/beamstudio)
[![DMX Precision](https://img.shields.io/badge/DMX-Ultra--Precision-red)](https://github.com/francuello10/beamstudio)

**BeamStudio** is a next-generation high-fidelity interface for professional DMX512 control. Re-engineered with an **Atomic State Architecture**, it transforms standard hardware into a precision lighting instrument.

---

## 🌟 Professional Features

BeamStudio v3.0 introduces industry-standard workflows and a professional semantic lexicon:

*   **Console Mixer (GrandMaster):** Professional-grade attribute control with built-in Fixture Patch management.
*   **Atomic State Architecture:** Ultra-low latency state management (<2ms) designed for high-bandwidth telemetry.
*   **Hardware Shielding:** Native protection for FTDI chip stability, locking the universe capacity to 33 bytes (32+1).
*   **Audio Telemetry DSP:** True stereo 2.1 spectral analysis with real-time visual feedback.
*   **AI Procedural Scenes:** Generate complex lighting code on-the-fly using Google Gemini 2.0 Flash.

---

## 📡 Professional Nomenclature

The system uses a standardized technical lexicon:
| Concept | Technical Name | Responsibility |
| :--- | :--- | :--- |
| **State** | `dmxUniverseState` | The 512-channel logical buffer. |
| **Patch** | `dmxFixtures` | Logical representation of physical hardware. |
| **Buffer** | `pixelMapBuffer` | High-frequency intermediate color data. |
| **DSP** | `audioTelemetryDSP` | Spectral analysis results for reactive effects. |

---

## 🚀 Installation & Setup

1.  **Drivers:** Install official [FTDI VCP Drivers](https://ftdichip.com/drivers/vcp-drivers/).
2.  **Deployment:** Substantially faster ignition via the **Console Mixer**.
3.  **Activation:** Navigate to **System** and engage the **Ultra-Low Latency D2XX Driver**.

---

## 🛠️ Hardware Requirements
*   **Interface:** KMTronic USB DMX512 or any FTDI D2XX-compatible hardware.
*   **Fixtures:** StickTec 1019 (American Pro) or standard RGB DMX units.
*   **Addressing (P6 Mode):**
    *   **Bar 1:** Start `d001` (Ch 1-7)
    *   **Bar 2:** Start `d008` (Ch 8-14)
    *   **Bar 3:** Start `d015` (Ch 15-21)

---

## 🔗 Links
*   **Author:** [Fran Cuello](https://github.com/francuello10)
*   **Source:** [GitHub Repository](https://github.com/francuello10/beamstudio)
*   **Technical Docs:** [Developer README](README_DEV.md)

---
*Desarrollado con ❤️ por Fran Cuello para setups de alta fidelidad.*
