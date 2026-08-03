# Projection Mapping Tutorial

This tutorial is the fastest safe path to get BeamStudio's projector output aligned with a real wall, panel, ceiling piece, couch face, or other surface tonight.

## Quick path

1. Open `Projector Output`.
2. Choose the projector display.
3. Click `Abrir proyector`.
4. Turn on `TEST PATTERN`.
5. Turn on `EDIT MAPPING`.
6. Fit one surface first.
7. Only after that, add more surfaces.
8. Save a preset before the session starts.

## What the page controls

| Control | What it does |
|--------|---------------|
| `Abrir proyector` | Opens the fullscreen projector window on the chosen display |
| `BLACKOUT` | Forces black output |
| `TEST PATTERN` | Shows the alignment grid |
| `NOW PLAYING` | Toggles the metadata overlay |
| `EDIT MAPPING` | Shows draggable mapping handles in the projector window |
| `Visual for: <surface>` | Chooses which visual feeds the selected surface |
| `Rotation` | Rotates only that surface's content, not the quad itself |
| `Save Preset` | Stores the current surface layout in `mapping-presets.json` |
| `Show selected visual` | Clears `BLACKOUT`, `TEST PATTERN`, and `NOW PLAYING` so the selected surface visual is actually visible |

## First rule: know what is covering the output

BeamStudio can show several layers in the projector window. If the wrong thing appears, check the status banner in `Projector Output`.

Priority:

```text
BLACKOUT
  covers everything
NOW PLAYING
  covers the selected visual
TEST PATTERN
  calibration mode
LIVE VISUAL
  the selected surface visual
```

If you selected `Pose Skeleton` but still see the music card, click `Show selected visual`. That is not you being dumb, that was a bad app state. The UI now makes it explicit.

## Happy path: first-time mapping

### Step 1. Open the projector window

1. Go to `Projector Output`.
2. Choose the external display.
3. Click `Abrir proyector`.

Expected result:

- a fullscreen projector window opens on the external display
- the main window keeps the operator controls

### Step 2. Show the alignment grid

1. Turn on `TEST PATTERN`.
2. Turn on `EDIT MAPPING`.

Expected result:

- you see the white calibration grid
- corner handles become draggable in the projector output

### Step 3. Fit the first surface

Start with one surface only. This matters. If the first quad is wrong, five wrong quads just make the mess bigger.

1. In `Projection Mapping — Surfaces`, select the default surface.
2. Drag the quad corners in the projector window until the grid fits the real surface.
3. If the image is rotated because of mounting direction, use the `Rotation` slider or the 0° / 90° / 180° / 270° buttons.

### Step 4. Choose the content

1. In `Visual for: <surface>`, choose the visual you want.
2. If the status banner says `BLACKOUT`, `NOW PLAYING`, or `TEST PATTERN`, click `Show selected visual`.
3. Verify the real visual is aligned, not only the grid.

## Multi-surface workflow

Use this when one projector covers several real objects or sub-areas.

### Example

```text
Projector
   └── Wall
       ├── Surface A -> Tunnel Grid
       ├── Surface B -> Particle Field
       └── Surface C -> Pose Skeleton
```

### Steps

1. Fit the first surface completely.
2. Click `Add Surface`.
3. Select the new surface from the list.
4. Drag its corners in the projector output.
5. Rename it so you know what it is in the room.
6. Pick its visual.
7. Repeat.

## Pose tracking on a mapped surface

1. Select the target surface.
2. Choose `Pose Skeleton`.
3. In the webcam section, click `Check Webcam`.
4. Allow camera access.
5. Choose the correct webcam if there is more than one.

Expected result:

- the hidden camera feed runs inside the projector stack
- the skeleton canvas becomes the texture source for that surface

## Presets

Use presets. Seriously. Rebuilding a room from scratch five minutes before people arrive is how you create self-inflicted pain.

### Save

1. Type a preset name.
2. Click `Save Preset`.

### Load

1. Pick the saved preset from the list.
2. Click the folder icon.

### Delete

1. Find the preset in the list.
2. Click the trash icon.

## Troubleshooting

### The projector window opens but I do not see the expected visual

Check:

- Read the status banner in `Projector Output`
- Click `Show selected visual`
- Confirm the selected surface has the intended visual
- Confirm the quad is still on-screen after dragging

### The visual is visible but on the wrong real object

Fix the quad corners first. Do not try to compensate with scene or color controls. Geometry first, art second.

### Rotation looks wrong

Use the surface rotation controls. They rotate the content sampled inside the surface, which is the right layer for mounted orientation fixes.

### Pose Skeleton stays blank

Check:

- you clicked `Check Webcam`
- the OS camera prompt was allowed
- the correct webcam is selected
- you are standing in frame

### Ambilight or audio is fine, but projector visuals look frozen

Check:

- projector window is still open on the target display
- the selected visual is still assigned to the intended surface
- the saved preset did not load an old layout unexpectedly

## Recommended tonight flow

1. Verify DMX output first.
2. Verify manual palettes.
3. Verify dynamic scenes.
4. Verify audio-reactive.
5. Verify Ambilight.
6. Open projector output.
7. Fit one surface.
8. Save a preset.
9. Add more surfaces only if the first one is solid.
10. Test `Pose Skeleton` last, after the basic projector path is confirmed.

## Relevant files

- `src/renderer/src/pages/ProjectorPage.jsx`
- `src/renderer/src/output/ProjectorApp.jsx`
- `src/renderer/src/mapping/MappingCompositor.jsx`
- `src/main/index.js`
