// BS-005: single source of truth for the visual library's ids/labels.
// ProjectorApp.jsx (render branch + default active visual) and
// ProjectorPage.jsx (operator picker) both consume this instead of each
// keeping their own literal list. All 4 planned visuals (Fluid Neon,
// Particle Field, Tunnel Grid, Kaleidoscope) plus Ceiling Dome (a
// ceiling-mounted-projector-specific ambient aurora/nebula visual) are now
// present — adding a future visual would still just be another entry here.
export const VISUALS = [
    { id: 'fluidNeon', label: 'Fluid Neon' },
    { id: 'particleField', label: 'Particle Field' },
    { id: 'tunnelGrid', label: 'Tunnel Grid' },
    { id: 'kaleidoscope', label: 'Kaleidoscope' },
    { id: 'ceilingDome', label: 'Ceiling Dome' }
]

export const DEFAULT_VISUAL_ID = VISUALS[0].id
