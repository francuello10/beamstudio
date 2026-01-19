import { app, shell, BrowserWindow, ipcMain, desktopCapturer, nativeTheme } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import dmxnet from 'dmxnet'

// ============================================================================
// DMX / Art-Net Setup
// ============================================================================

const dmxnetInstance = new dmxnet.dmxnet({
    log: { level: 'error' },
    oem: 0,
    sName: 'BeamStudio',
    lName: 'BeamStudio DMX Controller'
})

const sender = dmxnetInstance.newSender({
    ip: '255.255.255.255',
    subnet: 0,
    universe: 0,
    net: 0,
    port: 6454,
    base_refresh_interval: 25  // Optimized: 40Hz sync with QLC+
})

// ============================================================================
// StickTec 1019 - P6 Mode (7 Channels)
// ============================================================================

const CHANNEL_MAP = {
    RED: 0, GREEN: 1, BLUE: 2, FUNC: 3, SPD: 4, FLASH: 5, DIM: 6
}

// FUNC Channel - RANGES (not individual values)
const FUNC_RANGES = [
    { min: 0, max: 9, name: 'Manual', desc: 'Control RGB manual' },
    { min: 10, max: 19, name: 'Pr01', desc: 'Salto de 7 colores' },
    { min: 20, max: 29, name: 'Pr02', desc: 'Salto de 3 colores' },
    { min: 30, max: 39, name: 'Pr03', desc: 'Fade 7 colores' },
    { min: 40, max: 49, name: 'Pr04', desc: 'Fade 3 colores' },
    { min: 50, max: 59, name: 'Pr05', desc: 'Fade rojo' },
    { min: 60, max: 69, name: 'Pr06', desc: 'Fade verde' },
    { min: 70, max: 79, name: 'Pr07', desc: 'Fade azul' },
    { min: 80, max: 89, name: 'Pr08', desc: 'Fade amarillo' },
    { min: 90, max: 99, name: 'Pr09', desc: 'Fade cyan' },
    { min: 100, max: 109, name: 'Pr10', desc: 'Fade magenta' },
    { min: 110, max: 119, name: 'Pr11', desc: 'Fade blanco' },
    { min: 120, max: 129, name: 'Pr12', desc: 'Secuencia RGB' },
    { min: 130, max: 139, name: 'Pr13', desc: 'Secuencia CMY' },
    { min: 140, max: 149, name: 'Pr14', desc: 'Arcoíris lento' },
    { min: 150, max: 159, name: 'Pr15', desc: 'Arcoíris rápido' },
    { min: 160, max: 169, name: 'Pr16', desc: 'Pulso multicolor' },
    { min: 170, max: 179, name: 'Pr17', desc: 'Flash aleatorio' },
    { min: 180, max: 189, name: 'Pr18', desc: 'Strobe colores' },
    { min: 190, max: 199, name: 'Pr19', desc: 'Chase adelante' },
    { min: 200, max: 209, name: 'Pr20', desc: 'Chase atrás' },
    { min: 210, max: 219, name: 'Pr21', desc: 'Chase ping-pong' },
    { min: 220, max: 255, name: 'Sound', desc: 'Modo Audiorítmico' }
]

const FLASH_SPEEDS = { OFF: 0, SLOW: 50, MEDIUM: 127, FAST: 200 }
const PROGRAM_SPEEDS = { SLOW: 50, MEDIUM: 127, FAST: 220 }

const COLOR_MACROS = {
    OFF: { r: 0, g: 0, b: 0, name: 'Off' },
    WHITE: { r: 255, g: 255, b: 255, name: 'Blanco' },
    RED: { r: 255, g: 0, b: 0, name: 'Rojo' },
    GREEN: { r: 0, g: 255, b: 0, name: 'Verde' },
    BLUE: { r: 0, g: 0, b: 255, name: 'Azul' },
    YELLOW: { r: 255, g: 255, b: 0, name: 'Amarillo' },
    CYAN: { r: 0, g: 255, b: 255, name: 'Celeste' },
    MAGENTA: { r: 255, g: 0, b: 255, name: 'Magenta' },
    ORANGE: { r: 255, g: 128, b: 0, name: 'Naranja' },
    PINK: { r: 255, g: 100, b: 150, name: 'Rosa' },
    PURPLE: { r: 128, g: 0, b: 255, name: 'Violeta' },
    WARM: { r: 255, g: 180, b: 100, name: 'Cálido' },
    COOL: { r: 200, g: 220, b: 255, name: 'Frío' }
}

