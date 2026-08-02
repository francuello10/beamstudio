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
        this.state = { hasError: false, error: null, errorInfo: null }
    }
    static getDerivedStateFromError(error) { 
        return { hasError: true, error }
    }
    componentDidCatch(error, errorInfo) { 
        console.error("Uncaught error:", error, errorInfo)
        this.setState({ errorInfo })
    }
    handleReset = () => {
        this.setState({ hasError: false, error: null, errorInfo: null })
    }
    render() {
        if (this.state.hasError) {
            const isDev = process.env.NODE_ENV === 'development' || window.location.hostname === 'localhost'
            return (
                <div className="error-screen" style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100vh',
                    background: 'var(--bg-primary, #0a0a0a)',
                    color: 'var(--text-primary, #fff)',
                    padding: '2rem',
                    textAlign: 'center'
                }}>
                    <h1 style={{ fontSize: '2rem', marginBottom: '1rem', color: '#ff0080' }}>⚠️ Error en BeamStudio</h1>
                    <p style={{ marginBottom: '2rem', opacity: 0.8 }}>
                        Ha ocurrido un error inesperado. Por favor, intenta recargar la aplicación.
                    </p>
                    <button 
                        onClick={this.handleReset}
                        style={{
                            padding: '12px 24px',
                            background: '#ff0080',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '1rem',
                            fontWeight: 'bold',
                            marginBottom: '1rem'
                        }}
                    >
                        Reintentar
                    </button>
                    {isDev && this.state.error && (
                        <details style={{ 
                            marginTop: '2rem', 
                            textAlign: 'left', 
                            maxWidth: '600px',
                            background: 'rgba(255,255,255,0.05)',
                            padding: '1rem',
                            borderRadius: '8px',
                            fontSize: '0.85rem'
                        }}>
                            <summary style={{ cursor: 'pointer', marginBottom: '0.5rem' }}>Detalles del error (solo en desarrollo)</summary>
                            <pre style={{ 
                                overflow: 'auto', 
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                                color: '#ff6b6b'
                            }}>
                                {this.state.error.toString()}
                                {this.state.errorInfo?.componentStack}
                            </pre>
                        </details>
                    )}
                </div>
            )
        }
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
    const dmxFixtures = useDmxStore(state => state.dmxFixtures)
    const dmxUniverseState = useDmxStore(state => state.dmxUniverseState)

    // Audio Store
    const setAudioBaseColors = useAudioStore(state => state.setAudioBaseColors)

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


    React.useEffect(() => {
        const baseColor = {
            r: dmxUniverseState.red || 0,
            g: dmxUniverseState.green || 0,
            b: dmxUniverseState.blue || 0
        }
        const hasBaseColor = baseColor.r + baseColor.g + baseColor.b > 0
        const fixtureSlots = dmxFixtures.length ? dmxFixtures : [null, null, null]
        setAudioBaseColors(hasBaseColor ? fixtureSlots.map(() => baseColor) : [])
    }, [dmxUniverseState.red, dmxUniverseState.green, dmxUniverseState.blue, dmxFixtures, setAudioBaseColors])

    // Global Actions
    const handleReset = useCallback(async () => {
        resetDmx()
        setAudioBaseColors([])
        await window.dmx?.reset()
    }, [resetDmx, setAudioBaseColors])

    const handleMeet = useCallback(async () => {
        const warmWhite = { red: 255, green: 180, blue: 100, func: 0, spd: 0, flash: 0, dim: 150 }
        const warmBaseColors = (dmxFixtures.length ? dmxFixtures : [null, null, null])
            .map(() => ({ r: warmWhite.red, g: warmWhite.green, b: warmWhite.blue }))

        setAudioBaseColors(warmBaseColors)
        dispatchBulkDmxUpdate(warmWhite)
        await window.dmx?.colorMacro('WARM')
    }, [dispatchBulkDmxUpdate, dmxFixtures, setAudioBaseColors])

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
