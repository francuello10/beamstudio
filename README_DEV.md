# 🛠️ BeamStudio - Developer Documentation (AI/Dev Focus)

**Repo:** [github.com/francuello10/beamstudio](https://github.com/francuello10/beamstudio)  
**Backend Engine:** [QLC+](https://www.qlcplus.org/) (via Art-Net)

This document provides a technical overview of the BeamStudio architecture, intended for software developers and AI assistants.

---

## 🏗️ Architecture Overview

BeamStudio is an **Electron** application built with **React** and **Vite**, designed for high-performance DMX control.

### 🔌 Tech Stack
*   **Electron:** Multi-platform shell.
*   **Vite:** Extremely fast build tool and dev server.
*   **React:** UI components.
*   **Tailwind CSS + Vanilla CSS:** Modern Glassmorphism aesthetic.
*   **Framer Motion:** Smooth UI transitions and animations.
*   **dmxnet:** Node.js implementation of the Art-Net protocol.

---

## 📂 Project Structure

*   `src/main/index.js`: **Entry point.** Manages the Electron lifecycle, IPC handlers, and the core DMX/Art-Net logic.
*   `src/preload/index.js`: **Bridge.** Exposes safe DMX and Window APIs to the renderer process.
*   `src/renderer/src/App.jsx`: **Main UI.** Contains the routing, global state, and page components.
*   `src/renderer/src/index.css`: **Styles.** Global theme variables and component styling.

---

## 📡 DMX & Art-Net Implementation

### Main Process Loop
The application runs a 30fps DMX transmission loop in `src/main/index.js`. It maintains a `dmxState` object with:
*   `channels`: 512-channel DMX array.
*   `fixtureColors`: Current RGB state for UI feedback.
*   `blackout`: Global or per-fixture blackout flags.

### Data Flow
1.  **User Interaction:** Renderer (React) calls `window.dmx.setChannel()`.
2.  **IPC:** Message sent to Main Process via `ipcRenderer.invoke`.
3.  **State Update:** Main process updates `dmxState.channels`.
4.  **Broadcast:** Main process sends `dmx:colorsUpdated` back to Renderer for UI sync.
5.  **Transmit:** On the next tick (1/30s), the `dmxnet` sender broadcasts the 512-channel buffer via Art-Net.

---

## 🎨 Theme & Aesthetics
*   **Dark/Light Mode:** Controlled via an `.app.dark` or `.app.light` class on the root container.
*   **Glassmorphism:** Uses `backdrop-filter: blur()` and semi-transparent backgrounds (`var(--glass)`).
*   **Color Wheel:** Custom implementation using a conic-gradient and `mask-image` for the donut style.

---

## 🖥️ Platform Compatibility
*   **Windows:** Fully compatible. Recommended for usage with FTDI-based interfaces like KMTronic.
*   **Linux:** Fully compatible. Requires appropriate USB permissions for serial/DMX interfaces if used directly.
*   **macOS:** Compatible, though Art-Net is the preferred output method.

---

## 🛠️ Development Scripts
*   `npm run dev`: Starts the Vite dev server and Electron in development mode.
*   `npm run build`: Bundles the application for production using `electron-builder`.

---

*BeamStudio: Merging DMX stability with Modern Web aesthetics.*
