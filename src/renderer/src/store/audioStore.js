import { create } from 'zustand'

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
    energyFactor: 1,

    // Actions
    setAudioTelemetryDSP: (audioTelemetryDSP) => set({ audioTelemetryDSP }),

    setAudioData: (data) => set((state) => ({
        ...state,
        ...data
    })),

    setAudioActive: (audioActive) => set({ audioActive }),
    setEnergyFactor: (energyFactor) => set({ energyFactor })
}))
