# BeamStudio

BeamStudio is an Electron DMX controller for 3 RGB bars with live modes that can run tonight without touching the hardware timing layer: manual palettes, dynamic scenes, audio-reactive output, Ambilight, projector visuals, and projection mapping.

## Quick path

1. Install dependencies:
   ```bash
   npm install
   ```
2. Run the app:
   ```bash
   npm run dev
   ```
3. Before a real session, verify the codebase health:
   ```bash
   npm run check
   npm run build
   npm run doctor
   ```

## What is ready now

| Area | Current state | Where to use it |
|------|---------------|-----------------|
| Simple color palettes | Ready | `Console Mixer` |
| Meet / full white | Ready | `System` / global DMX actions |
| Dynamic scenes | Ready | `Dynamic` |
| Audio-reactive DMX | Ready | Header audio widget + `Audio` / `Dynamic` |
| Ambilight | Ready with platform-specific capture notes | `Ambilight` |
| Projector visuals | Ready | `Projector Output` |
| Projector Studio beta | Beta, parallel fallback kept | `Projector Studio` |
| Projection mapping | Ready | `Projector Output` + `Projection Mapping — Surfaces` |
| Pose tracking visual | Ready | `Projector Output` → `Pose Skeleton` |
| Webcam selection for pose tracking | Ready | `Projector Output` → `Pose Tracking Webcam` |

## Feature map

### 1. Dynamic scenes

- Page: `Dynamic`
- Source of truth:
  - `src/renderer/src/pages/DynamicScenesPageV2.jsx`
  - `src/renderer/src/utils/palettes.js`
  - `src/main/index.js`
- What it does:
  - Runs built-in animated scenes.
  - Can route a scene through the shared audio engine as a colorizer.
  - Can also preview AI-generated scenes without touching the projector stack.

### 2. Simple scenes / color palettes

- Page: `Console Mixer`
- Source of truth:
  - `src/renderer/src/pages/ConsoleMixerPage.jsx`
  - `src/renderer/src/utils/constants.js`
- What it does:
  - Manual RGB + function + speed + strobe + dimmer control.
  - Quick palette buttons for fast looks.
  - Fixture patch selection and per-fixture blackout toggle.

### 3. Meet

- Backend action: `dmx:meet`
- Source of truth:
  - `src/main/index.js`
- What it does:
  - Forces all fixtures to visible white.
  - Stops dynamic scenes first so the look is stable and predictable.

### 4. Audio-reactive

- Pages:
  - global header audio widget
  - `Audio`
  - optional scene colorizer inside `Dynamic`
- Source of truth:
  - `src/renderer/src/audio/AudioEngineContext.jsx`
  - `src/renderer/src/hooks/useSystemAudio.js`
  - `src/main/index.js`
- What it does:
  - Shared audio engine, not one engine per page.
  - Survives page navigation.
  - Can drive DMX directly or colorize scene output.

### 5. Ambilight

- Page: `Ambilight`
- Source of truth:
  - `src/renderer/src/pages/AmbilightPage.jsx`
  - `src/renderer/src/hooks/useGpuAmbilight.js`
  - `src/main/index.js`
- What it does:
  - Captures screen content and maps left / center / right colors to fixtures.
  - Owns DMX output while active.

### 6. Projector Studio beta

- Page: `Projector Studio`
- Source of truth:
  - `src/renderer/src/pages/ProjectorStudioPage.jsx`
  - `src/renderer/src/output/ProjectorApp.jsx`
  - `src/renderer/src/visuals/NowPlayingCardVisual.jsx`
  - `src/renderer/src/visuals/MusicEqualizerVisual.jsx`
  - `src/renderer/src/visuals/BassPulseVisual.jsx`
- What it does:
  - Adds a parallel visual editor without replacing the stable `Projector Output` page.
  - Shows a central preview of mapped zones.
  - Supports creating, selecting, moving, and reshaping up to 5 zones directly in the Studio preview.
  - Can show a webcam background for camera-assisted alignment while projecting a test signal.
  - Lets each zone choose a layer: Black / Neutral, existing visuals, Now Playing Card, Frequency Equalizer, or Bass Pulse.
  - Uses the existing mapping state and audio engine, no duplicate audio capture.

### 7. Projection mapping

- Page: `Projector Output`
- Source of truth:
  - `src/renderer/src/pages/ProjectorPage.jsx`
  - `src/renderer/src/output/ProjectorApp.jsx`
  - `src/renderer/src/mapping/MappingCompositor.jsx`
  - `src/main/index.js`
- What it does:
  - Opens a dedicated projector window.
  - Supports multiple surfaces.
  - Each surface can have its own visual.
  - Surfaces can be rotated, masked, saved, and loaded as presets.

## Projector Studio beta quick path

