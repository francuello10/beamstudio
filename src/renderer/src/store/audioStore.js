import { create } from 'zustand'

export const useAudioStore = create((set) => ({
    // State
    spatialEnergies: { left: 0, center: 0, right: 0 },
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
    setSpatialEnergies: (spatialEnergies) => set({ spatialEnergies }),

    setAudioData: (data) => set((state) => ({
        ...state,
        ...data
    })),

    setAudioActive: (audioActive) => set({ audioActive }),
    setEnergyFactor: (energyFactor) => set({ energyFactor })
}))
