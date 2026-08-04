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
    { id: 'bassPulseExaggerated', label: 'Bass Pulse Exaggerated' },
    { id: 'wmp9XpBars', label: 'WMP9 XP Bars' },
    { id: 'wmp9ClassicScope', label: 'WMP9 Classic Scope' },
    { id: 'wmp9SpaceTunnel', label: 'WMP9 Space Tunnel' },
    { id: 'wmp9Aquarium', label: 'WMP9 Aquarium' },
    { id: 'wmp9DaVinci', label: 'WMP9 da Vinci' },
    { id: 'wmp9Goo', label: 'WMP9 Goo' },
    { id: 'wmp9XpPlayer', label: 'WMP9 XP Player' },
    { id: 'wmp9ClassicPlayer', label: 'WMP9 Classic Player' },
    { id: 'wmp9SpacePlayer', label: 'WMP9 Space Player' },
    { id: 'wmp9AquariumPlayer', label: 'WMP9 Aquarium Player' },
    { id: 'wmp9DaVinciPlayer', label: 'WMP9 da Vinci Player' },
    { id: 'wmp9GooPlayer', label: 'WMP9 Goo Player' }
]

// Particle Field is the safest default for projector output: it does not
// require Fluid Neon's floating-point framebuffer extension, which is not
// available on every Electron/Linux GPU path.
export const DEFAULT_VISUAL_ID = 'particleField'
