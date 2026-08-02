import React from 'react'
import { Volume2, PowerOff, Play, Activity, Music2, RefreshCw } from 'lucide-react'
import { motion } from 'framer-motion'
import LivePreviewContainer from '../components/LivePreviewContainer'
import { useSystemAudio } from '../hooks/useSystemAudio'
import { useDmxStore } from '../store/dmxStore'
import { useAudioStore } from '../store/audioStore'

const percent = (value) => `${Math.round((value || 0) * 100)}%`

const isVisibleColor = (color = {}) => (color.r || 0) + (color.g || 0) + (color.b || 0) > 0

const normalizeColors = (colors = []) => colors.map(color => ({
    r: color?.r || 0,
    g: color?.g || 0,
    b: color?.b || 0
}))

const colorPreview = (color = {}) => ({
    background: `rgb(${color.r || 0}, ${color.g || 0}, ${color.b || 0})`,
    boxShadow: `0 0 18px rgba(${color.r || 0}, ${color.g || 0}, ${color.b || 0}, 0.45)`
})

const compactCard = {
    padding: '14px',
    borderRadius: '14px',
    background: 'rgba(255,255,255,0.045)',
    border: '1px solid rgba(255,255,255,0.1)'
}

const AudioPage = () => {
    const dmxFixtures = useDmxStore(state => state.dmxFixtures)
    const pixelMapBuffer = useDmxStore(state => state.pixelMapBuffer)
    const dmxUniverseState = useDmxStore(state => state.dmxUniverseState)
    const toggleBlackout = useDmxStore(state => state.toggleBlackout)
    const sendPixelMapBuffer = useDmxStore(state => state.sendPixelMapBuffer)

    const setAudioTelemetryDSP = useAudioStore(state => state.setAudioTelemetryDSP)
    const setAudioData = useAudioStore(state => state.setAudioData)
    const setAudioActive = useAudioStore(state => state.setAudioActive)
    const audioFrame = useAudioStore(state => state.audioFrame)
    const audioBaseColors = useAudioStore(state => state.audioBaseColors)
    const setAudioBaseColors = useAudioStore(state => state.setAudioBaseColors)
    const audioBoostLevel = useAudioStore(state => state.audioBoostLevel)
    const setAudioBoostLevel = useAudioStore(state => state.setAudioBoostLevel)

    const {
        start, stop, active, detectedGenre, autoGenre, setAutoGenre,
        manualGenre, setManualGenre, visualizerData,
        bassPulseMode, setBassPulseMode,
        availableInputs, selectedDeviceId, setSelectedDeviceId, refreshInputs, sourceError,
        activeSource, reconnecting
    } = useSystemAudio((colors) => sendPixelMapBuffer(colors, 'audio'), audioBaseColors, setAudioTelemetryDSP, audioBoostLevel)

    React.useEffect(() => {
        if (active) window.dmx?.setDynamicRendererActive(true, 'audio')
        return () => window.dmx?.setDynamicRendererActive(false, 'audio')
    }, [active])

    React.useEffect(() => {
        setAudioData({ audioActive: active, activeAudioSource: activeSource })
        setAudioActive(active)
    }, [active, activeSource, setAudioActive, setAudioData])

    const handleStart = React.useCallback(async () => {
        const currentColors = normalizeColors(pixelMapBuffer)
        if (currentColors.some(isVisibleColor)) {
            setAudioBaseColors(currentColors)
        }
        await start()
    }, [pixelMapBuffer, setAudioBaseColors, start])

    const currentGenre = autoGenre ? detectedGenre : manualGenre
    const mapping = [
        {
            label: 'Slot 1',
            fixture: dmxFixtures[0]?.name || 'Fixture 1',
            driver: bassPulseMode ? 'left mids / highs' : `${currentGenre} palette + left mids`,
            level: audioFrame.spatial.left,
            color: pixelMapBuffer[0]
        },
        {
            label: 'Slot 2',
            fixture: dmxFixtures[1]?.name || 'Fixture 2',
            driver: bassPulseMode ? 'bass / sub pulse' : `${currentGenre} palette + bass`,
            level: audioFrame.spatial.center,
            color: pixelMapBuffer[1]
        },
        {
            label: 'Slot 3',
            fixture: dmxFixtures[2]?.name || 'Fixture 3',
            driver: bassPulseMode ? 'right mids / highs' : `${currentGenre} palette + right mids`,
            level: audioFrame.spatial.right,
            color: pixelMapBuffer[2]
        }
    ]

    return (
        <div className="page audio-page">
            <div className="audio-main">
                <div className="glass-card audio-card" style={{ maxWidth: '760px', padding: '28px' }}>
                    <div className="audio-header" style={{ marginBottom: '6px' }}>
                        <div className={`status-indicator ${active ? 'active' : ''}`} />
                        <Volume2 size={30} className={active ? 'pulse-icon' : ''} />
                        <h2>Audio Reactive Engine</h2>
                    </div>

                    <p className="subtitle" style={{ marginBottom: '18px' }}>
Mixer/base palette → audio boost → fixture-slot DMX mapping
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '10px', marginBottom: '12px' }}>
                        <select
                            value={selectedDeviceId}
                            onChange={(e) => setSelectedDeviceId(e.target.value)}
                            disabled={active}
                            className="system-select"
                            style={{ padding: '10px 12px' }}
                        >
                            <option value="">Auto system monitor</option>
                            {availableInputs.map((input) => (
                                <option key={input.deviceId} value={input.deviceId}>
                                    {input.isMonitor ? 'Monitor · ' : ''}{input.label}
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

                    <div style={{ ...compactCard, marginBottom: '14px', textAlign: 'left' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
                            <div>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Active source</div>
                                <strong>{reconnecting ? 'Reconnecting...' : (activeSource.label || 'Auto system monitor')}</strong>
                                {activeSource.isMonitor ? <span style={{ color: '#8fffc2' }}> · system audio</span> : null}
                                {activeSource.fallbackToDefault ? <span style={{ color: '#ffcc66' }}> · fallback</span> : null}
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <span style={{ color: audioFrame.status.silence ? '#ffcc66' : '#8fffc2', fontSize: '12px' }}>
                                    {audioFrame.status.silence ? 'Silence' : 'Signal OK'}
                                </span>
                                <span style={{ color: audioFrame.status.clipping ? '#ff9b9b' : 'var(--text-secondary)', fontSize: '12px' }}>
                                    {audioFrame.status.clipping ? 'Clipping' : 'Clean'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {sourceError && (
                        <div style={{ ...compactCard, marginBottom: '14px', color: '#ff9b9b', textAlign: 'left' }}>
                            {sourceError}
                        </div>
                    )}


                    <div style={{ ...compactCard, marginBottom: '14px', textAlign: 'left' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                            <div>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Boost level</div>
                                <strong>x{audioBoostLevel.toFixed(1)}</strong>
                            </div>
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Higher = harsher pulses</span>
                        </div>
                        <input
                            type="range"
                            min="0.5"
                            max="2.5"
                            step="0.1"
                            value={audioBoostLevel}
                            onChange={(event) => setAudioBoostLevel(parseFloat(event.target.value))}
                            style={{ width: '100%' }}
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                        <button
                            onClick={() => setBassPulseMode(false)}
                            style={{
                                padding: '13px 16px',
                                borderRadius: '14px',
                                border: !bassPulseMode ? '2px solid #fff' : '1px solid rgba(255,255,255,0.18)',
                                background: !bassPulseMode ? 'linear-gradient(135deg, #00f260, #0575e6)' : 'rgba(255,255,255,0.045)',
                                color: '#fff',
                                fontWeight: 800,
                                cursor: 'pointer'
                            }}
                        >
                            <Music2 size={14} /> Full music boost
                        </button>
                        <button
                            onClick={() => setBassPulseMode(true)}
                            style={{
                                padding: '13px 16px',
                                borderRadius: '14px',
                                border: bassPulseMode ? '2px solid #fff' : '1px solid rgba(255,255,255,0.18)',
                                background: bassPulseMode ? 'linear-gradient(135deg, #ff0080, #7928ca)' : 'rgba(255,255,255,0.045)',
                                color: '#fff',
                                fontWeight: 800,
                                cursor: 'pointer'
                            }}
                        >
                            <Activity size={14} /> Bass boost
                        </button>
                    </div>

                    {!bassPulseMode && (
                        <div style={{ ...compactCard, marginBottom: '14px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: autoGenre ? 0 : '12px' }}>
                                <div style={{ textAlign: 'left' }}>
                                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Booster profile</div>
                                    <strong>{currentGenre}</strong>
                                </div>
                                <button
                                    onClick={() => setAutoGenre(!autoGenre)}
                                    style={{
                                        padding: '8px 14px',
                                        borderRadius: '999px',
                                        border: '1px solid rgba(255,255,255,0.18)',
                                        background: autoGenre ? 'linear-gradient(135deg, #00f260, #0575e6)' : 'rgba(255,255,255,0.06)',
                                        color: '#fff',
                                        fontSize: '11px',
                                        fontWeight: 800,
                                        cursor: 'pointer'
                                    }}
                                >
                                    Auto detect {autoGenre ? 'on' : 'off'}
                                </button>
                            </div>

                            {!autoGenre && (
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    {['ELECTRO', 'ROCK', 'CHILL'].map(mode => (
                                        <button
                                            key={mode}
                                            onClick={() => setManualGenre(mode)}
                                            style={{
                                                flex: 1,
                                                padding: '9px 10px',
                                                borderRadius: '12px',
                                                border: manualGenre === mode ? '2px solid #fff' : '1px solid rgba(255,255,255,0.18)',
                                                background: manualGenre === mode ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.18)',
                                                color: '#fff',
                                                fontWeight: 700,
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {mode}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    <div style={{ ...compactCard, marginBottom: '14px', textAlign: 'left' }}>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                            Mapping behavior
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                            Slot order follows the fixture patch. Full music boost follows the whole spectrum/profile; Bass boost emphasizes low-end pulses. Set any solid look first — REUNIÓN, Quick Palettes, ColorWheel, RGB faders, or scenes — and audio boosts that base. RGB changes reactively; DIM keeps the current master dimmer; FUNC/SPD/FLASH are left untouched. Extra fixtures reuse the last slot color.
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                            {mapping.map((item) => (
                                <div key={item.label} style={{ padding: '12px', borderRadius: '12px', background: 'rgba(0,0,0,0.22)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                        <span style={{ width: '14px', height: '14px', borderRadius: '50%', ...colorPreview(item.color) }} />
                                        <strong style={{ fontSize: '13px' }}>{item.label}</strong>
                                    </div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', minHeight: '30px' }}>{item.fixture}</div>
                                    <div style={{ fontSize: '11px', color: '#fff', marginTop: '8px' }}>{item.driver}</div>
                                    <div style={{ height: '5px', background: 'rgba(255,255,255,0.08)', borderRadius: '999px', marginTop: '10px' }}>
                                        <div style={{ width: percent(item.level), height: '100%', borderRadius: '999px', background: 'var(--accent)' }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 1fr', gap: '12px', alignItems: 'end', marginBottom: '18px' }}>
                        <MiniBars label="LEFT" values={visualizerData.left} />
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>SUB</div>
                            <div style={{ color: 'var(--accent)', fontWeight: 800 }}>{percent(visualizerData.bass)}</div>
                        </div>
                        <MiniBars label="RIGHT" values={visualizerData.right} />
                    </div>

                    <div className="controls-row" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                        <motion.button
                            className={`action-button ${active ? 'stop' : 'start'}`}
                            onClick={active ? stop : handleStart}
                            style={{ height: '52px', padding: '0 40px', margin: 0, fontSize: '14px' }}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            {active ? <><PowerOff size={20} /> Stop audio</> : <><Play size={20} /> Start audio</>}
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

const MiniBars = ({ label, values }) => (
    <div>
        <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '6px' }}>{label}</div>
        <div style={{ display: 'flex', gap: '2px', height: '42px', alignItems: 'flex-end' }}>
            {values.map((value, index) => (
                <motion.div
                    key={index}
                    style={{
                        flex: 1,
                        background: index < 3 ? 'var(--accent)' : index < 8 ? '#00f2fe' : '#7f00ff',
                        borderRadius: '2px'
                    }}
                    animate={{ height: `${Math.max(4, value * 100)}%` }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                />
            ))}
        </div>
    </div>
)

export default AudioPage