const fixtures = [
    { id: 1, name: 'Barra Izquierda', startChannel: 1, channels: 7 },
    { id: 2, name: 'Barra Centro', startChannel: 8, channels: 7 },
    { id: 3, name: 'Barra Derecha', startChannel: 15, channels: 7 }
]

// ============================================================================
// Dynamic Scenes (Software-based)
// ============================================================================

const DYNAMIC_SCENES = {
    vibe: {
        name: 'Vibe',
        desc: 'Pasteles aesthetic mutando',
        handler: (f) => {
            // Pastel colors cycling - low saturation, high lightness
            const hue = (f * 0.5) % 360
            const pastel = hslToRgb(hue, 50, 75) // Low saturation, high lightness = pastel
            return pastel
        }
    },
    aesthetic: {
        name: 'Aesthetic',
        desc: 'Tonos rosa/violeta/cyan',
        handler: (f) => {
            const colors = [
                { r: 255, g: 182, b: 193 }, // Pink
                { r: 230, g: 190, b: 255 }, // Lavender
                { r: 175, g: 238, b: 238 }, // Pale turquoise
                { r: 255, g: 218, b: 233 }, // Light pink
                { r: 200, g: 162, b: 200 }, // Thistle
                { r: 176, g: 224, b: 230 }, // Powder blue
            ]
            const idx = Math.floor((f * 0.02) % colors.length)
            const nextIdx = (idx + 1) % colors.length
            const t = ((f * 0.02) % 1)
            return {
                r: Math.round(colors[idx].r + (colors[nextIdx].r - colors[idx].r) * t),
                g: Math.round(colors[idx].g + (colors[nextIdx].g - colors[idx].g) * t),
                b: Math.round(colors[idx].b + (colors[nextIdx].b - colors[idx].b) * t)
            }
        }
    },
    rainbow: { name: 'Rainbow', desc: 'Arcoíris suave', handler: (f) => hslToRgb((f * 2) % 360, 100, 50) },
    fire: { name: 'Fire', desc: 'Efecto fuego', handler: () => ({ r: 255, g: Math.round(80 + Math.random() * 80), b: Math.round(Math.random() * 30) }) },
    ocean: { name: 'Ocean', desc: 'Ondas oceánicas', handler: (f) => ({ r: 0, g: Math.round(100 + 50 * Math.sin(f * 0.05)), b: Math.round(200 + 55 * Math.sin(f * 0.03)) }) },
    aurora: { name: 'Aurora', desc: 'Aurora boreal', handler: (f) => ({ r: Math.round(50 + 50 * Math.sin(f * 0.02)), g: Math.round(200 + 55 * Math.sin(f * 0.02 + 2)), b: Math.round(150 + 100 * Math.sin(f * 0.02 + 4)) }) },
    pulse: { name: 'Pulse', desc: 'Pulso de color', handler: (f) => { const i = Math.sin(f * 0.1) * 0.5 + 0.5; return { r: Math.round(255 * i), g: 0, b: Math.round(255 * i) } } },
    strobe: { name: 'Strobe', desc: 'Estroboscópico', handler: (f) => f % 6 < 3 ? { r: 255, g: 255, b: 255 } : { r: 0, g: 0, b: 0 } },
    party: { name: 'Party', desc: 'Fiesta random', handler: () => { const c = [[255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 0], [255, 0, 255], [0, 255, 255]][Math.floor(Math.random() * 6)]; return { r: c[0], g: c[1], b: c[2] } } },
    sunset: { name: 'Sunset', desc: 'Atardecer cálido', handler: (f) => { const t = (Math.sin(f * 0.01) + 1) / 2; return { r: 255, g: Math.round(100 + 80 * t), b: Math.round(50 * t) } } },
    chill: { name: 'Chill', desc: 'Relajante', handler: (f) => hslToRgb(200 + 40 * Math.sin(f * 0.01), 60, 40) }
}

