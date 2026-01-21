import { app, shell, BrowserWindow, ipcMain, desktopCapturer, nativeTheme } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import dmxnet from 'dmxnet'
import { performance } from 'perf_hooks'

const DMX_UNIVERSE_SIZE = 32
const universe = Buffer.alloc(DMX_UNIVERSE_SIZE + 1, 0) // Global Zero-Allocation Buffer for D2XX

// ============================================================================
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

// Available USB DMX drivers (order = priority for fallback)
const USB_DRIVERS = [
    { id: 'enttec-open', name: 'Enttec Open DMX', desc: 'FTDI con BREAK signal (KMtronic, Freestyler-compatible)' },
    { id: 'enttec-pro', name: 'Enttec USB DMX Pro', desc: 'Para interfaces DMX Pro oficiales' },
    { id: 'native', name: 'Native Serial', desc: 'Serial directo 250kbaud (sin BREAK)' },
]

// Driver state - Singleton pattern with connection promise
let dmxMode = 'artnet'  // 'artnet' | 'usb'
let currentUsbDriver = 'enttec-open'  // Default to Enttec Open (BREAK signal like Freestyler)
let nativeDevicePath = getDefaultDevicePath()
let dmxDriver = null
let nativePort = null  // Keep reference to the SerialPort instance
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

// Helper to safely close existing port with proper waiting
async function closeExistingPort() {
    return new Promise((resolve) => {
        if (nativePort) {
            const portToClose = nativePort
            nativePort = null  // Clear reference immediately to prevent reuse

            try {
                portToClose.removeAllListeners()

                if (portToClose.isOpen) {
                    portToClose.close((err) => {
                        if (err && err.message !== 'Canceled') {
                            console.log('Port close info:', err.message)
                        }
                        resolve()
                    })
                } else {
                    resolve()
                }
            } catch (e) {
                resolve()
            }
        } else {
            resolve()
        }
    })
}

// ============================================================================
// USB DMX Drivers (Enttec Open, Enttec Pro, Native)
// ============================================================================

// ENTTEC OPEN DMX - Uses BREAK signal (like Freestyler, QLC+)
// This is the protocol that works with KMtronic FTDI interfaces!
async function createEnttecOpenDriver(devicePath) {
    if (connectionPromise) {
        console.log('Connection in progress, waiting...')
        try { await connectionPromise } catch (e) { }
        if (dmxDriver && dmxDriver.mode === 'enttec-open' && dmxDriver.devicePath === devicePath) {
            return dmxDriver
        }
    }

    connectionPromise = (async () => {
        try {
            const { SerialPort } = await import('serialport')
            await closeExistingPort()

            const port = new SerialPort({
                path: devicePath,
                baudRate: 250000,
                dataBits: 8,
                stopBits: 2,
                parity: 'none',
                autoOpen: false,
            })

            // IMPORTANT: Handle errors to avoid crashes
            port.on('error', (err) => {
                console.error('[DMX] SerialPort Error:', err.message)
            })

            await new Promise((resolve, reject) => {
                port.open(err => err ? reject(err) : resolve())
            })

            nativePort = port
            const universe = Buffer.alloc(513, 0)
            let timeouts = [] // Store timeout handles

            // BREAK signal transmission (the key to FTDI compatibility!)
            function sendUniverse() {
                if (!port || !port.isOpen || !port.writable) return

                // Toggle BREAK signal before transmission (like Freestyler does!)
                port.set({ brk: true, rts: true }, () => {
                    if (!port || !port.isOpen) return

                    const t1 = setTimeout(() => {
                        if (!port || !port.isOpen) return
                        port.set({ brk: false, rts: true }, () => {
                            if (!port || !port.isOpen) return

                            const t2 = setTimeout(() => {
                                if (!port || !port.isOpen) return
                                try {
                                    port.write(Buffer.concat([Buffer.from([0]), universe.slice(1)]), (err) => {
                                        if (err && port.isOpen) console.error('[DMX] Write error:', err.message)
                                    })
                                    port.drain(() => { })
                                } catch (e) { console.error('[DMX] Sync write error:', e.message) }
                            }, 1)
                            timeouts.push(t2)
                        })
                    }, 1)
                    timeouts.push(t1)

                    // Periodic cleanup of old timeouts
                    if (timeouts.length > 50) timeouts = timeouts.slice(-10)
                })
            }

            // Start automatic transmission at 44Hz (DMX512 standard)
            intervalHandle = setInterval(sendUniverse, 23)

            console.log(`[DMX] Enttec Open driver connected: ${devicePath} (BREAK signal enabled)`)

            return {
                mode: 'enttec-open',
                devicePath,
                driverName: 'Enttec Open DMX',
                setChannel: (ch, val) => { if (ch >= 0 && ch < 512) universe[ch + 1] = val },
                transmit: () => { /* Automatic via interval */ },
                close: () => {
                    if (intervalHandle) clearInterval(intervalHandle)
                    // Clear all pending timeouts to stop the chain immediately
                    timeouts.forEach(t => clearTimeout(t))
                    timeouts = []
                    // Do NOT close port here or nullify nativePort. 
                    // Let closeExistingPort handle it sequentially.
                }
            }
        } catch (error) {
            console.error('[DMX] Enttec Open driver failed:', error.message)
            return null
        } finally {
            connectionPromise = null
        }
    })()

    return connectionPromise
}

