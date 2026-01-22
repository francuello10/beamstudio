import { app, shell, BrowserWindow, ipcMain, desktopCapturer, nativeTheme } from 'electron' // Force Rebuild 01:10
import { GoogleGenerativeAI } from '@google/generative-ai'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import dmxnet from 'dmxnet'
import { performance } from 'perf_hooks'
import { readFileSync, writeFileSync } from 'fs'

import { Worker } from 'worker_threads'

// Load dynamic fixtures
const FIXTURES_PATH = join(app.getPath('userData'), 'fixtures.json')
let fixtures = []

try {
    // Try to load from userData first (user changes), fallback to internal default
    fixtures = JSON.parse(readFileSync(FIXTURES_PATH, 'utf8'))
} catch (e) {
    fixtures = [
        { id: 1, name: 'Barra Izquierda', startChannel: 1, channels: 7 },
        { id: 2, name: 'Barra Centro', startChannel: 8, channels: 7 },
        { id: 3, name: 'Barra Derecha', startChannel: 15, channels: 7 }
    ]
}

const DMX_UNIVERSE_SIZE = 512
const dmxSharedBuffer = new SharedArrayBuffer(DMX_UNIVERSE_SIZE + 1)
const dmxArray = new Uint8Array(dmxSharedBuffer)
dmxArray[0] = 0 // Start Code byte

// Proxy to channels (1-indexed in DMX, 0-indexed in our subarray)
const dmxChannels = dmxArray.subarray(1)

// =============================================================
// DMX Driver Abstraction (Dual Mode: Art-Net or USB Direct)
// Cross-Platform: Ubuntu 24.04 / Windows 11
// ============================================================================

// Cross-platform default device path
function getDefaultDevicePath() {
    if (process.platform === 'win32') return 'COM3'
    if (process.platform === 'darwin') return '/dev/tty.usbserial-A'
    return '/dev/ttyUSB0'
}

// Known DMX USB device vendor IDs (for auto-detection)
const KNOWN_DMX_VENDORS = {
    '0403': 'FTDI (KMtronic, Enttec, DMXKing)',
    '10C4': 'Silicon Labs',
    '1A86': 'CH340 Clone',
}

// Available USB DMX drivers
const USB_DRIVERS = [
    { id: 'd2xx', name: 'FTDI D2XX Direct', desc: 'Direct USB communication (Ultra-low latency)' },
]

// Driver state - Singleton pattern with connection promise
let dmxMode = 'artnet'  // 'artnet' | 'usb'
let currentUsbDriver = 'd2xx'  // Default to D2XX (High Precision)
let nativeDevicePath = ''
let dmxDriver = null
let connectionPromise = null  // Tracks pending connection to prevent race conditions

// Art-Net setup (always available as fallback)
const dmxnetInstance = new dmxnet.dmxnet({
    log: { level: 'error' },
    oem: 0,
    sName: 'BeamStudio',
    lName: 'BeamStudio DMX Controller'
})

const artnetSender = dmxnetInstance.newSender({
    ip: '255.255.255.255',
    subnet: 0,
    universe: 0,
    net: 0,
    port: 6454,
    base_refresh_interval: 25
})

// Unified DMX Driver Interface
function createArtNetDriver() {
    return {
        mode: 'artnet',
        setChannel: (ch, val) => artnetSender.setChannel(ch, val),
        transmit: () => artnetSender.transmit(),
        close: () => { }  // Art-Net doesn't need cleanup
    }
}

async function closeExistingDriver() {
    if (dmxDriver && typeof dmxDriver.close === 'function') {
        console.log('[DMX] Closing existing driver:', dmxDriver.mode)
        try {
            await dmxDriver.close()
        } catch (e) {
            console.log('Driver close warning:', e.message)
        }
        dmxDriver = null
    }
}

// Initialize with Art-Net by default
dmxDriver = createArtNetDriver()

