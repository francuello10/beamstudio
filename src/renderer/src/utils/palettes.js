/**
 * Centralized Color Palettes for BeamStudio V5.0
 * Used by Audio, Dynamic Scenes, Ambilight Boost
 */

// === ANIMATION SPEED MODIFIER ===
export const ANIMATION_SPEED = 0.5 // Slower for relaxing aesthetic

// === SCENE PALETTES ===
export const PALETTES = {
    CYBERPUNK: {
        name: 'Cyberpunk',
        colors: [
            { r: 255, g: 0, b: 128 },   // Hot Pink
            { r: 0, g: 255, b: 255 },   // Cyan
            { r: 128, g: 0, b: 255 },   // Purple
        ],
        description: 'Neon pink and cyan - Blade Runner vibes'
    },
    SUNSET: {
        name: 'Sunset',
        colors: [
            { r: 255, g: 100, b: 0 },   // Orange
            { r: 255, g: 50, b: 50 },   // Red-Orange
            { r: 255, g: 180, b: 0 },   // Gold
        ],
        description: 'Warm tones - golden hour'
    },
    FIRE: {
        name: 'Fire',
        colors: [
            { r: 255, g: 0, b: 0 },     // Red
            { r: 255, g: 80, b: 0 },    // Orange
            { r: 255, g: 200, b: 0 },   // Yellow
        ],
        description: 'Intense flames - aggressive'
    },
    OCEAN: {
        name: 'Ocean',
        colors: [
            { r: 0, g: 100, b: 255 },   // Blue
            { r: 0, g: 200, b: 200 },   // Teal
            { r: 0, g: 150, b: 255 },   // Light Blue
        ],
        description: 'Deep sea - calming'
    },
    FOREST: {
        name: 'Forest',
        colors: [
            { r: 0, g: 150, b: 50 },    // Green
            { r: 100, g: 200, b: 0 },   // Lime
            { r: 0, g: 100, b: 0 },     // Dark Green
        ],
        description: 'Nature - organic'
    },
    AURORA: {
        name: 'Aurora',
        colors: [
            { r: 0, g: 255, b: 100 },   // Green
            { r: 100, g: 0, b: 255 },   // Purple
            { r: 0, g: 200, b: 255 },   // Cyan
        ],
        description: 'Northern lights - magical'
    },
    // NEW PALETTES V5.0
    CYBER: {
        name: 'Cyber',
        colors: [
            { r: 255, g: 220, b: 0 },   // Yellow
            { r: 0, g: 150, b: 255 },   // Blue
            { r: 255, g: 200, b: 50 },  // Gold
        ],
        description: 'Cyber yellow/blue - futuristic'
    },
    TOXIC: {
        name: 'Toxic',
        colors: [
            { r: 0, g: 255, b: 50 },    // Neon Green
            { r: 150, g: 0, b: 255 },   // Violet
            { r: 50, g: 200, b: 0 },    // Lime
        ],
        description: 'Green/violet - radioactive'
    },
    CANDY: {
        name: 'Candy',
        colors: [
            { r: 255, g: 100, b: 200 }, // Pink
            { r: 100, g: 200, b: 255 }, // Cyan
            { r: 255, g: 150, b: 220 }, // Light Pink
        ],
        description: 'Pink/cyan - sweet'
    },
    MONO_WHITE: {
        name: 'Pure White',
        colors: [
            { r: 255, g: 255, b: 255 },
            { r: 255, g: 255, b: 255 },
            { r: 255, g: 255, b: 255 },
        ],
        description: 'Clean white - studio'
    },
    MONO_RED: {
        name: 'Pure Red',
        colors: [
            { r: 255, g: 0, b: 0 },
            { r: 255, g: 0, b: 0 },
            { r: 255, g: 0, b: 0 },
        ],
        description: 'Intense red - passion'
    }
}

// === REACTIVE FLAGS (Static palettes for L-C-R mapping) ===
export const FLAGS = {
    ARGENTINA: {
        name: '🇦🇷 Argentina',
        colors: [
            { r: 117, g: 190, b: 218 }, // Celeste
            { r: 255, g: 255, b: 255 }, // Blanco
            { r: 117, g: 190, b: 218 }, // Celeste
        ],
        description: 'Albiceleste'
    },
    BOCA: {
        name: '💙💛 Boca',
        colors: [
            { r: 0, g: 51, b: 160 },    // Azul Boca
            { r: 255, g: 204, b: 0 },   // Oro
            { r: 0, g: 51, b: 160 },    // Azul Boca
        ],
        description: 'La Mitad + 1'
    },
    ITALIA: {
        name: '🇮🇹 Italia',
        colors: [
            { r: 0, g: 146, b: 70 },    // Verde
            { r: 255, g: 255, b: 255 }, // Blanco
            { r: 206, g: 43, b: 55 },   // Rojo
        ],
        description: 'Tricolore'
    },
    ECLIPSE: {
        name: '🌑 Eclipse',
        colors: [
            { r: 20, g: 30, b: 80 },    // Azul Oscuro
            { r: 255, g: 150, b: 50 },  // Ámbar
            { r: 20, g: 30, b: 80 },    // Azul Oscuro
        ],
        description: 'Solar Corona'
    }
}

