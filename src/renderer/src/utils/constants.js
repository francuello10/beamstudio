import {
    Sliders, Music, Lightbulb, Monitor, Settings, Sparkles,
    Heart, Waves, Flame, Droplets, Radio, Zap, PartyPopper, CloudSun,
    Moon, Star, Sun, TreePine, Wind, Activity, Palette, Eye
} from 'lucide-react'

export const NAV_ITEMS = [
    { id: 'mixer', icon: Sliders, label: 'Console Mixer' },
    { id: 'programs', icon: Lightbulb, label: 'Programs' },
    { id: 'dynamic', icon: Sparkles, label: 'Dynamic' },
    { id: 'audio', icon: Music, label: 'Audio' },
    { id: 'ambilight', icon: Monitor, label: 'Ambilight' },
    { id: 'system', icon: Settings, label: 'System' },
]

export const CHANNELS = [
    { id: 'red', label: 'Red', color: '#ff4444' },
    { id: 'green', label: 'Green', color: '#44ff44' },
    { id: 'blue', label: 'Blue', color: '#4444ff' },
    { id: 'func', label: 'Function', color: '#ffaa00' },
    { id: 'spd', label: 'Speed', color: '#00cccc' },
    { id: 'flash', label: 'Strobe', color: '#ffffff' },
    { id: 'dim', label: 'Master', color: '#888888' },
]

export const QUICK_COLORS = [
    { name: 'Off', r: 0, g: 0, b: 0 },
    { name: 'White', r: 255, g: 255, b: 255 },
    { name: 'Red', r: 255, g: 0, b: 0 },
    { name: 'Green', r: 0, g: 255, b: 0 },
    { name: 'Blue', r: 0, g: 0, b: 255 },
    { name: 'Cyan', r: 0, g: 255, b: 255 },
    { name: 'Magenta', r: 255, g: 0, b: 255 },
    { name: 'Yellow', r: 255, g: 255, b: 0 },
    { name: 'Orange', r: 255, g: 128, b: 0 },
    { name: 'Pink', r: 255, g: 150, b: 200 },
    { name: 'Purple', r: 128, g: 0, b: 255 },
    { name: 'Warm', r: 255, g: 180, b: 100 },
]

// V6.0 Premium Scene Collection — 25 Scenes
export const BUILT_IN_SCENES = [
    // ── AMBIENT / CHILL
    { id: 'vibe', name: 'Vibe', desc: 'Dreamy pastels' },
    { id: 'aesthetic', name: 'Aesthetic', desc: 'Vaporwave gradient' },
    { id: 'chill', name: 'Chill', desc: 'Deep relaxing ambient' },
    { id: 'zen', name: 'Zen', desc: 'Warm meditation' },
    { id: 'romance', name: 'Romance', desc: 'Sensual passion' },
    // ── NATURE
    { id: 'rainbow', name: 'Rainbow', desc: 'Flowing spectrum' },
    { id: 'aurora', name: 'Aurora', desc: 'Northern lights' },
    { id: 'ocean', name: 'Ocean', desc: 'Deep sea waves' },
    { id: 'forest', name: 'Forest', desc: 'Green canopy' },
    { id: 'sunset', name: 'Sunset', desc: 'Golden hour' },
    { id: 'cordoba_sky', name: 'Córdoba Sky', desc: 'Majestic sunset' },
    { id: 'tropical', name: 'Tropical', desc: 'Vivid paradise' },
    // ── FIRE & ENERGY
    { id: 'fire', name: 'Fire', desc: 'Dancing flames' },
    { id: 'lava', name: 'Lava', desc: 'Flowing magma' },
    { id: 'fireball', name: 'Fireball', desc: 'Chase de fuego' },
    // ── MOODY / DARK
    { id: 'midnight', name: 'Midnight', desc: 'Deep night tones' },
    { id: 'galaxy', name: 'Galaxy', desc: 'Deep space nebula' },
    { id: 'biolum', name: 'Biolum', desc: 'Bioluminescence' },
    // ── ELECTRONIC / ENERGY
    { id: 'neon', name: 'Neon', desc: 'Cyberpunk glow' },
    { id: 'pulse', name: 'Pulse', desc: 'Heartbeat rhythm' },
    { id: 'strobe', name: 'Strobe', desc: 'High energy flash' },
    { id: 'party', name: 'Party', desc: 'Smooth party colors' },
    { id: 'rave', name: 'Rave', desc: 'Fast energy cycle' },
    // ── SPATIAL / CHASE
    { id: 'cylon', name: 'Cylon', desc: 'Scanner eye' },
    { id: 'plasma', name: 'Plasma', desc: 'Purple energy' },
]

export const DYNAMIC_SCENE_ICONS = {
    // Ambient
    vibe: Heart, aesthetic: Palette, chill: Waves, zen: Wind, romance: Heart,
    // Nature
    rainbow: Waves, aurora: Sparkles, ocean: Droplets, forest: TreePine,
    sunset: CloudSun, cordoba_sky: CloudSun, tropical: Sun,
    // Fire & Energy
    fire: Flame, lava: Flame, fireball: Flame,
    // Moody / Dark
    midnight: Moon, galaxy: Star, biolum: Sparkles,
    // Electronic
    neon: Zap, pulse: Radio, strobe: Zap, party: PartyPopper, rave: Activity,
    // Spatial
    cylon: Eye, plasma: Zap,
}
