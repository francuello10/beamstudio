import { app, shell, BrowserWindow, ipcMain, desktopCapturer, nativeTheme } from 'electron' // Force Rebuild 01:10
import { GoogleGenerativeAI } from '@google/generative-ai'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import dmxnet from 'dmxnet'
import { performance } from 'perf_hooks'
import { readFileSync } from 'fs'

import { Worker } from 'worker_threads'
import logger from './logger'

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
let dmxMode = 'artnet'  // 'artnet' | 'usb'
let currentUsbDriver = process.platform === 'win32' ? 'd2xx' : 'serialport' // Default based on OS
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
        logger.log('[DMX] Closing existing driver:', dmxDriver.mode)
        try {
            await dmxDriver.close()
        } catch (e) {
            logger.warn('Driver close warning:', e.message)
        }
        dmxDriver = null
    }
}

// Initialize with Art-Net by default
dmxDriver = createArtNetDriver()

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
                        transmitLength: 33
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
                        dmxHz: dmxState.performance.dmxHz
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
    } else {
        await closeExistingDriver()
        dmxDriver = createArtNetDriver()
        dmxMode = 'artnet'
        return { success: true, mode: 'artnet' }
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
let frameCount = 0
let lastFpsTime = performance.now()

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
            frameCount++

            // Telemetry: Every 1 second
            const now = performance.now()
            if (now - lastFpsTime >= 1000) {
                const actualHz = Math.round((frameCount * 1000) / (now - lastFpsTime))
                BrowserWindow.getAllWindows().forEach(win => {
                    win.webContents.send('dmx:telemetry', { actualHz })
                })
                frameCount = 0
                lastFpsTime = now
            }
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
    const isCold = fixtures.every(f => dmxState.channels[f.startChannel - 1 + CHANNEL_MAP.DIM] === 0)
    if (isCold) {
        setAllFixturesChannel('dim', 255)
    }

    dynamicSceneInterval = setInterval(() => {
        const result = scene.handler(dmxState.dynamicSceneFrame)
        // @ai-constraints Use current Master Dimmer value
        // Support both single-color and per-fixture (array) scenes
        if (scene.perFixture && Array.isArray(result)) {
            fixtures.forEach((f, i) => {
                const color = result[i] || result[result.length - 1]
                const currentDim = dmxState.channels[f.startChannel - 1 + CHANNEL_MAP.DIM] || 0
                setFixtureColor(i, color.r, color.g, color.b, currentDim)
            })
        } else {
            fixtures.forEach((f, i) => {
                const currentDim = dmxState.channels[f.startChannel - 1 + CHANNEL_MAP.DIM] || 0
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
        driverMode: dmxDriver?.mode || 'artnet'
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
        if (dmxDriver && dmxDriver.mode === 'd2xx' && dmxDriver.worker) {
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
        // if (!active) resetAll() // Don't reset, allow persistence
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
            logger.error('Ambilight: Failed to get sources (Check Wayland/PipeWire permissions):', error)
            return []
        }
    })

    // @ai-constraints Set DIM=255 for all fixtures when starting ambilight to ensure visibility
    ipcMain.handle('ambilight:start', (_, sourceId) => {
        stopDynamicScene()
        dmxState.activeProgram = null
        dmxState.ambilightActive = true

        // Cold start fix: If Dimmer is 0, set to 255 to ensure visibility
        const isCold = fixtures.every(f => {
            const profile = FIXTURE_PROFILES[f.mode] || FIXTURE_PROFILES['P06']
            if (!profile.hasMasterDimmer || profile.map.DIM === undefined) return false
            return dmxState.channels[f.startChannel - 1 + profile.map.DIM] === 0
        })
        if (isCold) setAllFixturesChannel('dim', 255)

        return { success: true, sourceId }
    })
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
    ipcMain.on('ambilight:setColorsAsync', (_, { left, center, right, colors: incomingColors }) => {
        if (!dmxState.ambilightActive && !dmxState.audioReactiveActive && !dmxState.dynamicRendererActive) return

        const targetColors = incomingColors || [left, center, right]

        const adaptiveSmooth = (cur, target) => {
            const diff = (Math.abs(cur.r - (target?.r || 0)) + Math.abs(cur.g - (target?.g || 0)) + Math.abs(cur.b - (target?.b || 0))) / 3
            // @ai-constraints Deco tuning: blend smoothly, only large transients snap
            const f = diff > 40 ? 0.75 : 0.25
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
        // @ai-constraints Use currentDim to respect Master Slider (Grand Master behavior)
        colors.forEach((c, i) => {
            const f = fixtures[i]
            const profile = FIXTURE_PROFILES[f.mode] || FIXTURE_PROFILES['P06']
            let currentDim = 255
            if (profile.hasMasterDimmer && profile.map.DIM !== undefined) {
                currentDim = dmxState.channels[f.startChannel - 1 + profile.map.DIM] || 0
            }
            // If currentDim is 0, we should probably output 0, but if it's undefined (startup), default to 255?
            // Actually, dmxState is initialized to 0. 
            // When Audio starts, we set it to 255.
            // If user lowers it, we should use that value.
            setFixtureColor(i, c.r, c.g, c.b, currentDim)
        })
    })

    // @ai-constraints Set DIM=255 for all fixtures when starting audio reactive mode
    ipcMain.handle('audio:start', () => {
        stopDynamicScene()
        dmxState.activeProgram = null
        dmxState.audioReactiveActive = true

        // Cold start fix: If Dimmer is 0, set to 255 to ensure visibility
        const isCold = fixtures.every(f => {
            const profile = FIXTURE_PROFILES[f.mode] || FIXTURE_PROFILES['P06']
            if (!profile.hasMasterDimmer || profile.map.DIM === undefined) return false
            return dmxState.channels[f.startChannel - 1 + profile.map.DIM] === 0
        })
        if (isCold) setAllFixturesChannel('dim', 255)

        return { success: true }
    })
    // @ai-constraints Do NOT call resetAll() here — let lights hold their last state
    // User must explicitly press RESET to clear. Navigation should not kill DMX output.
    ipcMain.handle('audio:stop', () => { dmxState.audioReactiveActive = false; return { success: true } })
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

    ipcMain.handle('scene:load', (_, sceneData) => {
        stopDynamicScene()
        dmxState.activeProgram = null
        fixtures.forEach((f, i) => {
            const base = f.startChannel - 1
            const profile = FIXTURE_PROFILES[f.mode] || FIXTURE_PROFILES['P06']
            const d = sceneData.fixtures?.[i] || sceneData

            if (profile.map.RED !== undefined) dmxState.channels[base + profile.map.RED] = d.red || 0
            if (profile.map.GREEN !== undefined) dmxState.channels[base + profile.map.GREEN] = d.green || 0
            if (profile.map.BLUE !== undefined) dmxState.channels[base + profile.map.BLUE] = d.blue || 0
            if (profile.map.FUNC !== undefined) dmxState.channels[base + profile.map.FUNC] = d.func || 0
            if (profile.map.SPD !== undefined) dmxState.channels[base + profile.map.SPD] = d.spd || 0
            if (profile.map.FLASH !== undefined) dmxState.channels[base + profile.map.FLASH] = d.flash || 0
            if (profile.hasMasterDimmer && profile.map.DIM !== undefined) dmxState.channels[base + profile.map.DIM] = d.dim ?? 255

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
    electronApp.setAppUserModelId('com.francuello.beamstudio')
    app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))
    setupIPC()

    // Auto-connect to D2XX by default (fall back to Art-Net)
    try {
        logger.log('[DMX] Auto-connecting to D2XX...')
        const result = await switchDmxMode('usb', null, 'd2xx')
        if (!result.success) {
            logger.log('[DMX] D2XX not found, using Art-Net fallback')
        }
    } catch (e) {
        logger.log('[DMX] D2XX auto-connect failed:', e.message)
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
