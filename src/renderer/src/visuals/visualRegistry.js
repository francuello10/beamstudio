// BS-005: single source of truth for the visual library's ids/labels.
// ProjectorApp.jsx (render branch + default active visual) and
// ProjectorPage.jsx (operator picker) both consume this instead of each
// keeping their own literal list. All 4 planned visuals (Fluid Neon,
// Particle Field, Tunnel Grid, Kaleidoscope) plus Ceiling Dome (a
// ceiling-mounted-projector-specific ambient aurora/nebula visual) are now
// present — adding a future visual would still just be another entry here.
export const VISUALS = [
    { id: 'blackNeutral', label: 'Black / Neutral' },
    { id: 'fluidNeon', label: 'Fluid Neon' },
    { id: 'particleField', label: 'Particle Field' },
    { id: 'tunnelGrid', label: 'Tunnel Grid' },
    { id: 'kaleidoscope', label: 'Kaleidoscope' },
    { id: 'ceilingDome', label: 'Ceiling Dome' },
    { id: 'poseSkeleton', label: 'Pose Skeleton' },
    { id: 'nowPlayingCard', label: 'Now Playing Card' },
    { id: 'nowPlayingCover', label: 'Album Cover' },
    { id: 'nowPlayingTitle', label: 'Track Title' },
    { id: 'nowPlayingArtist', label: 'Artist Name' },
    { id: 'nowPlayingAlbum', label: 'Album Name' },
    { id: 'nowPlayingProgress', label: 'Song Progress Bar' },
    { id: 'nowPlayingTime', label: 'Song Time' },
    { id: 'musicEqualizer', label: 'Music EQ Standard' },
    { id: 'musicEqualizerSmooth', label: 'Music EQ Smooth' },
    { id: 'musicEqualizerExaggerated', label: 'Music EQ Exaggerated' },
    { id: 'musicEqualizerWave', label: 'Music EQ Wave' },
    { id: 'musicEqualizerRadial', label: 'Music EQ Radial' },
    { id: 'bassPulse', label: 'Bass Pulse Standard' },
    { id: 'bassPulseSmooth', label: 'Bass Pulse Smooth' },
    { id: 'bassPulseExaggerated', label: 'Bass Pulse Exaggerated' }
]

// Particle Field is the safest default for projector output: it does not
// require Fluid Neon's floating-point framebuffer extension, which is not
// available on every Electron/Linux GPU path.
export const DEFAULT_VISUAL_ID = 'particleField'
