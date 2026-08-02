// BS-005: single source of truth for the visual library's ids/labels.
// ProjectorApp.jsx (render branch + default active visual) and
// ProjectorPage.jsx (operator picker) both consume this instead of each
// keeping their own literal list — adding one of the next 3 visuals
// (Particle Field, Tunnel/Grid, Kaleidoscope) is just another entry here.
export const VISUALS = [
    { id: 'fluidNeon', label: 'Fluid Neon' }
]

export const DEFAULT_VISUAL_ID = VISUALS[0].id
