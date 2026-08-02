import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Monitor, Zap, Play, Square, Check, RefreshCw } from 'lucide-react'
import LivePreviewContainer from '../components/LivePreviewContainer'
import { useGpuAmbilight } from '../hooks/useGpuAmbilight'
import { useSystemAudio } from '../hooks/useSystemAudio'
import { useDmxStore } from '../store/dmxStore'
import { useAudioStore } from '../store/audioStore'
import '../fluidsim.css'

const AmbilightPage = () => {
    // Stores
    const dmxFixtures = useDmxStore(state => state.dmxFixtures)
    const dmxUniverseState = useDmxStore(state => state.dmxUniverseState)
    const pixelMapBuffer = useDmxStore(state => state.pixelMapBuffer)
    const toggleBlackout = useDmxStore(state => state.toggleBlackout)
    const sendPixelMapBuffer = useDmxStore(state => state.sendPixelMapBuffer)

    const audioTelemetryDSP = useAudioStore(state => state.audioTelemetryDSP)
    const setAudioTelemetryDSP = useAudioStore(state => state.setAudioTelemetryDSP)

    // BS-004: on Linux/Wayland, desktopCapturer.getSources() returns
    // empty-named entries (or none at all) — PipeWire withholds real
    // window/screen titles from apps for compositor-level privacy. The
    // custom-enumeration-then-select dropdown is unusable there, so Linux
    // skips it entirely and lets the OS's own xdg-desktop-portal picker
    // handle selection via getDisplayMedia() when the user clicks Ignite
    // (see useGpuAmbilight.js). Non-Linux platforms keep the dropdown as-is.
    const isLinux = window.platform === 'linux'

    // Local State
    const [sources, setSources] = useState([])
    const [selectedSource, setSelectedSource] = useState(null)
    const [captureError, setCaptureError] = useState(null)
    const [refreshing, setRefreshing] = useState(false)
    const [isStarting, setIsStarting] = useState(false)

    // GPU Extraction Engine
    const {
        start: startAmbilight, stop: stopAmbilight, capturing, colors: previewColors,
        isMono, setIsMono, smoothingFactor, setSmoothingFactor
    } = useGpuAmbilight(sendPixelMapBuffer, audioTelemetryDSP)

    // Audio Boost Engine (Analysis Only)
    const { start: startAudio, stop: stopAudio } = useSystemAudio(
        () => { }, // No direct DMX control, Ambilight hook handles it
        null,
        setAudioTelemetryDSP
    )

    const refreshSources = async () => {
        setRefreshing(true)
        try {
            const result = await window.ambilight?.getSources()
            const sourceList = result?.sources ?? []
            setSources(sourceList)

            if (result?.error) {
                setCaptureError(`No se pudieron listar las fuentes: ${result.error}`)
            } else if (sourceList.length === 0) {
                setCaptureError('No se encontraron fuentes de captura — revisá permisos de pantalla/PipeWire')
            } else {
                setCaptureError(null)
            }
        } catch (e) {
            setCaptureError('Failed to list sources')
        }
        setRefreshing(false)
    }

    // BS-004: Linux never uses the dropdown, so it doesn't need the
    // desktopCapturer enumeration on mount either — skipping it avoids a
    // false "no sources found" error banner from an enumeration whose result
    // this platform's flow doesn't consume at all.
    useEffect(() => { if (!isLinux) refreshSources() }, [])

    const audioMode = useAudioStore(state => state.audioMode)

    const handleModeChange = async (mode) => {
        const store = useAudioStore.getState()
        store.setAudioMode(mode)

        if (mode === 'OFF') {
            stopAudio()
        } else if (capturing) {
            await startAudio()
        }
    }

    const setActiveProgram = useDmxStore(state => state.setActiveProgram)
    const setActiveDynamicScene = useDmxStore(state => state.setActiveDynamicScene)
    const setActiveFlag = useDmxStore(state => state.setActiveFlag)

    const handleStart = async () => {
        // Guard against rapid double-click: a second start() before `capturing`
        // flips true could overwrite videoRef.current.srcObject with a second
        // MediaStream before the first one is stopped.
        if (isStarting || capturing) return
        setIsStarting(true)

        try {
            const id = selectedSource || sources[0]?.id
            setActiveProgram(null)
            setActiveDynamicScene(null)
            setActiveFlag(null)

            // Linux/Wayland has no pre-selected sourceId to gate on — the OS's
            // own picker (triggered inside startAmbilight() via
            // getDisplayMedia()) handles selection at click time. Non-Linux
            // keeps requiring a pre-selected `id` from the dropdown.
            if (id || isLinux) {
                setCaptureError(null)
                try {
                    await startAmbilight(id)
                    if (audioMode !== 'OFF') await startAudio()
                } catch (e) {
                    if (e?.name === 'NotAllowedError') {
                        // User cancelled the native OS screen-picker dialog — a
                        // normal, expected outcome, not a crash. Keep it calm.
                        setCaptureError('Elección de pantalla cancelada — iniciá de nuevo cuando quieras compartir una pantalla.')
                    } else {
                        setCaptureError('GPU capture failed — try a different source')
                    }
                }
            }
        } finally {
            setIsStarting(false)
        }
    }

    const handleStop = () => {
        stopAmbilight()
        stopAudio()
    }

    return (
        <div className="page ambilight-page">
            <div className="ambilight-main">
                <div className="glass-card ambilight-card">
                    <Monitor size={48} strokeWidth={1} style={{ color: capturing ? 'var(--accent)' : 'inherit', filter: capturing ? 'drop-shadow(0 0 10px var(--accent))' : 'none' }} />
                    <h2>GPU Screen Sync</h2>
                    <p className="subtitle">Mapeo espacial Izquierda-Centro-Derecha acelerado por hardware</p>

                    {captureError && (
                        <div style={{
                            background: 'rgba(255,68,68,0.12)',
                            border: '1px solid rgba(255,68,68,0.35)',
                            color: '#ff9b9b',
                            borderRadius: '8px',
                            padding: '10px 14px',
                            fontSize: '12px',
                            marginBottom: '16px',
                            textAlign: 'left'
                        }}>
                            {captureError}
                        </div>
                    )}

                    <div className="ambilight-controls" style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            {isLinux ? (
                                <div className="source-select-linux-note" style={{
                                    flex: 1, height: '42px', display: 'flex', alignItems: 'center',
                                    padding: '0 12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px',
                                    border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)',
                                    fontSize: '12px'
                                }}>
                                    Wayland: se te va a pedir elegir la pantalla al iniciar
                                </div>
                            ) : (
                                <select
                                    className="source-select"
                                    onChange={(e) => setSelectedSource(e.target.value)}
                                    disabled={capturing}
                                    style={{ flex: 1, margin: 0, height: '42px' }}
                                >
                                    {sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            )}

                            <div className="status-badge" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 12px', height: '42px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)', fontSize: '11px', whiteSpace: 'nowrap' }}>
                                <Zap size={14} color="#FFD700" fill="#FFD700" />
                                <span>AMD/NVIDIA GPU</span>
                            </div>

                            {!isLinux && (
                                <button
                                    onClick={refreshSources}
                                    disabled={capturing || refreshing}
                                    title="Refresh sources"
                                    style={{
                                        width: '42px',
                                        height: '42px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        background: 'rgba(255,255,255,0.05)',
                                        borderRadius: '8px',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        color: 'var(--text-secondary)',
                                        cursor: capturing ? 'not-allowed' : 'pointer',
                                        transition: 'all 0.2s',
                                        flexShrink: 0
                                    }}
                                >
                                    <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
                                </button>
                            )}
                        </div>

                        <div style={{ display: 'flex', gap: '12px', alignItems: 'stretch' }}>
                            <div className={`bgr-toggle ${isMono ? 'active' : ''}`} onClick={() => setIsMono(!isMono)} title="Use center color for all fixtures" style={{ height: '48px', padding: '0 16px' }}>
                                <div className="toggle-slider"></div>
                                <span>MONO</span>
                            </div>

                            <div className="audio-mode-group">
                                {['OFF', 'STEREO', 'EQ'].map(mode => (
                                    <button
                                        key={mode}
                                        onClick={() => handleModeChange(mode)}
                                        className={`mode-btn ${audioMode === mode ? 'active' : ''}`}
                                    >
                                        {mode}
                                    </button>
                                ))}
                            </div>

                            <motion.button
                                className={`action-button ${capturing ? 'stop' : 'active'}`}
                                onClick={capturing ? handleStop : handleStart}
                                disabled={isStarting}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                style={{
                                    flex: 1, margin: 0, height: '48px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px',
                                    opacity: isStarting ? 0.6 : 1,
                                    cursor: isStarting ? 'not-allowed' : 'pointer'
                                }}
                            >
                                {capturing
                                    ? <><Square size={18} fill="currentColor" /> STOP ENGINE</>
                                    : isStarting
                                        ? <>Starting...</>
                                        : <><Play size={18} fill="currentColor" /> IGNITE SYSTEM</>}
                            </motion.button>
                        </div>

                        <div style={{
                            display: 'flex', flexDirection: 'column', gap: '6px', padding: '12px 16px',
                            background: 'rgba(255,255,255,0.05)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Smoothing</span>
                                <strong style={{ fontSize: '12px' }}>{smoothingFactor.toFixed(2)}</strong>
                            </div>
                            <input
                                type="range"
                                min="0.05"
                                max="0.5"
                                step="0.01"
                                value={smoothingFactor}
                                onChange={(e) => setSmoothingFactor(parseFloat(e.target.value))}
                                style={{ width: '100%' }}
                            />
                        </div>
                    </div>

                    <div className="extraction-monitor">
                        <div className="monitor-header">
                            <span className="live-indicator"><div className="dot"></div> GPU SPATIAL MONITOR</span>
                            <span className="resolution-label">3x1 Hardware Downsampled</span>
                        </div>
                        <div className="canvas-wrapper" style={{ display: 'flex', gap: '4px', background: '#000', padding: '10px', height: '100px', position: 'relative' }}>
                            {previewColors.map((c, i) => {
                                const energyLabels = ['L', 'C', 'R']

                                return (
                                    <div key={i} style={{
                                        flex: 1,
                                        height: '100%',
                                        background: `rgb(${c.r}, ${c.g}, ${c.b})`,
                                        borderRadius: '4px',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        position: 'relative',
                                        overflow: 'hidden'
                                    }}>
                                        <div style={{
                                            position: 'absolute',
                                            top: '50%',
                                            left: '50%',
                                            transform: 'translate(-50%, -50%)',
                                            fontSize: '14px',
                                            fontWeight: 700,
                                            color: 'rgba(255,255,255,0.6)',
                                            textShadow: '0 1px 3px rgba(0,0,0,0.5)'
                                        }}>
                                            {energyLabels[i]}
                                        </div>
                                    </div>
                                )
                            })}
                            {!capturing && <div className="canvas-placeholder" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'rgba(255,255,255,0.3)' }}>Select screen and ignite...</div>}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}


export default AmbilightPage
