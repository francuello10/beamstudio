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

    // Actions
    setAudioTelemetryDSP: (audioTelemetryDSP) => set({ audioTelemetryDSP }),

    setAudioData: (data) => set((state) => ({
        ...state,
        ...data
    })),

    setAudioActive: (audioActive) => set({ audioActive }),
    setEnergyFactor: (energyFactor) => set({ energyFactor }),
    setAudioBaseColors: (audioBaseColors) => set({ audioBaseColors }),
    setAudioBoostLevel: (audioBoostLevel) => set({ audioBoostLevel: Math.max(0.5, Math.min(2.5, audioBoostLevel || 1)) }),

    // New Actions
    setAudioMode: (audioMode) => set({ audioMode }),
    updateAudioAnalysis: (spatial, spectral, audioFrame) => set({
        spatialResponse: spatial,
        spectralResponse: spectral,
        ...(audioFrame ? { audioFrame } : {})
    })
}))
