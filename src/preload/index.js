import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// DMX API - StickTec 1019 P6 Mode
const dmxAPI = {
    getFixtures: () => ipcRenderer.invoke('dmx:getFixtures'),
    getConfig: () => ipcRenderer.invoke('dmx:getConfig'),
    setChannels: (fixtureIds, channels) => ipcRenderer.invoke('dmx:setChannels', { fixtureIds, channels }),
    setChannel: (channel, value) => ipcRenderer.invoke('dmx:setChannel', { channel, value }),

    // High Performance - Async one-way calls
    setChannelAsync: (channel, value) => ipcRenderer.send('dmx:setChannelAsync', { channel, value }),
    setChannelsAsync: (fixtureIds, channels) => ipcRenderer.send('dmx:setChannelsAsync', { fixtureIds, channels }),

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

    // Dynamic scenes (software)
    dynamicScene: (sceneId, active) => ipcRenderer.invoke('dmx:dynamicScene', { sceneId, active }),
    updatePerformance: (settings) => ipcRenderer.invoke('dmx:updatePerformance', settings),

    // DMX Mode Control (Art-Net vs Native USB)
    getMode: () => ipcRenderer.invoke('dmx:getMode'),
    listPorts: () => ipcRenderer.invoke('dmx:listPorts'),
    setMode: (mode, devicePath) => ipcRenderer.invoke('dmx:setMode', { mode, devicePath }),

    getState: () => ipcRenderer.invoke('dmx:getState'),
    onColorsUpdated: (callback) => {
        ipcRenderer.on('dmx:colorsUpdated', (_, colors) => callback(colors))
        return () => ipcRenderer.removeAllListeners('dmx:colorsUpdated')
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

// Expose APIs
if (process.contextIsolated) {
    try {
        contextBridge.exposeInMainWorld('electron', electronAPI)
        contextBridge.exposeInMainWorld('dmx', dmxAPI)
        contextBridge.exposeInMainWorld('ambilight', ambilightAPI)
        contextBridge.exposeInMainWorld('audio', audioAPI)
        contextBridge.exposeInMainWorld('scene', sceneAPI)
        contextBridge.exposeInMainWorld('theme', themeAPI)
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