// ============================================================================
// DMX State
// ============================================================================

const dmxState = {
    channels: new Array(512).fill(0),
    blackout: false,
    savedState: null,
    flashActive: false,
    flashWhiteActive: false,
    dynamicScene: null,
    dynamicSceneFrame: 0,
    activeProgram: null,
    programSpeed: 127,
    ambilightActive: false,
    audioReactiveActive: false,
    performance: {
        dmxHz: 44,   // DMX512 standard
        uiHz: 30,    // Smoother UI sync
        ambiFps: 30
    },
    fixtureColors: [
        { r: 0, g: 0, b: 0, blackout: false },
        { r: 0, g: 0, b: 0, blackout: false },
        { r: 0, g: 0, b: 0, blackout: false }
    ]
}

let dynamicSceneInterval = null
let flashWhiteInterval = null

// ============================================================================
// Helper Functions
// ============================================================================

function hslToRgb(h, s, l) {
    s /= 100; l /= 100
    const a = s * Math.min(l, 1 - l)
    const f = n => { const k = (n + h / 30) % 12; return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1) }
    return { r: Math.round(f(0) * 255), g: Math.round(f(8) * 255), b: Math.round(f(4) * 255) }
}

function setFixtureColor(idx, r, g, b, dim = 255) {
    const f = fixtures[idx]
    if (!f) return
    const isBlackout = dmxState.fixtureColors[idx]?.blackout

    if (!isBlackout) {
        const base = f.startChannel - 1
        dmxState.channels[base + CHANNEL_MAP.RED] = r
        dmxState.channels[base + CHANNEL_MAP.GREEN] = g
        dmxState.channels[base + CHANNEL_MAP.BLUE] = b
        dmxState.channels[base + CHANNEL_MAP.DIM] = dim
    }
    // We update color state anyway so UI reflects what it "would" be? 
    // Or we keep it black in UI?
    // User wants "Toggle ON/OFF". If OFF, UI should probably be dark or show "OFF" state.
    // Let's keep internal RGB updated but send 0 to DMX? 
    // Actually, if we block DMX, we should also block UI color to show it's off.
    if (!isBlackout) {
        dmxState.fixtureColors[idx] = { r, g, b, blackout: false }
    }
}

function setAllFixturesColor(r, g, b, dim = 255) {
    fixtures.forEach((_, i) => setFixtureColor(i, r, g, b, dim))
}

function setFixtureChannel(idx, channel, value) {
    const f = fixtures[idx]
    if (!f) return
    if (dmxState.fixtureColors[idx]?.blackout) return // Block updates if blackout

    const offset = CHANNEL_MAP[channel.toUpperCase()]
    if (offset !== undefined) {
        dmxState.channels[f.startChannel - 1 + offset] = Math.max(0, Math.min(255, value))
    }
}

function setAllFixturesChannel(channel, value) {
    fixtures.forEach((_, i) => setFixtureChannel(i, channel, value))
}

// RESET ALL - Set all channels to 0
function resetAll() {
    stopDynamicScene()
    dmxState.activeProgram = null
    fixtures.forEach((f) => {
        const base = f.startChannel - 1
        for (let ch = 0; ch < 7; ch++) {
            dmxState.channels[base + ch] = 0
        }
    })
    dmxState.fixtureColors = [{ r: 0, g: 0, b: 0 }, { r: 0, g: 0, b: 0 }, { r: 0, g: 0, b: 0 }]
    broadcastColors()
}

function broadcastColors() {
    BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('dmx:colorsUpdated', dmxState.fixtureColors)
    })
}

// DMX Loop - 44Hz (Standard DMX Refresh Rate)
let dmxInterval = null
let uiInterval = null // Throttled UI update
let lastInternalColors = [{ r: 0, g: 0, b: 0 }, { r: 0, g: 0, b: 0 }, { r: 0, g: 0, b: 0 }]