// List available ports (D2XX)
async function listSerialPorts() {
    let ports = []

    // 1. Get D2XX Devices (Preferred)
    try {
        const rawFTDI = await import('ftdi-d2xx')
        const FTDI = rawFTDI.default || rawFTDI
        const devices = await FTDI.getDeviceInfoList()

        const d2xxPorts = devices.map(d => ({
            path: d.serial_number,
            manufacturer: 'FTDI (Direct D2XX)',
            displayName: `FTDI USB DMX (${d.description || 'D2XX'}) - ${d.serial_number}`,
            type: 'd2xx',
            isRecommended: true
        }))

        ports = [...d2xxPorts]
    } catch (e) {
        console.error('D2XX scan failed:', e)
    }

    return ports
}

// Diagnostic scan (Removed as requested, using listSerialPorts for all)

// ============================================================================
// FTDI D2XX Direct Driver (Worker Thread High Precision)
// ============================================================================
async function createD2XXDriver(devicePath) {
    if (connectionPromise) { try { await connectionPromise } catch (e) { } if (dmxDriver && dmxDriver.mode === 'd2xx') return dmxDriver }

    connectionPromise = (async () => {
        try {
            // 1. Obtener dispositivos antes de lanzar el worker para asegurar un serial_number válido
            const rawFTDI = await import('ftdi-d2xx')
            const FTDI = rawFTDI.default || rawFTDI
            const devices = await FTDI.getDeviceInfoList()

            if (devices.length === 0) {
                console.warn('[DMX] No FTDI devices found during init')
                return null
            }

            const targetSerial = devicePath || devices[0].serial_number
            console.log(`[DMX] Selected device serial: ${targetSerial}`)

            // 2. Path al worker
            const workerPath = join(__dirname, 'dmxWorker.js')
            console.log(`[DMX] Spawning worker at ${workerPath}`)

            const worker = new Worker(workerPath, {
                workerData: {
                    sharedBuffer: dmxSharedBuffer,
                    serialNumber: targetSerial,
                    settings: {
                        dmxHz: dmxState.performance.dmxHz,
                        transmitLength: 33
                    }
                }
            })

            let isClosed = false

            return new Promise((resolve, reject) => {
                worker.on('message', (msg) => {
                    if (msg.type === 'status' && msg.status === 'connected') {
                        console.log('[DMX] Worker connected and transmitting')
                        resolve({
                            mode: 'd2xx',
                            driverName: 'FTDI D2XX (Worker Thread)',
                            devicePath: targetSerial,
                            worker: worker,
                            setChannel: (ch, val) => {
                                if (ch >= 0 && ch < DMX_UNIVERSE_SIZE) {
                                    dmxChannels[ch] = val
                                }
                            },
                            transmit: () => { },
                            close: async () => {
                                isClosed = true
                                worker.postMessage({ type: 'stop' })
                                worker.terminate()
                            }
                        })
                    }
                    if (msg.type === 'error') {
                        console.error('[DMX Worker] Error:', msg.error)
                        if (!isClosed) reject(new Error(msg.error))
                    }
                })

                worker.on('error', (err) => {
                    console.error('[DMX Worker] Critical Error:', err)
                    if (!isClosed) reject(err)
                })

                worker.on('exit', (code) => {
                    if (code !== 0 && !isClosed) console.error(`[DMX Worker] Stopped with exit code ${code}`)
                })
            })

        } catch (error) {
            console.error('[DMX] D2XX Worker Init Failed:', error.message)
            return null
        } finally { connectionPromise = null }
    })()
    return connectionPromise
}


// Switch DMX mode
async function switchDmxMode(mode, devicePath = null, driverType = 'd2xx') {
    console.log(`[DMX] Switching to mode: ${mode}, path: ${devicePath}, driver: ${driverType}`)

    if (mode === 'usb' || mode === 'native') {
        const path = devicePath || nativeDevicePath

        let newDriver = null

        // Support only D2XX for USB
        newDriver = await createD2XXDriver(path)

        console.log('[DMX] New driver created:', newDriver ? newDriver.driverName : 'null')

        if (newDriver) {
            await closeExistingDriver()
            dmxDriver = newDriver
            dmxMode = 'usb'
            currentUsbDriver = 'd2xx'
            nativeDevicePath = path
            console.log(`[DMX] Driver assigned: ${dmxDriver.driverName} on ${path}`)
            return { success: true, mode: 'usb', devicePath: path, driverType: 'd2xx' }
        } else {
            return { success: false, error: 'Failed to connect to FTDI device (Check if it is in use or driver missing)', mode: dmxMode }
        }
    } else {
        await closeExistingDriver()
        dmxDriver = createArtNetDriver()
        dmxMode = 'artnet'
        return { success: true, mode: 'artnet' }
    }
}

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

