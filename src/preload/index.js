import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { HARDWARE_CONSTRAINTS } from '../shared/hardware-specs'

// BS-005: the projector window is launched with an extra CLI argument (see
// createProjectorWindow's webPreferences.additionalArguments in
// src/main/index.js) so this preload script can tell it apart from the main
// window and shrink its exposed globals accordingly — dmx/ambilight/scene/
// theme/ai/windowOps are not assigned onto the projector window's `window`
// object. This stops the projector's own normal application code from
// touching DMX/ambilight/main-window-only controls, since that app code
// always calls through optional chaining (e.g. `window.dmx?.xxx`), which now
// correctly no-ops in this window.
//
// This preload-level restriction does NOT by itself make hijacking DMX
// output ownership structurally impossible: the projector BrowserWindow runs
// with sandbox: false and DevTools reachable, so a deliberate DevTools
// console can still call `ipcRenderer.invoke('dmx:setDynamicRendererActive',
// ...)` directly, bypassing this layer entirely. The actual authoritative
// enforcement against that bypass is the sender-identity guard in
// src/main/index.js's `ipcMain.handle('dmx:setDynamicRendererActive', ...)`
// handler, which rejects ownership claims from the projector window
// regardless of what this preload script exposes.
const isProjectorWindow = process.argv.includes('--beamstudio-role=projector')

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
// Security hardening (post-BS-005 audit): start/stop/setLevel are the
// ORIGINAL audio-reactive-DMX feature — audio:start seizes dynamic-scene
// ownership and force-writes fixture dimmers, audio:setLevel writes
// caller-supplied RGB straight to physical fixture colors. Those are
// hardware-mutating, same class as dmx/ambilight, so they're only bundled
// into this object for non-projector windows. broadcastFrame/onFrameBroadcast
// are the safe AudioFrame relay and stay unconditional (see comment below).
const audioAPI = {
    // BS-005: relays AudioFrame from the main window (where useSystemAudio
    // actually runs) to the projector window's separate renderer process,
    // whose local useAudioStore never receives live analysis on its own.
    broadcastFrame: (frame) => ipcRenderer.send('audio:frameBroadcast', frame),
    onFrameBroadcast: (cb) => {
        const listener = (_e, frame) => cb(frame)
        ipcRenderer.on('audio:frameBroadcast', listener)
        return () => ipcRenderer.removeListener('audio:frameBroadcast', listener)
    },
    ...(!isProjectorWindow && {
        start: (claimsOutput = true) => ipcRenderer.invoke('audio:start', { claimsOutput }),
        stop: () => ipcRenderer.invoke('audio:stop'),
        setLevel: (levels) => ipcRenderer.invoke('audio:setLevel', levels)
    })
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
    setVisual: (visualId) => ipcRenderer.send('projector:setVisual', visualId),
    // BS-007 phase 2: Now Playing overlay toggle - mirrors setBlackout/
    // setTestPattern's exact one-way send/subscribe shape.
    setNowPlayingOverlay: (value) => ipcRenderer.send('projector:setNowPlayingOverlay', value),
    onVisualChanged: (cb) => {
        const listener = (_e, visualId) => cb(visualId)
        ipcRenderer.on('projector:visualChanged', listener)
        return () => ipcRenderer.removeListener('projector:visualChanged', listener)
    },
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
    onNowPlayingOverlayChanged: (cb) => {
        const listener = (_e, v) => cb(v)
        ipcRenderer.on('projector:nowPlayingOverlayChanged', listener)
        return () => ipcRenderer.removeListener('projector:nowPlayingOverlayChanged', listener)
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

// Mapping API (BS-006) — quad-warp projection mapping edit-mode toggle.
// Follows the exact same one-way send / subscribe-with-unsubscribe shape as
// projectorAPI's setBlackout/onBlackout: the main window calls setEditMode,
// the projector window listens via onEditModeChanged.
const mappingAPI = {
    setEditMode: (value) => ipcRenderer.send('mapping:setEditMode', value),
    onEditModeChanged: (cb) => {
        const listener = (_e, v) => cb(v)
        ipcRenderer.on('mapping:editModeChanged', listener)
        return () => ipcRenderer.removeListener('mapping:editModeChanged', listener)
    },

    // BS-006 phase 2: surfaces array sync. Either side (main window's
    // ProjectorPage or the projector window's MappingCompositor) can push a
    // new surfaces array — the other side picks it up via onSurfacesChanged.
    setSurfaces: (surfaces) => ipcRenderer.send('mapping:setSurfaces', surfaces),
    onSurfacesChanged: (cb) => {
        const listener = (_e, surfaces) => cb(surfaces)
        ipcRenderer.on('mapping:surfacesChanged', listener)
        return () => ipcRenderer.removeListener('mapping:surfacesChanged', listener)
    },
    // BS-006 phase 2 fix: pull the main process's last-known surfaces array
    // on mount, so a freshly-opened window adopts current state instead of
    // only ever reacting to pushes that happen after it starts listening.
    getSurfaces: () => ipcRenderer.invoke('mapping:getSurfaces'),

    // BS-006 phase 2: mapping preset persistence (userData/mapping-presets.json).
    listPresets: () => ipcRenderer.invoke('mapping:listPresets'),
    savePreset: (payload) => ipcRenderer.invoke('mapping:savePreset', payload),
    loadPreset: (name) => ipcRenderer.invoke('mapping:loadPreset', name),
    deletePreset: (name) => ipcRenderer.invoke('mapping:deletePreset', name)
}

// BS-007: better-named alias for the same 'get-system-media' IPC channel
// already used by dmxAPI.getSystemMedia. The original stays put (and
// unmodified) since useSystemAudio.js and geminiService.js already call
// window.dmx.getSystemMedia() directly - this is purely an additive, more
// discoverable name for new Now Playing metadata consumers.
const nowPlayingAPI = {
    getSystemMedia: () => ipcRenderer.invoke('get-system-media')
}

// Expose APIs
// BS-005: `audio` and `projector` are always exposed — the projector window
// needs `audio` for the AudioFrame relay (start/stop/setLevel are stripped
// out of that object for the projector, see audioAPI above) and `projector`
// for blackout/test-pattern/visual/status control. `dmx`, `ambilight`,
// `scene`, `theme`, `ai`, and `windowOps` are main-window-only: the projector
// is a pure visual output and must never be able to touch DMX/ambilight
// output ownership or main-window-only chrome.
// BS-006: `mapping` is exposed the same way as `projector` — the main window
// calls setEditMode, the projector window listens via onEditModeChanged.
// BS-007 phase 2: `nowPlaying` is ALSO always exposed (moved out of the
// dmx/ambilight-style gate it started in) — the projector window renders its
// own Now Playing overlay now, and getSystemMedia is a read-only metadata
// query with no DMX/hardware capability, so there's no isolation reason to
// withhold it there.
// Security hardening (post-BS-005 audit): `electron` is now gated the same
// way as `dmx`/`ambilight` — its `ipcRenderer` sub-object is a raw pass-
// through that accepts ANY IPC channel name (invoke/send/sendSync), which
// would let the projector window bypass every one of the gates above by
// calling e.g. `window.electron.ipcRenderer.invoke('dmx:setChannel', ...)`
// directly. A repo-wide grep confirms no projector renderer code (or any
// renderer code) currently reads `window.electron` at all, so withholding it
// from the projector has no functional cost.
if (process.contextIsolated) {
    try {
        // BS-004: plain string, not a function — lets renderer code branch on
        // OS-specific capture flows (e.g. Ambilight's Wayland getDisplayMedia
        // path vs. the desktopCapturer/getUserMedia path on other platforms)
        // without adding a round-trip IPC call for something that never changes.
        contextBridge.exposeInMainWorld('platform', process.platform)
        if (!isProjectorWindow) {
            contextBridge.exposeInMainWorld('electron', electronAPI)
            contextBridge.exposeInMainWorld('dmx', dmxAPI)
            contextBridge.exposeInMainWorld('ambilight', ambilightAPI)
        }
        contextBridge.exposeInMainWorld('audio', audioAPI)
        contextBridge.exposeInMainWorld('nowPlaying', nowPlayingAPI)
        if (!isProjectorWindow) {
            contextBridge.exposeInMainWorld('scene', sceneAPI)
            contextBridge.exposeInMainWorld('theme', themeAPI)
            contextBridge.exposeInMainWorld('ai', aiAPI)
            contextBridge.exposeInMainWorld('windowOps', windowOps)
        }
        contextBridge.exposeInMainWorld('projector', projectorAPI)
        contextBridge.exposeInMainWorld('mapping', mappingAPI)
    } catch (error) {
        console.error(error)
    }
} else {
    window.platform = process.platform
    if (!isProjectorWindow) {
        window.electron = electronAPI
        window.dmx = dmxAPI
        window.ambilight = ambilightAPI
    }
    window.audio = audioAPI
    window.nowPlaying = nowPlayingAPI
    if (!isProjectorWindow) {
        window.scene = sceneAPI
        window.theme = themeAPI
        window.ai = aiAPI
        window.windowOps = windowOps
    }
    window.projector = projectorAPI
    window.mapping = mappingAPI
}