1. Open `Projector Studio`.
2. Select a zone in the left panel.
3. Pick a layer in the inspector: `Now Playing Card`, `Frequency Equalizer`, `Bass Pulse`, an existing visual, or `Black / Neutral`.
4. Drag a zone body to move it, or drag its green numbered corners to reshape it. The MVP supports up to 5 zones.
5. For camera-assisted mapping, click `Camera`, point the webcam at the projection surface, then click `Test signal`. Use the orange reference points plus the green zone corners to line up the real wall.
6. Use rotation and feather controls while watching the central preview.
7. Click `Open projector` to send the same surfaces to the real projector window.
8. Save a preset when the layout is useful.

The old `Projector Output` page stays as the fallback and calibration surface. Use it for display selection, test pattern, webcam setup, and low-level mapping edits.

## Projection mapping tutorial

Detailed guide:

- [`docs/PROJECTION_MAPPING_TUTORIAL.md`](docs/PROJECTION_MAPPING_TUTORIAL.md)

Super short version:

1. Open `Projector Output`.
2. Choose the secondary display.
3. Click `Abrir proyector`.
4. Turn on `TEST PATTERN`.
5. Turn on `EDIT MAPPING`.
6. In the projector window, follow the overlay:
   - green circles = drag the projector corners
   - orange squares = crop/mask vertices
7. Add or select a surface.
8. Drag the green corners until the image fits the real surface.
9. Choose the visual for that surface.
10. If the status banner says `BLACKOUT`, `NOW PLAYING`, or `TEST PATTERN`, click `Show selected visual`.
11. Save the preset.

## Tonight test checklist

### Dynamic scenes

- [ ] Open `Dynamic`
- [ ] Trigger 3-5 built-in scenes
- [ ] Confirm switching scenes does not leave stale output alive
- [ ] Test `Colorize with audio` on and off

### Simple palettes

- [ ] Open `Console Mixer`
- [ ] Test several `Quick Palettes`
- [ ] Move `Master` dimmer
- [ ] Toggle one fixture blackout and restore it

### Meet

- [ ] Trigger `Meet`
- [ ] Confirm all fixtures go to solid visible white
- [ ] Confirm no dynamic scene keeps fighting it

### Audio-reactive

- [ ] Start the global audio widget
- [ ] Verify the engine survives page changes
- [ ] Test with music pause/resume
- [ ] Confirm Slot 2 center bass still hits cleanly

### Ambilight

- [ ] Open `Ambilight`
- [ ] Start screen capture
- [ ] Confirm left / center / right bars follow screen color
- [ ] Stop Ambilight and confirm output is released cleanly

### Projection mapping

- [ ] Open the projector window
- [ ] Verify `TEST PATTERN`
- [ ] Verify `EDIT MAPPING`
- [ ] Add multiple surfaces
- [ ] Assign different visuals per surface
- [ ] Save preset
- [ ] Load preset

### Pose tracking / webcam

- [ ] Select `Pose Skeleton` on one surface
- [ ] Click `Check Webcam`
- [ ] Allow camera access
- [ ] Pick the correct webcam
- [ ] Click `Show selected visual` if the projector is showing Now Playing or Test Pattern
- [ ] Confirm the skeleton is visible in the projector output

## Linux / Wayland notes

These are real operational notes, not theory:

- Ambilight on Wayland relies on the native screen-share picker.
- Pose tracking webcam also depends on desktop permission flow.
- `npm run doctor` on this machine reports Wayland + PipeWire running.
- If screen or camera access fails, retry after explicitly allowing the OS prompt.

## Files worth knowing

- `src/main/index.js` — main IPC, DMX ownership, Ambilight, projector, mapping
- `src/preload/index.js` — renderer API boundary
- `src/renderer/src/pages/ConsoleMixerPage.jsx` — manual palettes and fixture control
- `src/renderer/src/pages/DynamicScenesPageV2.jsx` — dynamic scenes and audio colorizer
- `src/renderer/src/pages/AmbilightPage.jsx` — Ambilight UI
- `src/renderer/src/pages/ProjectorPage.jsx` — projector control, mapping UI, webcam selection
- `src/renderer/src/pages/ProjectorStudioPage.jsx` — beta visual editor for mapped zones
- `src/renderer/src/output/ProjectorApp.jsx` — projector runtime window
- `src/renderer/src/mapping/MappingCompositor.jsx` — quad warp and per-surface compositor
- `src/renderer/src/hooks/useSystemAudio.js` — audio capture / analysis
- `src/renderer/src/hooks/useGpuAmbilight.js` — Ambilight capture pipeline
- `src/renderer/src/hooks/usePoseLandmarker.js` — pose tracking hook

## Dev commands

```bash
npm run dev
npm run check
npm run build
npm run doctor
```

## Related docs

- [Developer README](README_DEV.md)
- [Projection Mapping Tutorial](docs/PROJECTION_MAPPING_TUTORIAL.md)
- [Revival docs](docs/revival/README.md)