// Fixtures moved to dynamic loading (above)

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
    channels: dmxChannels,
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
    dynamicRendererActive: false, // For flags and renderer-driven scenes
    performance: {
        dmxHz: 44,   // DMX512 standard
        uiHz: 30,    // Smoother UI sync
        ambiFps: 30
    },
    fixtureColors: fixtures.map(() => ({ r: 0, g: 0, b: 0, blackout: false }))
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
        dmxState.channels[base + CHANNEL_MAP.RED] = Math.max(0, Math.min(255, r))
        dmxState.channels[base + CHANNEL_MAP.GREEN] = Math.max(0, Math.min(255, g))
        dmxState.channels[base + CHANNEL_MAP.BLUE] = Math.max(0, Math.min(255, b))
        dmxState.channels[base + CHANNEL_MAP.DIM] = Math.max(0, Math.min(255, dim))
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
    dmxState.fixtureColors = fixtures.map(() => ({ r: 0, g: 0, b: 0, blackout: false }))
    transmitNow()  // Immediate send!
    broadcastColors()
}

// Immediate DMX transmission - bypasses the 44Hz loop for instant response
function transmitNow() {
    if (dmxState.blackout) {
        for (let i = 0; i < 512; i++) dmxDriver.setChannel(i, 0)
    } else {
        for (let i = 0; i < 512; i++) dmxDriver.setChannel(i, dmxState.channels[i])
    }
    dmxDriver.transmit()
}

function broadcastColors() {
    BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('dmx:colorsUpdated', dmxState.fixtureColors)
    })
}

// DMX Loop - 44Hz (Standard DMX Refresh Rate)
let dmxInterval = null
let uiInterval = null // Throttled UI update
let lastInternalColors = fixtures.map(() => ({ r: 0, g: 0, b: 0 }))

