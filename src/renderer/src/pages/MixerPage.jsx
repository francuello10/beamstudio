import React, { useCallback } from 'react'
import { Sliders, Zap, Check } from 'lucide-react'
import VerticalFader from '../components/VerticalFader'
import LivePreviewContainer from '../components/LivePreviewContainer'
import ColorWheel from '../components/ColorWheel'
import { CHANNELS, QUICK_COLORS } from '../utils/constants'
import { useDmxStore } from '../store/dmxStore'
import { useConfigStore } from '../store/configStore'

const MixerPage = ({ onReset }) => {
    // Stores
    const channelValues = useDmxStore(state => state.channelValues)
    const setChannelValue = useDmxStore(state => state.setChannelValue)
    const setBulkChannelValues = useDmxStore(state => state.setBulkChannelValues)
    const fixtures = useDmxStore(state => state.fixtures)
    const setFixtures = useDmxStore(state => state.setFixtures)
    const toggleFixtureSelection = useDmxStore(state => state.toggleFixtureSelection)
    const liveColors = useDmxStore(state => state.liveColors)
    const config = useConfigStore(state => state.config)
    const incrementPending = useConfigStore(state => state.incrementPending)
    const decrementPending = useConfigStore(state => state.decrementPending)

    const handleChannelChange = useCallback((channel, value) => {
        setChannelValue(channel, value)
    }, [setChannelValue])

    const handleSelectedChannelsChange = useCallback((channels) => {
        setBulkChannelValues(channels)
    }, [setBulkChannelValues])

    const applyColor = (color) => {
        const updates = { red: color.r, green: color.g, blue: color.b }
        handleSelectedChannelsChange(updates)

        // Rapid IPC send for colors
        const selectedIds = fixtures.filter(f => f.selected).map(f => f.id)
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
                await window.dmx?.setChannels([fixtureId], channelValues)
            }
        } finally {
            decrementPending()
        }
    }

    return (
        <div className="mixer-page">
            <div className="mixer-console">
                <section className="console-section faders-section">
                    <h3><Sliders size={16} /> Console Master</h3>
                    <div className="faders-grid">
                        {CHANNELS.map(ch => (
                            <VerticalFader
                                key={ch.id}
                                channel={ch}
                                value={channelValues[ch.id]}
                                onChange={handleChannelChange}
                                config={config}
                            />
                        ))}
                    </div>
                </section>

                <div className="console-bottom">
                    <div className="glass-card colors-card">
                        <h3>Quick Colors</h3>
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
                        <h3>Fixtures Selection</h3>
                        <div className="fixtures-list horizontal">
                            {fixtures.map(f => (
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
                    <h3>Color Palette</h3>
                    <ColorWheel onChange={applyColor} size={220} />
                </div>

                <LivePreviewContainer
                    fixtures={fixtures}
                    masterDimmer={channelValues.dim}
                    onToggleFixture={onToggleFixture}
                />
            </div>
        </div>
    )
}

export default MixerPage
