import { create } from 'zustand'

/**
 * useDmxStore - Atomic State Architecture for Ultra-Low Latency DMX Control
 * 
 * Centralized store for the DMX Universe state and fixture patch.
 * Designed for high-frequency updates with minimal overhead.
 */
export const useDmxStore = create((set) => ({
    // State
    dmxUniverseState: { red: 0, green: 0, blue: 0, func: 0, spd: 0, flash: 0, dim: 0 },
    pixelMapBuffer: [],
    dmxFixtures: [],
    activeProgram: null,
    activeDynamicScene: null,

    // Actions
    /**
     * @ai-constraints Este store es atómico. Solo despachar cambios si el valor es diferente al anterior (Dirty-Checking). 
     * No saturar el bridge IPC con actualizaciones redundantes.
     */
    dispatchDmxAttributeUpdate: (channel, value) =>
        set((state) => ({
            dmxUniverseState: { ...state.dmxUniverseState, [channel]: value }
        })),

    dispatchBulkDmxUpdate: (values) =>
        set((state) => ({
            dmxUniverseState: { ...state.dmxUniverseState, ...values }
        })),

    setPixelMapBuffer: (colors) => set({ pixelMapBuffer: colors }),

    sendPixelMapBuffer: (colors) => {
        window.ambilight?.setColorsAsync({ colors })
        set({ pixelMapBuffer: colors })
    },

    setDmxFixtures: (dmxFixtures) => set({ dmxFixtures }),

    toggleFixtureSelection: (fixtureId) =>
        set((state) => ({
            dmxFixtures: state.dmxFixtures.map(f =>
                f.id === fixtureId ? { ...f, selected: !f.selected } : f
            )
        })),

    setActiveProgram: (activeProgram) => set({ activeProgram }),
    setActiveDynamicScene: (activeDynamicScene) => set({ activeDynamicScene }),

    toggleBlackout: async (fixtureId) => {
        const { dmxUniverseState } = useDmxStore.getState()
        const res = await window.dmx?.toggleBlackout(fixtureId)
        if (res?.success && !res.blackout) {
            // Restore current mix
            await window.dmx?.setChannels([fixtureId], dmxUniverseState)
        }
    },

    resetDmx: () => set({
        dmxUniverseState: { red: 0, green: 0, blue: 0, func: 0, spd: 0, flash: 0, dim: 0 },
        activeProgram: null,
        activeDynamicScene: null
    })
}))
