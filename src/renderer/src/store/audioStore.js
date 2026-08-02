import { create } from 'zustand'
import { createEmptyAudioFrame } from '../audio/AudioFrame'

/**
 * useAudioStore - High-Bandwidth Telemetry & DSP State
 * 
 * Centralized store for real-time audio analysis and telemetry.
 * 
 * @ai-constraints Este store recibe ráfagas de alta frecuencia (60Hz). 
 * No utilizar para estados que requieran persistencia pesada o lógica de negocio compleja.
 */
export const useAudioStore = create((set) => ({
    // State
    audioTelemetryDSP: { left: 0, center: 0, right: 0 },
    telemetry: {
        lowEndDynamics: 0,
        transientDensity: 0,
        midRms: 0,
        stereoWidth: 0
    },
    detectedGenre: 'UNKNOWN',
    visualizerData: {
        left: new Array(16).fill(0),
        right: new Array(16).fill(0),
        bass: 0
    },
    audioActive: false,
    activeAudioSource: { deviceId: '', label: '', fallbackToDefault: false },
    energyFactor: 1,

    // Centralized Audio Intelligence (v7)
    audioMode: 'STEREO', // 'STEREO' | 'EQ' | 'OFF'
    spatialResponse: { left: 0, center: 0, right: 0 }, // Normalized 0-1
    spectralResponse: new Array(16).fill(0),          // Normalized 0-1
    audioFrame: createEmptyAudioFrame(),
    audioBaseColors: [],
    audioBoostLevel: 1.5,
    // Page-derived override for the shared engine's modifier input colors.
    // null = no override, fall back to audioBaseColors. Only the page that
    // derives its own palette writes here (ConsoleMixerPage's manual mix,
    // DynamicScenesPageV2's live scene frame) and it MUST clear it on unmount
    // so a stale override never leaks into another feature.
    audioInputColors: null,
    // DMX source tag the shared engine writes its frames under. 'audio' is the
    // audio output path; DynamicScenesPageV2 switches it to 'renderer' while its
    // own audio boost is on, because that page owns DMX output as 'renderer'.
    audioOutputSource: 'audio',

    // Ecosystem Color-Sync: presentational-only UI toggle read by Particle
    // Field / Tunnel Grid / Kaleidoscope (useParticleField.js/useTunnelGrid.js/
    // useKaleidoscope.js) to optionally borrow their hue range from the DMX
    // side's current genre theme (see audio/genreColorTheme.js) instead of
    // their own fixed neon hue band. Deliberately NOT implemented for Fluid
    // Neon (its own manual palette picker is excluded on purpose) or Ceiling
    // Dome (no sync support added in this pass).
    // This is a narrow, deliberate exception to this store's "no business
    // logic" header comment above — a single boolean UI flag, not DSP/
    // business logic. It lives here (rather than a separate small store)
    // only because it must reach the projector output window's OWN separate
    // useAudioStore instance (a different renderer process) via the exact
    // same IPC relay this store already uses for `audioFrame` — see
    // ProjectorApp.jsx's onVisualColorSyncChanged listener and
    // ProjectorPage.jsx's toggle. Defaults ON per the ecosystem color-sync
    // audit's recommendation.
    visualColorSyncEnabled: true,

    // Actions
    setAudioTelemetryDSP: (audioTelemetryDSP) => set({ audioTelemetryDSP }),

    setAudioData: (data) => set((state) => ({
        ...state,
        ...data
    })),

    setAudioActive: (audioActive) => set({ audioActive }),
    setEnergyFactor: (energyFactor) => set({ energyFactor }),
    setAudioBaseColors: (audioBaseColors) => set({ audioBaseColors }),
    setAudioInputColors: (audioInputColors) => set({ audioInputColors: audioInputColors || null }),
    setAudioOutputSource: (audioOutputSource) => set({ audioOutputSource: audioOutputSource || 'audio' }),
    setAudioBoostLevel: (audioBoostLevel) => set({ audioBoostLevel: Math.max(0.5, Math.min(4, audioBoostLevel || 1)) }),
    setVisualColorSyncEnabled: (visualColorSyncEnabled) => set({ visualColorSyncEnabled: !!visualColorSyncEnabled }),

    // New Actions
    setAudioMode: (audioMode) => set({ audioMode }),
    updateAudioAnalysis: (spatial, spectral, audioFrame) => set({
        spatialResponse: spatial,
        spectralResponse: spectral,
        ...(audioFrame ? { audioFrame } : {})
    })
}))
