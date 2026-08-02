import React, { useCallback } from 'react'
import { Sliders, Zap, Check } from 'lucide-react'
import VerticalFader from '../components/VerticalFader'
import LivePreviewContainer from '../components/LivePreviewContainer'
import ColorWheel from '../components/ColorWheel'
import { CHANNELS, QUICK_COLORS } from '../utils/constants'
import { useDmxStore } from '../store/dmxStore'
import { useConfigStore } from '../store/configStore'
import { useAudioStore } from '../store/audioStore'
import { useSystemAudio } from '../hooks/useSystemAudio'

/**
 * ConsoleMixerPage - Grand Master Control Center
 * 
 * Provides professional-grade attribute control for the active fixture patch.
 * Implements industry-standard naming conventions (Console Mixer / Grand Master).
 */
const ConsoleMixerPage = ({ onReset }) => {
    // Stores
    const dmxUniverseState = useDmxStore(state => state.dmxUniverseState)
    const dispatchDmxAttributeUpdate = useDmxStore(state => state.dispatchDmxAttributeUpdate)
    const dispatchBulkDmxUpdate = useDmxStore(state => state.dispatchBulkDmxUpdate)
    const dmxFixtures = useDmxStore(state => state.dmxFixtures)
    const setDmxFixtures = useDmxStore(state => state.setDmxFixtures)
    const toggleFixtureSelection = useDmxStore(state => state.toggleFixtureSelection)
    const pixelMapBuffer = useDmxStore(state => state.pixelMapBuffer)

    // Audio Store
    const setAudioTelemetryDSP = useAudioStore(state => state.setAudioTelemetryDSP)
    const audioTelemetryDSP = useAudioStore(state => state.audioTelemetryDSP)
    const setAudioData = useAudioStore(state => state.setAudioData)
    const audioBoostLevel = useAudioStore(state => state.audioBoostLevel)
    const setAudioBoostLevel = useAudioStore(state => state.setAudioBoostLevel)

    const config = useConfigStore(state => state.config)
    const incrementPending = useConfigStore(state => state.incrementPending)
    const decrementPending = useConfigStore(state => state.decrementPending)

    // Local state for Audio Mode
    const [audioReactive, setAudioReactive] = React.useState(false)

    // 1. Hook up Audio Engine
    // We pass the *Manual Colors* from dmxUniverseState as the base "Input Colors" to the audio engine.
    // The engine will then modulate them and call dispatchPixelMapUpdate (or sendDmxBatch).

    // Convert current manual state to "colors" array for the hook
    const currentManualColors = dmxFixtures.map(() => ({
        r: dmxUniverseState.red || 0,
        g: dmxUniverseState.green || 0,
        b: dmxUniverseState.blue || 0
    }))

    const dispatchAudioColors = useCallback((colors) => {
        // Send to DMX (Fast Update)
        window.ambilight?.setColorsAsync({ colors, source: 'audio' })
        // Update Preview
        useDmxStore.getState().setPixelMapBuffer(colors)
    }, [])

    const { start: startAudio, stop: stopAudio, energyFactor, visualizerData, setModifierMode } = useSystemAudio(
        dispatchAudioColors,
        currentManualColors, // Pass manual colors to be boosted
        setAudioTelemetryDSP,
        audioBoostLevel
    )

    const handleBoostLevelChange = useCallback((event) => {
        setAudioBoostLevel(parseFloat(event.target.value))
    }, [setAudioBoostLevel])

    // Sync Audio Data
    React.useEffect(() => {
        window.currentBassLevel = visualizerData.bass
        setAudioData({ visualizerData })
    }, [visualizerData, setAudioData])

    // Toggle Audio Mode
    const handleAudioReactiveToggle = async () => {
        if (audioReactive) {
            setAudioReactive(false)
            setModifierMode(false)
            stopAudio()
            // Turn off dynamic flag so manual faders regain full control without modulation
            window.dmx?.setDynamicRendererActive(false, 'audio')
        } else {
            setAudioReactive(true)
            setModifierMode(true) // ENABLE MODIFIER MODE (Boosts input colors)
            // Enable dynamic renderer so updates are prioritized
            window.dmx?.setDynamicRendererActive(true, 'audio')
            await startAudio()
        }
    }

    // Cleanup on unmount
    React.useEffect(() => {
        return () => {
            if (audioReactive) {
                stopAudio()
                window.dmx?.setDynamicRendererActive(false, 'audio')
            }
        }
    }, [audioReactive, stopAudio])

    const handleChannelChange = useCallback((channel, value) => {
        dispatchDmxAttributeUpdate(channel, value)
    }, [dispatchDmxAttributeUpdate])

    const handleSelectedChannelsChange = useCallback((channels) => {
        dispatchBulkDmxUpdate(channels)
    }, [dispatchBulkDmxUpdate])

    const applyColor = (color) => {
        const updates = { red: color.r, green: color.g, blue: color.b }
        handleSelectedChannelsChange(updates)

        // Rapid IPC send for colors
        const selectedIds = dmxFixtures.filter(f => f.selected).map(f => f.id)
        if (selectedIds.length > 0) {
            window.dmx?.setChannelsAsync(selectedIds, updates)
        }
    }

    const onToggleFixture = async (fixtureId) => {
        incrementPending()
        try {
            const res = await window.dmx?.toggleBlackout(fixtureId)
            if (res?.success && !res.blackout) {
                // Restore current mix
                await window.dmx?.setChannels([fixtureId], dmxUniverseState)
            }
        } finally {
            decrementPending()
        }
    }

    return (
        <div className="mixer-page">
            <div className="mixer-console">
                <section className="console-section faders-section">
                    <div className="section-header-slim" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between' }}>
                        <h3><Sliders size={16} /> GrandMaster Console</h3>

                        {/* AUDIO TOGGLE BUTTON */}
                        <div
                            onClick={handleAudioReactiveToggle}
                            className="audio-reactive-toggle"
                            style={{
                                padding: '6px 12px',
                                borderRadius: '20px',
                                background: audioReactive ? 'linear-gradient(135deg, #ff0080, #7928ca)' : 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '11px',
                                fontWeight: 700,
                                transition: 'all 0.3s'
                            }}
                        >
                            <Zap size={14} fill={audioReactive ? "white" : "none"} />
                            <span>AUDIO BOOST {audioReactive ? 'ON' : 'OFF'}</span>
                            {audioReactive && <span style={{ opacity: 0.7, marginLeft: '4px' }}>x{energyFactor.toFixed(1)}</span>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '170px' }}>
                            <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 700 }}>BOOST x{audioBoostLevel.toFixed(1)}</span>
                            <input
                                type="range"
                                min="0.5"
                                max="2.5"
                                step="0.1"
                                value={audioBoostLevel}
                                onChange={handleBoostLevelChange}
                                style={{ width: '90px' }}
                            />
                        </div>
                    </div>

                    <div className="faders-grid">
                        {CHANNELS.map(ch => (
                            <VerticalFader
                                key={ch.id}
                                channel={ch}
                                value={dmxUniverseState[ch.id]}
                                onChange={handleChannelChange}
                                config={config}
                            />
                        ))}
                    </div>
                </section>

                <div className="console-bottom">
                    <div className="glass-card colors-card">
                        <h3>Quick Palettes</h3>
                        <div className="colors-grid">
                            {QUICK_COLORS.map(c => (
                                <button
                                    key={c.name}
                                    className={`color-btn ${c.name === 'Off' ? 'off' : ''}`}
                                    style={{ background: c.name === 'Off' ? 'transparent' : `rgb(${c.r}, ${c.g}, ${c.b})` }}
                                    onClick={() => applyColor(c)}
                                    title={c.name}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="glass-card fixtures-card">
                        <h3>Fixture Patch</h3>
                        <div className="fixtures-list horizontal">
                            {dmxFixtures.map(f => {
                                const activeColor = `rgb(${dmxUniverseState.red || 0},${dmxUniverseState.green || 0},${dmxUniverseState.blue || 0})`
                                const hasColor = (dmxUniverseState.red || 0) + (dmxUniverseState.green || 0) + (dmxUniverseState.blue || 0) > 50
                                return (
                                    <div
                                        key={f.id}
                                        className={`fixture-pill ${f.selected ? 'active' : ''}`}
                                        onClick={() => toggleFixtureSelection(f.id)}
                                        style={{
                                            borderColor: f.selected && hasColor ? activeColor : undefined,
                                            boxShadow: f.selected && hasColor ? `0 0 10px ${activeColor}` : undefined
                                        }}
                                    >
                                        <div
                                            className={`status-led ${f.selected ? 'on' : ''}`}
                                            style={{ background: f.selected && hasColor ? activeColor : undefined }}
                                        />
                                        <span>{f.name}</span>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </div>

            <div className="mixer-sidebar" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '100%' }}>
                <div className="glass-card color-wheel-card" style={{ marginBottom: '16px', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px' }}>
                    <h3 style={{ alignSelf: 'flex-start', margin: '0 0 12px 0' }}>Color Selector</h3>
                    <ColorWheel onChange={applyColor} size={200} />
                </div>

                <div style={{ flex: 1, minHeight: 0 }}>
                    <LivePreviewContainer
                        fixtures={dmxFixtures}
                        masterDimmer={dmxUniverseState.dim}
                        onToggleFixture={onToggleFixture}
                        isAudioActive={audioReactive}
                    />
                </div>
            </div>
        </div>
    )
}

export default ConsoleMixerPage