// Optimized color comparison (no JSON.stringify overhead)
function colorsChanged() {
    for (let i = 0; i < 3; i++) {
        const curr = dmxState.fixtureColors[i]
        const last = lastInternalColors[i]
        if (!last || curr.r !== last.r || curr.g !== last.g || curr.b !== last.b) {
            return true
        }
    }
    return false
}

function startDMXLoop() {
    if (dmxInterval) clearInterval(dmxInterval)
    if (uiInterval) clearInterval(uiInterval)

    // Hardware Loop - 44Hz continuous transmission
    const dmxMs = Math.round(1000 / dmxState.performance.dmxHz)
    dmxInterval = setInterval(() => {
        if (dmxState.blackout) {
            for (let i = 0; i < 512; i++) sender.setChannel(i, 0)
        } else {
            for (let i = 0; i < 512; i++) sender.setChannel(i, dmxState.channels[i])
        }
        sender.transmit()
    }, dmxMs)

    // UI Broadcast Loop - Optimized (no JSON.stringify)
    const uiMs = Math.round(1000 / dmxState.performance.uiHz)
    uiInterval = setInterval(() => {
        if (colorsChanged()) {
            lastInternalColors = dmxState.fixtureColors.map(c => ({ ...c }))
            broadcastColors()
        }
    }, uiMs)
}

function stopDMXLoop() {
    if (dmxInterval) { clearInterval(dmxInterval); dmxInterval = null }
    if (uiInterval) { clearInterval(uiInterval); uiInterval = null }
}

// ============================================================================
// Dynamic Scene Loop
// ============================================================================

function startDynamicScene(sceneId) {
    stopDynamicScene()
    const scene = DYNAMIC_SCENES[sceneId]
    if (!scene) return false
    dmxState.dynamicScene = sceneId
    dmxState.dynamicSceneFrame = 0
    dynamicSceneInterval = setInterval(() => {
        const color = scene.handler(dmxState.dynamicSceneFrame)
        setAllFixturesColor(color.r, color.g, color.b, 255)
        dmxState.dynamicSceneFrame++
        // broadcastColors() -> UI interval will handle this at 20Hz
    }, 1000 / 44) // Match DMX loop frequency
    return true
}

function stopDynamicScene() {
    if (dynamicSceneInterval) { clearInterval(dynamicSceneInterval); dynamicSceneInterval = null }
    dmxState.dynamicScene = null
}

// ============================================================================
// IPC Handlers
// ============================================================================

