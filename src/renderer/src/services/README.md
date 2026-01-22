# BeamStudio Services

Core logic engines that operate independently of the React UI lifecycle to ensure stability and performance.

## Core Engines

### [DmxScheduler.js](file:///home/fran/projects/beamstudio/src/renderer/src/services/DmxScheduler.js)
- **Elite Independent Transmission Engine:** Operates in a dedicated loop at 44Hz (DMX Standard).
- **Optimization:** Performs **Dirty-Checking** / Value-Diffing between the store and the last sent frame.
- **Hardware Shielding:** Clamps all values to the physical range (0-255) and prevents IPC saturation during UI lag.

### [geminiService.js](file:///home/fran/projects/beamstudio/src/renderer/src/services/geminiService.js)
- **Intelligence Layer:** Interfaces with the Gemini 2.0 Flash API to generate procedural lighting code.
- **Runtime:** Results are compiled and executed by the AI Runtime utility.

## AI Constraints
- **Throttle:** All asyc IPC calls through this directory must respect a 22-25ms throttle window.
- **Hardware Limits:** Never exceed the `UNIVERSE_CAPACITY` defined in `hardware-specs.js`.
