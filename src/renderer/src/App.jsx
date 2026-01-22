import React, { useState, useRef, useCallback, useEffect, Component } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Sliders, Music, Lightbulb, Monitor, Settings, PowerOff,
    Zap, Check, Sun, Moon, Play, Square, Volume2,
    Waves, Flame, Droplets, Sparkles, Radio, PartyPopper, Heart, CloudSun,
    AlertCircle, X, Minus
} from 'lucide-react'

import logoImg from './assets/logo.png'
import sticktecImg from './assets/sticktec.png'
import dmxControllerImg from './assets/dmx-controller.png'

import { useGpuAmbilight } from './hooks/useGpuAmbilight'
import { useSystemAudio } from './hooks/useSystemAudio'
import { DYNAMIC_SCENES, FLAGS } from './utils/palettes'
import { generateLightScene } from './services/geminiService'
import { compileAIResponse, executeAIScene } from './utils/aiRuntime'
import './dynamic.css' // Dynamic Page V2 Styles

// ============================================================================
// Navigation
// ============================================================================

const navItems = [
    { id: 'mixer', icon: Sliders, label: 'Mixer' },
    { id: 'programs', icon: Lightbulb, label: 'Programs' },
    { id: 'dynamic', icon: Sparkles, label: 'Dynamic' },
    { id: 'audio', icon: Music, label: 'Audio' },
    { id: 'ambilight', icon: Monitor, label: 'Ambilight' },
    { id: 'system', icon: Settings, label: 'System' },
]

const channels = [
    { id: 'red', label: 'Red', color: '#ff4444' },
    { id: 'green', label: 'Green', color: '#44ff44' },
    { id: 'blue', label: 'Blue', color: '#4444ff' },
    { id: 'func', label: 'Function', color: '#ffaa00' },
    { id: 'spd', label: 'Speed', color: '#00cccc' },
    { id: 'flash', label: 'Strobe', color: '#ffffff' },
    { id: 'dim', label: 'Master', color: '#888888' },
]

const dynamicSceneIcons = {
    vibe: Heart, aesthetic: Heart, rainbow: Waves, fire: Flame, ocean: Droplets,
    aurora: Sparkles, pulse: Radio, strobe: Zap, party: PartyPopper, sunset: CloudSun, chill: Waves
}

const quickColors = [
    { name: 'Off', r: 0, g: 0, b: 0 },
    { name: 'White', r: 255, g: 255, b: 255 },
    { name: 'Red', r: 255, g: 0, b: 0 },
    { name: 'Green', r: 0, g: 255, b: 0 },
    { name: 'Blue', r: 0, g: 0, b: 255 },
    { name: 'Cyan', r: 0, g: 255, b: 255 },
    { name: 'Magenta', r: 255, g: 0, b: 255 },
    { name: 'Yellow', r: 255, g: 255, b: 0 },
    { name: 'Orange', r: 255, g: 128, b: 0 },
    { name: 'Pink', r: 255, g: 150, b: 200 },
    { name: 'Purple', r: 128, g: 0, b: 255 },
    { name: 'Warm', r: 255, g: 180, b: 100 },
]

// ============================================================================
// Components
// ============================================================================

// ============================================================================
// Live Preview Container (Optimized)
// ============================================================================

