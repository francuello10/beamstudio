import React from 'react'
import { Sliders, Music, Lightbulb, Monitor, Settings, Sun, Moon } from 'lucide-react'
import { useConfigStore } from '../store/configStore'

const navItems = [
    { id: 'mixer', icon: Sliders, label: 'Console Mixer' },
    { id: 'programs', icon: Lightbulb, label: 'Programs' },
    { id: 'dynamic', icon: Sparkles, icon_override: true, label: 'Dynamic' }, // We'll fix Sparkles import
    { id: 'audio', icon: Music, label: 'Audio' },
    { id: 'ambilight', icon: Monitor, label: 'Ambilight' },
    { id: 'system', icon: Settings, label: 'System' },
]

// Note: Sparkles import from lucide-react
import { Sparkles } from 'lucide-react'

const Sidebar = React.memo(() => {
    const activePage = useConfigStore(state => state.activePage)
    const setActivePage = useConfigStore(state => state.setActivePage)
    const darkMode = useConfigStore(state => state.darkMode)
    const setDarkMode = useConfigStore(state => state.setDarkMode)

    return (
        <div className="sidebar">
            <div style={{ height: '20px' }} /> {/* Spacer */}
            <nav className="sidebar-nav">
                {navItems.map(item => {
                    const Icon = item.id === 'dynamic' ? Sparkles : item.icon
                    const isActive = activePage === item.id
                    return (
                        <div
                            key={item.id}
                            className={`nav-item ${isActive ? 'active' : ''}`}
                            onClick={() => setActivePage(item.id)}
                        >
                            <Icon size={20} />
                            <span>{item.label}</span>
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
