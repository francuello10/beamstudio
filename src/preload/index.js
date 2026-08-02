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
    saveFixtures: (fixtures) => ipcRenderer.invoke('dmx:saveFixtures', fixtures),

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
    setDynamicRendererActive: (active, owner = 'renderer') => ipcRenderer.invoke('dmx:setDynamicRendererActive', { active, owner }),
    updatePerformance: (settings) => ipcRenderer.invoke('dmx:updatePerformance', settings),

    // DMX Connection Control (USB runtime only)
    getMode: () => ipcRenderer.invoke('dmx:getMode'),
    listPorts: () => ipcRenderer.invoke('dmx:listPorts'),
    scanD2XX: () => ipcRenderer.invoke('dmx:scanD2XX'), // Diagnostic for non-VCP devices
    getUsbDrivers: () => ipcRenderer.invoke('dmx:getUsbDrivers'),
    setMode: (mode, devicePath, driver) => ipcRenderer.invoke('dmx:setMode', { mode, devicePath, driver }),

    getState: () => ipcRenderer.invoke('dmx:getState'),
    onColorsUpdated: (callback) => {
        const listener = (_, colors) => callback(colors)
        ipcRenderer.on('dmx:colorsUpdated', listener)
        return () => ipcRenderer.removeListener('dmx:colorsUpdated', listener)
    },
    onTelemetryUpdated: (callback) => {
        const listener = (_, data) => callback(data)
        ipcRenderer.on('dmx:telemetry', listener)
        return () => ipcRenderer.removeListener('dmx:telemetry', listener)
    }
}

// Ambilight API
const ambilightAPI = {
    getSources: () => ipcRenderer.invoke('ambilight:getSources'),
    start: (sourceId) => ipcRenderer.invoke('ambilight:start', sourceId),
    stop: () => ipcRenderer.invoke('ambilight:stop'),
    setColors: (colors) => ipcRenderer.invoke('ambilight:setColors', colors),
    setColorsAsync: (payload) => ipcRenderer.send('ambilight:setColorsAsync', payload)
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

// Projector API (BS-005)
const projectorAPI = {
    listDisplays: () => ipcRenderer.invoke('projector:listDisplays'),
    open: (displayId) => ipcRenderer.invoke('projector:open', displayId),
    close: () => ipcRenderer.invoke('projector:close'),
    setBlackout: (value) => ipcRenderer.send('projector:setBlackout', value),
    setTestPattern: (value) => ipcRenderer.send('projector:setTestPattern', value),
    onBlackout: (cb) => {
        const listener = (_e, v) => cb(v)
        ipcRenderer.on('projector:blackout', listener)
        return () => ipcRenderer.removeListener('projector:blackout', listener)
    },
    onTestPattern: (cb) => {
        const listener = (_e, v) => cb(v)
        ipcRenderer.on('projector:testPattern', listener)
        return () => ipcRenderer.removeListener('projector:testPattern', listener)
    },
    onStatusChanged: (cb) => {
        const listener = (_e, payload) => cb(payload)
        ipcRenderer.on('projector:statusChanged', listener)
        return () => ipcRenderer.removeListener('projector:statusChanged', listener)
    },
    onDisplaysChanged: (cb) => {
        const listener = (_e, displays) => cb(displays)
        ipcRenderer.on('projector:displaysChanged', listener)
        return () => ipcRenderer.removeListener('projector:displaysChanged', listener)
    }
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
        contextBridge.exposeInMainWorld('projector', projectorAPI)
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
    window.projector = projectorAPI
}
