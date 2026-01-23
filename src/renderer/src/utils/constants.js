import {
    Sliders, Music, Lightbulb, Monitor, Settings, Sparkles,
    Heart, Waves, Flame, Droplets, Radio, Zap, PartyPopper, CloudSun
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

export const DYNAMIC_SCENE_ICONS = {
    vibe: Heart, aesthetic: Heart, rainbow: Waves, fire: Flame, ocean: Droplets,
    aurora: Sparkles, pulse: Radio, strobe: Zap, party: PartyPopper, sunset: CloudSun, chill: Waves, romance: Heart
}