const LivePreviewContainer = React.memo(({ fixtures, masterDimmer, activeProgram, overrideColors, liveColors, onToggleFixture, spatialEnergies }) => {
    const [simFrame, setSimFrame] = useState(0)
    const colors = liveColors || (fixtures || []).map(() => ({ r: 0, g: 0, b: 0 }))

    useEffect(() => {
        let animationId
        if (activeProgram) {
            const animate = () => {
                setSimFrame(f => (f + 1) % 360)
                animationId = requestAnimationFrame(animate)
            }
            animate()
        }
        return () => cancelAnimationFrame(animationId)
    }, [activeProgram])

    return (
        <div className="glass-card live-preview">
            <div className="preview-header">
                <img src={logoImg} alt="BeamStudio" className="preview-logo" />
                <span>Live Output {activeProgram ? '(Auto)' : ''}</span>
                {spatialEnergies && (
                    <motion.span
                        animate={{ opacity: [0.4, 1, 0.4], scale: [1, 1.1, 1] }}
                        transition={{ duration: 0.5, repeat: Infinity }}
                        style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--accent)', fontWeight: 800, letterSpacing: '1px' }}
                    >
                        SOUND ACTIVE
                    </motion.span>
                )}
            </div>
            <div className="preview-bars">
                {fixtures?.map((fixture, i) => {
                    const isSelected = fixture.selected !== false
                    let c = overrideColors && overrideColors[i]
                        ? overrideColors[i]
                        : (isSelected && colors && colors[i] ? colors[i] : { r: 0, g: 0, b: 0 })

                    if (!overrideColors && activeProgram && c.r === 0 && c.g === 0 && c.b === 0) {
                        const hue = (simFrame * 2 + i * 30) % 360
                        const s = 100, l = 50;
                        const a = s * Math.min(l, 100 - l) / 100;
                        const f = n => {
                            const k = (n + hue / 30) % 12;
                            return l / 100 - a / 100 * Math.max(Math.min(k - 3, 9 - k, 1), -1);
                        };
                        c = { r: Math.round(f(0) * 255), g: Math.round(f(8) * 255), b: Math.round(f(4) * 255) }
                    }

                    const dimFactor = (masterDimmer !== undefined ? masterDimmer : 255) / 255
                    const isBlackout = liveColors && liveColors[i]?.blackout
                    const finalC = isBlackout ? { r: 0, g: 0, b: 0 } : c

                    // Audio Boost Calculation
                    // If spatialEnergies are provided, boost the corresponding bars
                    // Left fixtures (index 0-2), Center/Bass (3-4?), Right (5-7) - depends on mapping
                    // Basic 50/50 split for now: < half is Left, > half is Right. 
                    const isLeft = i < fixtures.length / 2;
                    const energy = spatialEnergies ? (isLeft ? spatialEnergies.left : spatialEnergies.right) : 0;
                    // Apply center (bass) boost to all or center fixtures? Let's add bass to everything slightly.
                    const bassKick = spatialEnergies ? spatialEnergies.center : 0;

                    const boostHeight = energy * 40; // up to 40% height increase
                    const boostOpacity = Math.max(0, Math.min(1, energy * 2));

                    return (
                        <div key={fixture.id} className="preview-strip-wrapper" style={{ position: 'relative', height: '100%', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <motion.div
                                className="preview-bar"
                                animate={{
                                    backgroundColor: `rgb(${finalC.r * dimFactor}, ${finalC.g * dimFactor}, ${finalC.b * dimFactor})`,
                                    boxShadow: `0 0 ${40 * dimFactor}px rgba(${finalC.r}, ${finalC.g}, ${finalC.b}, ${0.6 * dimFactor})`,
                                    // Subtle scale on beat
                                    scaleY: 1 + (bassKick * 0.1),
                                }}
                                transition={{ duration: 0.05 }} // Snappy audio response
                                style={{
                                    width: '100%',
                                    flex: 1,
                                    borderRadius: '8px',
                                    marginBottom: '8px',
                                    opacity: isSelected ? 1 : 0.2,
                                    position: 'relative',
                                    overflow: 'hidden'
                                }}
                            >
                                {/* Audio overlay boost */}
                                {spatialEnergies && (
                                    <>
                                        {/* Color Fill */}
                                        <div style={{
                                            position: 'absolute',
                                            bottom: 0,
                                            left: 0,
                                            width: '100%',
                                            height: `${bassKick * 100}%`,
                                            background: 'linear-gradient(to top, rgba(255,255,255,0.4), transparent)',
                                            opacity: 0.6,
                                            transition: 'height 0.05s ease-out'
                                        }} />
                                        {/* White Flash Strobe on Kick */}
                                        <motion.div
                                            animate={{ opacity: bassKick > 0.8 ? 0.8 : 0 }}
                                            transition={{ duration: 0.05 }}
                                            style={{
                                                position: 'absolute',
                                                top: 0, left: 0, right: 0, bottom: 0,
                                                background: 'white',
                                                pointerEvents: 'none',
                                                zIndex: 1
                                            }}
                                        />
                                    </>
                                )}

                                <div className="preview-bar-icon">
                                    <div className={`preview-led ${c.r + c.g + c.b > 50 && !isBlackout ? 'on' : ''}`} />
                                </div>
                            </motion.div>

                            {onToggleFixture && isSelected && (
                                <button
                                    className={`fixture-toggle-btn ${isBlackout ? 'off' : 'on'}`}
                                    onClick={(e) => { e.stopPropagation(); onToggleFixture(fixture.id); }}
                                    title={isBlackout ? "Turn On" : "Blackout"}
                                >
                                    <PowerOff size={14} />
                                </button>
                            )}

                            <span className="preview-label-text" style={{ marginTop: '8px', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', opacity: isSelected ? 1 : 0.5 }}>
                                {fixture.name.substring(0, 3).toUpperCase()}
                            </span>
                        </div>
                    )
                })}
            </div>
        </div>
    )
})

const Sidebar = React.memo(({ activePage, setActivePage, darkMode, onToggleTheme }) => {
    return (
        <div className="sidebar">
            <div style={{ height: '20px' }} /> {/* Spacer */}
            <nav className="sidebar-nav">
                {navItems.map((item) => (
                    <motion.div
                        key={item.id}
                        className={`nav-item ${activePage === item.id ? 'active' : ''}`}
                        onClick={() => setActivePage(item.id)}
                        whileHover={{ x: 4 }}
                        whileTap={{ scale: 0.98 }}
                    >
                        <item.icon size={18} />
                        <span>{item.label}</span>
                    </motion.div>
                ))}
            </nav>
            <div className="sidebar-footer">
                <img
                    src={logoImg}
                    alt="Beam"
                    style={{ width: '42px', opacity: 0.7, filter: 'grayscale(100%)' }}
                />
                <div className="theme-toggle" onClick={onToggleTheme}>
                    {darkMode ? <Sun size={20} /> : <Moon size={20} />}
                </div>
                <div className="status-dot" />
            </div>
        </div>
    )
})

function Header({ onReset, onMeet, onFlash, windowOps, isSyncing }) {
    const [isFlashing, setIsFlashing] = useState(false)

    const handleFlash = async () => {
        setIsFlashing(true)
        await onFlash()
        setTimeout(() => setIsFlashing(false), 1500)
    }

    return (
        <header className="header">
            <div className="header-brand">
                <img src={logoImg} alt="BeamStudio" className="header-logo" />
                <span className="header-title">BeamStudio</span>
            </div>

            <div className="header-actions">
                <div className="sync-witness-container" title={isSyncing ? "Syncing..." : "Synced"}>
                    <div className={`sync-witness ${isSyncing ? 'syncing' : 'idle'}`} />
                    <span className="sync-text">{isSyncing ? 'Syncing' : 'Ready'}</span>
                </div>

                <motion.button
                    className="meet-button"
                    onClick={onMeet}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                >
                    <Sun size={18} />
                    <span>STUDIO</span>
                </motion.button>

                <motion.button
                    className={`flash-action-btn ${isFlashing ? 'active' : ''}`}
                    onClick={handleFlash}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    title="Intense Flash (1.5s)"
                >
                    <Zap size={18} />
                    <span>FLASH</span>
                </motion.button>

                <motion.button
                    className="off-button"
                    onClick={onReset}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                >
                    <PowerOff size={18} />
                    <span>OFF</span>
                </motion.button>
            </div>
            {windowOps && (
                <div className="window-controls">
                    <button className="control-btn minimize" onClick={windowOps.minimize}><Minus size={14} /></button>
                    <button className="control-btn maximize" onClick={windowOps.toggleMaximize}><Square size={12} /></button>
                    <button className="control-btn close" onClick={windowOps.close}><X size={14} /></button>
                </div>
            )}
        </header>
    )
}

// ============================================================================
// Aesthetic Vertical Slider (Apple/Modern Style)
// ============================================================================

const VerticalFader = React.memo(({ channel, value, onChange, config }) => {
    const sliderRef = useRef(null)
    const isDragging = useRef(false)

    const updateValue = useCallback((e) => {
        if (!sliderRef.current) return
        const rect = sliderRef.current.getBoundingClientRect()
        const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top))
        const percent = 1 - (y / rect.height)
        onChange(channel.id, Math.round(percent * 255))
    }, [channel.id, onChange])

    const handleMouseDown = useCallback((e) => { isDragging.current = true; updateValue(e) }, [updateValue])

    useEffect(() => {
        const move = (e) => { if (isDragging.current) { e.preventDefault(); updateValue(e) } }
        const up = () => { isDragging.current = false }
        window.addEventListener('mousemove', move)
        window.addEventListener('mouseup', up)
        return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
    }, [updateValue])

    const funcName = channel.id === 'func' && config?.funcRanges
        ? config.funcRanges.find(r => value >= r.min && value <= (r.max || 255))?.name
        : null

    const percent = (value / 255) * 100

    return (
        <div className="fader-strip aesthetic">
            <div className="fader-track-container rounded" ref={sliderRef} onMouseDown={handleMouseDown}>
                <div className="fader-track-bg" />
                <div
                    className="fader-fill rounded"
                    style={{
                        height: `${percent}%`,
                        background: channel.color,
                        boxShadow: `0 0 20px ${channel.color}44`
                    }}
                />
                <div className="fader-thumb" style={{ bottom: `${percent}%` }} />
            </div>
            <div className="fader-info">
                <span className="fader-value">{value}</span>
                <span className="fader-label" style={{ color: channel.color }}>{channel.label}</span>
                <span className="fader-mode">{funcName || ''}</span>

                <button
                    className={`fader-reset-btn ${value === 255 ? 'active-max' : ''}`}
                    onClick={(e) => { e.stopPropagation(); onChange(channel.id, 255); }}
                    title="Maximizar (255)"
                    style={{ marginBottom: '4px' }}
                >
                    MAX
                </button>
                <button
                    className={`fader-reset-btn ${value === 0 ? 'at-zero' : ''}`}
                    onClick={(e) => { e.stopPropagation(); onChange(channel.id, 0); }}
                    title="Volver a 0"
                >
                    0
                </button>
            </div>
        </div>
    )
})

// ============================================================================
// Pages
// ============================================================================

function hslToRgb(h, s, l) {
    s /= 100; l /= 100
    const k = n => (n + h / 30) % 12
    const a = s * Math.min(l, 1 - l)
    const f = n => l - a * Math.max(Math.min(k(n) - 3, 9 - k(n), 1), -1)
    return { r: Math.round(255 * f(0)), g: Math.round(255 * f(8)), b: Math.round(255 * f(4)) }
}

function ColorWheel({ onChange, size = 180 }) {
    const wheelRef = useRef(null)

    const handleInteraction = (e) => {
        if (!wheelRef.current) return
        const rect = wheelRef.current.getBoundingClientRect()
        const clientX = e.touches ? e.touches[0].clientX : e.clientX
        const clientY = e.touches ? e.touches[0].clientY : e.clientY

        const x = clientX - (rect.left + rect.width / 2)
        const y = clientY - (rect.top + rect.height / 2)

        let angle = Math.atan2(y, x) * (180 / Math.PI) + 90
        if (angle < 0) angle += 360

        const rgb = hslToRgb(angle, 100, 50)
        onChange(rgb)
    }

    return (
        <div
            ref={wheelRef}
            className="color-wheel-container"
            style={{
                width: size, height: size,
                borderRadius: '50%',
                background: 'conic-gradient(from 0deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
                margin: '10px auto',
                position: 'relative',
                cursor: 'crosshair',
                touchAction: 'none',
                boxShadow: '0 0 20px rgba(0,0,0,0.5), inset 0 0 20px rgba(0,0,0,0.2)'
            }}
            onMouseDown={(e) => {
                handleInteraction(e);
                const move = (ev) => handleInteraction(ev);
                const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
                window.addEventListener('mousemove', move);
                window.addEventListener('mouseup', up);
            }}
            onTouchStart={(e) => { handleInteraction(e); }}
            onTouchMove={(e) => { handleInteraction(e); }}
        >
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '20px', height: '20px', background: '#333', borderRadius: '50%', pointerEvents: 'none' }} />
        </div>
    )
}

