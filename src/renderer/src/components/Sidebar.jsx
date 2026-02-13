import React from 'react'
import { Sliders, Music, Lightbulb, Monitor, Settings, Sun, Moon, Waves } from 'lucide-react'
import { useConfigStore } from '../store/configStore'
import { useDmxStore } from '../store/dmxStore'

const navItems = [
    { id: 'mixer', icon: Sliders, label: 'Console Mixer' },
    { id: 'programs', icon: Lightbulb, label: 'Programs' },
    { id: 'dynamic', icon: Sparkles, icon_override: true, label: 'Dynamic' }, // We'll fix Sparkles import
    { id: 'audio', icon: Music, label: 'Audio' },
    { id: 'fluidsim', icon: Waves, label: 'Fluid Sim' },
    { id: 'ambilight', icon: Monitor, label: 'Ambilight' },
    { id: 'system', icon: Settings, label: 'System' },
]

// Note: Sparkles import from lucide-react
import { Sparkles } from 'lucide-react'

import logoImg from '../assets/logo.png'

const Sidebar = React.memo(() => {
    const activePage = useConfigStore(state => state.activePage)
    const setActivePage = useConfigStore(state => state.setActivePage)
    const darkMode = useConfigStore(state => state.darkMode)
    const setDarkMode = useConfigStore(state => state.setDarkMode)

    // Store activity states
    const activeProgram = useDmxStore(state => state.activeProgram)
    const activeDynamicScene = useDmxStore(state => state.activeDynamicScene)
    // We infer ambilight activity via dmxStore if needed, or assume if user is there. 
    // Actually, store has specific flags for activity? 
    // dmxStore doesn't expose 'ambilightActive' directly in the hook we see? 
    // Let's check dmxStore definition again. 
    // Ah, dmxState is in the store but we need to subscribe to it.
    // The store definition has: dmxUniverseState, activeProgram, activeDynamicScene...

    // Helper to check if a mode is "Running"
    const isRunning = (id) => {
        const state = useDmxStore.getState()
        if (id === 'programs' && activeProgram !== null) return true
        if (id === 'dynamic' && (activeDynamicScene !== null || state.activeFlag !== null)) return true
        if (id === 'audio' && state.activeProgram === 220) return true // StickTec Sound Mode
        if (id === 'ambilight' && state.pixelMapBuffer?.length > 0 && !activeDynamicScene && !state.activeFlag && activeProgram === null) return true
        return false
    }

    return (
        <div className="sidebar">
            <div className="sidebar-logo-container" style={{ padding: '20px 0', display: 'flex', justifyContent: 'center' }}>
                <img src={logoImg} alt="BeamStudio" style={{ width: '32px', height: '32px', filter: 'drop-shadow(0 0 10px rgba(255,0,128,0.5))' }} />
            </div>
            <nav className="sidebar-nav">
                {navItems.map(item => {
                    const Icon = item.id === 'dynamic' ? Sparkles : item.icon
                    const isActive = activePage === item.id
                    const showDot = isRunning(item.id)

                    return (
                        <div
                            key={item.id}
                            className={`nav-item ${isActive ? 'active' : ''}`}
                            onClick={() => setActivePage(item.id)}
                            style={{ position: 'relative' }}
                        >
                            <Icon size={20} />
                            <span>{item.label}</span>
                            {showDot && (
                                <div style={{
                                    position: 'absolute',
                                    right: '12px',
                                    width: '6px',
                                    height: '6px',
                                    borderRadius: '50%',
                                    background: '#00ff88',
                                    boxShadow: '0 0 8px #00ff88'
                                }} />
                            )}
                        </div>
                    )
                })}
            </nav>

            <div className="sidebar-footer">
                <div className="theme-toggle" onClick={() => setDarkMode(!darkMode)}>
                    {darkMode ? <Sun size={20} /> : <Moon size={20} />}
                </div>
                <div className="status-dot" />
            </div>
        </div>
    )
})

export default Sidebar
