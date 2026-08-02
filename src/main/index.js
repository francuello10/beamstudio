import { app, shell, BrowserWindow, ipcMain, desktopCapturer, nativeTheme, screen, session } from 'electron' // Force Rebuild 01:10
import { GoogleGenerativeAI } from '@google/generative-ai'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { readFileSync } from 'fs'

import { Worker } from 'worker_threads'
import logger from './logger'

process.on('uncaughtException', (error) => {
    logger.error('[Process] uncaughtException:', error)
})

process.on('unhandledRejection', (reason) => {
    logger.error('[Process] unhandledRejection:', reason)
})

// Load dynamic fixtures
const FIXTURES_PATH = join(app.getPath('userData'), 'fixtures.json')
let fixtures = []

try {
    // Try to load from userData first (user changes), fallback to internal default
    fixtures = JSON.parse(readFileSync(FIXTURES_PATH, 'utf8'))
    // Migración V2: Asegurar que todos los fixtures guardados tengan 'mode'. Si no, asume 'P06' (Retrocompatibilidad).
    fixtures = fixtures.map(f => ({ ...f, mode: f.mode || 'P06' }))
} catch (e) {
    fixtures = [
        { id: 3, name: 'Luz 3 (TV Izq)', startChannel: 15, channels: 7, mode: 'P06' },
        { id: 1, name: 'Luz 1 (Mon Izq)', startChannel: 1, channels: 7, mode: 'P06' },
        { id: 2, name: 'Luz 2 (Mon Der)', startChannel: 8, channels: 7, mode: 'P06' }
    ]
}

// BS-006 phase 2: projection-mapping surface presets, mirroring the
// fixtures.json persistence pattern exactly (userData JSON file, read on
// demand, written back on every mutation — no in-memory cache needed since
// preset saves/loads are rare, operator-driven actions, not per-frame state).
const MAPPING_PRESETS_PATH = join(app.getPath('userData'), 'mapping-presets.json')

// BS-006 phase 2 fix: last surfaces array pushed by EITHER window (main or
// projector) via mapping:setSurfaces, cached here so a freshly-mounted
// projector window (e.g. after the operator closes/reopens it) can pull
// current state instead of a newly-mounted MappingCompositor pushing its own
// [DEFAULT_SURFACE] initial state back out and silently clobbering whatever
// richer layout was already live. Updated unconditionally in the
// mapping:setSurfaces handler below, even when there are zero other windows
// to relay to.
let lastKnownSurfaces = null

function readMappingPresets() {
    try {
        const data = JSON.parse(readFileSync(MAPPING_PRESETS_PATH, 'utf8'))
        // Guard against valid-JSON-but-wrong-shape content (e.g. `[]` or
        // `"oops"`) — without this, `data[name] = surfaces` below silently
        // succeeds but JSON.stringify on the result either drops the write
        // (array) or throws (primitive), corrupting/losing saved presets.
        if (typeof data !== 'object' || data === null || Array.isArray(data)) {
            return {}
        }
        return data
    } catch (e) {
        // Missing file (first run) or corrupt JSON — start from an empty
        // preset set rather than throwing, same as fixtures' fallback above.
        return {}
    }
}

function writeMappingPresets(data) {
    const fs = require('fs')
    fs.writeFileSync(MAPPING_PRESETS_PATH, JSON.stringify(data, null, 2))
}

const DMX_UNIVERSE_SIZE = 512
const dmxSharedBuffer = new SharedArrayBuffer(DMX_UNIVERSE_SIZE + 1)
const dmxArray = new Uint8Array(dmxSharedBuffer)
dmxArray[0] = 0 // Start Code byte

// Proxy to channels (1-indexed in DMX, 0-indexed in our subarray)
const dmxChannels = dmxArray.subarray(1)

// =============================================================
// DMX Driver Abstraction (Native USB Direct)
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

// Available USB DMX drivers - STRICT ISOLATION BY OS
function getAvailableDrivers() {
    if (process.platform === 'win32') {
        return [
            { id: 'd2xx', name: 'FTDI D2XX Direct', desc: 'Direct USB communication (Ultra-low latency) [WINDOWS ONLY]' }
        ]
    }
    // Linux / Mac (Kernel Drivers)
    return [
        { id: 'serialport', name: 'Enttec Open DMX (Kernel)', desc: 'Linux Kernel Driver (Ultra-low latency via /dev/ttyUSB0)' }
    ]
}

// Driver state - Singleton pattern with connection promise
let dmxMode = 'usb'
let currentUsbDriver = process.platform === 'win32' ? 'd2xx' : 'serialport' // Default based on OS
let nativeDevicePath = ''
let dmxDriver = null
let connectionPromise = null  // Tracks pending connection to prevent race conditions

async function closeExistingDriver() {
    if (dmxDriver && typeof dmxDriver.close === 'function') {
        logger.log('[DMX] Closing existing driver:', dmxDriver.mode)
        try {
            await dmxDriver.close()
        } catch (e) {
            logger.warn('Driver close warning:', e.message)
        }
        dmxDriver = null
    }
}

// List available ports (D2XX)
// List available ports (Context Aware)
async function listSerialPorts() {
    // 1. Windows: Use D2XX
    if (process.platform === 'win32') {
        try {
            const rawFTDI = await import('ftdi-d2xx')
            const FTDI = rawFTDI.default || rawFTDI
            const devices = await FTDI.getDeviceInfoList()

            return devices.map(d => ({
                path: d.serial_number,
                manufacturer: 'FTDI (Direct D2XX)',
                displayName: `FTDI USB DMX (${d.description || 'D2XX'}) - ${d.serial_number}`,
                type: 'd2xx',
                isRecommended: true
            }))
        } catch (e) {
            logger.error('D2XX scan failed:', e)
            return []
        }
    }

    // 2. Linux: Use SerialPort (Kernel)
    try {
        const { SerialPort } = require('serialport')
        const ports = await SerialPort.list()

        // Filter for relevant USB-DMX devices (FTDI, CH340, etc)
        const dmxPorts = ports.filter(p =>
            p.vendorId && Object.keys(KNOWN_DMX_VENDORS).includes(p.vendorId.toUpperCase())
        )

        return dmxPorts.map(p => ({
            path: p.path,
            manufacturer: KNOWN_DMX_VENDORS[p.vendorId?.toUpperCase()] || p.manufacturer || 'Generic USB',
            displayName: `${p.path} (${p.manufacturer || 'USB DMX'})`,
            type: 'serialport',
            isRecommended: true
        }))

    } catch (e) {
        logger.error('SerialPort scan failed:', e)
        return []
    }
}

// Diagnostic scan (Removed as requested, using listSerialPorts for all)