// ENTTEC USB DMX PRO - Uses framing protocol (for official Pro interfaces)
async function createEnttecProDriver(devicePath) {
    if (connectionPromise) {
        try { await connectionPromise } catch (e) { }
        if (dmxDriver && dmxDriver.mode === 'enttec-pro' && dmxDriver.devicePath === devicePath) {
            return dmxDriver
        }
    }

    connectionPromise = (async () => {
        try {
            const { SerialPort } = await import('serialport')
            await closeExistingPort()

            const port = new SerialPort({
                path: devicePath,
                baudRate: 250000,
                dataBits: 8,
                stopBits: 2,
                parity: 'none',
                autoOpen: false,
            })

            await new Promise((resolve, reject) => {
                port.open(err => err ? reject(err) : resolve())
            })

            nativePort = port
            const universe = Buffer.alloc(513, 0)
            let intervalHandle = null

            // ENTTEC Pro framing constants
            const START_OF_MSG = 0x7e
            const END_OF_MSG = 0xe7
            const SEND_DMX_RQ = 0x06
            const DMX_STARTCODE = 0x00

            function sendUniverse() {
                if (!port || !port.isOpen || !port.writable) return

                const hdr = Buffer.from([
                    START_OF_MSG,
                    SEND_DMX_RQ,
                    (universe.length) & 0xff,
                    ((universe.length) >> 8) & 0xff,
                    DMX_STARTCODE,
                ])
                const msg = Buffer.concat([hdr, universe.slice(1), Buffer.from([END_OF_MSG])])
                try {
                    port.write(msg, (err) => {
                        if (err) console.error('[DMX] Pro Write error:', err.message)
                    })
                    port.drain(() => { })
                } catch (e) { console.error('[DMX] Pro Sync write error:', e.message) }
            }

            intervalHandle = setInterval(sendUniverse, 25)

            console.log(`[DMX] Enttec Pro driver connected: ${devicePath}`)

            return {
                mode: 'enttec-pro',
                devicePath,
                driverName: 'Enttec USB DMX Pro',
                setChannel: (ch, val) => { if (ch >= 0 && ch < 512) universe[ch + 1] = val },
                transmit: () => { },
                close: () => {
                    if (intervalHandle) clearInterval(intervalHandle)
                    // Do NOT close port here or nullify nativePort.
                }
            }
        } catch (error) {
            console.error('[DMX] Enttec Pro driver failed:', error.message)
            return null
        } finally {
            connectionPromise = null
        }
    })()

    return connectionPromise
}