function setupIPC() {
    ipcMain.handle('dmx:getFixtures', () => fixtures.map((f, i) => ({ ...f, color: dmxState.fixtureColors[i] })))

    ipcMain.handle('dmx:getConfig', () => ({
        funcRanges: FUNC_RANGES,
        flashSpeeds: FLASH_SPEEDS,
        programSpeeds: PROGRAM_SPEEDS,
        colorMacros: COLOR_MACROS,
        dynamicScenes: Object.entries(DYNAMIC_SCENES).map(([id, s]) => ({ id, name: s.name, desc: s.desc })),
        performance: dmxState.performance
    }))

    ipcMain.handle('dmx:updatePerformance', (_, settings) => {
        dmxState.performance = { ...dmxState.performance, ...settings }
        startDMXLoop() // Restart loops with new timing
        return { success: true, performance: dmxState.performance }
    })

    ipcMain.handle('dmx:reset', () => {
        resetAll()
        return { success: true, colors: dmxState.fixtureColors }
    })

    // ASYNC ONE-WAY IPC (High performance, used for Faders)
    ipcMain.on('dmx:setChannelAsync', (_, { channel, value }) => {
        setAllFixturesChannel(channel, value)
        if (['red', 'green', 'blue'].includes(channel.toLowerCase())) {
            fixtures.forEach((_, i) => { dmxState.fixtureColors[i][channel.toLowerCase()[0]] = value })
        }
        // broadcastColors() -> Removed to prevent IPC flood
    })

    ipcMain.on('dmx:setChannelsAsync', (_, { fixtureIds, channels }) => {
        const targets = fixtureIds.length > 0
            ? fixtureIds.map(id => fixtures.findIndex(f => f.id === id)).filter(i => i >= 0)
            : [0, 1, 2]
        targets.forEach(i => {
            Object.entries(channels).forEach(([ch, val]) => {
                setFixtureChannel(i, ch, val)
                if (['red', 'green', 'blue'].includes(ch.toLowerCase())) {
                    dmxState.fixtureColors[i][ch.toLowerCase()[0]] = val
                }
            })
        })
        // broadcastColors() -> UI interval will handle this
    })

    ipcMain.handle('dmx:toggleBlackout', (_, fixtureId) => {
        const idx = fixtures.findIndex(f => f.id === fixtureId)
        if (idx === -1) return { success: false }

        const currentState = dmxState.fixtureColors[idx].blackout
        const newState = !currentState

        dmxState.fixtureColors[idx].blackout = newState

        if (newState) {
            // Turn OFF: Clear channels
            const f = fixtures[idx]
            const base = f.startChannel - 1
            for (let i = 0; i < 7; i++) {
                dmxState.channels[base + i] = 0
            }
            // Update UI color to black (but keep blackout flag)
            dmxState.fixtureColors[idx] = { r: 0, g: 0, b: 0, blackout: true }
        }

        broadcastColors()
        return { success: true, blackout: newState, idx }
    })

    ipcMain.handle('dmx:setChannels', (_, { fixtureIds, channels }) => {
        const targets = fixtureIds.length > 0
            ? fixtureIds.map(id => fixtures.findIndex(f => f.id === id)).filter(i => i >= 0)
            : [0, 1, 2]
        targets.forEach(i => {
            Object.entries(channels).forEach(([ch, val]) => {
                setFixtureChannel(i, ch, val)
                if (['red', 'green', 'blue'].includes(ch.toLowerCase())) {
                    dmxState.fixtureColors[i][ch.toLowerCase()[0]] = val
                }
            })
        })
        broadcastColors()
        return { success: true, colors: dmxState.fixtureColors }
    })

    ipcMain.handle('dmx:setChannel', (_, { channel, value }) => {
        setAllFixturesChannel(channel, value)
        if (['red', 'green', 'blue'].includes(channel.toLowerCase())) {
            fixtures.forEach((_, i) => { dmxState.fixtureColors[i][channel.toLowerCase()[0]] = value })
        }
        broadcastColors()
        return { success: true, colors: dmxState.fixtureColors }
    })

    ipcMain.handle('dmx:colorMacro', (_, colorName) => {
        stopDynamicScene()
        dmxState.activeProgram = null
        const color = COLOR_MACROS[colorName.toUpperCase()]
        if (!color) return { success: false }
        setAllFixturesColor(color.r, color.g, color.b, color.r === 0 && color.g === 0 && color.b === 0 ? 0 : 255)
        setAllFixturesChannel('func', 0)
        setAllFixturesChannel('spd', 0)
        setAllFixturesChannel('flash', 0)
        broadcastColors()
        return { success: true, color, colors: dmxState.fixtureColors }
    })

    // Set Program - TOGGLE behavior
    ipcMain.handle('dmx:setProgram', (_, { program, speed }) => {
        stopDynamicScene()

        // If same program, toggle OFF (reset to 0)
        if (dmxState.activeProgram === program) {
            resetAll()
            return { success: true, program: null, speed: 0 }
        }

        // Activate new program
        setAllFixturesChannel('func', program)
        if (speed !== undefined) {
            setAllFixturesChannel('spd', speed)
            dmxState.programSpeed = speed
        }
        setAllFixturesChannel('dim', 255)
        dmxState.activeProgram = program
        return { success: true, program, speed: dmxState.programSpeed }
    })

    ipcMain.handle('dmx:setFlash', (_, speed) => {
        setAllFixturesChannel('flash', speed)
        return { success: true, speed }
    })

    ipcMain.handle('dmx:flashWhite', (_, active) => {
        if (active) {
            dmxState.flashWhiteActive = true
            dmxState.savedState = [...dmxState.channels]
            flashWhiteInterval = setInterval(() => {
                if (!dmxState.flashWhiteActive) return
                const on = (Date.now() % 200) < 100
                if (on) {
                    setAllFixturesColor(255, 255, 255, 255)
                    setAllFixturesChannel('flash', 255)
                } else {
                    setAllFixturesColor(0, 0, 0, 0)
                    setAllFixturesChannel('flash', 0)
                }
                broadcastColors()
            }, 50)
        } else {
            dmxState.flashWhiteActive = false
            if (flashWhiteInterval) { clearInterval(flashWhiteInterval); flashWhiteInterval = null }
            if (dmxState.savedState) dmxState.channels = [...dmxState.savedState]
        }
        return { success: true, active: dmxState.flashWhiteActive }
    })

    ipcMain.handle('dmx:blackout', (_, active) => {
        if (active && !dmxState.blackout) {
            dmxState.savedState = [...dmxState.channels]
            stopDynamicScene()
        } else if (!active && dmxState.blackout && dmxState.savedState) {
            dmxState.channels = [...dmxState.savedState]
        }
        dmxState.blackout = active
        return { success: true, blackout: dmxState.blackout }
    })

    ipcMain.handle('dmx:flash', async () => {
        if (dmxState.flashActive) return { success: false }
        dmxState.flashActive = true
        const saved = [...dmxState.channels]
        setAllFixturesColor(255, 255, 255, 255)
        setAllFixturesChannel('flash', 255)
        await new Promise(r => setTimeout(r, 100))
        dmxState.channels = saved
        dmxState.flashActive = false
        return { success: true }
    })

    ipcMain.handle('dmx:intenseFlash', async () => {
        if (dmxState.flashActive || dmxState.flashWhiteActive) return { success: false }

        dmxState.flashActive = true
        const savedChannels = [...dmxState.channels]
        const savedColors = [...dmxState.fixtureColors]

        // Set ALL to WHITE + MAX DIM + FLASH
        fixtures.forEach((f, i) => {
            const base = f.startChannel - 1
            dmxState.channels[base + CHANNEL_MAP.RED] = 255
            dmxState.channels[base + CHANNEL_MAP.GREEN] = 255
            dmxState.channels[base + CHANNEL_MAP.BLUE] = 255
            dmxState.channels[base + CHANNEL_MAP.DIM] = 255
            dmxState.channels[base + CHANNEL_MAP.FLASH] = 255
            dmxState.fixtureColors[i] = { r: 255, g: 255, b: 255 }
        })

        broadcastColors()

        // Wait 1.5s
        await new Promise(r => setTimeout(r, 1500))

        // Restore
        dmxState.channels = savedChannels
        dmxState.fixtureColors = savedColors
        dmxState.flashActive = false

        broadcastColors()
        return { success: true }
    })

    ipcMain.handle('dmx:meet', () => {
        stopDynamicScene()
        dmxState.activeProgram = null
        setAllFixturesColor(255, 255, 255, 255)
        setAllFixturesChannel('func', 0)
        setAllFixturesChannel('spd', 0)
        setAllFixturesChannel('flash', 0)
        broadcastColors()
        return { success: true, colors: dmxState.fixtureColors }
    })

    // Dynamic Scenes - TOGGLE behavior
    ipcMain.handle('dmx:dynamicScene', (_, { sceneId, active }) => {
        if (active) {
            dmxState.activeProgram = null
            startDynamicScene(sceneId)
            return { success: true, sceneId: dmxState.dynamicScene }
        } else {
            stopDynamicScene()
            resetAll() // Reset to 0 when stopping
            return { success: true, sceneId: null }
        }
    })

    ipcMain.handle('dmx:soundMode', (_, active) => {
        stopDynamicScene()
        if (active) {
            setAllFixturesChannel('func', 220)
            setAllFixturesChannel('dim', 255)
            dmxState.activeProgram = 220
        } else {
            resetAll()
        }
        return { success: true, active }
    })

    // Ambilight
    ipcMain.handle('ambilight:getSources', async () => {
        try {
            const sources = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 320, height: 180 } })
            return sources.map(s => ({ id: s.id, name: s.name, thumbnail: s.thumbnail.toDataURL() }))
        } catch (error) {
            console.error('Ambilight: Failed to get sources (Check Wayland/PipeWire permissions):', error)
            return []
        }
    })

    ipcMain.handle('ambilight:start', (_, sourceId) => { stopDynamicScene(); dmxState.activeProgram = null; dmxState.ambilightActive = true; return { success: true, sourceId } })
    ipcMain.handle('ambilight:stop', () => { dmxState.ambilightActive = false; resetAll(); return { success: true } })

    let lastAmbiColors = [{ r: 0, g: 0, b: 0 }, { r: 0, g: 0, b: 0 }, { r: 0, g: 0, b: 0 }]
    ipcMain.handle('ambilight:setColors', (_, { left, center, right }) => {
        if (!dmxState.ambilightActive) return { success: false }
        const smooth = (c, t, f = 0.8) => ({ r: Math.round(c.r + (t.r - c.r) * f), g: Math.round(c.g + (t.g - c.g) * f), b: Math.round(c.b + (t.b - c.b) * f) })
        const colors = [left, center, right].map((t, i) => smooth(lastAmbiColors[i], t))
        lastAmbiColors = colors
        setFixtureColor(0, colors[0].r, colors[0].g, colors[0].b, 255)
        setFixtureColor(1, colors[1].r, colors[1].g, colors[1].b, 255)
        setFixtureColor(2, colors[2].r, colors[2].g, colors[2].b, 255)
        // broadcastColors() -> UI interval will handle this
        return { success: true, colors: dmxState.fixtureColors }
    })

    // Async High-Frequency Ambilight update (One-way)
    ipcMain.on('ambilight:setColorsAsync', (_, { left, center, right }) => {
        if (!dmxState.ambilightActive) return

        const adaptiveSmooth = (cur, target) => {
            const diff = (Math.abs(cur.r - target.r) + Math.abs(cur.g - target.g) + Math.abs(cur.b - target.b)) / 3
            // If big change (flash/cut), go fast (0.9). If small change, go buttery smooth (0.1)
            const f = diff > 30 ? 0.8 : 0.2
            return {
                r: Math.round(cur.r + (target.r - cur.r) * f),
                g: Math.round(cur.g + (target.g - cur.g) * f),
                b: Math.round(cur.b + (target.b - cur.b) * f)
            }
        }

        const colors = [left, center, right].map((t, i) => adaptiveSmooth(lastAmbiColors[i], t))
        lastAmbiColors = colors

        setFixtureColor(0, colors[0].r, colors[0].g, colors[0].b, 255)
        setFixtureColor(1, colors[1].r, colors[1].g, colors[1].b, 255)
        setFixtureColor(2, colors[2].r, colors[2].g, colors[2].b, 255)
        // broadcastColors() -> Removed to prevent IPC flood
    })

    ipcMain.handle('audio:start', () => { stopDynamicScene(); dmxState.activeProgram = null; dmxState.audioReactiveActive = true; return { success: true } })
    ipcMain.handle('audio:stop', () => { dmxState.audioReactiveActive = false; resetAll(); return { success: true } })
    ipcMain.handle('audio:setLevel', (_, { bass, mid, high, volume }) => {
        if (!dmxState.audioReactiveActive) return { success: false }
        const r = Math.min(255, Math.round(Math.pow(bass, 1.5) * 255 + Math.pow(high, 1.3) * 100))
        const g = Math.min(255, Math.round(Math.pow(mid, 1.2) * 200))
        const b = Math.min(255, Math.round(Math.pow(high, 1.3) * 255 + Math.pow(bass, 1.5) * 50))
        const dim = Math.min(255, Math.round(128 + (volume || 0.5) * 127))
        setAllFixturesColor(r, g, b, dim)
        // broadcastColors() -> Removed to prevent IPC flood
        return { success: true, colors: dmxState.fixtureColors }
    })

    ipcMain.handle('scene:load', (_, sceneData) => {
        stopDynamicScene()
        dmxState.activeProgram = null
        fixtures.forEach((f, i) => {
            const base = f.startChannel - 1
            const d = sceneData.fixtures?.[i] || sceneData
            dmxState.channels[base + CHANNEL_MAP.RED] = d.red || 0
            dmxState.channels[base + CHANNEL_MAP.GREEN] = d.green || 0
            dmxState.channels[base + CHANNEL_MAP.BLUE] = d.blue || 0
            dmxState.channels[base + CHANNEL_MAP.FUNC] = d.func || 0
            dmxState.channels[base + CHANNEL_MAP.SPD] = d.spd || 0
            dmxState.channels[base + CHANNEL_MAP.FLASH] = d.flash || 0
            dmxState.channels[base + CHANNEL_MAP.DIM] = d.dim ?? 255
            dmxState.fixtureColors[i] = { r: d.red || 0, g: d.green || 0, b: d.blue || 0 }
        })
        broadcastColors()
        return { success: true, colors: dmxState.fixtureColors }
    })

    ipcMain.handle('dmx:getState', () => ({
        channels: dmxState.channels.slice(0, 21),
        blackout: dmxState.blackout,
        dynamicScene: dmxState.dynamicScene,
        activeProgram: dmxState.activeProgram,
        programSpeed: dmxState.programSpeed,
        ambilightActive: dmxState.ambilightActive,
        audioReactiveActive: dmxState.audioReactiveActive,
        flashWhiteActive: dmxState.flashWhiteActive,
        fixtureColors: dmxState.fixtureColors
    }))

    ipcMain.handle('theme:toggle', () => { nativeTheme.themeSource = nativeTheme.shouldUseDarkColors ? 'light' : 'dark'; return { theme: nativeTheme.shouldUseDarkColors ? 'dark' : 'light' } })
    ipcMain.handle('theme:get', () => ({ theme: nativeTheme.shouldUseDarkColors ? 'dark' : 'light' }))
    ipcMain.handle('theme:set', (_, theme) => { nativeTheme.themeSource = theme; return { theme } })
}