// === GENRE PROFILES ===
export const GENRE_PROFILES = {
    ELECTRO: {
        name: 'Electro',
        bassWeight: 1.5,
        midWeight: 0.8,
        highWeight: 1.0,
        transientSensitivity: 2.0
    },
    ROCK: {
        name: 'Rock',
        bassWeight: 1.2,
        midWeight: 1.3,
        highWeight: 1.0,
        transientSensitivity: 1.5
    },
    CHILL: {
        name: 'Chill',
        bassWeight: 0.8,
        midWeight: 1.0,
        highWeight: 1.2,
        transientSensitivity: 0.7
    },
    // NEW GENRES V5.0
    LATIN: {
        name: 'Latin',
        bassWeight: 1.0,
        midWeight: 1.5,  // Low-mids focus (200-800Hz)
        highWeight: 1.2,
        transientSensitivity: 1.3
    },
    CINEMA: {
        name: 'Cinema',
        bassWeight: 1.8,  // Extreme dynamic range
        midWeight: 0.6,
        highWeight: 1.4,
        transientSensitivity: 2.5  // Very punchy for explosions
    }
}

// === DYNAMIC SCENE ANIMATIONS (Slowed 0.5x) ===
export const DYNAMIC_SCENES = {
    RAINBOW: {
        name: 'Rainbow Wave',
        icon: '🌈',
        getFrame: (t) => {
            const hue = (t * 0.25 * ANIMATION_SPEED) % 360 // Slowed
            return [
                hslToRgb((hue + 0) % 360, 100, 50),
                hslToRgb((hue + 120) % 360, 100, 50),
                hslToRgb((hue + 240) % 360, 100, 50),
            ]
        }
    },
    PULSE: {
        name: 'Sync Pulse',
        icon: '💓',
        getFrame: (t) => {
            const intensity = (Math.sin(t * 0.025 * ANIMATION_SPEED) + 1) / 2
            const v = Math.round(intensity * 255)
            return [{ r: v, g: 0, b: v }, { r: v, g: 0, b: v }, { r: v, g: 0, b: v }]
        }
    },
    BREATHE: {
        name: 'Calm Breathe',
        icon: '🌬️',
        getFrame: (t) => {
            const intensity = (Math.sin(t * 0.01 * ANIMATION_SPEED) + 1) / 2
            const v = Math.round(intensity * 200)
            return [{ r: 0, g: v, b: v }, { r: 0, g: v, b: v }, { r: 0, g: v, b: v }]
        }
    },
    STROBE: {
        name: 'Hard Strobe',
        icon: '⚡',
        getFrame: (t) => {
            const on = Math.floor(t / 100) % 2 === 0 // Slowed strobe
            const v = on ? 255 : 0
            return [{ r: v, g: v, b: v }, { r: v, g: v, b: v }, { r: v, g: v, b: v }]
        }
    },
    CHASE: {
        name: 'Chase',
        icon: '🏃',
        getFrame: (t) => {
            const pos = Math.floor(t / 400) % 3 // Slowed chase
            return [0, 1, 2].map(i => i === pos ? { r: 255, g: 100, b: 0 } : { r: 0, g: 0, b: 0 })
        }
    },
    VIBE: {
        name: 'Vibe',
        getFrame: (t) => {
            const h = (t * 0.05 * ANIMATION_SPEED) % 360
            return [
                hslToRgb(h, 70, 60),
                hslToRgb((h + 40) % 360, 70, 60),
                hslToRgb((h + 80) % 360, 70, 60),
            ]
        }
    },
    AESTHETIC: {
        name: 'Aesthetic',
        getFrame: (t) => {
            const h = 280 + Math.sin(t * 0.005 * ANIMATION_SPEED) * 40
            return [
                hslToRgb(h % 360, 80, 50),
                hslToRgb((h + 30) % 360, 80, 50),
                hslToRgb((h + 60) % 360, 80, 50),
            ]
        }
    },
    FIRE: {
        name: 'Fire',
        getFrame: (t) => {
            return [0, 1, 2].map(i => ({
                r: 200 + Math.random() * 55,
                g: 50 + Math.random() * 100,
                b: 0
            }))
        }
    },
    OCEAN: {
        name: 'Ocean',
        getFrame: (t) => {
            const h = 200 + Math.sin(t * 0.01 * ANIMATION_SPEED) * 20
            return [
                hslToRgb(h, 90, 40),
                hslToRgb(h + 10, 90, 40),
                hslToRgb(h + 20, 90, 40),
            ]
        }
    },
    AURORA: {
        name: 'Aurora',
        getFrame: (t) => {
            const h1 = (140 + Math.sin(t * 0.005 * ANIMATION_SPEED) * 40) % 360
            const h2 = (280 + Math.cos(t * 0.005 * ANIMATION_SPEED) * 40) % 360
            return [
                hslToRgb(h1, 100, 50),
                hslToRgb((h1 + h2) / 2, 100, 50),
                hslToRgb(h2, 100, 50),
            ]
        }
    },
    SUNSET: {
        name: 'Sunset',
        getFrame: (t) => {
            const h = 20 + Math.sin(t * 0.005 * ANIMATION_SPEED) * 20
            return [
                hslToRgb(h, 100, 50),
                hslToRgb(h + 20, 100, 50),
                hslToRgb(h + 40, 100, 50),
            ]
        }
    },
    ROMANCE: {
        name: 'Romance',
        getFrame: (t) => {
            // Match Backend: Deep Red -> Purple -> Bright Pink
            const time = t * 0.0005 * ANIMATION_SPEED
            const phase = time % 3

            let h, s, l

            if (phase < 1) {
                // Red -> Purple
                const p = phase
                const smoothP = p * p * (3 - 2 * p)
                h = 350 - (350 - 280) * smoothP
                s = 100
                l = 50
            } else if (phase < 2) {
                // Purple -> Bright Pink
                const p = phase - 1
                const smoothP = p * p * (3 - 2 * p)
                h = 280 + (320 - 280) * smoothP
                s = 100 - 30 * smoothP
                l = 50 + 40 * smoothP
            } else {
                // Bright Pink -> Red
                const p = phase - 2
                const smoothP = p * p * (3 - 2 * p)
                h = 320 + (350 - 320) * smoothP
                s = 70 + 30 * smoothP
                l = 90 - 40 * smoothP
            }

            // Stereo offset for visual interest
            return [
                hslToRgb(h, s, l),
                hslToRgb(h - 5, s, l * 0.9),
                hslToRgb(h + 5, s, l)
            ]
        }
    }
}