// NATIVE SERIAL - Direct serial transmission (legacy, without BREAK signal)
async function createNativeDriver(devicePath) {
    // If a connection is already in progress, wait for it
    if (connectionPromise) {
        console.log('Connection in progress, waiting...')
        try {
            await connectionPromise
        } catch (e) {
            // Previous connection failed, we'll try again
        }
        // If we now have a working driver on the same path, return it
        if (dmxDriver && dmxDriver.mode === 'native' && dmxDriver.devicePath === devicePath) {
            return dmxDriver
        }
    }

    // Create the connection promise
    connectionPromise = (async () => {
        try {
            const { SerialPort } = await import('serialport')

            // Close existing connection properly
            await closeExistingPort()

            // KMtronic Open DMX uses 250000 baud rate (DMX512 standard)
            const port = new SerialPort({
                path: devicePath,
                baudRate: 250000,
                dataBits: 8,
                stopBits: 2,
                parity: 'none',
                autoOpen: false,
                lock: true  // Explicitly request lock
            })

            // DMX512 frame buffer (513 bytes: 1 start code + 512 channels)
            const dmxBuffer = Buffer.alloc(513, 0)
            let isOpen = false
            let errorCount = 0
            const MAX_ERRORS = 5

            // Open port (single attempt, no retries to avoid delays)
            await new Promise((resolve, reject) => {
                port.open((err) => {
                    if (err) reject(err)
                    else {
                        isOpen = true
                        resolve()
                    }
                })
            })

            // Store reference to port for cleanup
            nativePort = port

            console.log(`KMtronic DMX connected on ${devicePath} at 250000 baud`)

            let isTransmitting = false
            let needsUpdate = false

            const driver = {
                mode: 'native',
                devicePath,
                setChannel: (ch, val) => {
                    if (ch >= 0 && ch < 512) {
                        dmxBuffer[ch + 1] = val  // +1 because byte 0 is start code
                    }
                },
                transmit: () => {
                    if (!isOpen || !port || !port.isOpen) return

                    // BLOCKING CONTROL: unexpected lag is usually caused by buffer bloat.
                    // If we are already sending, DO NOT send again immediately.
                    // Instead, mark that we need an update, and send only the LATEST state when free.
                    if (isTransmitting) {
                        needsUpdate = true
                        return
                    }

                    isTransmitting = true
                    needsUpdate = false

                    try {
                        port.write(dmxBuffer, (err) => {
                            if (err) handleErr(err)

                            // Important: Drain ensures the OS buffer handles the data
                            // but we don't want to block nodejs event loop too long
                            port.drain((drainErr) => {
                                isTransmitting = false
                                if (drainErr) handleErr(drainErr)
                                else errorCount = 0

                                // If a new frame came in while we were sending, send it now!
                                if (needsUpdate && isOpen && port.isOpen) {
                                    setImmediate(() => driver.transmit())
                                }
                            })
                        })
                    } catch (err) {
                        isTransmitting = false
                        handleErr(err)
                    }

                    function handleErr(err) {
                        // errorCount++ // reduced strictness
                        console.error('DMX drop:', err.message)
                    }
                },
                close: () => {
                    isOpen = false
                    // Do NOT close port here or nullify nativePort.
                }
            }

            return driver
        } catch (error) {
            console.error('Failed to create native DMX driver:', error)
            return null
        } finally {
            connectionPromise = null  // Clear promise when done
        }
    })()

    return connectionPromise
}

// Initialize with Art-Net by default
dmxDriver = createArtNetDriver()

// List available serial ports (for UI)
// List available serial ports (for UI)
// List available ports (Serial + D2XX)
async function listSerialPorts() {
    let ports = []

    // 1. Get Serial Ports
    try {
        const { SerialPort } = await import('serialport')
        const serialPorts = await SerialPort.list()
        ports = serialPorts.map(p => ({
            path: p.path,
            manufacturer: p.manufacturer || 'Unknown',
            displayName: `${p.path} (${p.manufacturer || 'Unknown'})`,
            type: 'serial'
        }))
    } catch (error) {
        console.error('Failed to list serial ports:', error)
    }

    // 2. Get D2XX Devices (Windows)
    if (process.platform === 'win32') {
        try {
            const rawFTDI = await import('ftdi-d2xx')
            const FTDI = rawFTDI.default || rawFTDI
            const devices = await FTDI.getDeviceInfoList()

            const d2xxPorts = devices.map(d => ({
                path: d.serial_number,
                manufacturer: 'FTDI (Direct)',
                displayName: `FTDI USB DMX (${d.description || 'D2XX'}) - ${d.serial_number}`,
                type: 'd2xx'
            }))

            // Put D2XX first
            ports = [...d2xxPorts, ...ports]
        } catch (e) {
            console.error('D2XX scan failed:', e)
        }
    }

    return ports
}

