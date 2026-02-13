import React, { useEffect, useCallback, Component } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// Shared Components
import Sidebar from './components/Sidebar'
import Header from './components/Header'

// Pages
import ConsoleMixerPage from './pages/ConsoleMixerPage'
import ProgramsPage from './pages/ProgramsPage'
import DynamicScenesPageV2 from './pages/DynamicScenesPageV2'
import AudioPage from './pages/AudioPage'
import AmbilightPage from './pages/AmbilightPage'
import FluidSimPage from './pages/FluidSimPage'
import SystemPage from './pages/SystemPage'

// Stores & Utils
import { useConfigStore } from './store/configStore'
import { useDmxStore } from './store/dmxStore'
import { useAudioStore } from './store/audioStore'
import './dynamic.css'

class ErrorBoundary extends Component {
    constructor(props) {
        super(props)
        this.state = { hasError: false }
    }
    static getDerivedStateFromError(error) { return { hasError: true } }
    componentDidCatch(error, errorInfo) { console.error("Uncaught error:", error, errorInfo) }
    render() {
        if (this.state.hasError) return <div className="error-screen"><h1>Something went wrong.</h1></div>
        return this.props.children
    }
}

function App() {
    // Config Store
    const activePage = useConfigStore(state => state.activePage)
    const darkMode = useConfigStore(state => state.darkMode)
    const setConfig = useConfigStore(state => state.setConfig)

    // DMX Store
    const setDmxFixtures = useDmxStore(state => state.setDmxFixtures)
    const setPixelMapBuffer = useDmxStore(state => state.setPixelMapBuffer)
    const resetDmx = useDmxStore(state => state.resetDmx)
    const dispatchDmxAttributeUpdate = useDmxStore(state => state.dispatchDmxAttributeUpdate)
    const dispatchBulkDmxUpdate = useDmxStore(state => state.dispatchBulkDmxUpdate)

    // Audio Store
    const setSpatialEnergies = useAudioStore(state => state.setSpatialEnergies)

    // Initial Data Loading
    useEffect(() => {
        (async () => {
            const cfg = await window.dmx?.getConfig()
            if (cfg) setConfig(cfg)
            const fxt = await window.dmx?.getFixtures()
            if (fxt) setDmxFixtures(fxt.map(f => ({ ...f, selected: true })))
        })()
    }, [setConfig, setDmxFixtures])

    // Global Subscriptions
    useEffect(() => {
        const h1 = window.dmx?.onColorsUpdated(setPixelMapBuffer)
        return () => h1 && h1()
    }, [setPixelMapBuffer])

    // Global Actions
    const handleReset = useCallback(async () => {
        resetDmx()
        await window.dmx?.reset()
    }, [resetDmx])

    const handleMeet = useCallback(async () => {
        const warmWhite = { red: 255, green: 180, blue: 120, func: 0, spd: 0, flash: 0, dim: 150 }
        dispatchBulkDmxUpdate(warmWhite)
        await window.dmx?.colorMacro('WARM')
    }, [dispatchBulkDmxUpdate])

    const handleIntenseFlash = useCallback(() => {
        window.dmx?.intenseFlash()
    }, [])

    const renderPage = () => {
        switch (activePage) {
            case 'mixer': return <ConsoleMixerPage onReset={handleReset} />
            case 'programs': return <ProgramsPage />
            case 'dynamic': return <DynamicScenesPageV2 />
            case 'audio': return <AudioPage />
            case 'fluidsim': return <FluidSimPage />
            case 'ambilight': return <AmbilightPage />
            case 'system': return <SystemPage />
            default: return <ConsoleMixerPage />
        }
    }

    return (
        <ErrorBoundary>
            <div className={`app ${darkMode ? 'dark' : 'light'}`}>
                <Sidebar />
                <div className="main-content">
                    <Header
                        onReset={handleReset}
                        onMeet={handleMeet}
                        onFlash={handleIntenseFlash}
                    />
                    <div className="page-container">
                        <AnimatePresence mode='wait'>
                            <motion.div
                                key={activePage}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.15 }}
                                style={{ height: '100%' }}
                            >
                                {renderPage()}
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </ErrorBoundary>
    )
}

export default App
