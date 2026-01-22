import React from 'react'
import { Sliders, Zap, Lightbulb, Music } from 'lucide-react'
import { motion } from 'framer-motion'
import LivePreviewContainer from '../components/LivePreviewContainer'
import { useDmxStore } from '../store/dmxStore'
import { useConfigStore } from '../store/configStore'

const ProgramsPage = () => {
    // Stores
    const channelValues = useDmxStore(state => state.channelValues)
    const setChannelValue = useDmxStore(state => state.setChannelValue)
    const activeProgram = useDmxStore(state => state.activeProgram)
    const setActiveProgram = useDmxStore(state => state.setActiveProgram)
    const fixtures = useDmxStore(state => state.fixtures)
    const toggleBlackout = useDmxStore(state => state.toggleBlackout)
    const config = useConfigStore(state => state.config)

    const funcRanges = config?.funcRanges || []

    const handleProgramChange = async (value) => {
        setActiveProgram(value)
        setChannelValue('func', value)
        if ((channelValues?.dim || 0) < 255) {
            setChannelValue('dim', 255)
        }
    }

    const handleSpeed = (speed) => {
        setChannelValue('spd', speed)
    }

    // Determine active range name
    const activeRange = funcRanges.find(r => activeProgram >= r.min && activeProgram <= r.max)

    return (
        <div className="page programs-page">
            <div className="programs-main">
                <div className="glass-card main-control">
                    <div className="control-header">
                        <h3><Sliders size={16} /> Selector de Programa (0-255)</h3>
                        <div className="value-display">
                            <span className="value-label">VALOR DMX</span>
                            <span className="value-number">{activeProgram || 0}</span>
                        </div>
                    </div>

                    <input
                        type="range"
                        min="0"
                        max="255"
                        value={activeProgram || 0}
                        onChange={(e) => handleProgramChange(parseInt(e.target.value))}
                        className="big-slider"
                    />

                    <div className="active-info">
                        {activeRange ? (
                            <>
                                <span className="active-name">{activeRange.name}</span>
                                <span className="active-desc">{activeRange.desc} ({activeRange.min}-{activeRange.max})</span>
                            </>
                        ) : (
                            <span className="active-name">Manual Control</span>
                        )}
                    </div>
                </div>

                <div className="glass-card">
                    <h3><Lightbulb size={16} /> Guía de Rangos Completa (0-255)</h3>
                    <p className="subtitle">Click en un rango para ir a su valor inicial</p>

                    <div className="func-grid">
                        {funcRanges.map(range => {
                            const isActive = activeProgram >= range.min && activeProgram <= range.max
                            return (
                                <motion.button
                                    key={range.min}
                                    className={`func-btn ${isActive ? 'active' : ''}`}
                                    onClick={() => handleProgramChange(range.min)}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    <span className="func-range">{range.min}-{range.max}</span>
                                    <span className="func-desc" style={{ fontSize: '1rem', fontWeight: 600, color: isActive ? 'white' : 'var(--text-secondary)', marginTop: '4px' }}>
                                        {range.desc}
                                    </span>
                                </motion.button>
                            )
                        })}
                    </div>
                </div>

                <div className="programs-bottom">
                    <div className="glass-card speed-card">
                        <h3><Zap size={16} /> Velocidad (Channel SPD)</h3>
                        <div className="speed-control-container" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1rem' }}>
                            <input
                                type="range"
                                min="0"
                                max="255"
                                value={channelValues?.spd || 0}
                                onChange={(e) => handleSpeed(parseInt(e.target.value))}
                                className="big-slider"
                                style={{ flex: 1, height: '12px' }}
                            />
                            <div className="value-display" style={{ minWidth: '60px' }}>
                                <span className="value-number" style={{ fontSize: '1.5rem' }}>{channelValues?.spd || 0}</span>
                            </div>
                        </div>
                    </div>

                    <div className="glass-card sound-card">
                        <h3><Music size={16} /> Modo Sound</h3>
                        <motion.button
                            className={`sound-btn ${activeProgram >= 220 ? 'active' : ''}`}
                            onClick={() => handleProgramChange(220)}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            <Music size={24} />
                            <span>Activar Audiorítmico</span>
                            <span className="func-range">220-255</span>
                        </motion.button>
                    </div>
                </div>
            </div>

            <div className="programs-sidebar">
                <div className="sidebar-control-group">
                    <span className="control-label">MASTER BRIGHTNESS</span>
                    <input
                        type="range" min="0" max="255"
                        value={channelValues.dim}
                        onChange={(e) => setChannelValue('dim', parseInt(e.target.value))}
                        className="big-slider"
                        style={{ height: '8px', marginBottom: '12px' }}
                    />
                </div>
                <LivePreviewContainer
                    fixtures={fixtures}
                    masterDimmer={channelValues.dim}
                    activeProgram={activeProgram}
                    onToggleFixture={toggleBlackout}
                />
            </div>
        </div>
    )
}

export default ProgramsPage