// Diagnostic scan for non-VCP FTDI devices (D2XX mode)
async function scanForNonVCPDevices() {
    return new Promise((resolve) => {
        try {
            const { exec } = require('child_process')

            if (process.platform === 'win32') {
                // Windows: Check specifically for "USB Serial Converter" which is the D2XX name
                // filtering for FTDI VID (0403)
                const cmd = `powershell "Get-PnpDevice -PresentOnly | Where-Object { $_.InstanceId -match 'VID_0403' } | Select-Object FriendlyName, InstanceId | ConvertTo-Json"`
                exec(cmd, { timeout: 3000 }, (error, stdout) => {
                    if (error) { resolve([]); return }
                    try {
                        const devices = JSON.parse(stdout)
                        const list = Array.isArray(devices) ? devices : (devices ? [devices] : [])
                        // Filter for things that look like FTDI bus devices but probably aren't showing as COM ports
                        // (Usually 'USB Serial Converter' vs 'USB Serial Port')
                        const d2xxDevices = list.filter(d =>
                            d.FriendlyName && d.FriendlyName.includes('USB Serial Converter')
                        )
                        resolve(d2xxDevices.map(d => ({ name: d.FriendlyName, type: 'D2XX' })))
                    } catch (e) { resolve([]) }
                })
            } else if (process.platform === 'linux') {
                // Linux: Check lsusb for FTDI
                exec('lsusb -d 0403:', { timeout: 3000 }, (error, stdout) => {
                    if (error || !stdout) { resolve([]); return }
                    const lines = stdout.split('\n').filter(l => l.trim().length > 0)
                    resolve(lines.map(l => ({ name: l, type: 'USB' })))
                })
            } else {
                resolve([])
            }
        } catch (error) {
            console.error('Scan failed:', error)
            resolve([])
        }
    })
}

// ============================================================================
// FTDI D2XX Direct Driver (GOLDEN MASTER - ZERO ALLOCATION)
// ============================================================================
async function createD2XXDriver(devicePath) {
    if (process.platform !== 'win32') return null
    if (connectionPromise) { try { await connectionPromise } catch (e) { } if (dmxDriver && dmxDriver.mode === 'd2xx') return dmxDriver }

    connectionPromise = (async () => {
        try {
            const rawFTDI = await import('ftdi-d2xx')
            const FTDI = rawFTDI.default || rawFTDI

            const devices = await FTDI.getDeviceInfoList()
            if (devices.length === 0) { console.error('[DMX] No FTDI D2XX devices'); return null }

            // Find specific or first device
            const targetDevice = devices.find(d => d.serial_number === devicePath) || devices[0]
            console.log(`[DMX] Opening Golden D2XX: ${targetDevice.description}`)
            const device = await FTDI.openDevice(targetDevice.serial_number)

            // SETUP OPTIMIZADO
            await device.setBaudRate(250000)
            await device.setDataCharacteristics(8, 2, 0)
            await device.setFlowControl(0, 0, 0)
            await device.setLatencyTimer(2)
            await device.purge(1 | 2)

            let intervalHandle = null
            let isSending = false
            let isClosed = false

            // LOOP DMX DE ALTA PRECISIÓN (Sin basura en RAM)
            async function dmxLoop() {
                if (isClosed || !device) return
                if (isSending) return // Drop frame

                isSending = true
                try {
                    // 1. Limpieza rápida
                    await device.purge(1 | 2)

                    // 2. Hardware Break (2ms es seguro)
                    await device.setBreakOn()
                    await new Promise(r => setTimeout(r, 2))

                    // 3. Precision MAB (Spin Wait 200us)
                    await device.setBreakOff()
                    const start = performance.now()
                    while (performance.now() - start < 0.2);

                    // 4. ESCRITURA DIRECTA (El arreglo mágico) 
                    // Enviamos el buffer global 'universe' tal cual está.
                    // Ya tiene 33 bytes y el byte[0] es 0.
                    // Cero copias, cero latencia.
                    await device.write(universe)

                } catch (e) {
                    if (!isClosed) console.error('[D2XX] TX Error:', e.message)
                } finally {
                    isSending = false
                    // Pacing: Leemos la UI (default 30Hz)
                    const targetHz = (dmxState?.performance?.dmxHz) || 30
                    const delay = Math.max(20, Math.round(1000 / targetHz))
                    if (!isClosed) intervalHandle = setTimeout(dmxLoop, delay)
                }
            }

            dmxLoop()

            return {
                mode: 'd2xx',
                driverName: 'FTDI D2XX (Golden)',
                devicePath: targetDevice.serial_number,
                device,
                // SetChannel solo actualiza el array en memoria, el loop lo lee solo
                setChannel: (ch, val) => { if (ch >= 0 && ch < DMX_UNIVERSE_SIZE) universe[ch + 1] = val },
                transmit: () => { },
                close: async () => {
                    isClosed = true
                    if (intervalHandle) clearTimeout(intervalHandle)
                    try { await device.close() } catch (e) { }
                }
            }
        } catch (error) {
            console.error('[DMX] D2XX Init Failed:', error.message)
            return null
        } finally { connectionPromise = null }
    })()
    return connectionPromise
}


