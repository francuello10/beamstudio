import React, { useCallback } from 'react'
import { Sliders, Zap, Check } from 'lucide-react'
import VerticalFader from '../components/VerticalFader'
import LivePreviewContainer from '../components/LivePreviewContainer'
import ColorWheel from '../components/ColorWheel'
import { CHANNELS, QUICK_COLORS } from '../utils/constants'
import { useDmxStore } from '../store/dmxStore'
import { useConfigStore } from '../store/configStore'

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

    const config = useConfigStore(state => state.config)
    const incrementPending = useConfigStore(state => state.incrementPending)
    const decrementPending = useConfigStore(state => state.decrementPending)

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
                    <h3><Sliders size={16} /> GrandMaster Console</h3>
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
                            {dmxFixtures.map(f => (
                                <div
                                    key={f.id}
                                    className={`fixture-pill ${f.selected ? 'active' : ''}`}
                                    onClick={() => toggleFixtureSelection(f.id)}
                                >
                                    <div className={`status-led ${f.selected ? 'on' : ''}`} />
                                    <span>{f.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="mixer-sidebar">
                <div className="glass-card color-wheel-card" style={{ marginBottom: '20px' }}>
                    <h3>Color Selector</h3>
                    <ColorWheel onChange={applyColor} size={220} />
                </div>

                <LivePreviewContainer
                    fixtures={dmxFixtures}
                    masterDimmer={dmxUniverseState.dim}
                    onToggleFixture={onToggleFixture}
                />
            </div>
        </div>
    )
}

export default ConsoleMixerPage
