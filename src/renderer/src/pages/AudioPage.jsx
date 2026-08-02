import React, { useCallback } from 'react'
import { Volume2, PowerOff, Play, Activity, Music2, RefreshCw } from 'lucide-react'
import { motion } from 'framer-motion'
import LivePreviewContainer from '../components/LivePreviewContainer'
import { useSystemAudio } from '../hooks/useSystemAudio'
import { useDmxStore } from '../store/dmxStore'
import { useAudioStore } from '../store/audioStore'

const AudioPage = () => {
    // Stores
    const dmxFixtures = useDmxStore(state => state.dmxFixtures)
    const pixelMapBuffer = useDmxStore(state => state.pixelMapBuffer)
    const dmxUniverseState = useDmxStore(state => state.dmxUniverseState)
    const toggleBlackout = useDmxStore(state => state.toggleBlackout)
    const sendPixelMapBuffer = useDmxStore(state => state.sendPixelMapBuffer)

    const setAudioTelemetryDSP = useAudioStore(state => state.setAudioTelemetryDSP)
    const setAudioData = useAudioStore(state => state.setAudioData)
    const audioFrame = useAudioStore(state => state.audioFrame)

    // Core Engine
    const {
        start, stop, active, detectedGenre, autoGenre, setAutoGenre,
        manualGenre, setManualGenre, telemetry, visualizerData,
        bassPulseMode, setBassPulseMode,
        availableInputs, selectedDeviceId, setSelectedDeviceId, refreshInputs, sourceError,
        activeSource, reconnecting
    } = useSystemAudio((colors) => sendPixelMapBuffer(colors, 'audio'), null, setAudioTelemetryDSP)

    // Toggle dynamic renderer flag so main process routes color updates to DMX
    React.useEffect(() => {
        if (active) window.dmx?.setDynamicRendererActive(true, 'audio')
        return () => window.dmx?.setDynamicRendererActive(false, 'audio')
    }, [active])

    // Sync store with hook data
    React.useEffect(() => {
        setAudioData({ telemetry, visualizerData, audioActive: active, activeAudioSource: activeSource })
    }, [telemetry, visualizerData, active, activeSource, setAudioData])

    return (
        <div className="page audio-page">
            <div className="audio-main">
                <div className="glass-card audio-card" style={{ maxWidth: '700px' }}>
                    <div className="audio-header">
                        <div className={`status-indicator ${active ? 'active' : ''}`} />
                        <Volume2 size={32} className={active ? 'pulse-icon' : ''} />
                        <h2>Stereo 2.1 DSP Engine</h2>
                    </div>

                    <p className="subtitle">True Stereo Analysis • Auto Genre Detection</p>

                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '20px' }}>
                        <select
                            value={selectedDeviceId}
                            onChange={(e) => setSelectedDeviceId(e.target.value)}
                            disabled={active}
                            className="system-select"
                            style={{ flex: 1, padding: '10px 12px' }}
                        >
                            <option value="">Default audio input</option>
                            {availableInputs.map((input) => (
                                <option key={input.deviceId} value={input.deviceId}>
                                    {input.isMonitor ? '🔊 ' : ''}{input.label}
                                </option>
                            ))}
                        </select>
                        <button
                            onClick={() => refreshInputs()}
                            disabled={active}
                            className="action-button"
                            style={{ minWidth: '44px', padding: '10px 12px' }}
                            title="Refresh audio inputs"
                        >
                            <RefreshCw size={16} />
                        </button>
                    </div>

                    {sourceError && (
                        <div style={{
                            marginBottom: '16px',
                            padding: '10px 12px',
                            borderRadius: '10px',
                            background: 'rgba(255, 68, 68, 0.12)',
                            border: '1px solid rgba(255, 68, 68, 0.35)',
                            color: '#ff9b9b',
                            fontSize: '12px'
                        }}>
                            {sourceError}
                        </div>
                    )}

                    {(activeSource.label || reconnecting) && (
                        <div style={{
                            marginBottom: '16px',
                            padding: '10px 12px',
                            borderRadius: '10px',
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            color: 'var(--text-secondary)',
                            fontSize: '12px'
                        }}>
                            <strong style={{ color: '#fff' }}>Active source:</strong>{' '}
                            {reconnecting
                                ? 'Reconnecting...'
                                : (activeSource.label || 'Default audio input')}
                            {activeSource.fallbackToDefault ? ' (fallback to default)' : ''}
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                        <div style={{
                            padding: '6px 10px',
                            borderRadius: '999px',
                            fontSize: '11px',
                            border: '1px solid rgba(255,255,255,0.1)',
                            background: audioFrame.status.silence ? 'rgba(255, 170, 0, 0.12)' : 'rgba(0, 255, 128, 0.10)',
                            color: audioFrame.status.silence ? '#ffcc66' : '#8fffc2'
                        }}>
                            {audioFrame.status.silence ? 'Silence' : 'Signal OK'}
                        </div>
                        <div style={{
                            padding: '6px 10px',
                            borderRadius: '999px',
                            fontSize: '11px',
                            border: '1px solid rgba(255,255,255,0.1)',
                            background: audioFrame.status.clipping ? 'rgba(255, 68, 68, 0.12)' : 'rgba(255,255,255,0.05)',
                            color: audioFrame.status.clipping ? '#ff9b9b' : 'var(--text-secondary)'
                        }}>
                            {audioFrame.status.clipping ? 'Clipping risk' : 'No clipping'}
                        </div>
                    </div>

                    {/* STEREO VISUALIZER */}
                    <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', height: '160px' }}>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '8px', textAlign: 'center' }}>LEFT</span>
                            <div style={{ display: 'flex', gap: '2px', height: '100%', alignItems: 'flex-end' }}>
                                {visualizerData.left.map((val, i) => (
                                    <motion.div
                                        key={i}
                                        style={{
                                            flex: 1,
                                            background: i < 3 ? 'var(--accent)' : i < 8 ? '#00f2fe' : '#7f00ff',
                                            borderRadius: '2px'
                                        }}
                                        animate={{ height: `${Math.max(4, val * 100)}%` }}
                                        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                                    />
                                ))}
                            </div>
                        </div>

                        <div style={{ width: '80px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '8px' }}>SUB</span>
                            <motion.div
                                style={{
                                    width: '60px',
                                    height: '60px',
                                    borderRadius: '50%',
                                    background: `radial-gradient(circle, rgba(255,${Math.round(100 - visualizerData.bass * 100)},0,${visualizerData.bass}) 0%, transparent 70%)`,
                                    border: `2px solid rgba(255, 51, 102, ${0.3 + visualizerData.bass * 0.7})`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                                animate={{ scale: 1 + visualizerData.bass * 0.2 }}
                                transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                            >
                                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--accent)' }}>
                                    {Math.round(visualizerData.bass * 100)}%
                                </span>
                            </motion.div>
                            <div style={{ marginTop: '8px', fontSize: '9px', color: 'var(--text-secondary)' }}>
                                WIDTH: {telemetry.stereoWidth}%
                            </div>
                        </div>

                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '8px', textAlign: 'center' }}>RIGHT</span>
                            <div style={{ display: 'flex', gap: '2px', height: '100%', alignItems: 'flex-end' }}>
                                {visualizerData.right.map((val, i) => (
                                    <motion.div
                                        key={i}
                                        style={{
                                            flex: 1,
                                            background: i < 3 ? 'var(--accent)' : i < 8 ? '#00f2fe' : '#7f00ff',
                                            borderRadius: '2px'
                                        }}
                                        animate={{ height: `${Math.max(4, val * 100)}%` }}
                                        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* MODE SELECTOR — Genre vs Bass Pulse */}
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', justifyContent: 'center' }}>
                        <button
                            onClick={() => setBassPulseMode(false)}
                            style={{
                                flex: 1,
                                padding: '12px 20px',
                                borderRadius: '12px',
                                border: !bassPulseMode ? '2px solid #fff' : '1px solid rgba(255,255,255,0.2)',
                                background: !bassPulseMode ? 'linear-gradient(135deg, #00f260, #0575e6)' : 'var(--glass)',
                                color: '#fff',
                                fontSize: '11px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                letterSpacing: '1px',
                                transition: 'all 0.3s',
                                boxShadow: !bassPulseMode ? '0 0 20px rgba(0,242,96,0.3)' : 'none'
                            }}
                        >
                            <Music2 size={14} /> GENRE MODE
                        </button>
                        <button
                            onClick={() => setBassPulseMode(true)}
                            style={{
                                flex: 1,
                                padding: '12px 20px',
                                borderRadius: '12px',
                                border: bassPulseMode ? '2px solid #fff' : '1px solid rgba(255,255,255,0.2)',
                                background: bassPulseMode ? 'linear-gradient(135deg, #ff0080, #7928ca)' : 'var(--glass)',
                                color: '#fff',
                                fontSize: '11px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                letterSpacing: '1px',
                                transition: 'all 0.3s',
                                boxShadow: bassPulseMode ? '0 0 20px rgba(255,0,128,0.3)' : 'none'
                            }}
                        >
                            <Activity size={14} /> BASS PULSE
                        </button>
                    </div>

                    {/* GENRE PANEL — hidden when Bass Pulse is active */}
                    <div style={{ marginBottom: '16px', padding: '16px', background: 'rgba(0,0,0,0.3)', borderRadius: '16px', opacity: bassPulseMode ? 0.3 : 1, pointerEvents: bassPulseMode ? 'none' : 'auto', transition: 'opacity 0.3s' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
                            <div
                                onClick={() => setAutoGenre(!autoGenre)}
                                style={{
                                    padding: '8px 20px',
                                    borderRadius: '20px',
                                    background: autoGenre ? 'linear-gradient(135deg, #00f260, #0575e6)' : 'var(--glass)',
                                    border: '1px solid rgba(255,255,255,0.2)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    transition: 'all 0.3s'
                                }}
                            >
                                <div style={{
                                    width: '10px', height: '10px', borderRadius: '50%',
                                    background: autoGenre ? '#fff' : 'rgba(255,255,255,0.3)',
                                    boxShadow: autoGenre ? '0 0 10px #fff' : 'none'
                                }} />
                                <span style={{ fontSize: '11px', fontWeight: 700, color: '#fff', letterSpacing: '1px' }}>
                                    AUTO DETECT {autoGenre ? 'ON' : 'OFF'}
                                </span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                            {['ELECTRO', 'ROCK', 'CHILL'].map(mode => {
                                const isActive = autoGenre ? detectedGenre === mode : manualGenre === mode
                                const gradients = {
                                    ELECTRO: 'linear-gradient(135deg, #ff0080, #7928ca)',
                                    ROCK: 'linear-gradient(135deg, #f5af19, #f12711)',
                                    CHILL: 'linear-gradient(135deg, #00c6ff, #0072ff)'
                                }
                                return (
                                    <button
                                        key={mode}
                                        onClick={() => !autoGenre && setManualGenre(mode)}
                                        disabled={autoGenre}
                                        style={{
                                            padding: '10px 20px',
                                            borderRadius: '12px',
                                            border: isActive ? '2px solid #fff' : '1px solid rgba(255,255,255,0.2)',
                                            background: isActive ? gradients[mode] : 'var(--glass)',
                                            color: '#fff',
                                            fontSize: '12px',
                                            fontWeight: 700,
                                            cursor: autoGenre ? 'not-allowed' : 'pointer',
                                            opacity: autoGenre ? 0.5 : 1,
                                            transition: 'all 0.2s',
                                            boxShadow: isActive ? '0 0 20px rgba(255,255,255,0.3)' : 'none'
                                        }}
                                    >
                                        {mode}
                                    </button>
                                )
                            })}
                        </div>

                        <div style={{ textAlign: 'center', marginTop: '12px' }}>
                            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>
                                {autoGenre ? 'DETECTED:' : 'MANUAL MODE:'}
                            </span>
                            <span style={{ fontSize: '14px', fontWeight: 800, color: '#fff', marginLeft: '8px', letterSpacing: '2px' }}>
                                {autoGenre ? detectedGenre : manualGenre}
                            </span>
                        </div>
                    </div>

                    {active && (
                        <div style={{
                            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px',
                            marginBottom: '24px', padding: '16px', background: 'rgba(0,0,0,0.3)',
                            borderRadius: '12px', fontSize: '10px'
                        }}>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ color: 'var(--text-secondary)' }}>LOW-END</div>
                                <div style={{ color: 'var(--accent)', fontWeight: 700, fontSize: '14px' }}>{telemetry.lowEndDynamics}%</div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ color: 'var(--text-secondary)' }}>TRANSIENTS</div>
                                <div style={{ color: '#00f2fe', fontWeight: 700, fontSize: '14px' }}>{telemetry.transientDensity}%</div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ color: 'var(--text-secondary)' }}>MID RMS</div>
                                <div style={{ color: '#7f00ff', fontWeight: 700, fontSize: '14px' }}>{telemetry.midRms}%</div>
                            </div>
                        </div>
                    )}

                    <div className="controls-row" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                        <motion.button
                            className={`action-button ${active ? 'stop' : 'start'}`}
                            onClick={active ? stop : start}
                            style={{ height: '52px', padding: '0 40px', margin: 0, fontSize: '14px' }}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            {active ? <><PowerOff size={20} /> Stop Engine</> : <><Play size={20} /> Engage 2.1 DSP</>}
                        </motion.button>
                    </div>
                </div>
            </div>
            <div className="audio-sidebar">
                <LivePreviewContainer
                    fixtures={dmxFixtures}
                    masterDimmer={dmxUniverseState.dim}
                    onToggleFixture={toggleBlackout}
                    isAudioActive={active}
                />
            </div>
        </div>
    )
}

export default AudioPage