// ============================================================================
// FTDI D2XX Direct Driver (Worker Thread High Precision)
// ============================================================================
// ============================================================================
// FTDI D2XX Direct Driver (Windows)
// ============================================================================
async function createD2XXDriver(devicePath) {
    if (connectionPromise) { try { await connectionPromise } catch (e) { } if (dmxDriver && dmxDriver.mode === 'd2xx') return dmxDriver }

    connectionPromise = (async () => {
        try {
            const rawFTDI = await import('ftdi-d2xx')
            const FTDI = rawFTDI.default || rawFTDI
            const devices = await FTDI.getDeviceInfoList()

            if (devices.length === 0) {
                logger.warn('[DMX] No FTDI devices found during init')
                return null
            }

            const targetSerial = devicePath || devices[0].serial_number
            logger.log(`[DMX] Selected device serial: ${targetSerial}`)

            // Path al worker
            const workerPath = join(__dirname, 'dmxWorker.js')
            logger.log(`[DMX] Spawning worker at ${workerPath}`)

            const worker = new Worker(workerPath, {
                workerData: {
                    sharedBuffer: dmxSharedBuffer,
                    serialNumber: targetSerial,
                    settings: {
                        dmxHz: dmxState.performance.dmxHz,
                        transmitLength: 33 // Reverted to 33 for limited hardware controller
                    }
                }
            })

            let isClosed = false

            return new Promise((resolve, reject) => {
                worker.on('message', (msg) => {
                    if (msg.type === 'status' && msg.status === 'connected') {
                        logger.log('[DMX] Worker connected and transmitting')
                        resolve({
                            mode: 'd2xx',
                            driverName: 'FTDI D2XX (Windows)',
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
                        logger.error('[DMX Worker] Error:', msg.error)
                        if (!isClosed) reject(new Error(msg.error))
                    }
                })

                worker.on('error', (err) => {
                    logger.error('[DMX Worker] Critical Error:', err)
                    if (!isClosed) reject(err)
                })

                worker.on('exit', (code) => {
                    if (code !== 0 && !isClosed) logger.error(`[DMX Worker] Stopped with exit code ${code}`)
                })
            })

        } catch (error) {
            logger.error('[DMX] D2XX Worker Init Failed:', error.message)
            return null
        } finally { connectionPromise = null }
    })()
    return connectionPromise
}

// ============================================================================
// Linux SerialPort Driver (Kernel)
// ============================================================================
async function createSerialPortDriver(devicePath) {
    if (connectionPromise) { try { await connectionPromise } catch (e) { } if (dmxDriver && dmxDriver.mode === 'serialport') return dmxDriver }

    connectionPromise = (async () => {
        try {
            const targetPath = devicePath || '/dev/ttyUSB0'
            logger.log(`[DMX Linux] Selected device path: ${targetPath}`)

            const workerPath = join(__dirname, 'serialWorker.js')
            logger.log(`[DMX Linux] Spawning worker at ${workerPath}`)

            const worker = new Worker(workerPath, {
                workerData: {
                    sharedBuffer: dmxSharedBuffer,
                    serialNumber: targetPath, // For serialport, serialNumber is the PATH
                    settings: {
                        dmxHz: dmxState.performance.dmxHz,
                        transmitLength: 33 // Reverted to 33 for limited hardware controller
                    }
                }
            })

            let isClosed = false

            return new Promise((resolve, reject) => {
                worker.on('message', (msg) => {
                    if (msg.type === 'status' && msg.status === 'connected') {
                        logger.log('[DMX Linux] Worker connected')
                        resolve({
                            mode: 'serialport',
                            driverName: 'Enttec Open DMX (Linux)',
                            devicePath: targetPath,
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
                        logger.error('[DMX Linux Worker] Error:', msg.error)
                        if (!isClosed) reject(new Error(msg.error))
                    }
                })

                worker.on('error', (err) => reject(err))
                worker.on('exit', (code) => { if (code !== 0) logger.error(`[DMX Linux] Worker exit ${code}`) })
            })

        } catch (error) {
            logger.error('[DMX Linux] Init Failed:', error.message)
            return null
        } finally { connectionPromise = null }
    })()
    return connectionPromise
}



// Switch DMX mode
async function switchDmxMode(mode, devicePath = null, driverType = 'd2xx') {
    logger.log(`[DMX] Switching to mode: ${mode}, path: ${devicePath}, driver: ${driverType}`)

    if (mode === 'usb' || mode === 'native') {
        const path = devicePath || nativeDevicePath

        let newDriver = null

        // STRICT OS CHECK
        if (process.platform === 'win32') {
            newDriver = await createD2XXDriver(path)
        } else {
            newDriver = await createSerialPortDriver(path)
        }

        logger.log('[DMX] New driver created:', newDriver ? newDriver.driverName : 'null')

        if (newDriver) {
            await closeExistingDriver()
            dmxDriver = newDriver
            dmxMode = 'usb'
            currentUsbDriver = process.platform === 'win32' ? 'd2xx' : 'serialport'
            nativeDevicePath = path
            logger.log(`[DMX] Driver assigned: ${dmxDriver.driverName} on ${path}`)
            return { success: true, mode: 'usb', devicePath: path, driverType: currentUsbDriver }
        } else {
            return { success: false, error: 'Failed to connect to USB device (Check if it is in use or driver missing)', mode: dmxMode }
        }
    }

    return {
        success: false,
        error: 'Art-Net mode has been removed from the local BeamStudio runtime',
        mode: dmxMode
    }
}

// ============================================================================
// Fixture Profiles (V2 Architecture)
// Defines how each fixture personality responds to global software commands.
// ============================================================================

const FIXTURE_PROFILES = {
    'P06': { // Default 7-channel mode (RGB + Func + Speed + Flash + Dimmer)
        name: 'P06 (7-Ch) - StickTec Full Control',
        channels: 7,
        segments: 1,
        hasMasterDimmer: true,
        map: { RED: 0, GREEN: 1, BLUE: 2, FUNC: 3, SPD: 4, FLASH: 5, DIM: 6 }
    },
    'P01': { // 7-channel mode (Same as P06 on some sticks)
        name: 'P01 (7-Ch) - Alternative P06',
        channels: 7,
        segments: 1,
        hasMasterDimmer: true,
        map: { RED: 0, GREEN: 1, BLUE: 2, FUNC: 3, SPD: 4, FLASH: 5, DIM: 6 }
    },
    'P02': { // 4-channel mode (RGB + Dimmer Global)
        name: 'P02 (4-Ch) - RGB + Master Dimmer',
        channels: 4,
        segments: 1,
        hasMasterDimmer: true,
        map: { RED: 0, GREEN: 1, BLUE: 2, DIM: 3 }
    }
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
// Dynamic Scenes (Software-based) — V6.0 Premium Collection
// All scenes use perFixture for independent 3-bar control.
// Time base: f = frame count at 44Hz → t = f / 44 (seconds)
// ============================================================================

// Organic noise from layered sine waves
const _wave = (t, seed) =>
    Math.sin(t * 0.7 + seed) * 0.5 +
    Math.sin(t * 1.3 + seed * 2.1) * 0.3 +
    Math.sin(t * 2.1 + seed * 0.7) * 0.2

const DYNAMIC_SCENES = {
    // ── AMBIENT / CHILL ──────────────────────────────────────────────────
    vibe: {
        name: 'Vibe', desc: 'Dreamy pastels',
        perFixture: true,
        handler: (f) => {
            const t = f / 44 * 0.5
            return [0, 1, 2].map(i =>
                hslToRgb((t * 15 + i * 50) % 360, 45, 72)
            )
        }
    },
    aesthetic: {
        name: 'Aesthetic', desc: 'Vaporwave gradient',
        perFixture: true,
        handler: (f) => {
            const t = f / 44 * 0.5
            return [0, 1, 2].map(i => {
                const base = 280 + Math.sin(t * 0.3 + i * 1.2) * 50
                const sat = 75 + Math.sin(t * 0.5 + i) * 15
                return hslToRgb(((base % 360) + 360) % 360, sat, 55)
            })
        }
    },
    chill: {
        name: 'Chill', desc: 'Deep relaxing ambient',
        perFixture: true,
        handler: (f) => {
            const t = f / 44 * 0.5
            return [0, 1, 2].map(i => {
                const h = 200 + Math.sin(t * 0.2 + i * 0.8) * 30
                const l = 30 + Math.sin(t * 0.15 + i * 1.5) * 10
                return hslToRgb(h, 60, l)
            })
        }
    },
    zen: {
        name: 'Zen', desc: 'Warm meditation',
        perFixture: true,
        handler: (f) => {
            const t = f / 44 * 0.5
            return [0, 1, 2].map(i => {
                const breath = (Math.sin(t * 0.3 + i * 0.3) + 1) / 2
                const h = 35 + breath * 10
                const l = 60 + breath * 15
                return hslToRgb(h, 30, l)
            })
        }
    },
    romance: {
        name: 'Romance', desc: 'Sensual passion',
        perFixture: true,
        handler: (f) => {
            const t = f / 44 * 0.5
            return [0, 1, 2].map(i => {
                const phase = Math.sin(t * 0.25 + i * 0.8) * 0.5 + 0.5
                const h = (340 + phase * 40) % 360
                const l = 40 + Math.sin(t * 0.3 + i * 1.5) * 12
                return hslToRgb(h, 90, l)
            })
        }
    },
    // ── NATURE ────────────────────────────────────────────────────────────
    rainbow: {
        name: 'Rainbow', desc: 'Flowing spectrum',
        perFixture: true,
        handler: (f) => {
            const t = f / 44 * 0.5
            return [0, 1, 2].map(i =>
                hslToRgb((t * 20 + i * 120) % 360, 100, 50)
            )
        }
    },
    aurora: {
        name: 'Aurora', desc: 'Northern lights',
        perFixture: true,
        handler: (f) => {
            const t = f / 44 * 0.5
            return [0, 1, 2].map(i => {
                const w = _wave(t * 0.4, i * 1.5)
                const h = w > 0 ? 120 + w * 40 : 280 + w * 40
                const l = 40 + Math.sin(t * 0.3 + i * 0.7) * 15
                return hslToRgb(((h % 360) + 360) % 360, 90, l)
            })
        }
    },
    ocean: {
        name: 'Ocean', desc: 'Deep sea waves',
        perFixture: true,
        handler: (f) => {
            const t = f / 44 * 0.5
            return [0, 1, 2].map(i => {
                const w = Math.sin(t * 0.5 + i * 1.2) * 0.5 + Math.cos(t * 0.3 - i * 0.8) * 0.3
                const h = 200 + w * 25
                const l = 35 + w * 12
                return hslToRgb(h, 85, l)
            })
        }
    },
    forest: {
        name: 'Forest', desc: 'Green canopy',
        perFixture: true,
        handler: (f) => {
            const t = f / 44 * 0.5
            return [0, 1, 2].map(i => {
                const dapple = Math.sin(t * 0.6 + i * 2.1) * Math.cos(t * 0.3 + i * 1.3)
                const h = 110 + dapple * 30
                const l = 30 + (dapple + 1) * 15
                return hslToRgb(h, 70, l)
            })
        }
    },
    sunset: {
        name: 'Sunset', desc: 'Golden hour',
        perFixture: true,
        handler: (f) => {
            const t = f / 44 * 0.5
            return [0, 1, 2].map(i => {
                const h = 15 + Math.sin(t * 0.2 + i * 0.6) * 20
                const l = 50 + Math.sin(t * 0.15 + i * 1.2) * 10
                return hslToRgb(((h % 360) + 360) % 360, 100, l)
            })
        }
    },
    cordoba_sky: {
        name: 'Córdoba Sky', desc: 'Majestic sunset',
        perFixture: true,
        handler: (f) => {
            const t = f / 44 * 0.5
            const tSlow = t * 0.08
            return [0, 1, 2].map(i => {
                const w = Math.sin(tSlow + i * 0.5) + Math.sin(tSlow * 0.3 + i) * 0.5
                const n = (w + 1.5) / 3
                const h = n < 0.5 ? 280 + (n * 2) * 80 : (n - 0.5) * 2 * 40
                return hslToRgb(((h % 360) + 360) % 360, 100, 50)
            })
        }
    },
    tropical: {
        name: 'Tropical', desc: 'Vivid paradise',
        perFixture: true,
        handler: (f) => {
            const t = f / 44 * 0.5
            const hues = [175, 15, 45]
            return [0, 1, 2].map(i => {
                const idx = Math.floor((t * 0.15 + i * 0.33) % 3)
                const blend = (t * 0.15 + i * 0.33) % 1
                const h1 = hues[idx % 3], h2 = hues[(idx + 1) % 3]
                const diff = h2 - h1
                const h = h1 + (Math.abs(diff) > 180 ? diff + 360 : diff) * (blend * blend * (3 - 2 * blend))
                return hslToRgb(((h % 360) + 360) % 360, 90, 55)
            })
        }
    },
    // ── FIRE & ENERGY ────────────────────────────────────────────────────
    fire: {
        name: 'Fire', desc: 'Dancing flames',
        perFixture: true,
        handler: (f) => {
            const t = f / 44
            return [0, 1, 2].map(i => {
                const flicker = Math.sin(t * 8 + i * 3.7) * 0.3 +
                    Math.sin(t * 13 + i * 5.1) * 0.2 +
                    Math.sin(t * 3 + i * 1.9) * 0.5
                const h = 10 + (flicker + 1) * 15
                const l = 35 + (flicker + 1) * 18
                return hslToRgb(h, 100, l)
            })
        }
    },
    lava: {
        name: 'Lava', desc: 'Flowing magma',
        perFixture: true,
        handler: (f) => {
            const t = f / 44 * 0.5
            return [0, 1, 2].map(i => {
                const flow = Math.sin(t * 0.4 + i * 1.5) * 0.5 + Math.cos(t * 0.2 - i * 2.1) * 0.3
                const h = 5 + (flow + 1) * 12
                const l = 25 + (flow + 1) * 18
                return hslToRgb(h, 100, l)
            })
        }
    },
    fireball: {
        name: 'Fireball', desc: 'Chase de fuego',
        perFixture: true,
        handler: (f) => {
            const t = f / 44 * 0.5
            const cycle = 4
            const pos = ((t % cycle) / cycle) * 4 - 1
            return [0, 1, 2].map(i => {
                const dist = Math.abs(pos - i)
                const intensity = Math.max(0, 1 - dist * 1.5)
                return hslToRgb(60 * intensity, 100, 50 * intensity)
            })
        }
    },
    // ── MOODY / DARK ─────────────────────────────────────────────────────
    midnight: {
        name: 'Midnight', desc: 'Deep night tones',
        perFixture: true,
        handler: (f) => {
            const t = f / 44 * 0.5
            return [0, 1, 2].map(i => {
                const glow = Math.sin(t * 0.25 + i * 2.0) * 0.5 + 0.5
                const h = 235 + Math.sin(t * 0.1 + i * 1.3) * 15
                const l = 8 + glow * 20
                return hslToRgb(h, 70, l)
            })
        }
    },
    galaxy: {
        name: 'Galaxy', desc: 'Deep space nebula',
        perFixture: true,
        handler: (f) => {
            const t = f / 44 * 0.5
            return [0, 1, 2].map(i => {
                const drift = Math.sin(t * 0.2 + i * 1.8) + Math.cos(t * 0.15 + i * 2.5) * 0.5
                const n = (drift + 1.5) / 3
                const h = n < 0.5 ? 280 - n * 2 * 40 : 240 + (n - 0.5) * 2 * 70
                const l = 25 + Math.sin(t * 0.5 + i * 3.14) * 15
                return hslToRgb(((h % 360) + 360) % 360, 85, l)
            })
        }
    },
    biolum: {
        name: 'Biolum', desc: 'Bioluminescence',
        perFixture: true,
        handler: (f) => {
            const t = f / 44 * 0.5
            return [0, 1, 2].map(i => {
                const noise = Math.sin(t * 1.5 + i * 132.1) * Math.cos(t * 3.5 - i * 45.3)
                const isSparkle = noise > 0.7
                const h = isSparkle ? 160 : 240
                const l = isSparkle ? 75 : 15 + (noise + 1) * 8
                return hslToRgb(h, 100, l)
            })
        }
    },
    // ── ELECTRONIC / ENERGY ──────────────────────────────────────────────
    neon: {
        name: 'Neon', desc: 'Cyberpunk glow',
        perFixture: true,
        handler: (f) => {
            const t = f / 44 * 0.5
            return [0, 1, 2].map(i => {
                const swap = Math.sin(t * 0.6 + i * 2.09) * 0.5 + 0.5
                const h = swap > 0.5 ? 330 : 210
                const l = 50 + Math.sin(t * 1.0 + i * 1.5) * 10
                return hslToRgb(h, 100, l)
            })
        }
    },
    pulse: {
        name: 'Pulse', desc: 'Heartbeat rhythm',
        perFixture: true,
        handler: (f) => {
            const t = f / 44 * 0.5
            const beat = Math.pow((Math.sin(t * 1.5) + 1) / 2, 3)
            return [0, 1, 2].map(i => {
                const h = 280 + i * 20
                const l = 10 + beat * 55
                return hslToRgb(h, 100, l)
            })
        }
    },
    strobe: {
        name: 'Strobe', desc: 'High energy flash',
        perFixture: true,
        handler: (f) => {
            const on = f % 6 < 3
            const h = (f * 30) % 360
            return [0, 1, 2].map(i => {
                if (!on) return { r: 0, g: 0, b: 0 }
                return hslToRgb((h + i * 120) % 360, 100, 50)
            })
        }
    },
    party: {
        name: 'Party', desc: 'Smooth party colors',
        perFixture: true,
        handler: (f) => {
            const t = f / 44
            return [0, 1, 2].map(i => {
                const h = (t * 60 + Math.sin(t * 2.5 + i * 3.14) * 120 + i * 120) % 360
                return hslToRgb(((h % 360) + 360) % 360, 100, 50)
            })
        }
    },
    rave: {
        name: 'Rave', desc: 'Fast energy cycle',
        perFixture: true,
        handler: (f) => {
            const t = f / 44
            return [0, 1, 2].map(i => {
                const h = (t * 90 + i * 120) % 360
                const l = 45 + Math.sin(t * 6 + i * 2) * 15
                return hslToRgb(h, 100, l)
            })
        }
    },
    // ── SPATIAL / CHASE ──────────────────────────────────────────────────
    cylon: {
        name: 'Cylon', desc: 'Scanner eye',
        perFixture: true,
        handler: (f) => {
            const t = f / 44 * 0.5
            const cycle = 3
            const phase = (t % cycle) / cycle
            const pos = (Math.sin(phase * Math.PI * 2) + 1)
            return [0, 1, 2].map(i => {
                const dist = Math.abs(pos - i)
                const intensity = Math.pow(Math.max(0, 1 - dist), 3)
                return { r: Math.round(255 * intensity), g: 0, b: 0 }
            })
        }
    },
    plasma: {
        name: 'Plasma', desc: 'Purple energy',
        perFixture: true,
        handler: (f) => {
            const t = f / 44 * 0.5
            return [0, 1, 2].map(i => {
                const v = Math.sin(t * 0.8 + i * 0.5) + Math.cos(t * 0.4 - i)
                const h = 270 + v * 30
                const l = Math.max(15, Math.min(70, 40 + v * 10 + Math.sin(t * 1.2 + i * 2) * 8))
                return hslToRgb(((h % 360) + 360) % 360, 100, l)
            })
        }
    }
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
    outputOwner: 'manual',
    ambilightActive: false,
    audioReactiveActive: false,
    dynamicRendererActive: false, // For flags and renderer-driven scenes
    performance: {
        dmxHz: 44,   // DMX512 standard
        uiHz: 60,    // Max UI Sync
        ambiFps: 60  // Max Game Capture
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
    const profile = FIXTURE_PROFILES[f.mode] || FIXTURE_PROFILES['P06']
    const isBlackout = dmxState.fixtureColors[idx]?.blackout

    if (!isBlackout && profile.map) {
        const base = f.startChannel - 1

        // Asignamos el color principal recuperando los indices del mapa
        if (profile.map.RED !== undefined) dmxState.channels[base + profile.map.RED] = Math.max(0, Math.min(255, r))
        if (profile.map.GREEN !== undefined) dmxState.channels[base + profile.map.GREEN] = Math.max(0, Math.min(255, g))
        if (profile.map.BLUE !== undefined) dmxState.channels[base + profile.map.BLUE] = Math.max(0, Math.min(255, b))
        if (profile.hasMasterDimmer && profile.map.DIM !== undefined) {
            dmxState.channels[base + profile.map.DIM] = Math.max(0, Math.min(255, dim))
        }
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

    const profile = FIXTURE_PROFILES[f.mode] || FIXTURE_PROFILES['P06']
    const offset = profile.map[channel.toUpperCase()]

    if (offset !== undefined) {
        dmxState.channels[f.startChannel - 1 + offset] = Math.max(0, Math.min(255, value))
    }
}

function setAllFixturesChannel(channel, value) {
    fixtures.forEach((_, i) => setFixtureChannel(i, channel, value))
}

function getFixtureProfile(fixture) {
    return FIXTURE_PROFILES[fixture?.mode] || FIXTURE_PROFILES['P06']
}

function getFixtureMasterDimValue(fixture) {
    if (!fixture) return 0
    const profile = getFixtureProfile(fixture)
    if (!profile.hasMasterDimmer || profile.map.DIM === undefined) return 0
    return dmxState.channels[fixture.startChannel - 1 + profile.map.DIM] || 0
}

let audioDimmerSnapshot = null

function getFixtureMasterDimIndex(fixture) {
    if (!fixture) return null
    const profile = getFixtureProfile(fixture)
    if (!profile.hasMasterDimmer || profile.map.DIM === undefined) return null
    return fixture.startChannel - 1 + profile.map.DIM
}

function snapshotAudioDimmerValues() {
    audioDimmerSnapshot = fixtures.map((fixture) => {
        const dimIndex = getFixtureMasterDimIndex(fixture)
        return dimIndex === null ? null : (dmxState.channels[dimIndex] || 0)
    })
}

function restoreAudioDimmerValues() {
    if (!audioDimmerSnapshot) return

    fixtures.forEach((fixture, index) => {
        const dimIndex = getFixtureMasterDimIndex(fixture)
        const value = audioDimmerSnapshot[index]
        if (dimIndex !== null && value !== null) {
            dmxState.channels[dimIndex] = value
        }
    })
    audioDimmerSnapshot = null
}

function ensureAudioStartVisibility() {
    fixtures.forEach((fixture, index) => {
        if (dmxState.fixtureColors[index]?.blackout) return

        const dimIndex = getFixtureMasterDimIndex(fixture)
        if (dimIndex === null) return

        if ((dmxState.channels[dimIndex] || 0) === 0) {
            dmxState.channels[dimIndex] = 255
        }
    })
}

function setOutputOwner(owner = 'manual') {
    dmxState.outputOwner = owner
}

function clearOutputOwner(owner) {
    if (!owner || dmxState.outputOwner === owner) {
        dmxState.outputOwner = 'manual'
    }
}

function isAsyncOutputSourceAllowed(source = 'renderer') {
    if (source === 'audio' && dmxState.audioReactiveActive) return true
    return dmxState.outputOwner === source
}

// RESET ALL - Set all channels to 0
function resetAll() {
    stopDynamicScene()
    dmxState.activeProgram = null
    fixtures.forEach((f) => {
        const base = f.startChannel - 1
        const profile = FIXTURE_PROFILES[f.mode] || FIXTURE_PROFILES['P06']
        for (let ch = 0; ch < profile.channels; ch++) {
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

/**
 * @ai-constraints Dynamic Scenes run at 44Hz to match DMX refresh rate.
 * DIM channel must be set to 255 to ensure lights are visible.
 */
function startDynamicScene(sceneId) {
    stopDynamicScene()
    const scene = DYNAMIC_SCENES[sceneId]
    if (!scene) return false
    // @ai-constraints "Cold Start" Fix: If DIM is 0 (from Reset), default to 255 so the scene is visible.
    // The user can then lower the fader to adjust, but we avoid starting in pitch black.
    const isCold = fixtures.every(f => getFixtureMasterDimValue(f) === 0)
    if (isCold) {
        setAllFixturesChannel('dim', 255)
    }

    dmxState.dynamicScene = sceneId
    dmxState.dynamicSceneFrame = 0

    dynamicSceneInterval = setInterval(() => {
        const result = scene.handler(dmxState.dynamicSceneFrame)
        // @ai-constraints Use current Master Dimmer value
        // Support both single-color and per-fixture (array) scenes
        if (scene.perFixture && Array.isArray(result)) {
            fixtures.forEach((f, i) => {
                const color = result[i] || result[result.length - 1]
                const currentDim = getFixtureMasterDimValue(f)
                setFixtureColor(i, color.r, color.g, color.b, currentDim)
            })
        } else {
            fixtures.forEach((f, i) => {
                const currentDim = getFixtureMasterDimValue(f)
                setFixtureColor(i, result.r, result.g, result.b, currentDim)
            })
        }
        dmxState.dynamicSceneFrame++
    }, 1000 / 44)
    return true
}

function stopDynamicScene() {
    if (dynamicSceneInterval) { clearInterval(dynamicSceneInterval); dynamicSceneInterval = null }
    dmxState.dynamicScene = null
    dmxState.dynamicSceneFrame = 0
}

// ============================================================================
// IPC Handlers
// ============================================================================

function setupIPC() {
    ipcMain.handle('ai:generate', async (_, { apiKey, model, prompt, systemInstruction }) => {
        try {
            logger.log(`[AI] Starting generation request...`)
            const genAI = new GoogleGenerativeAI(apiKey)
            const modelId = model.includes('/') ? model : `models/${model}`
            logger.log(`[AI] Model: ${modelId} (v1beta)`)

            const genModel = genAI.getGenerativeModel(
                { model: modelId, systemInstruction },
                { apiVersion: 'v1beta' }
            )

            logger.log(`[AI] Sending prompt to Gemini...`)
            const result = await genModel.generateContent(prompt)

            logger.log(`[AI] Response received. Extracting text...`)
            const response = await result.response
            const text = response.text()

            logger.log(`[AI] Generation successful! (${text.length} chars)`)
            return text
        } catch (error) {
            logger.error('[AI] Generation failed:', error)
            throw error
        }
    })

    ipcMain.handle('ai:test', async (_, { apiKey, model }) => {
        try {
            const genAI = new GoogleGenerativeAI(apiKey)
            const modelId = model.includes('/') ? model : `models/${model}`
            logger.log(`[AI] Testing connection with model: ${modelId} (v1beta)`)

            const genModel = genAI.getGenerativeModel(
                { model: modelId },
                { apiVersion: 'v1beta' }
            )
            const result = await genModel.generateContent("Respond with only the word OK.")
            return result.response.text().trim()
        } catch (error) {
            logger.error('[AI] Test failed:', error.message)
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
        driverMode: dmxDriver?.mode || 'usb'
    }))

    ipcMain.handle('dmx:listPorts', async () => {
        return await listSerialPorts()
    })

    ipcMain.handle('dmx:scanD2XX', async () => {
        // scanD2XX is now handled by listPorts which detects both VCP and D2XX devices
        return await listSerialPorts()
    })

    ipcMain.handle('dmx:getUsbDrivers', () => getAvailableDrivers())

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
        if (dmxDriver?.worker) {
            dmxDriver.worker.postMessage({
                type: 'updateSettings',
                dmxHz: dmxState.performance.dmxHz
            })
        }

        startDMXLoop() // Restart main loops
        return { success: true, performance: dmxState.performance }
    })

    ipcMain.handle('dmx:saveFixtures', (_, newFixtures) => {
        try {
            fixtures = newFixtures
            const fs = require('fs')
            fs.writeFileSync(FIXTURES_PATH, JSON.stringify(fixtures, null, 2))

            // Re-sync state arrays
            const newFixtureColors = fixtures.map((f, i) => dmxState.fixtureColors[i] || { r: 0, g: 0, b: 0, blackout: false })
            dmxState.fixtureColors = newFixtureColors

            broadcastColors()
            return { success: true }
        } catch (error) {
            logger.error('[DMX] Failed to save fixtures:', error)
            return { success: false, error: error.message }
        }
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
            const profile = FIXTURE_PROFILES[f.mode] || FIXTURE_PROFILES['P06']
            for (let i = 0; i < profile.channels; i++) {
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

    /**
     * @ai-constraints Sets individual colors for each fixture in a single atomic call.
     * Used by Reactive Flags to display multi-color patterns (e.g., flag stripes).
     * Always sets DIM to 255 (or color.dim if provided) to ensure visibility.
     */
    ipcMain.handle('dmx:setPerFixtureColors', (_, { fixtureColors }) => {
        fixtureColors.forEach((color, idx) => {
            if (idx < fixtures.length && color) {
                setFixtureColor(idx, color.r, color.g, color.b, color.dim ?? 255)
            }
        })
        transmitNow()
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
        setOutputOwner('manual')
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
        dmxState.dynamicRendererActive = false // Force clear dynamic/flag mode
        setOutputOwner('program')

        // If same program, toggle OFF (reset to 0)
        if (dmxState.activeProgram === program) {
            resetAll()
            setOutputOwner('manual')
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
                const profile = FIXTURE_PROFILES[f.mode] || FIXTURE_PROFILES['P06']

                if (profile.map.RED !== undefined) dmxState.channels[base + profile.map.RED] = 255
                if (profile.map.GREEN !== undefined) dmxState.channels[base + profile.map.GREEN] = 255
                if (profile.map.BLUE !== undefined) dmxState.channels[base + profile.map.BLUE] = 255
                if (profile.hasMasterDimmer && profile.map.DIM !== undefined) dmxState.channels[base + profile.map.DIM] = 255
                if (profile.map.FLASH !== undefined) dmxState.channels[base + profile.map.FLASH] = 255

                dmxState.fixtureColors[i] = { r: 255, g: 255, b: 255 }
            })
            transmitNow()
            broadcastColors()
        }

        // Helper to turn off
        const flashOff = () => {
            fixtures.forEach((f, i) => {
                const base = f.startChannel - 1
                const profile = FIXTURE_PROFILES[f.mode] || FIXTURE_PROFILES['P06']

                if (profile.map.RED !== undefined) dmxState.channels[base + profile.map.RED] = 0
                if (profile.map.GREEN !== undefined) dmxState.channels[base + profile.map.GREEN] = 0
                if (profile.map.BLUE !== undefined) dmxState.channels[base + profile.map.BLUE] = 0
                if (profile.hasMasterDimmer && profile.map.DIM !== undefined) dmxState.channels[base + profile.map.DIM] = 0
                if (profile.map.FLASH !== undefined) dmxState.channels[base + profile.map.FLASH] = 0

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
        setOutputOwner('manual')
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
            if (dmxState.dynamicScene === sceneId && dynamicSceneInterval) {
                return { success: true, sceneId, alreadyActive: true }
            }
            dmxState.activeProgram = null
            const started = startDynamicScene(sceneId)
            if (!started) {
                return { success: false, error: `Unknown dynamic scene: ${sceneId}`, sceneId: null }
            }
            setOutputOwner('dynamic-scene')
            return { success: true, sceneId: dmxState.dynamicScene }
        } else {
            if (!dynamicSceneInterval && !dmxState.dynamicScene) {
                return { success: true, sceneId: null, alreadyStopped: true }
            }
            stopDynamicScene()
            resetAll() // Reset to 0 when stopping
            clearOutputOwner('dynamic-scene')
            return { success: true, sceneId: null }
        }
    })

    ipcMain.handle('dmx:setDynamicRendererActive', (event, { active, owner = 'renderer' }) => {
        // Backend-side enforcement (mirrors isAsyncOutputSourceAllowed's spirit
        // above): the projector window's own app code never sees window.dmx
        // (see isProjectorWindow in src/preload/index.js), but that window
        // runs with sandbox: false and DevTools reachable, so a DevTools
        // console there still has raw ipcRenderer access and could call this
        // handler directly to hijack dmxState.outputOwner. Only claiming
        // ownership is the hijack vector, so only that path is rejected here
        // — releasing ownership (active: false) is allowed through
        // regardless of sender.
        if (active && BrowserWindow.fromWebContents(event.sender) === projectorWindow) {
            return { success: false, reason: 'projector window cannot claim DMX output ownership' }
        }

        dmxState.dynamicRendererActive = active
        if (active) {
            setOutputOwner(owner)
        } else {
            clearOutputOwner(owner)
        }
        return { success: true, active, owner: dmxState.outputOwner }
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
    // @ai-constraints Return shape distinguishes "enumeration threw" (error set)
    // from "enumeration succeeded but found zero sources" (error null, sources
    // empty — e.g. Wayland/PipeWire portal permission not granted yet) so the
    // renderer can show a genuinely different message for each case.
    ipcMain.handle('ambilight:getSources', async () => {
        try {
            const sources = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 320, height: 180 } })
            return { sources: sources.map(s => ({ id: s.id, name: s.name, thumbnail: s.thumbnail.toDataURL() })), error: null }
        } catch (error) {
            logger.error('Ambilight: Failed to get sources (Check Wayland/PipeWire permissions):', error)
            return { sources: [], error: error.message || 'Unknown error' }
        }
    })

    // @ai-constraints Set DIM=255 for all fixtures when starting ambilight to ensure visibility
    ipcMain.handle('ambilight:start', (_, sourceId) => {
        stopDynamicScene()
        dmxState.activeProgram = null
        dmxState.ambilightActive = true
        setOutputOwner('ambilight')

        // Cold start fix: If Dimmer is 0, set to 255 to ensure visibility
        const isCold = fixtures.every(f => {
            const profile = FIXTURE_PROFILES[f.mode] || FIXTURE_PROFILES['P06']
            if (!profile.hasMasterDimmer || profile.map.DIM === undefined) return false
            return dmxState.channels[f.startChannel - 1 + profile.map.DIM] === 0
        })
        if (isCold) setAllFixturesChannel('dim', 255)

        return { success: true, sourceId }
    })
    ipcMain.handle('ambilight:stop', () => {
        dmxState.ambilightActive = false
        clearOutputOwner('ambilight')
        resetAll()
        return { success: true }
    })

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
        lastAmbiColors = colors
        // @ai-constraints Respect Master Dimmer (Grand Master)
        colors.forEach((c, i) => {
            const f = fixtures[i]
            const profile = FIXTURE_PROFILES[f.mode] || FIXTURE_PROFILES['P06']
            let currentDim = 255
            if (profile.hasMasterDimmer && profile.map.DIM !== undefined) {
                currentDim = dmxState.channels[f.startChannel - 1 + profile.map.DIM] || 0
            }
            setFixtureColor(i, c.r, c.g, c.b, currentDim)
        })
        return { success: true, colors: dmxState.fixtureColors }
    })

    // Async High-Frequency Ambilight update (One-way)
    ipcMain.on('ambilight:setColorsAsync', (_, { left, center, right, colors: incomingColors, source = 'renderer' }) => {
        if (!isAsyncOutputSourceAllowed(source)) return

        const targetColors = incomingColors || [left, center, right]

        const adaptiveSmooth = (cur, target, index) => {
            const diff = (Math.abs(cur.r - (target?.r || 0)) + Math.abs(cur.g - (target?.g || 0)) + Math.abs(cur.b - (target?.b || 0))) / 3
            // Audio Slot 2 is already smoothed in the renderer and must hit the fixture hard.
            const f = source === 'audio' && index === 1 ? 1 : (diff > 40 ? 0.75 : 0.25)
            const color = {
                r: Math.round(cur.r + ((target?.r || 0) - cur.r) * f),
                g: Math.round(cur.g + ((target?.g || 0) - cur.g) * f),
                b: Math.round(cur.b + ((target?.b || 0) - cur.b) * f)
            }

            if (target?.dim !== undefined || cur?.dim !== undefined) {
                const currentDim = cur?.dim ?? target?.dim ?? 255
                const targetDim = target?.dim ?? currentDim
                color.dim = Math.round(currentDim + (targetDim - currentDim) * f)
            }

            return color
        }

        const colors = fixtures.map((_, i) => {
            const target = targetColors[i] || targetColors[targetColors.length - 1] || { r: 0, g: 0, b: 0 }
            return adaptiveSmooth(lastAmbiColors[i] || { r: 0, g: 0, b: 0 }, target, i)
        })

        lastAmbiColors = colors
        // @ai-constraints Use currentDim to respect Master Slider (Grand Master behavior)
        colors.forEach((c, i) => {
            const f = fixtures[i]
            const profile = FIXTURE_PROFILES[f.mode] || FIXTURE_PROFILES['P06']
            let currentDim = 255
            if (profile.hasMasterDimmer && profile.map.DIM !== undefined) {
                currentDim = dmxState.channels[f.startChannel - 1 + profile.map.DIM] || 0
            }
            const outputDim = source === 'audio' && c.dim !== undefined ? c.dim : currentDim
            setFixtureColor(i, c.r, c.g, c.b, outputDim)
        })
    })

    // @ai-constraints Audio start must make each master-dimmer fixture visible once.
    ipcMain.handle('audio:start', () => {
        stopDynamicScene()
        dmxState.activeProgram = null
        snapshotAudioDimmerValues()
        dmxState.audioReactiveActive = true

        // Seed only fixtures whose own master dimmer is still closed. Later audio frames
        // keep respecting the current dimmer value so intentional grand-master changes hold.
        ensureAudioStartVisibility()

        return { success: true }
    })
    // @ai-constraints Do NOT call resetAll() here — let lights hold their last state
    // User must explicitly press RESET to clear. Navigation should not kill DMX output.
    ipcMain.handle('audio:stop', () => {
        dmxState.audioReactiveActive = false
        restoreAudioDimmerValues()
        return { success: true }
    })
    /**
     * @ai-constraints Audio-reactive color formula with improved variety.
     * Uses bass/mid/high levels to create dynamic, varied colors.
     */
    ipcMain.handle('audio:setLevel', (_, { bass, mid, high, volume }) => {
        if (!dmxState.audioReactiveActive) return { success: false }

        // Improved color formula for more variety (not just blue)
        // Bass drives red/orange, mid drives green/yellow, high drives cyan/white
        const bassExp = Math.pow(bass, 1.5)
        const midExp = Math.pow(mid, 1.3)
        const highExp = Math.pow(high, 1.4)

        // Create more varied colors based on audio characteristics
        const r = Math.min(255, Math.round(bassExp * 255 + highExp * 50))
        const g = Math.min(255, Math.round(midExp * 200 + bassExp * 80))
        const b = Math.min(255, Math.round(highExp * 200 + midExp * 100))

        // Use current Master Dimmer value instead of overriding with volume
        fixtures.forEach((f, i) => {
            const profile = FIXTURE_PROFILES[f.mode] || FIXTURE_PROFILES['P06']
            let currentDim = 255
            if (profile.hasMasterDimmer && profile.map.DIM !== undefined) {
                currentDim = dmxState.channels[f.startChannel - 1 + profile.map.DIM] || 0
            }
            setFixtureColor(i, r, g, b, currentDim)
        })
        return { success: true, colors: dmxState.fixtureColors }
    })

    // Security hardening: this used to write d.red/d.green/... directly into
    // dmxState.channels (a Uint8Array view over a SharedArrayBuffer), with no
    // clamp — out-of-range/NaN input from a corrupted scene file would wrap at
    // the byte level for the real physical channel while dmxState.fixtureColors
    // (what the UI reads back) kept the raw unclamped value, producing a
    // UI/hardware mismatch. Now routed through the same setFixtureChannel/
    // setFixtureColor helpers every other channel-mutating handler already
    // uses, so the clamp and the UI-facing color state stay in sync.
    ipcMain.handle('scene:load', (_, sceneData) => {
        stopDynamicScene()
        dmxState.activeProgram = null
        setOutputOwner('manual')
        fixtures.forEach((_, i) => {
            const d = sceneData.fixtures?.[i] || sceneData

            setFixtureChannel(i, 'FUNC', d.func || 0)
            setFixtureChannel(i, 'SPD', d.spd || 0)
            setFixtureChannel(i, 'FLASH', d.flash || 0)
            setFixtureColor(i, d.red || 0, d.green || 0, d.blue || 0, d.dim ?? 255)
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
        dynamicRendererActive: dmxState.dynamicRendererActive,
        outputOwner: dmxState.outputOwner,
        flashWhiteActive: dmxState.flashWhiteActive,
        fixtureColors: dmxState.fixtureColors
    }))

    ipcMain.handle('theme:toggle', () => { nativeTheme.themeSource = nativeTheme.shouldUseDarkColors ? 'light' : 'dark'; return { theme: nativeTheme.shouldUseDarkColors ? 'dark' : 'light' } })
    ipcMain.handle('theme:get', () => ({ theme: nativeTheme.shouldUseDarkColors ? 'dark' : 'light' }))
    ipcMain.handle('theme:set', (_, theme) => { nativeTheme.themeSource = theme; return { theme } })

    // Projector Output
    ipcMain.handle('projector:listDisplays', () => serializeDisplays())
    ipcMain.handle('projector:open', (event, displayId) => {
        createProjectorWindow(displayId)
        return { ok: true, displayId: projectorDisplayId }
    })
    ipcMain.handle('projector:close', () => {
        closeProjectorWindow()
        return { ok: true }
    })
    ipcMain.on('projector:setBlackout', (event, value) => projectorWindow?.webContents.send('projector:blackout', value))
    ipcMain.on('projector:setTestPattern', (event, value) => projectorWindow?.webContents.send('projector:testPattern', value))
    ipcMain.on('projector:setVisual', (event, visualId) => projectorWindow?.webContents.send('projector:visualChanged', visualId))
    // BS-007 phase 2: Now Playing overlay toggle - relayed the exact same
    // one-way way as setBlackout/setTestPattern above. The projector window
    // runs its own useNowPlaying() poll (see ProjectorApp.jsx) for the actual
    // metadata; this channel only carries the on/off toggle.
    ipcMain.on('projector:setNowPlayingOverlay', (event, value) => projectorWindow?.webContents.send('projector:nowPlayingOverlayChanged', value))

    // Projection Mapping (BS-006) — relayed the same way as
    // projector:setBlackout: the main window's Edit Mapping toggle sends
    // this, the projector window listens for it to show/hide corner handles.
    ipcMain.on('mapping:setEditMode', (event, value) => projectorWindow?.webContents.send('mapping:editModeChanged', value))

    // BS-006 phase 2: surfaces array sync. EITHER window (main or projector)
    // can push a new surfaces array — broadcast to every OTHER window, same
    // relay shape as audio:frameBroadcast. Excluding the sender is what keeps
    // this from being a literal echo back to whichever window just sent it;
    // it does not by itself prevent a receiving window from turning around
    // and re-broadcasting what it just received — that feedback-loop guard
    // lives on the renderer side (see MappingCompositor.jsx's
    // suppressNextBroadcastRef).
    ipcMain.on('mapping:setSurfaces', (event, surfaces) => {
        // Cache unconditionally — even if no other window is currently open
        // to relay to (e.g. a preset gets loaded in the main window while
        // the projector window is closed) — so a LATER-opened window can
        // still pull current state via mapping:getSurfaces instead of
        // silently reverting to its own default.
        lastKnownSurfaces = surfaces
        BrowserWindow.getAllWindows().forEach(win => {
            if (win.webContents.id !== event.sender.id) win.webContents.send('mapping:surfacesChanged', surfaces)
        })
    })

    // BS-006 phase 2 fix: lets a freshly-mounted window (main or projector)
    // pull the last-known surfaces array on mount, instead of only ever
    // receiving updates pushed after it happened to be listening.
    ipcMain.handle('mapping:getSurfaces', () => lastKnownSurfaces)

    // BS-006 phase 2: mapping preset persistence, mirroring dmx:saveFixtures'
    // read-modify-write-to-userData-JSON pattern.
    ipcMain.handle('mapping:listPresets', () => {
        try {
            return Object.keys(readMappingPresets())
        } catch (error) {
            logger.error('[Mapping] Failed to list presets:', error)
            return []
        }
    })

    ipcMain.handle('mapping:savePreset', (_, { name, surfaces }) => {
        try {
            const data = readMappingPresets()
            data[name] = surfaces
            writeMappingPresets(data)
            return { success: true }
        } catch (error) {
            logger.error('[Mapping] Failed to save preset:', error)
            return { success: false, error: error.message }
        }
    })

    ipcMain.handle('mapping:loadPreset', (_, name) => {
        try {
            const data = readMappingPresets()
            return data[name] ?? null
        } catch (error) {
            logger.error('[Mapping] Failed to load preset:', error)
            return null
        }
    })

    ipcMain.handle('mapping:deletePreset', (_, name) => {
        try {
            const data = readMappingPresets()
            delete data[name]
            writeMappingPresets(data)
            return { success: true }
        } catch (error) {
            logger.error('[Mapping] Failed to delete preset:', error)
            return { success: false, error: error.message }
        }
    })

    // Relay AudioFrame from the main window's renderer process to every other
    // window (i.e. the projector window). Each BrowserWindow is a separate
    // renderer process with its own independent useAudioStore instance, so the
    // projector never sees live analysis unless it's relayed over IPC.
    // Small numeric AudioFrame payloads only — never heavy video/frame buffers.
    ipcMain.on('audio:frameBroadcast', (event, frame) => {
        BrowserWindow.getAllWindows().forEach(win => {
            if (win.webContents.id !== event.sender.id) win.webContents.send('audio:frameBroadcast', frame)
        })
    })
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
        icon: join(__dirname, '../../build/icon.png'),
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
// Projector Output (BS-005)
// ============================================================================

let projectorWindow = null
let projectorDisplayId = null

function serializeDisplays() {
    const primaryId = screen.getPrimaryDisplay().id
    return screen.getAllDisplays().map(d => ({ id: d.id, bounds: d.bounds, size: d.size, isPrimary: d.id === primaryId }))
}

function broadcastProjectorStatus() {
    BrowserWindow.getAllWindows().forEach(win => {
        if (win !== projectorWindow) win.webContents.send('projector:statusChanged', { connected: !!projectorWindow, displayId: projectorDisplayId })
    })
}

function createProjectorWindow(displayId) {
    // Only one projector window may exist at a time. Tear down any existing
    // one first so we never leak a stale BrowserWindow, and so its eventual
    // 'closed' event (guarded below) can't clobber state that now belongs
    // to the new window.
    if (projectorWindow && !projectorWindow.isDestroyed()) {
        closeProjectorWindow()
    }

    const displays = screen.getAllDisplays()
    const primaryDisplay = screen.getPrimaryDisplay()
    const display = displays.find(d => d.id === displayId)
        || displays.find(d => d.id !== primaryDisplay.id)
        || primaryDisplay

    const win = new BrowserWindow({
        x: display.bounds.x,
        y: display.bounds.y,
        width: display.bounds.width,
        height: display.bounds.height,
        fullscreen: true,
        frame: false,
        autoHideMenuBar: true,
        backgroundColor: '#000000',
        webPreferences: {
            preload: join(__dirname, '../preload/index.js'),
            sandbox: false,
            contextIsolation: true,
            nodeIntegration: false,
            backgroundThrottling: false,
            // Lets the preload script tell this window apart from the main
            // window so it never gets the dmx/ambilight globals — see
            // isProjectorWindow in src/preload/index.js. This makes the
            // ACCIDENTAL DMX-ownership hijack from useFluidSimulation/
            // dmxStore's normal (optional-chained) calls impossible. A
            // deliberate DevTools-driven bypass is still possible since this
            // window runs unsandboxed; that path is closed by the
            // sender-identity guard in the dmx:setDynamicRendererActive
            // handler below, not by this preload restriction.
            additionalArguments: ['--beamstudio-role=projector']
        }
    })

    projectorWindow = win
    projectorDisplayId = display.id

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
        win.loadURL(process.env['ELECTRON_RENDERER_URL'] + '?role=projector')
    } else {
        // `query` is serialized via url.format() and appended as `?role=projector`
        win.loadFile(join(__dirname, '../renderer/index.html'), { query: { role: 'projector' } })
    }

    win.on('closed', () => {
        // Only clear shared state if this window is still the current
        // projector window. A stale/orphaned window's 'closed' event firing
        // after a newer window has taken over must NOT null out state that
        // belongs to that newer, still-live window.
        if (projectorWindow === win) {
            projectorWindow = null
            projectorDisplayId = null
            broadcastProjectorStatus()
        }
    })

    broadcastProjectorStatus()
}

function closeProjectorWindow() {
    if (projectorWindow) {
        projectorWindow.close()
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
// Returns { title, artist, playbackStatus } or null
const execPromise = (cmd) => new Promise((resolve) => {
    const { exec } = require('child_process')
    exec(cmd, { timeout: 1500 }, (error, stdout) => {
        if (error || !stdout) resolve(null)
        else resolve(stdout.trim())
    })
})

// BS-007 bugfix: '|' is NOT a safe field delimiter - real track titles/artists
// (YouTube video titles especially) commonly contain a literal '|', which
// shifts every subsequent field by one position (e.g. mpris:artUrl landing in
// the album slot, or a Windows title's '|' pushing playbackStatus out of the
// 'playing'/'paused'/'stopped' set entirely, silently falling through to
// 'no-player'). The ASCII Unit Separator (0x1F) is built for exactly this -
// delimiting fields in text that may itself contain any printable character -
// and real metadata essentially never contains a raw control character.
// Verified live on this machine: `playerctl metadata --format` with this
// separator embedded in a single-quoted shell string passes the literal 0x1F
// byte through child_process.exec unmodified (confirmed via `od -c` against
// a real Spotify MPRIS session).
const METADATA_FIELD_SEPARATOR = '\x1f'

const getWindowsMedia = async () => {
    const psScript = `
        try {
            $ctl = [Windows.Media.Control.GlobalSystemMediaTransportControls,Windows.Media.Control,ContentType=WindowsRuntime]::GetForCurrentView().SessionManager.GetCurrentSession()
            if ($ctl) {
                $info = $ctl.TryGetMediaPropertiesAsync().GetAwaiter().GetResult()
                $playback = $ctl.GetPlaybackInfo().PlaybackStatus
                $sep = [char]0x1F
                Write-Output "$($info.Title)$sep$($info.Artist)$sep$playback"
            }
        } catch {}
    `
    // Encode command for PowerShell
    const cmd = `powershell -NoProfile -NonInteractive -Command "${psScript.replace(/\n/g, ' ')}"`
    const output = await execPromise(cmd)
    if (!output || !output.includes(METADATA_FIELD_SEPARATOR)) return null
    const [title, artist, playbackStatus] = output.split(METADATA_FIELD_SEPARATOR)
    return {
        title: title.trim(),
        artist: artist.trim(),
        playbackStatus: (playbackStatus || '').trim()
    }
}
const getLinuxMedia = async () => {
    const playbackStatus = await execPromise('playerctl status')
    // BS-007: format string extended with position/mpris:length/mpris:artUrl
    // (additive only - title/artist/playbackStatus below keep their exact
    // existing shape/behavior so useSystemAudio.js and geminiService.js, both
    // of which already call window.dmx.getSystemMedia() directly, are
    // unaffected). Units verified empirically on this machine with a live
    // MPRIS player (playerctl v2.4.1): both {{position}} and {{mpris:length}}
    // are microseconds - e.g. position=4096000 matched `playerctl position`
    // reporting 4.096 seconds for the same track.
    // BS-007 phase 2: appended {{xesam:album}} - also confirmed present on
    // this machine against a real live Spotify session via `playerctl
    // metadata` (along with xesam:albumArtist/discNumber/trackNumber/url,
    // none of which are consumed here). There is NO composer/songwriter
    // MPRIS field - Spotify's MPRIS integration does not expose one, so it
    // is deliberately not requested/returned here.
    const output = await execPromise(
        `playerctl metadata --format '{{title}}${METADATA_FIELD_SEPARATOR}{{artist}}${METADATA_FIELD_SEPARATOR}{{position}}${METADATA_FIELD_SEPARATOR}{{mpris:length}}${METADATA_FIELD_SEPARATOR}{{mpris:artUrl}}${METADATA_FIELD_SEPARATOR}{{xesam:album}}'`
    )
    if (!output || !output.includes(METADATA_FIELD_SEPARATOR)) {
        if (playbackStatus) return { title: '', artist: '', playbackStatus: playbackStatus.trim() }
        return null
    }
    const [title, artist, positionRaw, lengthRaw, artUrlRaw, albumRaw] = output.split(METADATA_FIELD_SEPARATOR)
    const positionUs = Number(positionRaw)
    const lengthUs = Number(lengthRaw)
    return {
        title: title.trim(),
        artist: artist.trim(),
        playbackStatus: (playbackStatus || '').trim(),
        // New BS-007 fields - additive, not consumed by existing callers.
        positionSec: Number.isFinite(positionUs) && positionUs >= 0 ? positionUs / 1e6 : null,
        durationSec: Number.isFinite(lengthUs) && lengthUs > 0 ? lengthUs / 1e6 : null,
        artUrl: artUrlRaw && artUrlRaw.trim() ? artUrlRaw.trim() : null,
        // BS-007 phase 2: album name, additive - trims like title/artist.
        album: (albumRaw || '').trim()
    }
}

ipcMain.handle('get-system-media', async () => {
    if (process.platform === 'win32') return await getWindowsMedia()
    if (process.platform === 'linux') return await getLinuxMedia()
    return null
})

app.whenReady().then(async () => {
    electronApp.setAppUserModelId('com.francuello.beamstudio')
    app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))
    setupIPC()

    // BS-004: required for navigator.mediaDevices.getDisplayMedia() to work
    // at all — Electron rejects every getDisplayMedia() call with
    // NotSupportedError unless a handler is registered here, regardless of
    // the enable-features=WebRTCPipeWireCapturer flag above (confirmed via
    // electron.d.ts: DisplayMediaRequestHandlerOpts.useSystemPicker is
    // documented as "macOS Experimental" only in this Electron version, so it
    // can't be relied on for the Linux/Wayland picker). On Linux, the handler
    // requests a 'screen' source from desktopCapturer — with the PipeWire
    // flag enabled, that call itself is what surfaces the native
    // xdg-desktop-portal ScreenCast picker dialog.
    session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
        // This handler is registered on the DEFAULT session, shared by every
        // BrowserWindow (including the projector window, which never sets a
        // separate partition) — so without this check, the projector's own
        // renderer could also request display media and silently get one,
        // even though it's supposed to be a locked-down pure-output window
        // with no DMX/ambilight capability (same isolation intent as the
        // isProjectorWindow preload gate). Reject any requesting frame whose
        // URL carries the projector's ?role=projector query string.
        if (request.frame?.url?.includes('role=projector')) {
            callback({})
            return
        }
        try {
            const sources = await desktopCapturer.getSources({ types: ['screen'] })
            callback({ video: sources[0] })
        } catch (error) {
            logger.error('[Ambilight] getDisplayMedia handler failed to get a screen source:', error)
            callback({})
        }
    }, { useSystemPicker: true })

    // Projector display recovery (BS-005)
    screen.on('display-removed', (event, oldDisplay) => {
        if (projectorDisplayId === oldDisplay.id) {
            closeProjectorWindow()
        }
    })
    screen.on('display-added', () => {
        BrowserWindow.getAllWindows().forEach(win => {
            if (win !== projectorWindow) win.webContents.send('projector:displaysChanged', serializeDisplays())
        })
    })

    // Auto-connect to the local USB DMX interface by default
    try {
        logger.log('[DMX] Auto-connecting to local USB DMX interface...')
        const result = await switchDmxMode('usb', null, 'd2xx')
        if (!result.success) {
            logger.log('[DMX] USB auto-connect did not succeed:', result.error)
        }
    } catch (e) {
        logger.log('[DMX] USB auto-connect failed:', e.message)
    }

    startDMXLoop()
    createWindow()
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('window-all-closed', () => { stopDMXLoop(); stopDynamicScene(); if (process.platform !== 'darwin') app.quit() })
app.on('before-quit', () => {
    stopDMXLoop();
    stopDynamicScene();
    if (dmxDriver) {
        for (let i = 0; i < 512; i++) dmxDriver.setChannel(i, 0);
        dmxDriver.transmit()
        if (dmxDriver.close) dmxDriver.close()
    }
})