// === UTILITY FUNCTIONS ===
export function hslToRgb(h, s, l) {
    s /= 100
    l /= 100
    const c = (1 - Math.abs(2 * l - 1)) * s
    const x = c * (1 - Math.abs((h / 60) % 2 - 1))
    const m = l - c / 2
    let r = 0, g = 0, b = 0
    if (h < 60) { r = c; g = x }
    else if (h < 120) { r = x; g = c }
    else if (h < 180) { g = c; b = x }
    else if (h < 240) { g = x; b = c }
    else if (h < 300) { r = x; b = c }
    else { r = c; b = x }
    return {
        r: Math.round((r + m) * 255),
        g: Math.round((g + m) * 255),
        b: Math.round((b + m) * 255)
    }
}

export function multiplyBrightness(color, factor) {
    return {
        r: Math.min(255, Math.round(color.r * factor)),
        g: Math.min(255, Math.round(color.g * factor)),
        b: Math.min(255, Math.round(color.b * factor))
    }
}

export function blendColors(colors, factor) {
    return colors.map(c => multiplyBrightness(c, factor))
}

// === LERP COLOR (Anti-flicker smoothing) ===
export function lerpColor(current, target, factor = 0.25) {
    return {
        r: Math.round(current.r + (target.r - current.r) * factor),
        g: Math.round(current.g + (target.g - current.g) * factor),
        b: Math.round(current.b + (target.b - current.b) * factor)
    }
}

// === BRIGHTNESS FLOOR (Aesthetic mode) ===
export function applyBrightnessFloor(color, floor = 0.35) {
    const maxVal = Math.max(color.r, color.g, color.b)
    const currentBrightness = maxVal / 255
    if (currentBrightness >= floor) return color

    const boostFactor = floor / Math.max(currentBrightness, 0.01)
    return multiplyBrightness(color, boostFactor)
}
