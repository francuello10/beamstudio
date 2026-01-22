import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Monitor, Zap, Play, Square, Check } from 'lucide-react'
import LivePreviewContainer from '../components/LivePreviewContainer'
import { useGpuAmbilight } from '../hooks/useGpuAmbilight'
import { useSystemAudio } from '../hooks/useSystemAudio'
import { useDmxStore } from '../store/dmxStore'
import { useAudioStore } from '../store/audioStore'

const AmbilightPage = () => {
    // Stores
    const fixtures = useDmxStore(state => state.fixtures)
    const channelValues = useDmxStore(state => state.channelValues)
    const liveColors = useDmxStore(state => state.liveColors)
    const toggleBlackout = useDmxStore(state => state.toggleBlackout)
    const sendLiveColors = useDmxStore(state => state.sendLiveColors)

    const spatialEnergies = useAudioStore(state => state.spatialEnergies)
    const setSpatialEnergies = useAudioStore(state => state.setSpatialEnergies)

    // Local State
    const [sources, setSources] = useState([])
    const [selectedSource, setSelectedSource] = useState(null)
    const [audioBoost, setAudioBoost] = useState(false)

    // GPU Extraction Engine
    const { start: startAmbilight, stop: stopAmbilight, capturing, colors: previewColors, isMono, setIsMono } = useGpuAmbilight(sendLiveColors, spatialEnergies)

    // Audio Boost Engine
    const { start: startAudio, stop: stopAudio, setModifierMode, energyFactor } = useSystemAudio(
        sendLiveColors,
        previewColors,
        setSpatialEnergies
    )

    useEffect(() => {
        window.ambilight?.getSources().then(setSources)
    }, [])

    const handleAudioBoostToggle = async () => {
        if (audioBoost) {
            setAudioBoost(false)
            setModifierMode(false)
            stopAudio()
        } else {
            setAudioBoost(true)
            setModifierMode(true)
            await startAudio()
        }
    }

    const handleStart = () => {
        const id = selectedSource || sources[0]?.id
        if (id) startAmbilight(id)
    }

    return (
        <div className="page ambilight-page">
            <div className="ambilight-main">
                <div className="glass-card ambilight-card">
                    <Monitor size={48} strokeWidth={1} style={{ color: capturing ? 'var(--accent)' : 'inherit', filter: capturing ? 'drop-shadow(0 0 10px var(--accent))' : 'none' }} />
                    <h2>GPU Screen Sync</h2>
                    <p className="subtitle">Mapeo espacial Izquierda-Centro-Derecha acelerado por hardware</p>

                    <div className="ambilight-controls" style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <select
                                className="source-select"
                                onChange={(e) => setSelectedSource(e.target.value)}
                                disabled={capturing}
                                style={{ flex: 1, margin: 0, height: '42px' }}
                            >
                                {sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>

                            <div className="status-badge" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 12px', height: '42px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)', fontSize: '11px', whiteSpace: 'nowrap' }}>
                                <Zap size={14} color="#FFD700" fill="#FFD700" />
                                <span>AMD/NVIDIA GPU</span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '12px', alignItems: 'stretch' }}>
                            <div className={`bgr-toggle ${isMono ? 'active' : ''}`} onClick={() => setIsMono(!isMono)} title="Use center color for all fixtures" style={{ height: '48px', padding: '0 16px' }}>
                                <div className="toggle-slider"></div>
                                <span>MONO</span>
                            </div>

                            <div
                                className={`bgr-toggle ${audioBoost ? 'active' : ''}`}
                                onClick={handleAudioBoostToggle}
                                title="Modulate brightness with audio"
                                style={{
                                    height: '48px',
                                    padding: '0 16px',
                                    background: audioBoost ? 'linear-gradient(135deg, #ff0080, #7928ca)' : undefined,
                                    borderColor: audioBoost ? 'transparent' : undefined
                                }}
                            >
                                <div className="toggle-slider"></div>
                                <span>BOOST {audioBoost && `x${energyFactor.toFixed(1)}`}</span>
                            </div>

                            <motion.button
                                className={`action-button ${capturing ? 'stop' : 'active'}`}
                                onClick={capturing ? stopAmbilight : handleStart}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                style={{ flex: 1, margin: 0, height: '48px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}
                            >
                                {capturing ? <><Square size={18} fill="currentColor" /> STOP ENGINE</> : <><Play size={18} fill="currentColor" /> IGNITE SYSTEM</>}
                            </motion.button>
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
                                const boostPercent = audioBoost ? Math.round(energyFactor * 100 - 100) : 0

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
                                        {audioBoost && (
                                            <div style={{
                                                position: 'absolute',
                                                bottom: 0,
                                                left: 0,
                                                right: 0,
                                                height: `${Math.min(100, boostPercent)}%`,
                                                background: 'rgba(255,255,255,0.25)',
                                                transition: 'height 0.1s ease',
                                                borderRadius: '0 0 4px 4px'
                                            }} />
                                        )}
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
            <div className="ambilight-sidebar">
                <LivePreviewContainer
                    fixtures={fixtures}
                    masterDimmer={channelValues.dim}
                    onToggleFixture={toggleBlackout}
                />
            </div>
        </div>
    )
}

export default AmbilightPage
