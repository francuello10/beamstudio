import React, { useCallback } from 'react'
import { Sliders, Check } from 'lucide-react'
import VerticalFader from '../components/VerticalFader'
import LivePreviewContainer from '../components/LivePreviewContainer'
import ColorWheel from '../components/ColorWheel'
import { CHANNELS, QUICK_COLORS } from '../utils/constants'
import { useDmxStore } from '../store/dmxStore'
import { useConfigStore } from '../store/configStore'
import { useAudioStore } from '../store/audioStore'
import { useAudioEngine } from '../audio/AudioEngineContext'

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
    const audioTelemetryDSP = useAudioStore(state => state.audioTelemetryDSP)
    const setAudioData = useAudioStore(state => state.setAudioData)
    const setAudioInputColors = useAudioStore(state => state.setAudioInputColors)

    const config = useConfigStore(state => state.config)
    const incrementPending = useConfigStore(state => state.incrementPending)
    const decrementPending = useConfigStore(state => state.decrementPending)

    // Consume the shared Audio Engine (mounted in App.jsx, never unmounted by
    // navigation, started/stopped only via the global Header widget now - this
    // page no longer owns a start/stop toggle of its own). Its DMX writes go
    // out through useDmxStore.sendPixelMapBuffer with source 'audio' -
    // byte-for-byte what this page's old dispatchAudioColors did.
    const { active: audioActive, visualizerData } = useAudioEngine()

    // The *Manual Colors* from dmxUniverseState are the base "Input Colors" the
    // engine modulates. Memoized on the actual values because it is published to
    // the shared store below: a fresh array identity on every render would loop
    // (store write -> engine re-render -> context consumer re-render -> ...).
    const currentManualColors = React.useMemo(() => dmxFixtures.map(() => ({
        r: dmxUniverseState.red || 0,
        g: dmxUniverseState.green || 0,
        b: dmxUniverseState.blue || 0
    })), [dmxFixtures, dmxUniverseState.red, dmxUniverseState.green, dmxUniverseState.blue])

    // Publish the manual mix as the shared engine's modifier input, but ONLY
    // while the shared engine is actually running (`audioActive`, the real
    // engine state - this page has no on/off toggle of its own any more, that
    // now lives solely in the global Header widget). Gating on the real active
    // state instead of a page-local flag means this never goes stale: if audio
    // gets stopped from the Header while this page is open, the override is
    // released immediately instead of silently overriding the shared engine's
    // input forever. This effect never touches audioOutputSource, only the
    // input-color base, so it is safe regardless of which page happens to be
    // mounted while audio is active.
    React.useEffect(() => {
        if (audioActive) setAudioInputColors(currentManualColors)
    }, [audioActive, currentManualColors, setAudioInputColors])

    // Release the override when the engine stops or the page goes away, so the
    // global audioBaseColors fallback takes over again.
    React.useEffect(() => {
        if (!audioActive) return undefined
        return () => setAudioInputColors(null)
    }, [audioActive, setAudioInputColors])

    // Sync Audio Data
    React.useEffect(() => {
        window.currentBassLevel = visualizerData.bass
        setAudioData({ visualizerData })
    }, [visualizerData, setAudioData])

    const handleChannelChange = useCallback((channel, value) => {
        dispatchDmxAttributeUpdate(channel, value)
    }, [dispatchDmxAttributeUpdate])

    const handleSelectedChannelsChange = useCallback((channels) => {
        dispatchBulkDmxUpdate(channels)
    }, [dispatchBulkDmxUpdate])

    const applyColor = (color) => {
        const updates = { red: color.r, green: color.g, blue: color.b }
        handleSelectedChannelsChange(updates)

        // Rapid IPC send for colors - skipped while the shared audio engine is
        // actually running, so this doesn't fight the engine's own DMX writes.
        const selectedIds = dmxFixtures.filter(f => f.selected).map(f => f.id)
        if (!audioActive && selectedIds.length > 0) {
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
                    <div className="section-header-slim" style={{ marginBottom: '16px' }}>
                        <h3><Sliders size={16} /> GrandMaster Console</h3>
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
                        isAudioActive={audioActive}
                    />
                </div>
            </div>
        </div>
    )
}

export default ConsoleMixerPage
