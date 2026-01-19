import React, { useState, useRef, useCallback, useEffect, Component } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Sliders, Music, Lightbulb, Monitor, Settings, PowerOff,
    Zap, Check, Sun, Moon, Play, Square, Volume2,
    Waves, Flame, Droplets, Sparkles, Radio, PartyPopper, Heart, CloudSun
} from 'lucide-react'

import logoImg from './assets/logo.png'
import sticktecImg from './assets/sticktec.png'
import dmxControllerImg from './assets/dmx-controller.png'

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

function LivePreviewContainer({ fixtures, masterDimmer, activeProgram, overrideColors, liveColors, onToggleFixture }) {
    const [simFrame, setSimFrame] = useState(0)
    // Use lifted state
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
            </div>
            <div className="preview-bars">
                {fixtures?.map((fixture, i) => {
                    const isSelected = fixture.selected !== false
                    // Priority: Override > Backend Colors > Default
                    let c = overrideColors && overrideColors[i]
                        ? overrideColors[i]
                        : (isSelected && colors && colors[i] ? colors[i] : { r: 0, g: 0, b: 0 })

                    // Simulation Override
                    if (!overrideColors && activeProgram && c.r === 0 && c.g === 0 && c.b === 0) {
                        const hue = (simFrame * 2 + i * 30) % 360
                        const s = 100, l = 50;
                        const a = s * Math.min(l, 100 - l) / 100;
                        const f = n => {
                            const k = (n + hue / 30) % 12;
                            const color = l / 100 - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
                            return Math.round(255 * color);
                        };
                        c = { r: f(0), g: f(8), b: f(4) }
                    }

                    const dimFactor = (masterDimmer !== undefined ? masterDimmer : 255) / 255

                    const isBlackout = liveColors && liveColors[i]?.blackout
                    const finalC = isBlackout ? { r: 0, g: 0, b: 0 } : c

                    return (
                        <div key={fixture.id} className="preview-strip-wrapper" style={{ position: 'relative', height: '100%', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <motion.div
                                className="preview-bar"
                                animate={{
                                    backgroundColor: `rgb(${finalC.r * dimFactor}, ${finalC.g * dimFactor}, ${finalC.b * dimFactor})`,
                                    boxShadow: `0 0 ${40 * dimFactor}px rgba(${finalC.r}, ${finalC.g}, ${finalC.b}, ${0.6 * dimFactor})`
                                }}
                                transition={{ duration: 0.1 }}
                                style={{ width: '100%', flex: 1, borderRadius: '8px', marginBottom: '8px', opacity: isSelected ? 1 : 0.2 }}
                            >
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
}

function Sidebar({ activePage, setActivePage, darkMode, onToggleTheme }) {
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
}

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
                    <button className="control-btn minimize" onClick={windowOps.minimize}>─</button>
                    <button className="control-btn maximize" onClick={windowOps.toggleMaximize}>□</button>
                    <button className="control-btn close" onClick={windowOps.close}>✕</button>
                </div>
            )}
        </header>
    )
}

// ============================================================================
// Aesthetic Vertical Slider (Apple/Modern Style)
// ============================================================================

function VerticalFader({ channel, value, onChange, config }) {
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
        ? config.funcRanges.find(r => value >= r.min && r.max && value <= r.max)?.name
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

                {/* Reset to 0 Button */}
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
}

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

function MixerPage({ channelValues, setChannelValues, fixtures, setFixtures, config, onReset, liveColors, onToggleFixture, executeDmx }) {
    const handleChannelChange = useCallback((id, value) => {
        setChannelValues(prev => ({ ...prev, [id]: value }))
        executeDmx(() => window.dmx?.setChannelAsync(id, value), true)
    }, [setChannelValues, executeDmx])

    const applyColor = async (color) => {
        if (color.r === 0 && color.g === 0 && color.b === 0) {
            onReset() // Use reset for Off
        } else {
            setChannelValues(prev => ({ ...prev, red: color.r, green: color.g, blue: color.b, dim: 255 }))
            executeDmx(() => window.dmx?.colorMacro(color.name.toUpperCase()))
        }
    }

    return (
        <div className="page mixer-page">
            <div className="mixer-console">
                {/* Faders Section */}
                <div className="console-section faders-section">
                    <h3>Master Faders</h3>
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
                                size={160}
                                onChange={(color) => {
                                    setChannelValues(prev => ({ ...prev, red: color.r, green: color.g, blue: color.b, dim: 255 }))
                                    // Use optimized bulk update for Color Wheel to prevent 4x IPC calls per frame
                                    executeDmx(() => window.dmx?.setChannelsAsync([], {
                                        red: color.r,
                                        green: color.g,
                                        blue: color.b,
                                        dim: 255
                                    }), true)
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
                        <h3>Fixtures Selection</h3>
                        <div className="fixtures-list horizontal">
                            {fixtures.map((f, i) => (
                                <div
                                    key={f.id}
                                    className={`fixture-pill ${f.selected ? 'selected' : ''}`}
                                    onClick={() => setFixtures(fixtures.map(fx => fx.id === f.id ? { ...fx, selected: !fx.selected } : fx))}
                                >
                                    <img src={sticktecImg} alt="bar" className="fixture-icon-img" />
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
                <LivePreviewContainer fixtures={fixtures} masterDimmer={channelValues.dim} liveColors={liveColors} onToggleFixture={onToggleFixture} />
            </div>
        </div>
    )
}
function ProgramsPage({ config, activeProgram, onSelectProgram, channelValues, setChannelValues, fixtures, liveColors, onToggleFixture, executeDmx }) {
    const funcRanges = config?.funcRanges || []

    const handleProgramChange = async (value) => {
        onSelectProgram(value)
        executeDmx(async () => {
            await window.dmx?.setChannel('func', value)
            // Ensure dimmer is on when using programs
            if ((channelValues?.dim || 0) < 255) {
                await window.dmx?.setChannel('dim', 255)
            }
        })
    }

    const handleSpeed = async (speed) => {
        setChannelValues(prev => ({ ...prev, spd: speed }))
        executeDmx(() => window.dmx?.setChannelAsync('spd', speed), true)
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
                        <h3>�️ Selector de Programa (0-255)</h3>
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
                    <h3>📚 Guía de Rangos Completa (0-255)</h3>
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
                        <h3>⚡ Velocidad (Channel SPD)</h3>
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
                        <h3>🔊 Modo Sound</h3>
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
                {/* Pass 'activeProgram' to preview to allow simulation */}
                <LivePreviewContainer
                    fixtures={fixtures}
                    masterDimmer={255}
                    activeProgram={activeProgram}
                    liveColors={liveColors}
                    onToggleFixture={onToggleFixture}
                />
            </div>
        </div>
    )
}

function DynamicScenesPage({ config, activeDynamicScene, onSelectScene, fixtures, setChannelValues, channelValues, liveColors, onToggleFixture, executeDmx }) {
    const dynamicScenes = config?.dynamicScenes || []

    const handleSelect = async (sceneId) => {
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

    return (
        <div className="page dynamic-page">
            <div className="dynamic-main">
                <div className="glass-card">
                    <h3>Dynamic Scenes</h3>
                    <p className="subtitle">Software-generated effects • Click to toggle</p>
                    <div className="scenes-grid">
                        {dynamicScenes.map(scene => {
                            const Icon = dynamicSceneIcons[scene.id] || Sparkles
                            const isActive = activeDynamicScene === scene.id
                            return (
                                <motion.button
                                    key={scene.id}
                                    className={`scene-card ${isActive ? 'active' : ''}`}
                                    onClick={() => handleSelect(scene.id)}
                                    whileHover={{ y: -4 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    <Icon size={28} />
                                    <span className="scene-name">{scene.name}</span>
                                    <span className="scene-desc">{scene.desc}</span>
                                </motion.button>
                            )
                        })}
                    </div>
                </div>
            </div>
            <div className="dynamic-sidebar">
                <LivePreviewContainer fixtures={fixtures} masterDimmer={channelValues.dim} liveColors={liveColors} onToggleFixture={onToggleFixture} />
            </div>
        </div>
    )
}

function AudioPage({ fixtures, setChannelValues, channelValues, liveColors, onToggleFixture, executeDmx }) {
    const [active, setActive] = useState(false)
    const [levels, setLevels] = useState({ bass: 0, mid: 0, high: 0 })
    const [gain, setGain] = useState(1.0)
    const audioContext = useRef(null)
    const analyser = useRef(null)
    const animationFrame = useRef(null)
    const gainRef = useRef(1.0) // Ref for access inside closure

    // Update reg when state changes
    useEffect(() => { gainRef.current = gain }, [gain])

    const start = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
            audioContext.current = new (window.AudioContext || window.webkitAudioContext)()
            const source = audioContext.current.createMediaStreamSource(stream)
            analyser.current = audioContext.current.createAnalyser()
            analyser.current.fftSize = 512
            analyser.current.smoothingTimeConstant = 0.8
            source.connect(analyser.current)

            setActive(true)
            setChannelValues(prev => ({ ...prev, dim: 255 }))
            await window.audio?.start()

            const dataArray = new Uint8Array(analyser.current.frequencyBinCount)
            const analyze = () => {
                if (!analyser.current) return
                analyser.current.getByteFrequencyData(dataArray)

                // Calculate bands with gain
                const g = gainRef.current
                const bassRaw = dataArray.slice(0, 8).reduce((a, b) => a + b, 0) / 8 / 255
                const midRaw = dataArray.slice(8, 40).reduce((a, b) => a + b, 0) / 32 / 255
                const highRaw = dataArray.slice(40, 100).reduce((a, b) => a + b, 0) / 60 / 255

                const bass = Math.min(1, bassRaw * g)
                const mid = Math.min(1, midRaw * g)
                const high = Math.min(1, highRaw * g)

                setLevels({ bass, mid, high })
                executeDmx(() => window.audio?.setLevel({ bass, mid, high, volume: (bass + mid + high) / 3 }))

                animationFrame.current = requestAnimationFrame(analyze)
            }
            analyze()
        } catch (err) { console.error('Audio error:', err) }
    }

    const stop = () => {
        if (animationFrame.current) cancelAnimationFrame(animationFrame.current)
        if (audioContext.current) audioContext.current.close()
        setActive(false)
        setLevels({ bass: 0, mid: 0, high: 0 })
        window.audio?.stop()
        setChannelValues({ red: 0, green: 0, blue: 0, func: 0, spd: 0, flash: 0, dim: 0 })
    }

    return (
        <div className="page audio-page">
            <div className="audio-main">
                <div className="glass-card audio-card">
                    <div className="audio-header">
                        <div className={`status-indicator ${active ? 'active' : ''}`} />
                        <Volume2 size={32} className={active ? 'pulse-icon' : ''} />
                        <h2>Audio Reactive</h2>
                    </div>

                    <p className="subtitle">Sincroniza las luces con el micrófono</p>

                    <div className="visualizer-container">
                        <div className="visualizer">
                            <div className="band-container">
                                <motion.div className="bar bass" animate={{ height: `${levels.bass * 100}%` }} transition={{ type: 'spring', stiffness: 300, damping: 20 }} />
                                <span className="band-label">BASS</span>
                            </div>
                            <div className="band-container">
                                <motion.div className="bar mid" animate={{ height: `${levels.mid * 100}%` }} transition={{ type: 'spring', stiffness: 300, damping: 20 }} />
                                <span className="band-label">MID</span>
                            </div>
                            <div className="band-container">
                                <motion.div className="bar high" animate={{ height: `${levels.high * 100}%` }} transition={{ type: 'spring', stiffness: 300, damping: 20 }} />
                                <span className="band-label">HIGH</span>
                            </div>
                        </div>
                    </div>

                    <div className="controls-row">
                        <div className="control-group">
                            <label>Sensibilidad: {gain.toFixed(1)}x</label>
                            <input
                                type="range"
                                min="0.5"
                                max="3.0"
                                step="0.1"
                                value={gain}
                                onChange={(e) => setGain(parseFloat(e.target.value))}
                                className="styled-range"
                            />
                        </div>

                        <motion.button
                            className={`action-button ${active ? 'stop' : 'start'}`}
                            onClick={active ? stop : start}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            {active ? <><PowerOff size={18} /> Detener</> : <><Play size={18} /> Iniciar</>}
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

function AmbilightPage({ fixtures, setChannelValues, channelValues, liveColors, onToggleFixture, executeDmx, config }) {
    const fps = config?.performance?.ambiFps || 30
    const [capturing, setCapturing] = useState(false)
    const [sources, setSources] = useState([])
    const [selectedSource, setSelectedSource] = useState(null)
    const [isBGR, setIsBGR] = useState(false)
    const [previewColors, setPreviewColors] = useState(null)
    const videoRef = useRef(null)
    const canvasRef = useRef(null)
    const captureInterval = useRef(null)

    useEffect(() => {
        window.ambilight?.getSources()
            .then(setSources)
            .catch(err => {
                console.warn('Ambilight not available:', err)
                setSources([])
            })
    }, [])

    const start = async () => {
        const sourceId = selectedSource || sources[0]?.id
        if (!sourceId) return
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: false, video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: sourceId, minWidth: 1280, maxWidth: 1920, minHeight: 720, maxHeight: 1080 } }
            })
            if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play() }
            setCapturing(true)
            setChannelValues(prev => ({ ...prev, dim: 255 }))
            await window.ambilight?.start(sourceId)
            const ms = Math.round(1000 / fps)
            captureInterval.current = setInterval(() => extract(), ms)
        } catch (err) { console.error('Capture error:', err) }
    }

    const stop = () => {
        if (videoRef.current?.srcObject) videoRef.current.srcObject.getTracks().forEach(t => t.stop())
        if (captureInterval.current) clearInterval(captureInterval.current)
        setCapturing(false)
        setPreviewColors(null)
        window.ambilight?.stop()
        setChannelValues({ red: 0, green: 0, blue: 0, func: 0, spd: 0, flash: 0, dim: 0 })
    }

    // PRECOMPUTED GAMMA 2.2 TABLE (Linearizes LED output)
    const GAMMA_TABLE = Array.from({ length: 256 }, (_, i) => Math.round(Math.pow(i / 255, 2.2) * 255))

    const extract = () => {
        if (!videoRef.current || !canvasRef.current) return
        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true })
        canvas.width = 160; canvas.height = 90
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height)

        const frameData = ctx.getImageData(0, 0, canvas.width, canvas.height).data

        // 1. GLOBAL DOMINANT EXTRACTION (Full Screen Sync)
        let maxR = 0, maxG = 0, maxB = 0, maxVibrance = -1
        const rowStride = canvas.width * 4

        // Sample ENTIRE screen to find the strongest color (Philips "Natural" sync)
        for (let y = 5; y < 85; y += 4) {
            const rowOffset = y * rowStride
            for (let x = 5; x < 155; x += 4) {
                const i = rowOffset + (x * 4)
                const r = frameData[i], g = frameData[i + 1], b = frameData[i + 2]

                // Vibrance score: purely based on how "not grey" the color is
                const vibrance = Math.max(r, g, b) - Math.min(r, g, b)
                const brightness = (r + g + b) / 3

                if (vibrance + (brightness * 0.5) > maxVibrance) {
                    maxVibrance = vibrance + (brightness * 0.5)
                    maxR = r; maxG = g; maxB = b
                }
            }
        }

        // 2. MASSIVE EXAGGERATION (For Global Impact)
        let r = maxR, g = maxG, b = maxB

        // Manual Channel Swap Fix (Linux Wayland/PipeWire BGR Buffer)
        if (isBGR) {
            const temp = r
            r = b
            b = temp
        }

        const max = Math.max(r, g, b, 1)

        if (max > 10) {
            const boost = 255 / max
            r *= boost; g *= boost; b *= boost

            // Color specific "Vivid" enhancement (Wimbledon/Action/Ocean)
            if (g > r * 1.1 && g > b * 1.1) { g = 255; r *= 0.1; b *= 0.1 }
            else if (r > g * 1.1 && r > b * 1.1) { r = 255; g *= 0.1; b *= 0.1 }
            else if (b > r * 1.1 && b > g * 1.1) { b = 255; r *= 0.1; g *= 0.1 }
        } else {
            r = 0; g = 0; b = 0
        }

        const corr = (val) => GAMMA_TABLE[Math.min(255, Math.round(val))]
        const syncColor = { r: corr(r), g: corr(g), b: corr(b) }

        // All 3 bars get the same color for Basic Sync Mode
        const finalColors = [syncColor, syncColor, syncColor]
        setPreviewColors(finalColors)

        executeDmx(() => window.ambilight?.setColorsAsync({
            left: syncColor,
            center: syncColor,
            right: syncColor
        }), true)
    }

    return (
        <div className="page ambilight-page">
            <div className="ambilight-main">
                <div className="glass-card ambilight-card">
                    <Monitor size={48} strokeWidth={1} style={{ color: capturing ? 'var(--accent)' : 'inherit', filter: capturing ? 'drop-shadow(0 0 10px var(--accent))' : 'none' }} />
                    <h2>Ambilight Extreme</h2>
                    <p className="subtitle">Real-time Dominant Color Extraction Engine</p>

                    <div className="ambilight-setup-row">
                        <select className="source-select" onChange={(e) => setSelectedSource(e.target.value)} disabled={capturing}>
                            {sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>

                        <div className={`bgr-toggle ${isBGR ? 'active' : ''}`} onClick={() => setIsBGR(!isBGR)} title="Swap Red/Blue channels (Fix for some Linux drivers)">
                            <div className="toggle-slider"></div>
                            <span>BGR FIX</span>
                        </div>

                        <motion.button
                            className={`action-button ${capturing ? 'stop' : 'active'}`}
                            onClick={capturing ? stop : start}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            {capturing ? <><Square size={16} /> Stop Engine</> : <><Play size={16} /> Ignite Ambilight</>}
                        </motion.button>
                    </div>

                    <video ref={videoRef} style={{ display: 'none' }} />

                    {/* Real-time Extraction TV */}
                    <div className="extraction-monitor">
                        <div className="monitor-header">
                            <span className="live-indicator"><div className="dot"></div> EXTRACTION TV</span>
                            <span className="resolution-label">160x90 Downsampled Pipeline</span>
                        </div>
                        <div className="canvas-wrapper">
                            <canvas ref={canvasRef} className="extraction-canvas" />
                            {!capturing && <div className="canvas-placeholder">Select source and ignite engine...</div>}
                        </div>
                    </div>

                    {/* Dominant Color Analyzer */}
                    {capturing && previewColors && (
                        <div className="color-analyzer">
                            <div className="analyzer-label">DMX BUS MONITOR (VIVID OUTPUT)</div>
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
                                            {fixtures[i]?.name.split(' ')[1]}
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
    const [serialPorts, setSerialPorts] = useState([])
    const [selectedPort, setSelectedPort] = useState(config?.nativeDevicePath || '/dev/ttyUSB0')
    const [isConnecting, setIsConnecting] = useState(false)
    const [connectionStatus, setConnectionStatus] = useState(null)

    // Load serial ports on mount
    useEffect(() => {
        window.dmx?.listPorts().then(ports => {
            setSerialPorts(ports)
            // Auto-select KMtronic if found
            const kmtronic = ports.find(p => p.isKMtronic)
            if (kmtronic) setSelectedPort(kmtronic.path)
        })
        // Get current mode
        window.dmx?.getMode().then(mode => {
            setDmxMode(mode.mode)
            if (mode.devicePath) setSelectedPort(mode.devicePath)
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
            const result = await window.dmx?.setMode(newMode, selectedPort)
            if (result.success) {
                setDmxMode(result.mode)
                setConnectionStatus({ type: 'success', message: newMode === 'native' ? `Connected to ${result.devicePath}` : 'Using Art-Net (QLC+)' })
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
                            <span className="mode-icon">📡</span>
                            <span className="mode-label">Art-Net</span>
                            <span className="mode-desc">Via QLC+ (~70-120ms)</span>
                        </button>
                        <button
                            className={`mode-btn ${dmxMode === 'native' ? 'active' : ''}`}
                            onClick={() => handleModeChange('native')}
                            disabled={isConnecting}
                        >
                            <span className="mode-icon">🔌</span>
                            <span className="mode-label">Native USB</span>
                            <span className="mode-desc">Direct (~10-25ms)</span>
                        </button>
                    </div>

                    {dmxMode === 'native' && (
                        <div className="native-config">
                            <div className="port-selector">
                                <label>Serial Port:</label>
                                <select
                                    value={selectedPort}
                                    onChange={(e) => setSelectedPort(e.target.value)}
                                    disabled={isConnecting}
                                >
                                    {serialPorts.length === 0 && <option value="">No ports found</option>}
                                    {serialPorts.map(p => (
                                        <option key={p.path} value={p.path}>
                                            {p.path} {p.isKMtronic ? '(KMtronic)' : `(${p.manufacturer})`}
                                        </option>
                                    ))}
                                </select>
                                <button className="refresh-btn" onClick={refreshPorts} title="Refresh ports">🔄</button>
                            </div>
                            <button
                                className="reconnect-btn"
                                onClick={() => handleModeChange('native')}
                                disabled={isConnecting}
                            >
                                {isConnecting ? 'Connecting...' : 'Reconnect'}
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

    const handleChannelChange = useCallback((channel, value) => {
        executeDmx(() => window.dmx?.setChannelAsync(channel, value), true)
    }, [executeDmx])

    const handleSelectedChannelsChange = useCallback((channels) => {
        const fixtureIds = fixtures.filter(f => f.selected).map(f => f.id)
        executeDmx(() => window.dmx?.setChannelsAsync(fixtureIds, channels), true)
    }, [fixtures, executeDmx])

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
        setChannelValues({ red: 255, green: 255, blue: 255, func: 0, spd: 0, flash: 0, dim: 255 })
        setActiveProgram(null)
        setActiveDynamicScene(null)
        executeDmx(() => window.dmx?.colorMacro('WHITE'))
    }, [executeDmx])

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
        onToggleTheme
    }

    const renderPage = () => {
        switch (activePage) {
            case 'mixer': return <MixerPage {...commonProps} onReset={handleReset} />
            case 'programs': return <ProgramsPage {...commonProps} activeProgram={activeProgram} onSelectProgram={setActiveProgram} />
            case 'dynamic': return <DynamicScenesPage config={config} activeDynamicScene={activeDynamicScene} onSelectScene={setActiveDynamicScene} {...commonProps} />
            case 'audio': return <AudioPage {...commonProps} />
            case 'ambilight': return <AmbilightPage {...commonProps} />
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