// Optimized color comparison (no JSON.stringify overhead)
function colorsChanged() {
    for (let i = 0; i < fixtures.length; i++) {
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

    // Hardware Loop - Only for drivers that don't have their own loop (like Art-Net)
    // The D2XX Worker handles its own high-precision timing.
    if (dmxDriver.mode === 'artnet') {
        const dmxMs = Math.round(1000 / dmxState.performance.dmxHz)
        dmxInterval = setInterval(() => {
            if (dmxState.blackout) {
                for (let i = 0; i < 512; i++) dmxDriver.setChannel(i, 0)
            } else {
                for (let i = 0; i < 512; i++) dmxDriver.setChannel(i, dmxState.channels[i])
            }
            dmxDriver.transmit()
        }, dmxMs)
    }

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
        // Use current dimmer value instead of hardcoded 255
        fixtures.forEach((f, i) => {
            const currentDim = dmxState.channels[f.startChannel - 1 + CHANNEL_MAP.DIM]
            setFixtureColor(i, color.r, color.g, color.b, currentDim)
        })
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
    ipcMain.handle('ai:generate', async (_, { apiKey, model, prompt, systemInstruction }) => {
        try {
            console.log(`[AI] Starting generation request...`)
            const genAI = new GoogleGenerativeAI(apiKey)
            const modelId = model.includes('/') ? model : `models/${model}`
            console.log(`[AI] Model: ${modelId} (v1beta)`)

            const genModel = genAI.getGenerativeModel(
                { model: modelId, systemInstruction },
                { apiVersion: 'v1beta' }
            )

            console.log(`[AI] Sending prompt to Gemini...`)
            const result = await genModel.generateContent(prompt)

            console.log(`[AI] Response received. Extracting text...`)
            const response = await result.response
            const text = response.text()

            console.log(`[AI] Generation successful! (${text.length} chars)`)
            return text
        } catch (error) {
            console.error('[AI] Generation failed:', error)
            throw error
        }
    })

    ipcMain.handle('ai:test', async (_, { apiKey, model }) => {
        try {
            const genAI = new GoogleGenerativeAI(apiKey)
            const modelId = model.includes('/') ? model : `models/${model}`
            console.log(`[AI] Testing connection with model: ${modelId} (v1beta)`)

            const genModel = genAI.getGenerativeModel(
                { model: modelId },
                { apiVersion: 'v1beta' }
            )
            const result = await genModel.generateContent("Respond with only the word OK.")
            return result.response.text().trim()
        } catch (error) {
            console.error('[AI] Test failed:', error.message)
            throw error
        }
    })

    ipcMain.handle('ai:listModels', async (_, { apiKey }) => {
        return ["gemini-1.5-flash", "gemini-1.5-flash-8b", "gemini-1.5-pro", "gemini-2.0-flash-exp"]
    })

    ipcMain.handle('dmx:getFixtures', () => fixtures.map((f, i) => ({ ...f, color: dmxState.fixtureColors[i] })))

    ipcMain.handle('dmx:getConfig', () => ({
        funcRanges: FUNC_RANGES,
        flashSpeeds: FLASH_SPEEDS,
        programSpeeds: PROGRAM_SPEEDS,
        colorMacros: COLOR_MACROS,
        dynamicScenes: Object.entries(DYNAMIC_SCENES).map(([id, s]) => ({ id, name: s.name, desc: s.desc })),
        performance: dmxState.performance,
        dmxMode: dmxMode,
        nativeDevicePath: nativeDevicePath
    }))

    // DMX Mode Control
    ipcMain.handle('dmx:getMode', () => ({
        mode: dmxMode,
        devicePath: nativeDevicePath,
        driver: currentUsbDriver, // Expose current driver type
        driverName: dmxDriver?.driverName || 'Unknown',
        driverMode: dmxDriver?.mode || 'artnet'
    }))

    ipcMain.handle('dmx:listPorts', async () => {
        return await listSerialPorts()
    })

    ipcMain.handle('dmx:scanD2XX', async () => {
        return await scanForNonVCPDevices()
    })

    ipcMain.handle('dmx:getUsbDrivers', () => USB_DRIVERS)

    ipcMain.handle('dmx:setMode', async (_, { mode, devicePath, driver }) => {
        const result = await switchDmxMode(mode, devicePath, driver)
        if (result.success) {
            // Restart DMX loop with new driver
            startDMXLoop()
        }
        return result
    })

    ipcMain.handle('dmx:updatePerformance', (_, settings) => {
        dmxState.performance = { ...dmxState.performance, ...settings }

        // Update Worker if active
        if (dmxDriver && dmxDriver.mode === 'd2xx' && dmxDriver.worker) {
            dmxDriver.worker.postMessage({
                type: 'updateSettings',
                dmxHz: dmxState.performance.dmxHz
            })
        }

        startDMXLoop() // Restart main loops
        return { success: true, performance: dmxState.performance }
    })

    ipcMain.handle('dmx:reset', () => {
        resetAll()
        return { success: true, colors: dmxState.fixtureColors }
    })

    ipcMain.on('dmx:setChannelAsync', (_, { channel, value }) => {
        const validatedValue = Math.max(0, Math.min(255, value))
        setAllFixturesChannel(channel, validatedValue)
        if (['red', 'green', 'blue'].includes(channel.toLowerCase())) {
            fixtures.forEach((_, i) => { dmxState.fixtureColors[i][channel.toLowerCase()[0]] = validatedValue })
        }
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
        transmitNow()  // Instant response!
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
            if (dmxState.savedState) dmxState.channels.set(dmxState.savedState)
        }
        return { success: true, active: dmxState.flashWhiteActive }
    })

    ipcMain.handle('dmx:blackout', (_, active) => {
        if (active && !dmxState.blackout) {
            dmxState.savedState = [...dmxState.channels]
            stopDynamicScene()
        } else if (!active && dmxState.blackout && dmxState.savedState) {
            dmxState.channels.set(dmxState.savedState)
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
        dmxState.channels.set(saved)
        dmxState.flashActive = false
        return { success: true }
    })

    ipcMain.handle('dmx:intenseFlash', async () => {
        if (dmxState.flashActive || dmxState.flashWhiteActive) return { success: false }

        dmxState.flashActive = true
        dmxState.flashCancelled = false  // Reset cancel flag
        const savedChannels = [...dmxState.channels]
        const savedColors = [...dmxState.fixtureColors]

        // Helper to flash white
        const flashWhite = () => {
            fixtures.forEach((f, i) => {
                const base = f.startChannel - 1
                dmxState.channels[base + CHANNEL_MAP.RED] = 255
                dmxState.channels[base + CHANNEL_MAP.GREEN] = 255
                dmxState.channels[base + CHANNEL_MAP.BLUE] = 255
                dmxState.channels[base + CHANNEL_MAP.DIM] = 255
                dmxState.channels[base + CHANNEL_MAP.FLASH] = 255
                dmxState.fixtureColors[i] = { r: 255, g: 255, b: 255 }
            })
            transmitNow()
            broadcastColors()
        }

        // Helper to turn off
        const flashOff = () => {
            fixtures.forEach((f, i) => {
                const base = f.startChannel - 1
                dmxState.channels[base + CHANNEL_MAP.RED] = 0
                dmxState.channels[base + CHANNEL_MAP.GREEN] = 0
                dmxState.channels[base + CHANNEL_MAP.BLUE] = 0
                dmxState.channels[base + CHANNEL_MAP.DIM] = 0
                dmxState.channels[base + CHANNEL_MAP.FLASH] = 0
                dmxState.fixtureColors[i] = { r: 0, g: 0, b: 0 }
            })
            transmitNow()
            broadcastColors()
        }

        // 3 POPS in 4 seconds (pop every ~1.3s, each pop lasts 200ms)
        for (let i = 0; i < 3; i++) {
            if (dmxState.flashCancelled) break  // Early exit if cancelled
            flashWhite()
            await new Promise(r => setTimeout(r, 200))  // Pop duration
            if (dmxState.flashCancelled) break
            flashOff()
            if (i < 2 && !dmxState.flashCancelled) await new Promise(r => setTimeout(r, 1100))
        }

        // Restore original state (transmit multiple times for reliability)
        dmxState.channels.set(savedChannels)
        dmxState.fixtureColors = [...savedColors]
        dmxState.flashActive = false
        dmxState.flashCancelled = false

        // Send restored state multiple times to ensure hardware receives it
        transmitNow()
        await new Promise(r => setTimeout(r, 50))
        transmitNow()
        broadcastColors()

        return { success: true }
    })

    // Cancel Flash - Stops flash sequence immediately
    ipcMain.handle('dmx:cancelFlash', () => {
        dmxState.flashCancelled = true
        dmxState.flashActive = false
        dmxState.flashWhiteActive = false
        resetAll()  // Reset to black/saved state
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

    ipcMain.handle('dmx:setDynamicRendererActive', (_, active) => {
        dmxState.dynamicRendererActive = active
        if (!active) resetAll()
        return { success: true, active }
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

    let lastAmbiColors = fixtures.map(() => ({ r: 0, g: 0, b: 0 }))
    ipcMain.handle('ambilight:setColors', (_, { left, center, right, colors: incomingColors }) => {
        if (!dmxState.ambilightActive) return { success: false }

        const targetColors = incomingColors || [left, center, right]
        const smooth = (c, t, f = 0.8) => ({ r: Math.round(c.r + (t.r - c.r) * f), g: Math.round(c.g + (t.g - c.g) * f), b: Math.round(c.b + (t.b - c.b) * f) })

        const colors = fixtures.map((_, i) => {
            const target = targetColors[i] || targetColors[targetColors.length - 1] || { r: 0, g: 0, b: 0 }
            return smooth(lastAmbiColors[i] || { r: 0, g: 0, b: 0 }, target)
        })

        lastAmbiColors = colors
        colors.forEach((c, i) => {
            const f = fixtures[i]
            const currentDim = dmxState.channels[f.startChannel - 1 + CHANNEL_MAP.DIM]
            setFixtureColor(i, c.r, c.g, c.b, currentDim)
        })
        return { success: true, colors: dmxState.fixtureColors }
    })

    // Async High-Frequency Ambilight update (One-way)
    ipcMain.on('ambilight:setColorsAsync', (_, { left, center, right, colors: incomingColors }) => {
        if (!dmxState.ambilightActive && !dmxState.audioReactiveActive && !dmxState.dynamicRendererActive) return

        const targetColors = incomingColors || [left, center, right]

        const adaptiveSmooth = (cur, target) => {
            const diff = (Math.abs(cur.r - (target?.r || 0)) + Math.abs(cur.g - (target?.g || 0)) + Math.abs(cur.b - (target?.b || 0))) / 3
            const f = diff > 30 ? 0.8 : 0.2
            return {
                r: Math.round(cur.r + ((target?.r || 0) - cur.r) * f),
                g: Math.round(cur.g + ((target?.g || 0) - cur.g) * f),
                b: Math.round(cur.b + ((target?.b || 0) - cur.b) * f)
            }
        }

        const colors = fixtures.map((_, i) => {
            const target = targetColors[i] || targetColors[targetColors.length - 1] || { r: 0, g: 0, b: 0 }
            return adaptiveSmooth(lastAmbiColors[i] || { r: 0, g: 0, b: 0 }, target)
        })

        lastAmbiColors = colors
        colors.forEach((c, i) => {
            const f = fixtures[i]
            const currentDim = dmxState.channels[f.startChannel - 1 + CHANNEL_MAP.DIM]
            setFixtureColor(i, c.r, c.g, c.b, currentDim)
        })
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
        webPreferences: {
            preload: join(__dirname, '../preload/index.js'),
            sandbox: false,
            contextIsolation: true,
            nodeIntegration: false,
            backgroundThrottling: false  // CRITICAL: Keep audio engine running when minimized
        }
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

// Media Bridge - IPC Handler
// Returns { title, artist } or null
const execPromise = (cmd) => new Promise((resolve) => {
    const { exec } = require('child_process')
    exec(cmd, { timeout: 1500 }, (error, stdout) => {
        if (error || !stdout) resolve(null)
        else resolve(stdout.trim())
    })
})

const getWindowsMedia = async () => {
    const psScript = `
        try {
            $ctl = [Windows.Media.Control.GlobalSystemMediaTransportControls,Windows.Media.Control,ContentType=WindowsRuntime]::GetForCurrentView().SessionManager.GetCurrentSession()
            if ($ctl) {
                $info = $ctl.TryGetMediaPropertiesAsync().GetAwaiter().GetResult()
                Write-Output "$($info.Title)|$($info.Artist)"
            }
        } catch {}
    `
    // Encode command for PowerShell
    const cmd = `powershell -NoProfile -NonInteractive -Command "${psScript.replace(/\n/g, ' ')}"`
    const output = await execPromise(cmd)
    if (!output || !output.includes('|')) return null
    const [title, artist] = output.split('|')
    return { title: title.trim(), artist: artist.trim() }
}
const getLinuxMedia = async () => {
    const output = await execPromise("playerctl metadata --format '{{title}}|{{artist}}'")
    if (!output || !output.includes('|')) return null
    const [title, artist] = output.split('|')
    return { title: title.trim(), artist: artist.trim() }
}

ipcMain.handle('get-system-media', async () => {
    if (process.platform === 'win32') return await getWindowsMedia()
    if (process.platform === 'linux') return await getLinuxMedia()
    return null
})

app.whenReady().then(async () => {
    electronApp.setAppUserModelId('com.beamstudio.dmx')
    app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))
    setupIPC()

    // Auto-connect to D2XX by default (fall back to Art-Net)
    try {
        console.log('[DMX] Auto-connecting to D2XX...')
        const result = await switchDmxMode('usb', null, 'd2xx')
        if (!result.success) {
            console.log('[DMX] D2XX not found, using Art-Net fallback')
        }
    } catch (e) {
        console.log('[DMX] D2XX auto-connect failed:', e.message)
    }

    startDMXLoop()
    createWindow()
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('window-all-closed', () => { stopDMXLoop(); stopDynamicScene(); if (process.platform !== 'darwin') app.quit() })
app.on('before-quit', () => { stopDMXLoop(); stopDynamicScene(); for (let i = 0; i < 512; i++) dmxDriver.setChannel(i, 0); dmxDriver.transmit() })
