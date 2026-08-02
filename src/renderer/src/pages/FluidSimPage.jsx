import React, { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Square, Zap, Droplets, Target, Activity } from 'lucide-react'
import LivePreviewContainer from '../components/LivePreviewContainer'
import { useFluidSimulation, FLUID_PALETTES } from '../hooks/useFluidSimulation'
import { useSystemAudio } from '../hooks/useSystemAudio'
import { useDmxStore } from '../store/dmxStore'
import { useAudioStore } from '../store/audioStore'
import '../fluidsim.css'

const FluidSimPage = () => {
    // Stores
    const dmxFixtures = useDmxStore(state => state.dmxFixtures)
    const dmxUniverseState = useDmxStore(state => state.dmxUniverseState)
    const toggleBlackout = useDmxStore(state => state.toggleBlackout)
    const sendPixelMapBuffer = useDmxStore(state => state.sendPixelMapBuffer)
    const setActiveProgram = useDmxStore(state => state.setActiveProgram)
    const setActiveDynamicScene = useDmxStore(state => state.setActiveDynamicScene)
    const setActiveFlag = useDmxStore(state => state.setActiveFlag)

    const setAudioTelemetryDSP = useAudioStore(state => state.setAudioTelemetryDSP)
    const audioMode = useAudioStore(state => state.audioMode)
    const audioFrame = useAudioStore(state => state.audioFrame)

    // Audio Engine
    const { start: startAudio, stop: stopAudio, energyFactor } = useSystemAudio(
        () => { }, // We don't need direct pixel map buffer here, fluid engine handles it
        null,
        setAudioTelemetryDSP
    )

    // Fluid Engine
    const {
        canvasRef, start: startFluid, stop: stopFluid,
        running, activePalette, changePalette, splat,
        currentColors // now exposed for UI feedback
    } = useFluidSimulation()

    // Toggle dynamic renderer for DMX routing
    useEffect(() => {
        if (running) window.dmx?.setDynamicRendererActive(true, 'renderer')
        return () => window.dmx?.setDynamicRendererActive(false, 'renderer')
    }, [running])

    // Audio Mode Handler
    const handleModeChange = useCallback(async (mode) => {
        const store = useAudioStore.getState()
        store.setAudioMode(mode)

        if (mode === 'OFF') {
            stopAudio()
        } else if (running) {
            // Only start audio if the engine is running
            await startAudio()
        }
    }, [startAudio, stopAudio, running])

    const handleStart = async () => {
        // Clear other modes
        setActiveProgram(null)
        setActiveDynamicScene(null)
        setActiveFlag(null)
        startFluid()

        // Resume audio if mode was active
        if (audioMode !== 'OFF') {
            await startAudio()
        }
    }

    const handleStop = () => {
        stopFluid()
        stopAudio()
    }

    // Mouse interaction
    const handleCanvasMouseMove = useCallback((e) => {
        if (!running || e.buttons === 0) return
        const rect = e.currentTarget.getBoundingClientRect()
        const x = (e.clientX - rect.left) / rect.width
        const y = 1.0 - (e.clientY - rect.top) / rect.height
        const dx = e.movementX / rect.width
        const dy = -e.movementY / rect.height
        const palette = activePalette.colors
        const color = palette[Math.floor(Math.random() * palette.length)]
        splat(x, y, dx * 10, dy * 10, color)
    }, [running, splat, activePalette])

    return (
        <div className="page fluidsim-page">
            <div className="fluidsim-main">
                {/* Visualizer Card */}
                <div className="glass-card fluidsim-canvas-card">
                    <div className="fluidsim-header">
                        <div className="fluidsim-title-group">
                            <Droplets size={20} className="fluidsim-icon" />
                            <div>
                                <h2>Neon Overdrive</h2>
                                <span className="fluidsim-subtitle">
                                    {activePalette.name} • {activePalette.type === 'explosive' ? 'High Energy Physics' : 'Flow State Physics'}
                                </span>
                            </div>
                        </div>

                        <div className="fluidsim-controls-top">
                            <div className="audio-mode-group">
                                {['OFF', 'STEREO', 'EQ'].map(mode => (
                                    <button
                                        key={mode}
                                        onClick={() => handleModeChange(mode)}
                                        className={`mode-btn ${audioMode === mode ? 'active' : ''}`}
                                    >
                                        {mode}
                                    </button>
                                ))}
                            </div>

                            <motion.button
                                className={`fluidsim-action-btn ${running ? 'stop' : ''}`}
                                onClick={running ? handleStop : handleStart}
                                whileHover={{ scale: 1.03 }}
                                whileTap={{ scale: 0.97 }}
                            >
                                {running
                                    ? <><Square size={16} fill="currentColor" /> STOP ENGINE</>
                                    : <><Play size={16} fill="currentColor" /> IGNITE SYSTEM</>
                                }
                            </motion.button>
                        </div>
                    </div>

                    {/* Canvas Wrapper */}
                    <div className="fluidsim-canvas-wrapper">
                        <canvas
                            ref={canvasRef}
                            width={1024}
                            height={576}
                            className="fluidsim-canvas"
                            onMouseMove={handleCanvasMouseMove}
                            onMouseDown={handleCanvasMouseMove}
                        />
                        {!running && (
                            <div className="fluidsim-canvas-overlay">
                                <Target size={64} strokeWidth={1} />
                                <span>INITIALIZE GPU FLUID DYNAMICS</span>
                            </div>
                        )}


                    </div>

                    {/* GPU Spatial Monitor (Replacing old Zone Monitor) */}
                    <div className="extraction-monitor" style={{ marginTop: '20px' }}>
                        <div className="monitor-header">
                            <span className="live-indicator"><div className="dot"></div> GPU SPATIAL MONITOR</span>
                            <span className="resolution-label">3x1 WebGL Downsample • 60Hz Telemetry</span>
                        </div>
                        <div className="monitor-canvas-wrapper" style={{ display: 'flex', gap: '4px', background: '#000', padding: '10px', height: '100px', position: 'relative', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                            {currentColors.map((c, i) => {
                                const energyLabels = ['LEFT', 'CENTER', 'RIGHT']

                                let energy = 0
                                if (audioMode !== 'OFF') {
                                    if (i === 0) energy = audioFrame.spatial.left
                                    if (i === 1) energy = audioFrame.spatial.center
                                    if (i === 2) energy = audioFrame.spatial.right
                                }
                                // For visual feedback, show colors and overlay energy bar

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
                                        {audioMode !== 'OFF' && (
                                            <div style={{
                                                position: 'absolute',
                                                bottom: 0,
                                                left: 0,
                                                right: 0,
                                                height: `${Math.min(100, energy * 100)}%`,
                                                background: 'linear-gradient(to top, rgba(255,255,255,0.4), rgba(255,255,255,0.0))',
                                                transition: 'height 0.05s linear',
                                                borderTop: '2px solid rgba(255,255,255,0.8)'
                                            }} />
                                        )}
                                        <div style={{
                                            position: 'absolute',
                                            top: '50%',
                                            left: '50%',
                                            transform: 'translate(-50%, -50%)',
                                            fontSize: '12px',
                                            fontWeight: 700,
                                            color: 'rgba(255,255,255,0.8)',
                                            textShadow: '0 1px 4px rgba(0,0,0,0.8)',
                                            zIndex: 2
                                        }}>
                                            {energyLabels[i]}
                                        </div>
                                    </div>
                                )
                            })}
                            {!running && <div className="canvas-placeholder" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'rgba(255,255,255,0.3)', pointerEvents: 'none' }}>System Inactive</div>}
                        </div>
                    </div>


                    {/* Palette Grid */}
                    <div className="fluidsim-palette-bar">
                        <span className="palette-label">FLUID PRESETS</span>
                        <div className="palette-grid">
                            {FLUID_PALETTES.map(p => (
                                <motion.button
                                    key={p.id}
                                    className={`palette-chip ${activePalette.id === p.id ? 'active' : ''} ${p.type}`}
                                    onClick={() => changePalette(p.id)}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    style={{
                                        background: `linear-gradient(135deg, 
                                            rgb(${Math.min(255, p.colors[0][0] * 200)},${Math.min(255, p.colors[0][1] * 200)},${Math.min(255, p.colors[0][2] * 200)}) 0%, 
                                            rgb(${Math.min(255, p.colors[1][0] * 200)},${Math.min(255, p.colors[1][1] * 200)},${Math.min(255, p.colors[1][2] * 200)}) 100%)`
                                    }}
                                >
                                    <div className="chip-content">
                                        <span className="palette-chip-name">{p.name}</span>
                                        <span className="palette-chip-type">
                                            {p.type === 'explosive' ? <Zap size={8} fill="currentColor" /> : <Droplets size={8} />}
                                        </span>
                                    </div>
                                </motion.button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

        </div>
    )
}


export default FluidSimPage