function MixerPage({
    channelValues, handleChannelChange, handleSelectedChannelsChange, setChannelValues,
    fixtures, setFixtures, config, onReset, liveColors, onToggleFixture, executeDmx,
    spatialEnergies
}) {
    const [lockedSelection, setLockedSelection] = useState(false)
    const applyColor = async (color) => {
        if (color.r === 0 && color.g === 0 && color.b === 0) {
            onReset() // Use reset for Off
        } else {
            handleSelectedChannelsChange({ red: color.r, green: color.g, blue: color.b, dim: 255 })
            executeDmx(() => window.dmx?.colorMacro(color.name.toUpperCase()))
        }
    }

    return (
        <div className="page mixer-page">
            <div className="mixer-console">
                {/* Faders Section */}
                <div className="console-section faders-section">
                    <div className="section-header-slim">
                        <h3>Master Faders</h3>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                className="surprise-btn-small"
                                style={{ background: 'rgba(255,255,255,0.1)', height: '24px', fontSize: '10px' }}
                                onClick={() => {
                                    const allMax = channels.reduce((acc, ch) => ({ ...acc, [ch.id]: 255 }), {})
                                    handleSelectedChannelsChange(allMax)
                                }}
                            >
                                MAX ALL
                            </button>
                            <button
                                className="surprise-btn-small"
                                style={{ background: 'rgba(255,0,0,0.2)', color: '#ff4444', height: '24px', fontSize: '10px' }}
                                onClick={onReset}
                            >
                                RESET ALL
                            </button>
                        </div>
                    </div>
                    <div className="faders-grid">
                        {channels.map((ch) => (
                            <VerticalFader
                                key={ch.id}
                                channel={ch}
                                value={channelValues[ch.id]}
                                onChange={handleChannelChange}
                                config={config}
                            />
                        ))}
                    </div>
                </div>

                {/* Bottom Section: Colors & Fixtures */}
                <div className="console-bottom" style={{ display: 'flex', gap: '20px' }}>
                    <div className="console-card colors-card" style={{ flex: 1, display: 'flex', flexDirection: 'row', gap: '20px', alignItems: 'center' }}>
                        <div style={{ flex: '0 0 auto' }}>
                            <h3 style={{ marginBottom: '10px', textAlign: 'center' }}>Color Wheel</h3>
                            <ColorWheel
                                size={110}
                                onChange={(color) => {
                                    handleSelectedChannelsChange({
                                        red: color.r,
                                        green: color.g,
                                        blue: color.b,
                                        dim: 255
                                    })
                                }}
                            />
                        </div>
                        <div style={{ flex: 1 }}>
                            <h3>Quick Colors</h3>
                            <div className="colors-grid">
                                {quickColors.map((color, i) => (
                                    <motion.button
                                        key={i}
                                        className={`color-btn ${color.r === 0 && color.g === 0 && color.b === 0 ? 'off' : ''}`}
                                        style={{
                                            background: color.r === 0 && color.g === 0 && color.b === 0
                                                ? 'transparent'
                                                : `rgb(${color.r}, ${color.g}, ${color.b})`
                                        }}
                                        onClick={() => applyColor(color)}
                                        whileHover={{ scale: 1.1 }}
                                        whileTap={{ scale: 0.95 }}
                                        title={color.name}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="console-card fixtures-card">
                        <div className="section-header-slim">
                            <h3>Fixtures Selection</h3>
                            <button
                                onClick={() => setLockedSelection(!lockedSelection)}
                                className={`surprise-btn-small ${lockedSelection ? 'active' : ''}`}
                                style={{ background: lockedSelection ? '#ff3366' : 'rgba(255,255,255,0.1)', height: '24px' }}
                            >
                                {lockedSelection ? 'LOCKED' : 'UNLOCK'}
                            </button>
                        </div>
                        <div className="fixtures-list horizontal">
                            {fixtures.map((f, i) => (
                                <div
                                    key={f.id}
                                    className={`fixture-pill ${f.selected ? 'selected' : ''} ${lockedSelection ? 'locked' : ''}`}
                                    onClick={() => {
                                        if (lockedSelection) return;
                                        setFixtures(fixtures.map(fx => fx.id === f.id ? { ...fx, selected: !fx.selected } : fx))
                                    }}
                                >
                                    <div className={`fixture-led ${f.selected ? 'on' : ''}`} />
                                    <span>{f.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Sidebar for Live Output */}
            <div className="mixer-sidebar">
                <LivePreviewContainer
                    fixtures={fixtures}
                    masterDimmer={channelValues.dim}
                    liveColors={liveColors}
                    onToggleFixture={onToggleFixture}
                    spatialEnergies={spatialEnergies}
                />
            </div>
        </div>
    )
}
function ProgramsPage({
    config, activeProgram, onSelectProgram, channelValues, setChannelValues,
    fixtures, liveColors, onToggleFixture, executeDmx, handleChannelChange,
    spatialEnergies
}) {
    const funcRanges = config?.funcRanges || []

    const handleProgramChange = async (value) => {
        onSelectProgram(value)
        handleChannelChange('func', value)
        if ((channelValues?.dim || 0) < 255) {
            handleChannelChange('dim', 255)
        }
    }

    const handleSpeed = async (speed) => {
        handleChannelChange('spd', speed)
    }

    // Group by type
    const manual = funcRanges.filter(r => r.min === 0)
    const programs = funcRanges.filter(r => r.min >= 10 && r.min < 220)

    // Determine active range name
    const activeRange = funcRanges.find(r => activeProgram >= r.min && activeProgram <= r.max)

    return (
        <div className="page programs-page">
            <div className="programs-main">
                {/* Main Slider Control */}
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

                {/* Programs Grid (Reference & Presets) */}
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

                {/* Speed & Sound */}
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
                        onChange={(e) => handleChannelChange('dim', parseInt(e.target.value))}
                        className="big-slider"
                        style={{ height: '8px', marginBottom: '12px' }}
                    />
                </div>
                {/* Pass 'activeProgram' to preview to allow simulation */}
                <LivePreviewContainer
                    fixtures={fixtures}
                    masterDimmer={channelValues.dim}
                    activeProgram={activeProgram}
                    liveColors={liveColors}
                    onToggleFixture={onToggleFixture}
                    spatialEnergies={spatialEnergies}
                />
            </div>
        </div>
    )
}

function DynamicScenesPageV2({
    config, activeDynamicScene, onSelectScene, fixtures, setChannelValues,
    channelValues, liveColors, onToggleFixture, executeDmx, sendDmxBatch,
    spatialEnergies
}) {
    const dynamicScenes = config?.dynamicScenes || []
    const [audioReactive, setAudioReactive] = useState(false)
    const [sensitivity, setSensitivity] = useState(70) // 0-100%
    const [activeFlag, setActiveFlag] = useState(null)
    const [sceneColors, setSceneColors] = useState([{ r: 0, g: 0, b: 0 }, { r: 0, g: 0, b: 0 }, { r: 0, g: 0, b: 0 }])

    // AI State
    const [aiChatOpen, setAiChatOpen] = useState(true) // ALWAYS OPEN
    const [aiPrompt, setAiPrompt] = useState('')
    const [isGenerating, setIsGenerating] = useState(false)
    const [previewScene, setPreviewScene] = useState(null)
    const [customScenes, setCustomScenes] = useState([])

    // Load custom scenes on mount
    useEffect(() => {
        const saved = localStorage.getItem('CUSTOM_AI_SCENES')
        if (saved) {
            try {
                const parsed = JSON.parse(saved)
                const hydrated = parsed.map(s => {
                    if (s.type === 'DYNAMIC' && s.code) {
                        return { ...s, compiledFunc: compileAIResponse(s.code) }
                    }
                    return s
                })
                setCustomScenes(hydrated)
            } catch (e) { console.error("Failed to load custom scenes", e) }
        }
    }, [])

    const handleAiGenerate = async (promptType = "surprise") => {
        setIsGenerating(true)
        // setAiChatOpen(true) // Already open

        const prompt = promptType === "surprise" ? "Surprise me with something amazing" : aiPrompt
        const aiJson = await generateLightScene(prompt)

        if (aiJson) {
            let scene = { ...aiJson, id: Date.now() }
            if (aiJson.type === 'DYNAMIC') {
                const func = compileAIResponse(aiJson.code)
                if (func) {
                    scene.compiledFunc = func
                    setPreviewScene(scene)
                    setActiveDynamicScene(null)
                    setActiveFlag(null)
                    setAudioReactive(true)
                }
            } else if (aiJson.type === 'FLAG') {
                setPreviewScene(scene)
                setActiveDynamicScene(null)
                setActiveFlag(null)
            }
        }
        setIsGenerating(false)
    }

    const saveAiScene = () => {
        if (!previewScene) return
        const newScenes = [...customScenes, previewScene]
        setCustomScenes(newScenes)
        const toStore = newScenes.map(({ compiledFunc, ...rest }) => rest)
        localStorage.setItem('CUSTOM_AI_SCENES', JSON.stringify(toStore))
        setPreviewScene(null)
        setAudioReactive(false)
    }

    useEffect(() => {
        window.dmx?.setDynamicRendererActive(!!activeFlag || audioReactive)
        return () => window.dmx?.setDynamicRendererActive(false)
    }, [activeFlag, audioReactive])

    useEffect(() => {
        if (!audioReactive && !previewScene) return

        let frameId
        let scene

        if (previewScene && previewScene.type === 'DYNAMIC') {
            scene = {
                getFrame: (t) => {
                    return executeAIScene(previewScene.compiledFunc, t, window.currentBassLevel || 0.5)
                }
            }
        } else if (activeDynamicScene) {
            const sceneKey = activeDynamicScene.toUpperCase()
            scene = DYNAMIC_SCENES[sceneKey]
        }

        if (!scene) return

        const updateFrame = () => {
            const colors = scene.getFrame(Date.now())
            setSceneColors(colors)
            frameId = requestAnimationFrame(updateFrame)
        }

        frameId = requestAnimationFrame(updateFrame)
        return () => {
            if (frameId) cancelAnimationFrame(frameId)
        }
    }, [activeDynamicScene, audioReactive, previewScene])

    let colorsForAudio = sceneColors
    if (previewScene) {
        if (previewScene.type === 'FLAG') colorsForAudio = previewScene.colors
    } else if (activeFlag) {
        colorsForAudio = FLAGS[activeFlag]?.colors
    }

    const { start: startAudio, stop: stopAudio, active: audioActive, setModifierMode, energyFactor, visualizerData } = useSystemAudio(sendDmxBatch, colorsForAudio)

    useEffect(() => {
        window.currentBassLevel = visualizerData.bass
    }, [visualizerData.bass])

    const handleAudioReactiveToggle = async () => {
        if (audioReactive) {
            setAudioReactive(false)
            setModifierMode(false)
            stopAudio()
        } else {
            setAudioReactive(true)
            setModifierMode(true)
            await startAudio()
        }
    }

    const handleFlagSelect = (flagId) => {
        if (activeFlag === flagId) {
            setActiveFlag(null)
            if (!audioReactive) {
                sendDmxBatch([{ r: 0, g: 0, b: 0 }, { r: 0, g: 0, b: 0 }, { r: 0, g: 0, b: 0 }])
            }
        } else {
            setActiveFlag(flagId)
            onSelectScene(null)
            setPreviewScene(null)
            if (!audioReactive) {
                const flag = FLAGS[flagId]
                if (flag) sendDmxBatch(flag.colors)
            }
        }
    }

    const handleSelect = async (sceneId) => {
        setActiveFlag(null)
        if (activeDynamicScene === sceneId) {
            executeDmx(() => window.dmx?.dynamicScene(sceneId, false))
            onSelectScene(null)
            setChannelValues({ red: 0, green: 0, blue: 0, func: 0, spd: 0, flash: 0, dim: 0 })
        } else {
            executeDmx(() => window.dmx?.dynamicScene(sceneId, true))
            onSelectScene(sceneId)
            setChannelValues(prev => ({ ...prev, dim: 255 }))
        }
    }

    // Keep static flag colors when not audio reactive
    useEffect(() => {
        if (activeFlag && !audioReactive) {
            const flag = FLAGS[activeFlag]
            if (flag) {
                sendDmxBatch(flag.colors)
            }
        }
    }, [activeFlag, audioReactive])

    const brightnessFloor = 0.35
    const effectiveSensitivity = sensitivity / 100

    return (
        <div className="page dynamic-page-v2">
            <div className="dynamic-workspace">
                {/* LEFT CONSOLE: SCENES & FLAGS */}
                <div className="dynamic-console">
                    <div className="dynamic-scroll-area">
                        {/* HEADER */}
                        <div className="section-header-slim">
                            <span className="section-title">Dynamic Scenes</span>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <div
                                    onClick={handleAudioReactiveToggle}
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
                                    <Music size={14} />
                                    <span>AUDIO REACTIVE {audioReactive ? 'ON' : 'OFF'}</span>
                                    {audioReactive && <span style={{ opacity: 0.7, marginLeft: '4px' }}>x{energyFactor.toFixed(1)}</span>}
                                </div>
                            </div>
                        </div>

                        {/* SENSITIVITY SLIDER (If Audio Reactive) */}
                        {audioReactive && (
                            <div className="glass-card" style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>SENSITIVITY</span>
                                    <input
                                        type="range" min="0" max="100" value={sensitivity}
                                        onChange={(e) => setSensitivity(parseInt(e.target.value))}
                                        style={{ flex: 1 }}
                                    />
                                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent)' }}>{sensitivity}%</span>
                                </div>
                                <div style={{ display: 'flex', gap: '4px', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                                    <motion.div
                                        animate={{ width: `${visualizerData.bass * 100}%` }}
                                        style={{ height: '100%', background: 'var(--accent)', boxShadow: '0 0 10px var(--accent)' }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* SCENES GRID */}
                        <div className="scenes-grid-slim">
                            {dynamicScenes.map(scene => {
                                const Icon = dynamicSceneIcons[scene.id] || Sparkles
                                const isActive = activeDynamicScene === scene.id
                                return (
                                    <div
                                        key={scene.id}
                                        className={`scene-card-slim ${isActive ? 'active' : ''}`}
                                        onClick={() => handleSelect(scene.id)}
                                    >
                                        <Icon size={44} className="scene-icon" style={{ marginBottom: '8px', opacity: isActive ? 1 : 0.7 }} />
                                        <span className="scene-name">{scene.name}</span>
                                        <span className="scene-desc" style={{ fontSize: '12px' }}>{scene.desc}</span>
                                    </div>
                                )
                            })}
                        </div>

                        {/* FLAGS HEADER */}
                        <div className="section-header-slim" style={{ marginTop: '24px' }}>
                            <span className="section-title" style={{ fontSize: '14px' }}>Reactive Flags</span>
                        </div>

                        {/* FLAGS GRID */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                            {Object.entries(FLAGS).map(([id, flag]) => {
                                const isActive = activeFlag === id
                                const [left, center, right] = flag.colors
                                return (
                                    <button
                                        key={id}
                                        onClick={() => handleFlagSelect(id)}
                                        style={{
                                            padding: '12px 24px',
                                            borderRadius: '30px',
                                            background: isActive
                                                ? `linear-gradient(90deg, rgb(${left.r},${left.g},${left.b}), rgb(${center.r},${center.g},${center.b}), rgb(${right.r},${right.g},${right.b}))`
                                                : 'rgba(255,255,255,0.05)',
                                            border: isActive ? '2px solid white' : '1px solid rgba(255,255,255,0.1)',
                                            color: 'white',
                                            fontWeight: 800,
                                            fontSize: '14px',
                                            cursor: 'pointer',
                                            boxShadow: isActive ? '0 0 20px rgba(255,255,255,0.4)' : 'none',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px',
                                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                                        }}
                                    >
                                        {flag.name}
                                        {isActive && audioReactive && (
                                            <span style={{ fontSize: '10px', opacity: 0.8 }}>x{energyFactor.toFixed(1)}</span>
                                        )}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* BOTTOM BAR: AI CHAT (Moved Inside Console) */}
                    <div className="ai-floating-container">
                        <div className="ai-input-pill">
                            {isGenerating ? (
                                <div className="spinner" style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                            ) : (
                                <Sparkles size={18} color="var(--accent)" />
                            )}
                            <input
                                type="text"
                                className="ai-chat-input"
                                value={aiPrompt}
                                onChange={(e) => setAiPrompt(e.target.value)}
                                placeholder="Describe a lighting vibe..."
                                onKeyDown={(e) => e.key === 'Enter' && handleAiGenerate("custom")}
                                disabled={isGenerating}
                            />
                            <button
                                className="surprise-btn-small"
                                onClick={() => handleAiGenerate("surprise")}
                                disabled={isGenerating}
                            >
                                <Sparkles size={12} fill="white" />
                                SURPRISE ME
                            </button>
                        </div>
                        <span style={{ fontSize: '10px', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '6px', textShadow: '0 1px 2px black' }}>
                            Powered by Google Gemini 2.0 Flash
                        </span>
                    </div>

                </div>

                {/* RIGHT SIDEBAR: PREVIEW */}
                <div className="programs-sidebar">
                    <div className="sidebar-control-group">
                        <span className="control-label">MASTER DIMMER</span>
                        <input
                            type="range" min="0" max="255"
                            value={channelValues.dim}
                            onChange={(e) => handleChannelChange('dim', parseInt(e.target.value))}
                            className="big-slider"
                            style={{ height: '8px', marginBottom: '12px' }}
                        />
                    </div>
                    <LivePreviewContainer
                        fixtures={fixtures}
                        masterDimmer={channelValues.dim}
                        liveColors={liveColors}
                        onToggleFixture={onToggleFixture}
                        spatialEnergies={spatialEnergies}
                    />

                    {/* Active Info / Status */}
                    {previewScene && (
                        <div className="active-scene-banner">
                            <div style={{ overflow: 'hidden' }}>
                                <h4 style={{ margin: 0, color: '#0fdbc2', fontSize: '13px' }}>Previewing AI Scene</h4>
                                <span style={{ fontSize: '12px', opacity: 0.7, whiteSpace: 'nowrap', textOverflow: 'ellipsis', display: 'block' }}>{previewScene.name}</span>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                                <button onClick={saveAiScene} className="surprise-btn-small" style={{ background: '#0fdbc2', padding: '6px 10px' }}>SAVE</button>
                                <button onClick={() => { setPreviewScene(null); setAudioReactive(false); }} className="surprise-btn-small" style={{ background: 'rgba(255,255,255,0.1)', padding: '6px 10px' }}>X</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>


        </div>
    )
}


function AudioPage({ fixtures, liveColors, onToggleFixture, channelValues, sendDmxBatch, onAudioUpdate }) {
    const { start, stop, active, detectedGenre, autoGenre, setAutoGenre, manualGenre, setManualGenre, telemetry, visualizerData } = useSystemAudio(sendDmxBatch, null, onAudioUpdate)

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

                    {/* STEREO VISUALIZER */}
                    <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', height: '160px' }}>
                        {/* LEFT CHANNEL */}
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
                                        transition={{ type: 'tween', duration: 0.05 }}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* CENTER - BASS MONITOR + STEREO WIDTH */}
                        <div style={{ width: '80px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '8px' }}>SUB</span>
                            <motion.div
                                style={{
                                    width: '60px',
                                    height: '60px',
                                    borderRadius: '50%',
                                    background: `radial-gradient(circle, rgba(255,${Math.round(100 - visualizerData.bass * 100)},0,${visualizerData.bass}) 0%, transparent 70%)`,
                                    border: `2px solid rgba(var(--accent-rgb), ${0.3 + visualizerData.bass * 0.7})`,
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

                        {/* RIGHT CHANNEL */}
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
                                        transition={{ type: 'tween', duration: 0.05 }}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* GENRE CONTROL PANEL */}
                    <div style={{
                        marginBottom: '16px',
                        padding: '16px',
                        background: 'rgba(0,0,0,0.3)',
                        borderRadius: '16px'
                    }}>
                        {/* AI Toggle */}
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
                                    AI AUTO-VIBE {autoGenre ? 'ON' : 'OFF'}
                                </span>
                            </div>
                        </div>

                        {/* Manual Mode Buttons */}
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

                        {/* Active Genre Display */}
                        <div style={{ textAlign: 'center', marginTop: '12px' }}>
                            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>
                                {autoGenre ? 'AI DETECTED:' : 'MANUAL MODE:'}
                            </span>
                            <span style={{ fontSize: '14px', fontWeight: 800, color: '#fff', marginLeft: '8px', letterSpacing: '2px' }}>
                                {autoGenre ? detectedGenre : manualGenre}
                            </span>
                        </div>
                    </div>

                    {/* TELEMETRY DASHBOARD */}
                    {active && (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, 1fr)',
                            gap: '12px',
                            marginBottom: '24px',
                            padding: '16px',
                            background: 'rgba(0,0,0,0.3)',
                            borderRadius: '12px',
                            fontSize: '10px'
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

                    {/* CONTROLS */}
                    <div className="controls-row" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
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
                <LivePreviewContainer fixtures={fixtures} masterDimmer={channelValues?.dim || 255} liveColors={liveColors} onToggleFixture={onToggleFixture} />
            </div>
        </div>
    )
}

function AmbilightPage({ fixtures, channelValues, liveColors, onToggleFixture, sendDmxBatch, onAudioUpdate }) {
    const { start, stop, capturing, colors: previewColors, isMono, setIsMono } = useGpuAmbilight(sendDmxBatch)
    const [sources, setSources] = useState([])
    const [selectedSource, setSelectedSource] = useState(null)
    const [audioBoost, setAudioBoost] = useState(false)

    // Audio engine in modifier mode for Ambilight colors
    const { start: startAudio, stop: stopAudio, active: audioActive, setModifierMode, energyFactor } = useSystemAudio(
        (colors) => {
            // Only send to DMX if audio boost is active
            if (audioBoost) sendDmxBatch(colors)
        },
        previewColors,
        onAudioUpdate
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
        if (id) start(id)
    }

    return (
        <div className="page ambilight-page">
            <div className="ambilight-main">
                <div className="glass-card ambilight-card">
                    <Monitor size={48} strokeWidth={1} style={{ color: capturing ? 'var(--accent)' : 'inherit', filter: capturing ? 'drop-shadow(0 0 10px var(--accent))' : 'none' }} />
                    <h2>GPU Screen Sync</h2>
                    <p className="subtitle">Mapeo espacial Izquierda-Centro-Derecha acelerado por hardware</p>

                    <div className="ambilight-controls" style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                        {/* Row 1: Source & Status */}
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
                                <span>RX 6700 XT</span>
                            </div>
                        </div>

                        {/* Row 2: Toggles & Action */}
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
                                onClick={capturing ? stop : handleStart}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                style={{ flex: 1, margin: 0, height: '48px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}
                            >
                                {capturing ? <><Square size={18} fill="currentColor" /> STOP ENGINE</> : <><Play size={18} fill="currentColor" /> IGNITE SYSTEM</>}
                            </motion.button>
                        </div>
                    </div>

                    {/* Real-time Extraction TV */}
                    <div className="extraction-monitor">
                        <div className="monitor-header">
                            <span className="live-indicator"><div className="dot"></div> GPU SPATIAL MONITOR</span>
                            <span className="resolution-label">3x1 Hardware Downsampled</span>
                        </div>
                        <div className="canvas-wrapper" style={{ gap: '4px', background: '#000', padding: '10px' }}>
                            {previewColors.map((c, i) => {
                                // Energy bar height based on audio energy if boost active
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
                                        {/* Energy bar overlay */}
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
                                        {/* Zone label */}
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
                                        {/* Boost percentage */}
                                        {audioBoost && (
                                            <div style={{
                                                position: 'absolute',
                                                bottom: '4px',
                                                left: '50%',
                                                transform: 'translateX(-50%)',
                                                fontSize: '9px',
                                                fontWeight: 700,
                                                color: '#fff',
                                                background: 'rgba(0,0,0,0.5)',
                                                padding: '1px 4px',
                                                borderRadius: '3px'
                                            }}>
                                                +{boostPercent}%
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                            {!capturing && <div className="canvas-placeholder" style={{ position: 'absolute' }}>Select screen and ignite...</div>}
                        </div>
                    </div>

                    {/* Dominant Color Analyzer */}
                    {capturing && previewColors && (
                        <div className="color-analyzer">
                            <div className="analyzer-label">DMX SPATIAL BUS</div>
                            <div className="visualizer">
                                {previewColors.map((c, i) => (
                                    <div key={i} className="analyzer-bar" style={{
                                        background: `rgb(${c.r}, ${c.g}, ${c.b})`,
                                        boxShadow: `0 10px 30px rgba(${c.r}, ${c.g}, ${c.b}, 0.4)`
                                    }}>
                                        <div className="analyzer-codes">
                                            <span className="code-value">R:{c.r}</span>
                                            <span className="code-value">G:{c.g}</span>
                                            <span className="code-value">B:{c.b}</span>
                                        </div>
                                        <div className="hex-label">
                                            {fixtures[i]?.name.split(' ')[1] || 'BAR'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
            <div className="ambilight-sidebar">
                <LivePreviewContainer
                    fixtures={fixtures}
                    masterDimmer={channelValues?.dim || 255}
                    overrideColors={previewColors}
                    liveColors={liveColors}
                    onToggleFixture={onToggleFixture}
                />
            </div>
        </div>
    )
}

function SystemPage({ config, fixtures, setFixtures, onUpdatePerformance }) {
    const funcRanges = config?.funcRanges || []
    const perf = config?.performance || { dmxHz: 40, uiHz: 20, ambiFps: 30 }

    // DMX Mode state
    const [dmxMode, setDmxMode] = useState(config?.dmxMode || 'artnet')
    const [selectedPort, setSelectedPort] = useState(config?.nativeDevicePath || '')
    const [selectedDriver, setSelectedDriver] = useState('d2xx')
    const [usbDrivers, setUsbDrivers] = useState([])
    const [serialPorts, setSerialPorts] = useState([])
    const [isConnecting, setIsConnecting] = useState(false)
    const [connectionStatus, setConnectionStatus] = useState(null)

    // AI Configuration
    const [geminiKey, setGeminiKey] = useState(localStorage.getItem('RENDERER_VITE_GEMINI_API_KEY') || '')
    const [geminiModel, setGeminiModel] = useState(localStorage.getItem('RENDERER_VITE_GEMINI_MODEL') || 'gemini-2.0-flash-exp')
    const [keySaved, setKeySaved] = useState(false)
    const [testStatus, setTestStatus] = useState(null) // { type: 'success' | 'error', message: string } | null

    const handleSaveKey = () => {
        localStorage.setItem('RENDERER_VITE_GEMINI_API_KEY', geminiKey)
        localStorage.setItem('RENDERER_VITE_GEMINI_MODEL', geminiModel)
        setKeySaved(true)
        setTimeout(() => setKeySaved(false), 2000)
    }

    // Load serial ports on mount
    useEffect(() => {
        window.dmx?.getUsbDrivers().then(setUsbDrivers)
        window.dmx?.listPorts().then(async ports => {
            setSerialPorts(ports || [])

            // Auto-select recommended port
            const recommended = ports?.find(p => p.isRecommended)
            if (recommended) {
                setSelectedPort(recommended.path)
                if (recommended.recommendedDriver) setSelectedDriver(recommended.recommendedDriver)
            }
        })
        // Get current mode
        window.dmx?.getMode().then(mode => {
            setDmxMode(mode.mode)
            if (mode.devicePath) setSelectedPort(mode.devicePath)
            if (mode.driver) setSelectedDriver(mode.driver)
        })
    }, [])

    const handleUpdate = (key, val) => {
        onUpdatePerformance({ [key]: parseInt(val) })
    }

    const handleRename = (id, newName) => {
        setFixtures(fixtures.map(f => f.id === id ? { ...f, name: newName } : f))
    }

    const handleModeChange = async (newMode) => {
        setIsConnecting(true)
        setConnectionStatus(null)
        try {
            // Pass selectedDriver for USB mode
            const result = await window.dmx?.setMode(newMode, selectedPort, selectedDriver)
            if (result.success) {
                setDmxMode(result.mode)
                setConnectionStatus({
                    type: 'success',
                    message: newMode === 'usb' || newMode === 'native'
                        ? `Connected (${result.driverType})`
                        : 'Using Art-Net (QLC+)'
                })
            } else {
                setConnectionStatus({ type: 'error', message: result.error || 'Failed to switch mode' })
            }
        } catch (err) {
            setConnectionStatus({ type: 'error', message: err.message })
        }
        setIsConnecting(false)
    }

    const refreshPorts = async () => {
        const ports = await window.dmx?.listPorts()
        setSerialPorts(ports || [])
    }

    return (
        <div className="page system-page">
            <div className="system-grid">
                <div className="glass-card branding-card">
                    <img src={logoImg} alt="BeamStudio" className="branding-logo" />
                    <h1>BeamStudio</h1>
                    <p>DMX Lighting Controller</p>
                    <span className="version">v1.0.0</span>
                    <div className="author-info" style={{ marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px', textAlign: 'center' }}>
                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Developed by</p>
                        <a
                            href="https://github.com/francuello10"
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: 'var(--accent)', fontWeight: '700', textDecoration: 'none', fontSize: '14px' }}
                        >
                            Fran Cuello
                        </a>
                    </div>
                </div>

                {/* AI Configuration */}
                <div className="glass-card ai-config-card">
                    <div className="card-header-icon">
                        <Sparkles size={20} className="accent-text" />
                        <h3>AI Engine Configuration</h3>
                    </div>
                    <p className="subtitle">Configure your Google Gemini integration.</p>

                    <div style={{ display: 'flex', gap: '16px', flexDirection: 'column' }}>
                        {/* API KEY ROW */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Gemini API Key</label>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <input
                                    type="password"
                                    value={geminiKey}
                                    onChange={(e) => {
                                        // Remove special characters that cause ByteString errors (like 8226 bullet points)
                                        const sanitized = e.target.value.replace(/[^\x00-\x7F]/g, "").trim();
                                        setGeminiKey(sanitized);
                                    }}
                                    placeholder="Paste your API Key here"
                                    style={{
                                        flex: 1,
                                        padding: '12px',
                                        borderRadius: '12px',
                                        border: '1px solid var(--border-color)',
                                        background: 'rgba(0,0,0,0.3)',
                                        color: 'white',
                                        outline: 'none',
                                        fontSize: '13px'
                                    }}
                                />
                            </div>
                        </div>

                        {/* MODEL SELECTION ROW */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Model Selection</label>
                            <select
                                value={geminiModel}
                                onChange={(e) => setGeminiModel(e.target.value)}
                                style={{
                                    padding: '12px',
                                    borderRadius: '12px',
                                    border: '1px solid var(--border-color)',
                                    background: 'rgba(0,0,0,0.3)',
                                    color: 'white',
                                    outline: 'none',
                                    fontSize: '13px',
                                    appearance: 'none',
                                    cursor: 'pointer'
                                }}
                            >
                                <option value="gemini-1.5-flash">Gemini 1.5 Flash (Recommended)</option>
                                <option value="gemini-1.5-flash-8b">Gemini 1.5 Flash-8B (Lightweight)</option>
                                <option value="gemini-1.5-pro">Gemini 1.5 Pro (Smarter)</option>
                                <option value="gemini-2.0-flash-exp">Gemini 2.0 Flash Experimental</option>
                            </select>
                        </div>

                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                onClick={handleSaveKey}
                                style={{
                                    flex: 1,
                                    padding: '12px',
                                    borderRadius: '12px',
                                    background: keySaved ? '#00f260' : 'var(--accent)',
                                    color: 'white',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontWeight: 'bold',
                                    transition: 'all 0.2s',
                                    textTransform: 'uppercase',
                                    letterSpacing: '1px'
                                }}
                            >
                                {keySaved ? <><Check size={16} /> Config Saved</> : 'Save AI Configuration'}
                            </button>

                            <button
                                onClick={async () => {
                                    setTestStatus(null);
                                    const btn = document.getElementById('test-conn-btn');
                                    if (btn) { btn.innerText = "TESTING..."; btn.disabled = true; }
                                    try {
                                        if (!geminiKey) throw new Error("Please enter an API Key first");

                                        const { testConnection } = await import('./services/geminiService');
                                        await testConnection();

                                        setTestStatus({ type: 'success', message: `Successfully connected to ${geminiModel}!` });
                                    } catch (e) {
                                        setTestStatus({ type: 'error', message: e.message || "Connection failed. Check your API key and model selection." });
                                    } finally {
                                        if (btn) { btn.innerText = "TEST CONNECTION"; btn.disabled = false; }
                                    }
                                }}
                                id="test-conn-btn"
                                style={{
                                    width: '180px',
                                    padding: '12px',
                                    background: 'transparent',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    color: 'var(--text-secondary)',
                                    borderRadius: '12px',
                                    cursor: 'pointer',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    letterSpacing: '1px',
                                    textTransform: 'uppercase'
                                }}
                            >
                                Test Connection
                            </button>
                        </div>

                        {testStatus && (
                            <div className={`connection-status ${testStatus.type}`} style={{ padding: '12px', borderRadius: '8px', fontSize: '12px', textAlign: 'center' }}>
                                {testStatus.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />} {testStatus.message}
                            </div>
                        )}
                    </div>
                </div>

                <div className="glass-card performance-card">
                    <div className="card-header-icon">
                        <Zap size={20} className="accent-text" />
                        <h3>Hardware Performance</h3>
                    </div>
                    <p className="subtitle">Tune the engine for your DMX controller stability.</p>

                    <div className="perf-slider-group">
                        <div className="perf-control">
                            <div className="label-row">
                                <span>DMX Refresh Rate</span>
                                <span className="value-badge">{perf.dmxHz} Hz</span>
                            </div>
                            <input type="range" min="10" max="44" value={perf.dmxHz} onChange={(e) => handleUpdate('dmxHz', e.target.value)} />
                            <span className="hint">Lower this if lights flicker or lag (USB congestion).</span>
                        </div>

                        <div className="perf-control">
                            <div className="label-row">
                                <span>UI Sync Frequency</span>
                                <span className="value-badge">{perf.uiHz} Hz</span>
                            </div>
                            <input type="range" min="5" max="30" value={perf.uiHz} onChange={(e) => handleUpdate('uiHz', e.target.value)} />
                            <span className="hint">Frecuency of UI color updates. Lower = smoother UI.</span>
                        </div>

                        <div className="perf-control">
                            <div className="label-row">
                                <span>Ambilight Capture</span>
                                <span className="value-badge">{perf.ambiFps} FPS</span>
                            </div>
                            <input type="range" min="10" max="60" value={perf.ambiFps} onChange={(e) => handleUpdate('ambiFps', e.target.value)} />
                            <span className="hint">Frame rate of screen extraction engine.</span>
                        </div>
                    </div>
                </div>

                {/* DMX Connection Mode - NEW */}
                <div className="glass-card dmx-mode-card">
                    <div className="card-header-icon">
                        <Radio size={20} className="accent-text" />
                        <h3>DMX Connection Mode</h3>
                    </div>
                    <p className="subtitle">Choose how BeamStudio connects to your lights.</p>

                    <div className="dmx-mode-toggle">
                        <button
                            className={`mode-btn ${dmxMode === 'artnet' ? 'active' : ''}`}
                            onClick={() => handleModeChange('artnet')}
                            disabled={isConnecting}
                        >
                            <span className="mode-icon"><Radio size={18} /></span>
                            <span className="mode-label">Art-Net</span>
                            <span className="mode-desc">Via QLC+ (~80ms)</span>
                        </button>
                        <button
                            className={`mode-btn ${dmxMode === 'usb' || dmxMode === 'native' ? 'active' : ''}`}
                            onClick={() => handleModeChange('usb')}
                            disabled={isConnecting}
                        >
                            <span className="mode-icon"><Zap size={18} /></span>
                            <span className="mode-label">Direct USB</span>
                            <span className="mode-desc">FTDI D2XX (&lt; 2ms)</span>
                        </button>
                    </div>

                    {(dmxMode === 'native' || dmxMode === 'usb') && (
                        <div className="native-config">
                            <div className="port-selector-group" style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
                                {/* Port Selector */}
                                <div className="config-row" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                    <label style={{ minWidth: '80px' }}>FTDI Device:</label>
                                    <select
                                        value={selectedPort}
                                        onChange={(e) => setSelectedPort(e.target.value)}
                                        disabled={isConnecting}
                                        style={{ flex: 1 }}
                                    >
                                        {serialPorts.length === 0 && <option value="">No FTDI devices found</option>}
                                        {serialPorts.map(p => (
                                            <option key={p.path} value={p.path}>
                                                {p.displayName || p.path} {p.isRecommended ? <Check size={12} color="var(--accent)" /> : ''}
                                            </option>
                                        ))}
                                    </select>
                                    <button className="refresh-btn" onClick={refreshPorts} title="Refresh ports"><Zap size={14} /></button>
                                </div>
                            </div>

                            <button
                                className="reconnect-btn"
                                onClick={() => handleModeChange('usb')}
                                disabled={isConnecting}
                                style={{ marginTop: '15px', padding: '12px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                            >
                                {isConnecting ? 'Connecting...' : 'ACTIVATE HIGH PRECISION DMX'}
                            </button>
                        </div>
                    )}

                    {connectionStatus && (
                        <div className={`connection-status ${connectionStatus.type}`}>
                            {connectionStatus.type === 'success' ? '✓' : '✗'} {connectionStatus.message}
                        </div>
                    )}
                </div>

                <div className="glass-card hardware-card">
                    <h3>Fixtures Config</h3>
                    <div className="fixtures-config-list">
                        {fixtures.map(f => (
                            <div key={f.id} className="fixture-config-row">
                                <div className="fixture-icon-config">
                                    <img src={sticktecImg} alt="bar" />
                                </div>
                                <input
                                    type="text"
                                    className="fixture-name-input"
                                    value={f.name}
                                    onChange={(e) => handleRename(f.id, e.target.value)}
                                />
                                <span className="fixture-addr-config">Addr: {f.startChannel}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="glass-card reference-card">
                    <h3>FUNC Channel Reference</h3>
                    <div className="func-list">
                        {funcRanges.map((r, i) => (
                            <div key={i} className="func-row">
                                <span className="func-range">{r.min}-{r.max}</span>
                                <span className="func-desc" style={{ fontWeight: 600, color: 'var(--text)' }}>{r.desc}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

// ============================================================================
// Main App
// ============================================================================

class ErrorBoundary extends Component {
    constructor(props) {
        super(props)
        this.state = { hasError: false }
    }
    static getDerivedStateFromError(error) { return { hasError: true } }
    componentDidCatch(error, errorInfo) { console.error("Uncaught error:", error, errorInfo) }
    render() {
        if (this.state.hasError) return <h1>Something went wrong.</h1>
        return this.props.children
    }
}

function App() {
    const [activePage, setActivePage] = useState('mixer')
    const [darkMode, setDarkMode] = useState(true)
    const [config, setConfig] = useState(null)
    const [channelValues, setChannelValues] = useState({ red: 0, green: 0, blue: 0, func: 0, spd: 0, flash: 0, dim: 0 })
    const [activeProgram, setActiveProgram] = useState(null)
    const [activeDynamicScene, setActiveDynamicScene] = useState(null)
    const [fixtures, setFixtures] = useState([])
    const [liveColors, setLiveColors] = useState([])
    const [globalAudioEnergy, setGlobalAudioEnergy] = useState(null) // { left, center, right }
    const [pendingRequests, setPendingRequests] = useState(0)

    // Helper to track DMX calls
    const executeDmx = useCallback(async (fn, isAsync = false) => {
        if (isAsync) {
            fn()
            return
        }
        setPendingRequests(p => p + 1)
        try {
            return await fn()
        } finally {
            // Delay for visibility of the sync process
            setTimeout(() => setPendingRequests(p => Math.max(0, p - 1)), 50)
        }
    }, [])

    const pendingDmxUpdates = useRef({})

    // Phase 2: IPC Throttling Scheduler (Flush at 40Hz)
    useEffect(() => {
        const flush = () => {
            if (Object.keys(pendingDmxUpdates.current).length === 0) return
            const updates = { ...pendingDmxUpdates.current }
            pendingDmxUpdates.current = {}

            const selectedIds = fixtures.filter(f => f.selected).map(f => f.id)
            window.dmx?.setChannelsAsync(selectedIds, updates)
        }
        const timer = setInterval(flush, 25)
        return () => clearInterval(timer)
    }, [fixtures])

    const handleChannelChange = useCallback((channel, value) => {
        setChannelValues(prev => ({ ...prev, [channel]: value }))
        pendingDmxUpdates.current[channel] = value
    }, [])

    const sendDmxBatch = useCallback((colors) => {
        window.ambilight?.setColorsAsync({ colors })
        setLiveColors(colors)
    }, [])

    const handleSelectedChannelsChange = useCallback((channels) => {
        setChannelValues(prev => ({ ...prev, ...channels }))
        Object.entries(channels).forEach(([ch, val]) => {
            pendingDmxUpdates.current[ch] = val
        })
    }, [])

    useEffect(() => {
        const handleColors = (newColors) => setLiveColors(newColors)
        const cleanup = window.dmx?.onColorsUpdated(handleColors)
        return () => cleanup && cleanup()
    }, [])

    useEffect(() => {
        (async () => {
            const cfg = await window.dmx?.getConfig()
            if (cfg) setConfig(cfg)
            const fxt = await window.dmx?.getFixtures()
            if (fxt) setFixtures(fxt.map(f => ({ ...f, selected: true }))) // Default all selected
        })()
    }, [])

    const handleReset = useCallback(async () => {
        setChannelValues({ red: 0, green: 0, blue: 0, func: 0, spd: 0, flash: 0, dim: 0 })
        setActiveProgram(null)
        setActiveDynamicScene(null)
        // Robust clearing
        executeDmx(async () => {
            await window.dmx?.setChannel('func', 0)
            await window.dmx?.setChannel('spd', 0)
            await window.dmx?.setChannel('flash', 0)
            await window.dmx?.reset()
        })
    }, [executeDmx])

    const handleUpdatePerformance = useCallback(async (settings) => {
        const res = await window.dmx?.updatePerformance(settings)
        if (res?.success) {
            setConfig(prev => ({ ...prev, performance: res.performance }))
        }
    }, [])

    const handleToggleFixture = async (fixtureId) => {
        executeDmx(async () => {
            const res = await window.dmx?.toggleBlackout(fixtureId)
            if (res?.success && !res.blackout) {
                // Restore current mix
                await window.dmx?.setChannels(
                    [fixtureId],
                    channelValues
                )
            }
        })
    }

    const handleMeet = useCallback(async () => {
        // Warmer, softer light (Warm White at 60%)
        const warmWhite = { red: 255, green: 180, blue: 120, func: 0, spd: 0, flash: 0, dim: 150 }
        setChannelValues(warmWhite)
        setActiveProgram(null)
        setActiveDynamicScene(null)
        executeDmx(async () => {
            await window.dmx?.colorMacro('WARM') // Map to warm macro if exists, or custom colors
            const selectedIds = fixtures.filter(f => f.selected).map(f => f.id)
            await window.dmx?.setChannels(selectedIds, warmWhite)
        })
    }, [executeDmx, fixtures])

    const handleIntenseFlash = useCallback(() => executeDmx(() => window.dmx?.intenseFlash()), [executeDmx])

    const onToggleTheme = useCallback(() => setDarkMode(prev => !prev), [])

    const headerProps = {
        onReset: handleReset,
        onMeet: handleMeet,
        onFlash: handleIntenseFlash,
        windowOps: window.windowOps,
        isSyncing: pendingRequests > 0
    }

    const commonProps = {
        fixtures, config, setChannelValues, channelValues,
        setFixtures, liveColors, onToggleFixture: handleToggleFixture,
        executeDmx,
        darkMode,
        onToggleTheme,
        handleChannelChange,
        handleSelectedChannelsChange,
        sendDmxBatch,
        spatialEnergies: globalAudioEnergy // Pass global energy to all pages
    }

    const renderPage = () => {
        switch (activePage) {
            case 'mixer': return <MixerPage {...commonProps} onReset={handleReset} />
            case 'programs': return <ProgramsPage {...commonProps} activeProgram={activeProgram} onSelectProgram={setActiveProgram} />
            case 'dynamic': return <DynamicScenesPageV2 config={config} activeDynamicScene={activeDynamicScene} onSelectScene={setActiveDynamicScene} {...commonProps} />
            case 'audio': return <AudioPage {...commonProps} onAudioUpdate={setGlobalAudioEnergy} />
            case 'ambilight': return <AmbilightPage {...commonProps} onAudioUpdate={setGlobalAudioEnergy} />
            case 'system': return <SystemPage {...commonProps} onUpdatePerformance={handleUpdatePerformance} />
            default: return null
        }
    }

    return (
        <ErrorBoundary>
            <div className={`app ${darkMode ? 'dark' : 'light'}`}>
                <Sidebar activePage={activePage} setActivePage={setActivePage} darkMode={darkMode} onToggleTheme={onToggleTheme} />
                <div className="main-content">
                    <Header
                        {...headerProps}
                    />
                    <div className="page-container">
                        <AnimatePresence mode='wait'>
                            <motion.div
                                key={activePage}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.2 }}
                                style={{ height: '100%' }}
                            >
                                {renderPage()}
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </ErrorBoundary>
    )
}

export default App