// Switch DMX mode
async function switchDmxMode(mode, devicePath = null, driverType = 'enttec-open') {
    if (process.platform === 'win32') driverType = 'd2xx' // FORCE D2XX ON WINDOWS

    console.log(`[DMX] Switching to mode: ${mode}, path: ${devicePath}, driver: ${driverType}`)

    // Safely close existing driver
    const safeClose = () => {
        try {
            if (dmxDriver && typeof dmxDriver.close === 'function') {
                console.log('[DMX] Closing existing driver:', dmxDriver.mode)
                dmxDriver.close()
            }
        } catch (e) {
            console.log('Driver close warning:', e.message)
        }
    }

    if (mode === 'usb' || mode === 'native') { // Support both names
        const path = devicePath || nativeDevicePath

        let newDriver = null

        // Select driver implementation
        if (driverType === 'd2xx') {
            newDriver = await createD2XXDriver(path)
        } else if (driverType === 'enttec-open') {
            newDriver = await createEnttecOpenDriver(path)
        } else if (driverType === 'enttec-pro') {
            newDriver = await createEnttecProDriver(path)
        } else {
            newDriver = await createNativeDriver(path)
        }

        console.log('[DMX] New driver created:', newDriver ? newDriver.driverName : 'null')

        if (newDriver) {
            safeClose()
            dmxDriver = newDriver
            dmxMode = 'usb'
            currentUsbDriver = driverType // Store current driver preference
            nativeDevicePath = path
            console.log(`[DMX] Driver assigned: ${dmxDriver.driverName} on ${path}`)
            return { success: true, mode: 'usb', devicePath: path, driverType }
        } else {
            return { success: false, error: 'Failed to connect to device', mode: dmxMode }
        }
    } else {
        safeClose()
        await closeExistingPort() // Explicitly close generic port when switching to ArtNet
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

    // Hardware Loop - 44Hz continuous transmission (uses abstracted driver)
    const dmxMs = Math.round(1000 / dmxState.performance.dmxHz)
    dmxInterval = setInterval(() => {
        if (dmxState.blackout) {
            for (let i = 0; i < 512; i++) dmxDriver.setChannel(i, 0)
        } else {
            for (let i = 0; i < 512; i++) dmxDriver.setChannel(i, dmxState.channels[i])
        }
        dmxDriver.transmit()
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
        dmxState.channels = [...savedChannels]
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

app.whenReady().then(async () => {
    electronApp.setAppUserModelId('com.beamstudio.dmx')
    app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))
    setupIPC()

    // Auto-connect to Native USB by default (fall back to Art-Net if not available)
    try {
        const result = await switchDmxMode('native', '/dev/ttyUSB0')
        if (!result.success) {
            console.log('[DMX] Native USB not available, using Art-Net fallback')
        }
    } catch (e) {
        console.log('[DMX] Native USB connection failed, using Art-Net:', e.message)
    }

    startDMXLoop()
    createWindow()
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('window-all-closed', () => { stopDMXLoop(); stopDynamicScene(); if (process.platform !== 'darwin') app.quit() })
app.on('before-quit', () => { stopDMXLoop(); stopDynamicScene(); for (let i = 0; i < 512; i++) dmxDriver.setChannel(i, 0); dmxDriver.transmit() })
