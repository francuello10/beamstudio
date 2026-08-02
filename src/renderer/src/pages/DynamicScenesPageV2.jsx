import React, { useState, useEffect, useCallback } from 'react'
import { Sparkles, Music, Sliders } from 'lucide-react'
import LivePreviewContainer from '../components/LivePreviewContainer'
import { useDmxStore } from '../store/dmxStore'
import { useConfigStore } from '../store/configStore'
import { useAudioStore } from '../store/audioStore'
import { useAudioEngine } from '../audio/AudioEngineContext'
import { DYNAMIC_SCENES, FLAGS } from '../utils/palettes'
import { DYNAMIC_SCENE_ICONS, BUILT_IN_SCENES } from '../utils/constants'
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
    const activeFlag = useDmxStore(state => state.activeFlag)
    const setActiveFlag = useDmxStore(state => state.setActiveFlag)
    const config = useConfigStore(state => state.config)

    const audioTelemetryDSP = useAudioStore(state => state.audioTelemetryDSP)
    const setAudioData = useAudioStore(state => state.setAudioData)
    const setAudioActive = useAudioStore(state => state.setAudioActive)
    const setAudioInputColors = useAudioStore(state => state.setAudioInputColors)
    const setAudioOutputSource = useAudioStore(state => state.setAudioOutputSource)

    // Force use of BUILT_IN_SCENES to ensure new V5.0 scenes are visible
    // ignoring potentially stale config.dynamicScenes
    const dynamicScenes = BUILT_IN_SCENES

    // Page-local intent: "route this page's scene through the shared audio
    // engine as a colorizer". This is NOT the shared engine's on/off (that is
    // useAudioEngine().active, shown/controlled only by the global Header
    // widget now) - it is this page's own claim on 'renderer' DMX output
    // ownership, which is genuinely page-specific and must stay a deliberate,
    // explicit trigger here (see the ownership-claim comment on the toggle
    // handler below).
    const [colorizeWithAudio, setColorizeWithAudio] = useState(false)
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
        window.ambilight?.setColorsAsync({ colors, source: 'renderer' })
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
                    setColorizeWithAudio(true)
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
    }

    // Shared Audio Engine (mounted in App.jsx, never unmounted by navigation).
    // `active` is the ONLY source of truth for whether the engine is actually
    // running - the global Header widget is the sole on/off control now. This
    // page keeps its own `colorizeWithAudio` toggle only to express ITS intent
    // to route the scene through the engine as a colorizer (see the effects
    // below and the toggle handler further down).
    const { start: startAudio, stop: stopAudio, active: audioEngineActive, energyFactor, visualizerData, setModifierMode } = useAudioEngine()

    // True only when this page BOTH wants to colorize (its own toggle) AND the
    // shared engine is actually running. Using `active` here - not just the
    // local toggle - closes the same state-desync gap the engine-hoisting fix
    // targeted at the DMX layer: if the shared engine gets stopped from the
    // global Header widget while this page's toggle is still "on", this flips
    // to false immediately, so the scene falls back to dispatching DMX itself
    // instead of silently waiting on an engine that is no longer running.
    const audioReallyDriving = colorizeWithAudio && audioEngineActive

    useEffect(() => {
        const rendererDriven = !!activeFlag || audioReallyDriving || previewScene?.type === 'DYNAMIC'
        window.dmx?.setDynamicRendererActive(rendererDriven, 'renderer')
        return () => window.dmx?.setDynamicRendererActive(false, 'renderer')
    }, [activeFlag, audioReallyDriving, previewScene])

    useEffect(() => {
        if (!audioReallyDriving && !previewScene) return

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

            // Fix: Dispatch DMX update immediately if not using Audio engine
            if (!audioReallyDriving) {
                dispatchPixelMapUpdate(colors)
            }

            frameId = requestAnimationFrame(updateFrame)
        }

        frameId = requestAnimationFrame(updateFrame)
        return () => {
            if (frameId) cancelAnimationFrame(frameId)
        }
    }, [activeDynamicScene, audioReallyDriving, previewScene])

    let colorsForAudio = sceneColors
    if (previewScene) {
        if (previewScene.type === 'FLAG') colorsForAudio = previewScene.colors
    } else if (activeFlag) {
        colorsForAudio = FLAGS[activeFlag]?.colors
    }

    // Publish this page's live scene frame as the shared engine's modifier input
    // (it used to be a hook argument). sceneColors is replaced ~60fps by the rAF
    // loop above, so this effect re-runs at that rate on purpose. Gated on
    // audioReallyDriving (this page's own colorize intent AND the engine really
    // being active): the engine is shared, so pushing this page's scene frame
    // just because the engine happens to be active for some OTHER reason would
    // hijack the input of audio that another feature started.
    useEffect(() => {
        if (audioReallyDriving) setAudioInputColors(colorsForAudio)
    }, [audioReallyDriving, colorsForAudio, setAudioInputColors])

    // While this page is really driving via audio it owns DMX output as
    // 'renderer' (see the setDynamicRendererActive effect above), so the shared
    // engine must tag ITS writes 'renderer' too or isAsyncOutputSourceAllowed()
    // in src/main/index.js drops them. That also keeps the backend output path
    // identical to what this page had when it passed dispatchPixelMapUpdate:
    // 'renderer' frames respect the Grand Master dimmer and use adaptive
    // smoothing, while 'audio' frames let audio drive the dimmer and slam Slot
    // 2 at factor 1.
    // Both overrides are released when colorizing stops (toggle-off, engine
    // stopped externally, or the page unmounts), so nothing leaks into another
    // feature.
    useEffect(() => {
        if (!audioReallyDriving) return undefined
        setAudioOutputSource('renderer')
        return () => {
            setAudioOutputSource('audio')
            setAudioInputColors(null)
        }
    }, [audioReallyDriving, setAudioOutputSource, setAudioInputColors])

    useEffect(() => {
        window.currentBassLevel = visualizerData.bass
        setAudioData({ visualizerData })
    }, [visualizerData, setAudioData])

    // Deliberate user toggle, so stopAudio() stays. claimsOutput: false because
    // this page already claims DMX output as 'renderer' — letting audio:start
    // claim 'audio' would steal ownership from the page's own claim and every
    // frame would be dropped.
    //
    // NOTE: this toggle is scoped to "colorize THIS page's scene with audio",
    // not the shared engine's global on/off - that now lives solely in the
    // Header widget. Turning this off does stop the shared engine outright
    // (matches the existing behavior this toggle already had before the
    // Header widget existed) rather than just releasing this page's own
    // 'renderer' claim, so avoid relying on this toggle if audio is also being
    // used elsewhere for output claimed as 'audio' - use the Header widget for
    // that instead.
    //
    // Bugfix: branches on audioReallyDriving, not the raw colorizeWithAudio
    // flag - if the shared engine gets stopped externally (Header widget)
    // while this page's toggle is still visually "on", colorizeWithAudio
    // alone would make a click here take the "turn off" branch (matching
    // internal state) even though nothing is actually colorizing any more -
    // confusing, since the operator sees an "ON" pill that isn't doing
    // anything and clicking it just quietly clears a flag. audioReallyDriving
    // reflects reality, so the same click instead correctly restarts
    // colorization in that case.
    const handleColorizeToggle = async () => {
        if (audioReallyDriving) {
            setColorizeWithAudio(false)
            setAudioActive(false)
            setModifierMode(false)
            stopAudio()
        } else {
            setColorizeWithAudio(true)
            setAudioActive(true)
            setModifierMode(true)
            await startAudio({ claimsOutput: false })
        }
    }

    const handleFlagSelect = async (flagId) => {
        if (activeFlag === flagId) {
            // Deselect flag - reset to black
            setActiveFlag(null)
            if (!audioReallyDriving) {
                await window.dmx?.reset()
                dispatchBulkDmxUpdate({ red: 0, green: 0, blue: 0, func: 0, spd: 0, flash: 0, dim: 0 })
            }
        } else {
            // Select new flag
            setActiveFlag(flagId)
            setActiveDynamicScene(null)
            setPreviewScene(null)

            const flag = FLAGS[flagId]
            if (flag) {
                // Send all 3 colors in a single atomic call
                await window.dmx?.setPerFixtureColors(flag.colors)

                // Update UI with the first fixture's color (for fader display)
                const firstColor = flag.colors[0]
                dispatchBulkDmxUpdate({
                    red: firstColor.r,
                    green: firstColor.g,
                    blue: firstColor.b,
                    dim: 255
                })

                // Update pixel map for preview
                dispatchPixelMapUpdate(flag.colors)
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
                                    onClick={handleColorizeToggle}
                                    className="colorize-with-audio-toggle"
                                    title="Route this scene's colors through the shared audio engine as a colorizer. This does not turn the shared engine itself on/off - use the AUDIO widget in the header for that."
                                    style={{
                                        padding: '6px 12px',
                                        borderRadius: '20px',
                                        background: audioReallyDriving ? 'linear-gradient(135deg, #ff0080, #7928ca)' : 'rgba(255,255,255,0.05)',
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
                                    <span>COLORIZE WITH AUDIO {audioReallyDriving ? 'ON' : 'OFF'}</span>
                                    {audioReallyDriving && <span style={{ opacity: 0.7, marginLeft: '4px' }}>x{energyFactor.toFixed(1)}</span>}
                                </div>
                            </div>
                        </div>

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
                                        {isActive && audioReallyDriving && (
                                            <span style={{ fontSize: '10px', opacity: 0.8 }}>x{energyFactor.toFixed(1)}</span>
                                        )}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* AI INPUT — HIDDEN FOR RELEASE
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
                    */}
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
                        isAudioActive={audioEngineActive}
                    />

                    {previewScene && (
                        <div className="active-scene-banner">
                            <div style={{ overflow: 'hidden' }}>
                                <h4 style={{ margin: 0, color: '#0fdbc2', fontSize: '13px' }}>Previewing AI Scene</h4>
                                <span style={{ fontSize: '12px', opacity: 0.7, whiteSpace: 'nowrap', textOverflow: 'ellipsis', display: 'block' }}>{previewScene.name}</span>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                                <button onClick={saveAiScene} className="surprise-btn-small" style={{ background: '#0fdbc2', padding: '6px 10px' }}>SAVE</button>
                                <button onClick={() => { setPreviewScene(null); }} className="surprise-btn-small" style={{ background: 'rgba(255,255,255,0.1)', padding: '6px 10px' }}>X</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default DynamicScenesPageV2
