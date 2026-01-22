import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, Music, Sliders } from 'lucide-react'
import LivePreviewContainer from '../components/LivePreviewContainer'
import { useDmxStore } from '../store/dmxStore'
import { useConfigStore } from '../store/configStore'
import { useAudioStore } from '../store/audioStore'
import { useSystemAudio } from '../hooks/useSystemAudio'
import { DYNAMIC_SCENES, FLAGS } from '../utils/palettes'
import { DYNAMIC_SCENE_ICONS } from '../utils/constants'
import { generateLightScene } from '../services/geminiService'
import { compileAIResponse, executeAIScene } from '../utils/aiRuntime'

const DynamicScenesPageV2 = () => {
    // Stores
    const dmxUniverseState = useDmxStore(state => state.dmxUniverseState)
    const dispatchDmxAttributeUpdate = useDmxStore(state => state.dispatchDmxAttributeUpdate)
    const dispatchBulkDmxUpdate = useDmxStore(state => state.dispatchBulkDmxUpdate)
    const activeDynamicScene = useDmxStore(state => state.activeDynamicScene)
    const setActiveDynamicScene = useDmxStore(state => state.setActiveDynamicScene)
    const dmxFixtures = useDmxStore(state => state.dmxFixtures)
    const pixelMapBuffer = useDmxStore(state => state.pixelMapBuffer)
    const toggleBlackout = useDmxStore(state => state.toggleBlackout)
    const config = useConfigStore(state => state.config)

    const audioTelemetryDSP = useAudioStore(state => state.audioTelemetryDSP)
    const setAudioTelemetryDSP = useAudioStore(state => state.setAudioTelemetryDSP)
    const setAudioData = useAudioStore(state => state.setAudioData)

    const dynamicScenes = config?.dynamicScenes || []

    // Page Local State
    const [audioReactive, setAudioReactive] = useState(false)
    const [sensitivity, setSensitivity] = useState(70)
    const [activeFlag, setActiveFlag] = useState(null)
    const [sceneColors, setSceneColors] = useState([{ r: 0, g: 0, b: 0 }, { r: 0, g: 0, b: 0 }, { r: 0, g: 0, b: 0 }])
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

    const dispatchPixelMapUpdate = useCallback((colors) => {
        window.ambilight?.setColorsAsync({ colors })
        // We use dmxStore to track live colors for preview
        useDmxStore.getState().setPixelMapBuffer(colors)
    }, [])

    const handleAiGenerate = async (promptType = "surprise") => {
        setIsGenerating(true)
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

    const { start: startAudio, stop: stopAudio, energyFactor, visualizerData, setModifierMode } = useSystemAudio(
        dispatchPixelMapUpdate,
        colorsForAudio,
        setAudioTelemetryDSP
    )

    useEffect(() => {
        window.currentBassLevel = visualizerData.bass
        setAudioData({ visualizerData })
    }, [visualizerData, setAudioData])

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
            setActiveDynamicScene(null)
            setPreviewScene(null)
            if (!audioReactive) {
                const flag = FLAGS[flagId]
                if (flag) dispatchPixelMapUpdate(flag.colors)
            }
        }
    }

    const handleSelect = async (sceneId) => {
        setActiveFlag(null)
        if (activeDynamicScene === sceneId) {
            await window.dmx?.dynamicScene(sceneId, false)
            setActiveDynamicScene(null)
            dispatchBulkDmxUpdate({ red: 0, green: 0, blue: 0, func: 0, spd: 0, flash: 0, dim: 0 })
        } else {
            await window.dmx?.dynamicScene(sceneId, true)
            setActiveDynamicScene(sceneId)
            dispatchDmxAttributeUpdate('dim', 255)
        }
    }

    return (
        <div className="page dynamic-page-v2">
            <div className="dynamic-workspace">
                <div className="dynamic-console">
                    <div className="dynamic-scroll-area">
                        <div className="section-header-slim">
                            <span className="section-title">Dynamic Scenes</span>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
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
                                    <Music size={14} />
                                    <span>AUDIO REACTIVE {audioReactive ? 'ON' : 'OFF'}</span>
                                    {audioReactive && <span style={{ opacity: 0.7, marginLeft: '4px' }}>x{energyFactor.toFixed(1)}</span>}
                                </div>
                            </div>
                        </div>

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

                        <div className="scenes-grid-slim">
                            {dynamicScenes.map(scene => {
                                const Icon = DYNAMIC_SCENE_ICONS[scene.id] || Sparkles
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

                        <div className="section-header-slim" style={{ marginTop: '24px' }}>
                            <span className="section-title" style={{ fontSize: '14px' }}>Reactive Flags</span>
                        </div>

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
                        <span style={{ fontSize: '10px', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '6px' }}>
                            Powered by Google Gemini 2.0 Flash
                        </span>
                    </div>
                </div>

                <div className="programs-sidebar">
                    <div className="sidebar-control-group">
                        <span className="control-label">MASTER DIMMER</span>
                        <input
                            type="range" min="0" max="255"
                            value={dmxUniverseState.dim}
                            onChange={(e) => dispatchDmxAttributeUpdate('dim', parseInt(e.target.value))}
                            className="big-slider"
                            style={{ height: '8px', marginBottom: '12px' }}
                        />
                    </div>
                    <LivePreviewContainer
                        fixtures={dmxFixtures}
                        masterDimmer={dmxUniverseState.dim}
                        onToggleFixture={toggleBlackout}
                    />

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

export default DynamicScenesPageV2
