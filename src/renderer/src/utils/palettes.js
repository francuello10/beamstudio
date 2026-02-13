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
    },
    FOCUS: {
        name: '💡 Focus',
        colors: [
            { r: 255, g: 214, b: 170 }, // Warm White (2700K approx)
            { r: 255, g: 214, b: 170 }, // Warm White
            { r: 255, g: 214, b: 170 }, // Warm White
        ],
        description: 'Productivity (2700K)'
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

// === DYNAMIC SCENE ANIMATIONS — V6.0 Premium Collection ===
// All scenes return [color0, color1, color2] for 3-bar per-fixture rendering
// Time base: t = Date.now() (ms) → s = t * 0.0005 (half-speed seconds)

const _wave = (t, seed) =>
    Math.sin(t * 0.7 + seed) * 0.5 +
    Math.sin(t * 1.3 + seed * 2.1) * 0.3 +
    Math.sin(t * 2.1 + seed * 0.7) * 0.2

export const DYNAMIC_SCENES = {
    // ── AMBIENT / CHILL ──────────────────────────────────────────────────
    VIBE: {
        name: 'Vibe',
        getFrame: (t) => {
            const s = t * 0.0005
            return [0, 1, 2].map(i => hslToRgb((s * 15 + i * 50) % 360, 45, 72))
        }
    },
    AESTHETIC: {
        name: 'Aesthetic',
        getFrame: (t) => {
            const s = t * 0.0005
            return [0, 1, 2].map(i => {
                const base = 280 + Math.sin(s * 0.3 + i * 1.2) * 50
                const sat = 75 + Math.sin(s * 0.5 + i) * 15
                return hslToRgb(((base % 360) + 360) % 360, sat, 55)
            })
        }
    },
    CHILL: {
        name: 'Chill',
        getFrame: (t) => {
            const s = t * 0.0005
            return [0, 1, 2].map(i => {
                const h = 200 + Math.sin(s * 0.2 + i * 0.8) * 30
                const l = 30 + Math.sin(s * 0.15 + i * 1.5) * 10
                return hslToRgb(h, 60, l)
            })
        }
    },
    ZEN: {
        name: 'Zen',
        getFrame: (t) => {
            const s = t * 0.0005
            return [0, 1, 2].map(i => {
                const breath = (Math.sin(s * 0.3 + i * 0.3) + 1) / 2
                const h = 35 + breath * 10
                const l = 60 + breath * 15
                return hslToRgb(h, 30, l)
            })
        }
    },
    ROMANCE: {
        name: 'Romance',
        getFrame: (t) => {
            const s = t * 0.0005
            return [0, 1, 2].map(i => {
                const phase = Math.sin(s * 0.25 + i * 0.8) * 0.5 + 0.5
                const h = (340 + phase * 40) % 360
                const l = 40 + Math.sin(s * 0.3 + i * 1.5) * 12
                return hslToRgb(h, 90, l)
            })
        }
    },
    // ── NATURE ────────────────────────────────────────────────────────────
    RAINBOW: {
        name: 'Rainbow',
        getFrame: (t) => {
            const s = t * 0.0005
            return [0, 1, 2].map(i => hslToRgb((s * 20 + i * 120) % 360, 100, 50))
        }
    },
    AURORA: {
        name: 'Aurora',
        getFrame: (t) => {
            const s = t * 0.0005
            return [0, 1, 2].map(i => {
                const w = _wave(s * 0.4, i * 1.5)
                const h = w > 0 ? 120 + w * 40 : 280 + w * 40
                const l = 40 + Math.sin(s * 0.3 + i * 0.7) * 15
                return hslToRgb(((h % 360) + 360) % 360, 90, l)
            })
        }
    },
    OCEAN: {
        name: 'Ocean',
        getFrame: (t) => {
            const s = t * 0.0005
            return [0, 1, 2].map(i => {
                const w = Math.sin(s * 0.5 + i * 1.2) * 0.5 + Math.cos(s * 0.3 - i * 0.8) * 0.3
                const h = 200 + w * 25
                const l = 35 + w * 12
                return hslToRgb(h, 85, l)
            })
        }
    },
    FOREST: {
        name: 'Forest',
        getFrame: (t) => {
            const s = t * 0.0005
            return [0, 1, 2].map(i => {
                const dapple = Math.sin(s * 0.6 + i * 2.1) * Math.cos(s * 0.3 + i * 1.3)
                const h = 110 + dapple * 30
                const l = 30 + (dapple + 1) * 15
                return hslToRgb(h, 70, l)
            })
        }
    },
    SUNSET: {
        name: 'Sunset',
        getFrame: (t) => {
            const s = t * 0.0005
            return [0, 1, 2].map(i => {
                const h = 15 + Math.sin(s * 0.2 + i * 0.6) * 20
                const l = 50 + Math.sin(s * 0.15 + i * 1.2) * 10
                return hslToRgb(((h % 360) + 360) % 360, 100, l)
            })
        }
    },
    CORDOBA_SKY: {
        name: 'Córdoba Sky',
        getFrame: (t) => {
            const s = t * 0.0005
            const tSlow = s * 0.08
            return [0, 1, 2].map(i => {
                const w = Math.sin(tSlow + i * 0.5) + Math.sin(tSlow * 0.3 + i) * 0.5
                const n = (w + 1.5) / 3
                const h = n < 0.5 ? 280 + (n * 2) * 80 : (n - 0.5) * 2 * 40
                return hslToRgb(((h % 360) + 360) % 360, 100, 50)
            })
        }
    },
    TROPICAL: {
        name: 'Tropical',
        getFrame: (t) => {
            const s = t * 0.0005
            const hues = [175, 15, 45]
            return [0, 1, 2].map(i => {
                const idx = Math.floor((s * 0.15 + i * 0.33) % 3)
                const blend = (s * 0.15 + i * 0.33) % 1
                const h1 = hues[idx % 3], h2 = hues[(idx + 1) % 3]
                const diff = h2 - h1
                const h = h1 + (Math.abs(diff) > 180 ? diff + 360 : diff) * (blend * blend * (3 - 2 * blend))
                return hslToRgb(((h % 360) + 360) % 360, 90, 55)
            })
        }
    },
    // ── FIRE & ENERGY ────────────────────────────────────────────────────
    FIRE: {
        name: 'Fire',
        getFrame: (t) => {
            const s = t * 0.001
            return [0, 1, 2].map(i => {
                const flicker = Math.sin(s * 8 + i * 3.7) * 0.3 +
                    Math.sin(s * 13 + i * 5.1) * 0.2 +
                    Math.sin(s * 3 + i * 1.9) * 0.5
                const h = 10 + (flicker + 1) * 15
                const l = 35 + (flicker + 1) * 18
                return hslToRgb(h, 100, l)
            })
        }
    },
    LAVA: {
        name: 'Lava',
        getFrame: (t) => {
            const s = t * 0.0005
            return [0, 1, 2].map(i => {
                const flow = Math.sin(s * 0.4 + i * 1.5) * 0.5 + Math.cos(s * 0.2 - i * 2.1) * 0.3
                const h = 5 + (flow + 1) * 12
                const l = 25 + (flow + 1) * 18
                return hslToRgb(h, 100, l)
            })
        }
    },
    FIREBALL: {
        name: 'Fireball',
        getFrame: (t) => {
            const s = t * 0.0005
            const cycle = 4
            const pos = ((s % cycle) / cycle) * 4 - 1
            return [0, 1, 2].map(i => {
                const dist = Math.abs(pos - i)
                const intensity = Math.max(0, 1 - dist * 1.5)
                return hslToRgb(60 * intensity, 100, 50 * intensity)
            })
        }
    },
    // ── MOODY / DARK ─────────────────────────────────────────────────────
    MIDNIGHT: {
        name: 'Midnight',
        getFrame: (t) => {
            const s = t * 0.0005
            return [0, 1, 2].map(i => {
                const glow = Math.sin(s * 0.25 + i * 2.0) * 0.5 + 0.5
                const h = 235 + Math.sin(s * 0.1 + i * 1.3) * 15
                const l = 8 + glow * 20
                return hslToRgb(h, 70, l)
            })
        }
    },
    GALAXY: {
        name: 'Galaxy',
        getFrame: (t) => {
            const s = t * 0.0005
            return [0, 1, 2].map(i => {
                const drift = Math.sin(s * 0.2 + i * 1.8) + Math.cos(s * 0.15 + i * 2.5) * 0.5
                const n = (drift + 1.5) / 3
                const h = n < 0.5 ? 280 - n * 2 * 40 : 240 + (n - 0.5) * 2 * 70
                const l = 25 + Math.sin(s * 0.5 + i * 3.14) * 15
                return hslToRgb(((h % 360) + 360) % 360, 85, l)
            })
        }
    },
    BIOLUM: {
        name: 'Biolum',
        getFrame: (t) => {
            const s = t * 0.0005
            return [0, 1, 2].map(i => {
                const noise = Math.sin(s * 1.5 + i * 132.1) * Math.cos(s * 3.5 - i * 45.3)
                const isSparkle = noise > 0.7
                const h = isSparkle ? 160 : 240
                const l = isSparkle ? 75 : 15 + (noise + 1) * 8
                return hslToRgb(h, 100, l)
            })
        }
    },
    // ── ELECTRONIC / ENERGY ──────────────────────────────────────────────
    NEON: {
        name: 'Neon',
        getFrame: (t) => {
            const s = t * 0.0005
            return [0, 1, 2].map(i => {
                const swap = Math.sin(s * 0.6 + i * 2.09) * 0.5 + 0.5
                const h = swap > 0.5 ? 330 : 210
                const l = 50 + Math.sin(s * 1.0 + i * 1.5) * 10
                return hslToRgb(h, 100, l)
            })
        }
    },
    PULSE: {
        name: 'Pulse',
        getFrame: (t) => {
            const s = t * 0.0005
            const beat = Math.pow((Math.sin(s * 1.5) + 1) / 2, 3)
            return [0, 1, 2].map(i => {
                const h = 280 + i * 20
                const l = 10 + beat * 55
                return hslToRgb(h, 100, l)
            })
        }
    },
    STROBE: {
        name: 'Strobe',
        getFrame: (t) => {
            const frame = Math.floor(t / 23)
            const on = frame % 6 < 3
            const h = (frame * 30) % 360
            return [0, 1, 2].map(i => {
                if (!on) return { r: 0, g: 0, b: 0 }
                return hslToRgb((h + i * 120) % 360, 100, 50)
            })
        }
    },
    PARTY: {
        name: 'Party',
        getFrame: (t) => {
            const s = t * 0.001
            return [0, 1, 2].map(i => {
                const h = (s * 60 + Math.sin(s * 2.5 + i * 3.14) * 120 + i * 120) % 360
                return hslToRgb(((h % 360) + 360) % 360, 100, 50)
            })
        }
    },
    RAVE: {
        name: 'Rave',
        getFrame: (t) => {
            const s = t * 0.001
            return [0, 1, 2].map(i => {
                const h = (s * 90 + i * 120) % 360
                const l = 45 + Math.sin(s * 6 + i * 2) * 15
                return hslToRgb(h, 100, l)
            })
        }
    },
    // ── SPATIAL / CHASE ──────────────────────────────────────────────────
    CYLON: {
        name: 'Cylon',
        getFrame: (t) => {
            const s = t * 0.0005
            const cycle = 3
            const phase = (s % cycle) / cycle
            const pos = (Math.sin(phase * Math.PI * 2) + 1)
            return [0, 1, 2].map(i => {
                const dist = Math.abs(pos - i)
                const intensity = Math.pow(Math.max(0, 1 - dist), 3)
                return { r: Math.round(255 * intensity), g: 0, b: 0 }
            })
        }
    },
    PLASMA: {
        name: 'Plasma',
        getFrame: (t) => {
            const s = t * 0.0005
            return [0, 1, 2].map(i => {
                const v = Math.sin(s * 0.8 + i * 0.5) + Math.cos(s * 0.4 - i)
                const h = 270 + v * 30
                const l = Math.max(15, Math.min(70, 40 + v * 10 + Math.sin(s * 1.2 + i * 2) * 8))
                return hslToRgb(((h % 360) + 360) % 360, 100, l)
            })
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
