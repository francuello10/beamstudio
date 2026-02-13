import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { PowerOff } from 'lucide-react'
import logoImg from '../assets/logo.png'
import { useDmxStore } from '../store/dmxStore'
import { useAudioStore } from '../store/audioStore'

const LivePreviewContainer = React.memo(({ fixtures, masterDimmer, activeProgram, overrideColors, onToggleFixture, isAudioActive }) => {
    const [simFrame, setSimFrame] = useState(0)

    // Subscribe to stores
    const pixelMapBuffer = useDmxStore(state => state.pixelMapBuffer)
    const dmxUniverseState = useDmxStore(state => state.dmxUniverseState)
    const audioTelemetryDSP = useAudioStore(state => state.audioTelemetryDSP)

    // @ai-constraints Derive colors from pixelMapBuffer, fallback to dmxUniverseState RGB values
    const colors = pixelMapBuffer?.length > 0
        ? pixelMapBuffer
        : (fixtures || []).map(() => ({
            r: dmxUniverseState?.red || 0,
            g: dmxUniverseState?.green || 0,
            b: dmxUniverseState?.blue || 0
        }))

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
        <div className="glass-card live-preview" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="preview-header" style={{ flexShrink: 0 }}>
                <img src={logoImg} alt="BeamStudio" className="preview-logo" />
                <span>Live Output {activeProgram ? '(Auto)' : ''}</span>
                {isAudioActive && audioTelemetryDSP && (audioTelemetryDSP.center > 0.05 || audioTelemetryDSP.left > 0.05) && (
                    <motion.span
                        animate={{ opacity: [0.4, 1, 0.4], scale: [1, 1.1, 1] }}
                        transition={{ duration: 0.5, repeat: Infinity }}
                        style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--accent)', fontWeight: 800, letterSpacing: '1px' }}
                    >
                        SOUND ACTIVE
                    </motion.span>
                )}
            </div>
            <div className="preview-bars" style={{ flex: 1, display: 'flex', gap: '8px', minHeight: 0 }}>
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
                    const isBlackout = pixelMapBuffer && pixelMapBuffer[i]?.blackout
                    const finalC = isBlackout ? { r: 0, g: 0, b: 0 } : c

                    // Strobe simulation logic
                    const strobeVal = dmxUniverseState?.flash || 0
                    let strobeVisible = true
                    if (strobeVal > 10) {
                        const freq = (strobeVal / 255) * 29 + 1
                        const period = 1000 / freq
                        strobeVisible = (Date.now() % period) < (period / 2)
                    }

                    // Audio Boost Calculation
                    // @ai-constraints Calculate precise energy per fixture (L/R) for visualization
                    const isLeft = i < fixtures.length / 2
                    // Use Left energy for left fixtures, Right for right. Mix of Center (Bass) for all.
                    const channelEnergy = audioTelemetryDSP
                        ? (isLeft ? audioTelemetryDSP.left : audioTelemetryDSP.right)
                        : 0
                    const boostPercent = Math.round(channelEnergy * 100)

                    // Center/Bass affects everyone for punch, but sides have their own jitter
                    const totalDeformation = 1 + (audioTelemetryDSP ? (audioTelemetryDSP.center * 0.2 + channelEnergy * 0.1) : 0)

                    return (
                        <div key={fixture.id} className="preview-strip-wrapper" style={{ position: 'relative', height: '100%', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <motion.div
                                className="preview-bar"
                                animate={{
                                    backgroundColor: strobeVisible
                                        ? `rgb(${finalC.r * dimFactor}, ${finalC.g * dimFactor}, ${finalC.b * dimFactor})`
                                        : 'rgb(0,0,0)',
                                    boxShadow: strobeVisible
                                        ? `0 0 ${40 * dimFactor}px rgba(${finalC.r}, ${finalC.g}, ${finalC.b}, ${0.6 * dimFactor})`
                                        : 'none',
                                    scaleY: totalDeformation, // Use combined deformation
                                }}
                                transition={{ duration: 0.05 }}
                                style={{
                                    width: '100%',
                                    flex: 1,
                                    borderRadius: '8px',
                                    marginBottom: '8px',
                                    opacity: isSelected ? 1 : 0.2,
                                    position: 'relative',
                                    overflow: 'hidden',
                                    minHeight: 0,
                                    // Origin at bottom so it grows up
                                    transformOrigin: 'bottom'
                                }}
                            >
                                {audioTelemetryDSP && (
                                    <>
                                        {/* Energy Fill Level */}
                                        <div style={{
                                            position: 'absolute',
                                            bottom: 0,
                                            left: 0,
                                            width: '100%',
                                            height: `${Math.min(100, boostPercent * 1.5)}%`, // Scale visually
                                            background: 'linear-gradient(to top, rgba(255,255,255,0.5), transparent)',
                                            opacity: 0.8,
                                            transition: 'height 0.05s ease-out',
                                            mixBlendMode: 'overlay'
                                        }} />

                                        {/* Boost Percentage Text */}
                                        {boostPercent > 5 && (
                                            <div style={{
                                                position: 'absolute',
                                                bottom: '4px',
                                                width: '100%',
                                                textAlign: 'center',
                                                fontSize: '10px',
                                                fontWeight: 800,
                                                color: 'rgba(255,255,255,0.9)',
                                                textShadow: '0 1px 2px black',
                                                zIndex: 10
                                            }}>
                                                +{boostPercent}%
                                            </div>
                                        )}

                                        {/* White Flash Strobe on Kick */}
                                        <motion.div
                                            animate={{ opacity: (audioTelemetryDSP.center > 0.8 && strobeVisible) ? 0.6 : 0 }}
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

export default LivePreviewContainer