// ============================================================================
// Window Creation
// ============================================================================

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1400, height: 900, minWidth: 1100, minHeight: 750,
        show: false, autoHideMenuBar: true, backgroundColor: '#0a0a0a',
        frame: false, // Custom frame
        titleBarStyle: 'hidden', // Allows traffic lights on macOS, custom div on Windows/Linux
        icon: join(__dirname, '../../src/renderer/src/assets/logo.png'),
        webPreferences: { preload: join(__dirname, '../preload/index.js'), sandbox: false, contextIsolation: true, nodeIntegration: false }
    })

    // Window Ops
    ipcMain.on('window:minimize', () => mainWindow.minimize())
    ipcMain.on('window:maximize', () => { if (mainWindow.isMaximized()) mainWindow.unmaximize(); else mainWindow.maximize() })
    ipcMain.on('window:close', () => mainWindow.close())

    mainWindow.on('ready-to-show', () => mainWindow.show())
    mainWindow.webContents.setWindowOpenHandler((details) => { shell.openExternal(details.url); return { action: 'deny' } })

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
        mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
        mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
    }
}

// ============================================================================
// App Lifecycle
// ============================================================================

// Enable Wayland Screen Capture support
if (process.platform === 'linux') {
    app.commandLine.appendSwitch('enable-features', 'WebRTCPipeWireCapturer')
    app.commandLine.appendSwitch('enable-webrtc-pipewire-capturer') // Fallback legacy
}

app.whenReady().then(() => {
    electronApp.setAppUserModelId('com.beamstudio.dmx')
    app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))
    setupIPC()
    startDMXLoop()
    createWindow()
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('window-all-closed', () => { stopDMXLoop(); stopDynamicScene(); if (process.platform !== 'darwin') app.quit() })
app.on('before-quit', () => { stopDMXLoop(); stopDynamicScene(); for (let i = 0; i < 512; i++) sender.setChannel(i, 0); sender.transmit() })
