import { create } from 'zustand'

export const useConfigStore = create((set) => ({
    // State
    config: null,
    activePage: 'mixer',
    darkMode: true,
    pendingRequests: 0,

    // Actions
    setConfig: (config) => set({ config }),

    setActivePage: (activePage) => set({ activePage }),

    setDarkMode: (darkMode) => {
        set({ darkMode })
        // Persistence could be added here if needed, or in a separate effect
    },

    incrementPending: () => set((state) => ({ pendingRequests: state.pendingRequests + 1 })),
    decrementPending: () => set((state) => ({ pendingRequests: Math.max(0, state.pendingRequests - 1) })),

    updatePerformance: (settings) => {
        // Sync with Backend Driver
        window.dmx?.updatePerformance(settings)

        set((state) => ({
            config: state.config ? {
                ...state.config,
                performance: { ...state.config.performance, ...settings }
            } : null
        }))
    }
}))
