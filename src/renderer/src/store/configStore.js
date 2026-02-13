import { create } from 'zustand'

export const useConfigStore = create((set) => ({
    // State
    config: null,
    activePage: 'mixer',
    darkMode: true,
    pendingRequests: 0,

    dynamicScenes: [
        { id: 'vibe', name: 'Vibe', desc: 'Slow color shift' },
        { id: 'aesthetic', name: 'Aesthetic', desc: 'Vaporwave gradient' },
        { id: 'rainbow', name: 'Rainbow', desc: 'Full spectrum cycle' },
        { id: 'fire', name: 'Fire', desc: 'Intense heat' },
        { id: 'ocean', name: 'Ocean', desc: 'Deep blue depths' },
        { id: 'aurora', name: 'Aurora', desc: 'Northern lights' },
        { id: 'pulse', name: 'Pulse', desc: 'Heartbeat rhythm' },
        { id: 'strobe', name: 'Strobe', desc: 'High energy flash' },
        { id: 'party', name: 'Party', desc: 'Random colors' }, // Note: Needs implementation in palettes.js if missing
        { id: 'sunset', name: 'Sunset', desc: 'Golden hour' },
        { id: 'chill', name: 'Chill', desc: 'Relaxed atmosphere' },
        { id: 'romance', name: 'Romance', desc: 'Pink & purple' },
        // NEW V5.0 SCENES
        { id: 'fireball', name: 'Fireball', desc: 'Moving chase effect' },
        { id: 'cordoba_sky', name: 'Córdoba Sky', desc: 'Majestic sunset' },
        { id: 'cylon', name: 'Cylon', desc: 'Scanner eye' },
        { id: 'plasma', name: 'Plasma', desc: 'Energy flow' },
        { id: 'biolum', name: 'Biolum', desc: 'Glowing sparkles' }
    ],

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
