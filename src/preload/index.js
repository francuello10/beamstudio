import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { HARDWARE_CONSTRAINTS } from '../shared/hardware-specs'

// DMX API - StickTec 1019 P6 Mode
const dmxAPI = {
    getFixtures: () => ipcRenderer.invoke('dmx:getFixtures'),
    getConfig: () => ipcRenderer.invoke('dmx:getConfig'),
    getSystemMedia: () => ipcRenderer.invoke('get-system-media'),
    setChannels: (fixtureIds, channels) => ipcRenderer.invoke('dmx:setChannels', { fixtureIds, channels }),
    setChannel: (channel, value) => ipcRenderer.invoke('dmx:setChannel', { channel, value }),

    /**
     * High Performance - Async one-way calls
     * @ai-constraints Usar HARDWARE_CONSTRAINTS para validación.
     */
    setChannelAsync: (channel, value) => {
        const val = Math.max(HARDWARE_CONSTRAINTS.DMX_MIN, Math.min(HARDWARE_CONSTRAINTS.DMX_MAX, value))
        ipcRenderer.send('dmx:setChannelAsync', { channel, value: val })
    },
    setChannelsAsync: (fixtureIds, channels) => {
        const validated = {}
        Object.entries(channels).forEach(([ch, val]) => {
            validated[ch] = Math.max(HARDWARE_CONSTRAINTS.DMX_MIN, Math.min(HARDWARE_CONSTRAINTS.DMX_MAX, val))
        })
        ipcRenderer.send('dmx:setChannelsAsync', { fixtureIds, channels: validated })
    },

    // Set per-fixture colors in a single call (for flags, etc.)
    setPerFixtureColors: (fixtureColors) => ipcRenderer.invoke('dmx:setPerFixtureColors', { fixtureColors }),

    // RESET ALL - Back to 0 0 0 0 0 0 0
    reset: () => ipcRenderer.invoke('dmx:reset'),

    // Color Macros
    colorMacro: (colorName) => ipcRenderer.invoke('dmx:colorMacro', colorName),

    // Programs (FUNC channel)
    setProgram: (program, speed) => ipcRenderer.invoke('dmx:setProgram', { program, speed }),

    // Flash controls
    setFlash: (speed) => ipcRenderer.invoke('dmx:setFlash', speed),
    flashWhite: (active) => ipcRenderer.invoke('dmx:flashWhite', active),
    flash: () => ipcRenderer.invoke('dmx:flash'),

    // Sound mode (hardware)
    soundMode: (active) => ipcRenderer.invoke('dmx:soundMode', active),

    // Core controls
    blackout: (active) => ipcRenderer.invoke('dmx:blackout', active),
    toggleBlackout: (fixtureId) => ipcRenderer.invoke('dmx:toggleBlackout', fixtureId),
    meet: () => ipcRenderer.invoke('dmx:meet'),
    intenseFlash: () => ipcRenderer.invoke('dmx:intenseFlash'),
    cancelFlash: () => ipcRenderer.invoke('dmx:cancelFlash'),

    // Dynamic scenes (software)
    dynamicScene: (sceneId, active) => ipcRenderer.invoke('dmx:dynamicScene', { sceneId, active }),
    setDynamicRendererActive: (active) => ipcRenderer.invoke('dmx:setDynamicRendererActive', active),
    updatePerformance: (settings) => ipcRenderer.invoke('dmx:updatePerformance', settings),

    // DMX Mode Control (Art-Net vs Native USB)
    getMode: () => ipcRenderer.invoke('dmx:getMode'),
    listPorts: () => ipcRenderer.invoke('dmx:listPorts'),
    scanD2XX: () => ipcRenderer.invoke('dmx:scanD2XX'), // Diagnostic for non-VCP devices
    getUsbDrivers: () => ipcRenderer.invoke('dmx:getUsbDrivers'),
    setMode: (mode, devicePath, driver) => ipcRenderer.invoke('dmx:setMode', { mode, devicePath, driver }),

    getState: () => ipcRenderer.invoke('dmx:getState'),
    onColorsUpdated: (callback) => {
        ipcRenderer.on('dmx:colorsUpdated', (_, colors) => callback(colors))
        return () => ipcRenderer.removeAllListeners('dmx:colorsUpdated')
    },
    onTelemetryUpdated: (callback) => {
        ipcRenderer.on('dmx:telemetry', (_, data) => callback(data))
        return () => ipcRenderer.removeAllListeners('dmx:telemetry')
    }
}

// Ambilight API
const ambilightAPI = {
    getSources: () => ipcRenderer.invoke('ambilight:getSources'),
    start: (sourceId) => ipcRenderer.invoke('ambilight:start', sourceId),
    stop: () => ipcRenderer.invoke('ambilight:stop'),
    setColors: (colors) => ipcRenderer.invoke('ambilight:setColors', colors),
    setColorsAsync: (colors) => ipcRenderer.send('ambilight:setColorsAsync', colors)
}

// Audio API
const audioAPI = {
    start: () => ipcRenderer.invoke('audio:start'),
    stop: () => ipcRenderer.invoke('audio:stop'),
    setLevel: (levels) => ipcRenderer.invoke('audio:setLevel', levels)
}

// Scene API
const sceneAPI = {
    load: (sceneData) => ipcRenderer.invoke('scene:load', sceneData)
}

// Window Operations
const windowOps = {
    minimize: () => ipcRenderer.send('window:minimize'),
    toggleMaximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close')
}

// Theme API
const themeAPI = {
    toggle: () => ipcRenderer.invoke('theme:toggle'),
    get: () => ipcRenderer.invoke('theme:get'),
    set: (theme) => ipcRenderer.invoke('theme:set', theme)
}

// AI API
const aiAPI = {
    generate: (apiKey, model, prompt, systemInstruction) => ipcRenderer.invoke('ai:generate', { apiKey, model, prompt, systemInstruction }),
    test: (apiKey, model) => ipcRenderer.invoke('ai:test', { apiKey, model }),
    listModels: (apiKey) => ipcRenderer.invoke('ai:listModels', { apiKey })
}

// Expose APIs
if (process.contextIsolated) {
    try {
        contextBridge.exposeInMainWorld('electron', electronAPI)
        contextBridge.exposeInMainWorld('dmx', dmxAPI)
        contextBridge.exposeInMainWorld('ambilight', ambilightAPI)
        contextBridge.exposeInMainWorld('audio', audioAPI)
        contextBridge.exposeInMainWorld('scene', sceneAPI)
        contextBridge.exposeInMainWorld('theme', themeAPI)
        contextBridge.exposeInMainWorld('ai', aiAPI)
        contextBridge.exposeInMainWorld('windowOps', windowOps)
    } catch (error) {
        console.error(error)
    }
} else {
    window.electron = electronAPI
    window.dmx = dmxAPI
    window.ambilight = ambilightAPI
    window.audio = audioAPI
    window.scene = sceneAPI
    window.theme = themeAPI
    window.windowOps = windowOps
}
