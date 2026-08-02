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

const audioSlotRoles = [
    { label: 'Slot 1', role: 'LEFT SIDE', detail: 'L channel + lower-priority vocal guide + bass bleed' },
    { label: 'Slot 2', role: 'BASS CENTER', detail: 'Bass/sub only — put the physical center light here' },
    { label: 'Slot 3', role: 'RIGHT SIDE', detail: 'R channel + lower-priority vocal guide + bass bleed' }
]

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
    const audioStatusLabel = audioFrame.status.playbackPaused
        ? 'Playback paused'
        : audioFrame.status.silence
            ? 'Silence'
            : 'Signal OK'
    const audioStatusColor = audioFrame.status.playbackPaused || audioFrame.status.silence ? '#ffcc66' : '#8fffc2'
    const mapping = [
        {
            ...audioSlotRoles[0],
            fixture: dmxFixtures[0]?.name || 'Fixture 1',
            driver: bassPulseMode ? 'side response + slight bass' : `${currentGenre} profile + left side`,
            level: audioFrame.spatial.left,
            color: pixelMapBuffer[0]
        },
        {
            ...audioSlotRoles[1],
            fixture: dmxFixtures[1]?.name || 'Fixture 2',
            driver: bassPulseMode ? 'bass only / sub pulse' : `${currentGenre} profile + bass center`,
            level: audioFrame.spatial.center,
            color: pixelMapBuffer[1]
        },
        {
            ...audioSlotRoles[2],
            fixture: dmxFixtures[2]?.name || 'Fixture 3',
            driver: bassPulseMode ? 'side response + slight bass' : `${currentGenre} profile + right side`,
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
Mixer/base palette → audio boost → clean Slot 2 bass hits
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '10px', marginBottom: '12px' }}>
                        <select
                            value={selectedDeviceId}
                            onChange={(e) => setSelectedDeviceId(e.target.value)}
                            disabled={active}
                            className="system-select"
                            style={{ padding: '10px 12px' }}
                        >
                            <option value="">Auto speaker monitor</option>
                            {availableInputs.map((input) => (
                                <option key={input.deviceId} value={input.deviceId}>
                                    {input.isMonitor ? 'Speaker monitor · ' : 'System default · '}{input.label}
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
                                <strong>{reconnecting ? 'Reconnecting...' : (activeSource.label || 'Auto speaker monitor')}</strong>
                                {activeSource.isMonitor || activeSource.isGenericSystem ? <span style={{ color: '#8fffc2' }}> · system audio</span> : null}
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <span style={{ color: audioStatusColor, fontSize: '12px' }}>
                                    {audioStatusLabel}
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
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Higher = bigger 4D party jumps</span>
                        </div>
                        <input
                            type="range"
                            min="0.5"
                            max="4"
                            step="0.5"
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
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                            <div>
                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Audio fixture map</div>
                                <strong>Slot 2 = physical center / bass only</strong>
                            </div>
                            <span style={{ fontSize: '11px', color: '#ffcc66', textAlign: 'right' }}>
                                If center is wrong, reorder/rename fixtures in System.
                            </span>
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                            Full Music Boost uses the whole profile. Bass Boost makes Slot 2 react only to bass/sub, while Slot 1 and Slot 3 follow L/R plus a lower-priority vocal/melody guide; bass still leads the physical impact. Base colors define hue only; audio drives high-power RGB/DIM jumps and restores DIM when stopped; FUNC/SPD/FLASH are left untouched.
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                            {mapping.map((item) => (
                                <div key={item.label} style={{ padding: '12px', borderRadius: '12px', background: 'rgba(0,0,0,0.22)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                        <span style={{ width: '14px', height: '14px', borderRadius: '50%', ...colorPreview(item.color) }} />
                                        <strong style={{ fontSize: '13px' }}>{item.label}</strong>
                                    </div>
                                    <div style={{ fontSize: '12px', color: item.label === 'Slot 2' ? '#ffcc66' : '#fff', fontWeight: 800, marginBottom: '4px' }}>{item.role}</div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', minHeight: '30px' }}>{item.fixture}</div>
                                    <div style={{ fontSize: '11px', color: '#fff', marginTop: '8px' }}>{item.driver}</div>
                                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '4px' }}>{item.detail}</div>
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
                            <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>CENTER HIT</div>
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
