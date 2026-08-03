import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Activity, Camera, CircleDot, Crosshair, EyeOff, Layers, MonitorUp, Music, Plus, Radio, RotateCw, Save, Sparkles, Trash2, Waves } from 'lucide-react'
import { DEFAULT_SURFACE, createInsetSurface } from '../mapping/MappingCompositor'
import { DEFAULT_VISUAL_ID, VISUALS } from '../visuals/visualRegistry'
import { useAudioStore } from '../store/audioStore'
import { useNowPlaying } from '../hooks/useNowPlaying'
import { useNowPlayingStore } from '../metadata/nowPlayingStore'

const MAX_STUDIO_ZONES = 5
const MUSIC_LAYER_IDS = ['nowPlayingCard', 'musicEqualizer', 'bassPulse']
const DEFAULT_REFERENCE_POINTS = [
    { id: 'tl', x: 0.08, y: 0.08, label: 'A' },
    { id: 'tr', x: 0.92, y: 0.08, label: 'B' },
    { id: 'br', x: 0.92, y: 0.92, label: 'C' },
    { id: 'bl', x: 0.08, y: 0.92, label: 'D' }
]

const CONTENT_GROUPS = [
    {
        title: 'Safe output',
        items: [
            { id: 'blackNeutral', label: 'Black / Neutral', description: 'No light from this zone.', icon: CircleDot }
        ]
    },
    {
        title: 'Music layers',
        items: [
            { id: 'nowPlayingCard', label: 'Now Playing Card', description: 'Track card mapped into this zone.', icon: Music },
            { id: 'musicEqualizer', label: 'Frequency Equalizer', description: '16-band spectral bars from the shared audio engine.', icon: Activity },
            { id: 'bassPulse', label: 'Bass Pulse', description: 'Kick/bass rings for edges, ceiling, or side panels.', icon: Radio }
        ]
    },
    {
        title: 'Visual library',
        items: VISUALS
            .filter(visual => !['blackNeutral', ...MUSIC_LAYER_IDS].includes(visual.id))
            .map(visual => ({ ...visual, description: 'Existing live visual source.', icon: Sparkles }))
    }
]

const formatDegrees = (radians = 0) => Math.round((((radians * 180) / Math.PI) % 360 + 360) % 360)
const degreesToRadians = (degrees) => (((Number(degrees) || 0) * Math.PI) / 180)
const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0))
const clampPoint = (point) => ({ x: clamp01(point.x), y: clamp01(point.y) })

const getVisualLabel = (visualId) => VISUALS.find(visual => visual.id === visualId)?.label || visualId || 'Unknown'
const pointsForSurface = (surface) => surface.corners.map(point => `${point.x * 100},${point.y * 100}`).join(' ')

const getLayerColor = (visualId) => {
    if (visualId === 'blackNeutral') return '#050505'
    if (visualId === 'nowPlayingCard') return '#ff2d75'
    if (visualId === 'musicEqualizer') return '#00f5ff'
    if (visualId === 'bassPulse') return '#ff8a00'
    if (visualId === 'poseSkeleton') return '#00ff88'
    return '#8b5cf6'
}

const ProjectorStudioPage = () => {
    useNowPlaying()
    const svgRef = useRef(null)
    const videoRef = useRef(null)
    const cameraStreamRef = useRef(null)
    const cameraRequestIdRef = useRef(0)
    const mountedRef = useRef(true)
    const audioFrame = useAudioStore(state => state.audioFrame)
    const nowPlaying = useNowPlayingStore(state => state.nowPlaying)
    const [surfaces, setSurfaces] = useState([DEFAULT_SURFACE])
    const [selectedSurfaceId, setSelectedSurfaceId] = useState(DEFAULT_SURFACE.id)
    const [projectorStatus, setProjectorStatus] = useState({ connected: false, displayId: null })
    const [presetName, setPresetName] = useState('Studio Beta')
    const [message, setMessage] = useState('Select a zone, choose a layer, see what will be projected.')
    const [dragging, setDragging] = useState(null)
    const [cameraStream, setCameraStream] = useState(null)
    const [cameraStatus, setCameraStatus] = useState('Camera background off.')
    const [referencePoints, setReferencePoints] = useState(DEFAULT_REFERENCE_POINTS)

    useEffect(() => {
        const unsubscribe = window.mapping?.onSurfacesChanged((updated) => {
            if (!Array.isArray(updated) || updated.length === 0) return
            setSurfaces(updated)
            setSelectedSurfaceId(current => (updated.some(surface => surface.id === current) ? current : updated[0].id))
        })
        return () => unsubscribe?.()
    }, [])

    useEffect(() => {
        let cancelled = false
        ;(async () => {
            const cached = await window.mapping?.getSurfaces?.()
            if (!cancelled && Array.isArray(cached) && cached.length > 0) {
                setSurfaces(cached)
                setSelectedSurfaceId(current => (cached.some(surface => surface.id === current) ? current : cached[0].id))
            }
        })()
        return () => { cancelled = true }
    }, [])

    useEffect(() => {
        const unsubscribe = window.projector?.onStatusChanged((payload) => {
            setProjectorStatus(payload || { connected: false, displayId: null })
        })
        return () => unsubscribe?.()
    }, [])

    useEffect(() => {
        let cancelled = false
        ;(async () => {
            const state = await window.projector?.getState?.()
            if (!cancelled && state) {
                setProjectorStatus({
                    connected: Boolean(state.connected),
                    displayId: state.displayId ?? null
                })
            }
        })()
        return () => { cancelled = true }
    }, [])

    useEffect(() => {
        cameraStreamRef.current = cameraStream
        if (videoRef.current) videoRef.current.srcObject = cameraStream
        return () => {
            if (videoRef.current) videoRef.current.srcObject = null
        }
    }, [cameraStream])

    useEffect(() => () => {
        mountedRef.current = false
        cameraRequestIdRef.current += 1
        cameraStreamRef.current?.getTracks().forEach(track => track.stop())
    }, [])

    const selectedSurface = surfaces.find(surface => surface.id === selectedSurfaceId) || surfaces[0] || DEFAULT_SURFACE
    const selectedVisualId = selectedSurface.visualId || DEFAULT_VISUAL_ID
    const selectedLayerColor = getLayerColor(selectedVisualId)
    const spectral = Array.isArray(audioFrame?.spectral) ? audioFrame.spectral : []
    const bass = clamp01(audioFrame?.levels?.bass)
    const volume = clamp01(audioFrame?.levels?.volume)
    const activeZones = surfaces.filter(surface => (surface.visualId || DEFAULT_VISUAL_ID) !== 'blackNeutral').length
    const cameraActive = Boolean(cameraStream)

    const studioSummary = useMemo(() => {
        const counts = surfaces.reduce((acc, surface) => {
            const visualId = surface.visualId || DEFAULT_VISUAL_ID
            acc[visualId] = (acc[visualId] || 0) + 1
            return acc
        }, {})
        return Object.entries(counts)
            .map(([visualId, count]) => `${count}× ${getVisualLabel(visualId)}`)
            .join(' · ')
    }, [surfaces])

    const eventToPoint = (event) => {
        const svg = svgRef.current
        if (!svg) return null
        const rect = svg.getBoundingClientRect()
        return clampPoint({
            x: (event.clientX - rect.left) / rect.width,
            y: (event.clientY - rect.top) / rect.height
        })
    }

    const pushSurfaces = (next, nextMessage = 'Studio layout sent to projector.') => {
        setSurfaces(next)
        window.mapping?.setSurfaces?.(next)
        setMessage(nextMessage)
    }

    const updateSelectedSurface = (patch, nextMessage) => {
        pushSurfaces(
            surfaces.map(surface => (surface.id === selectedSurface.id ? { ...surface, ...patch } : surface)),
            nextMessage
        )
    }

    const updateSurfaceGeometry = (surfaceId, corners, nextMessage) => {
        pushSurfaces(
            surfaces.map(surface => (surface.id === surfaceId ? { ...surface, corners } : surface)),
            nextMessage
        )
    }

    const handleLayerSelect = (visualId) => {
        window.projector?.setBlackout?.(false)
        window.projector?.setTestPattern?.(false)
        window.projector?.setNowPlayingOverlay?.(false)
        updateSelectedSurface(
            { visualId },
            `${selectedSurface.name} is now ${getVisualLabel(visualId)}.`
        )
    }

    const handleRotationChange = (degrees) => {
        updateSelectedSurface(
            { rotation: degreesToRadians(degrees) },
            `${selectedSurface.name} rotation set to ${Math.round(Number(degrees) || 0)}°.`
        )
    }

    const handleFeatherChange = (value) => {
        updateSelectedSurface(
            { feather: Math.max(0, Math.min(0.45, Number(value) || 0)) },
            `${selectedSurface.name} edge feather updated.`
        )
    }

    const handleRename = (name) => {
        updateSelectedSurface({ name }, 'Zone name updated.')
    }

    const handleAddSurface = () => {
        if (surfaces.length >= MAX_STUDIO_ZONES) {
            setMessage(`Studio MVP supports up to ${MAX_STUDIO_ZONES} zones.`)
            return
        }
        const nextSurface = createInsetSurface(selectedSurface?.corners)
        const next = [...surfaces, { ...nextSurface, name: `Zone ${surfaces.length + 1}`, visualId: 'blackNeutral' }]
        setSelectedSurfaceId(nextSurface.id)
        pushSurfaces(next, 'Added a new neutral zone. Drag its corners in the preview.')
    }

    const handleRemoveSurface = () => {
        if (surfaces.length <= 1) return
        const next = surfaces.filter(surface => surface.id !== selectedSurface.id)
        setSelectedSurfaceId(next[0].id)
        pushSurfaces(next, 'Removed zone from Studio layout.')
    }

    const handleOpenProjector = async () => {
        if (projectorStatus.connected) {
            window.mapping?.setSurfaces?.(surfaces)
            setMessage('Projector is already live. Studio layout refreshed.')
            return
        }

        const result = await window.projector?.open?.()
        if (result?.ok) {
            setProjectorStatus({ connected: true, displayId: result.displayId })
            setMessage('Projector opened. Studio layout is live.')
            window.mapping?.setSurfaces?.(surfaces)
        }
    }

    const handleProjectTestSignal = async () => {
        if (!projectorStatus.connected) {
            const result = await window.projector?.open?.()
            if (result?.ok) setProjectorStatus({ connected: true, displayId: result.displayId })
        }
        window.projector?.setBlackout?.(false)
        window.projector?.setNowPlayingOverlay?.(false)
        window.projector?.setTestPattern?.(true)
        setMessage('Projecting test signal. Point the webcam at the wall and align the zones over the camera image.')
    }

    const handleClearTestSignal = () => {
        window.projector?.setTestPattern?.(false)
        setMessage('Test signal cleared. Studio layout remains active.')
    }

    const handleStartCamera = async () => {
        if (!navigator.mediaDevices?.getUserMedia) {
            setCameraStatus('Camera API is not available here.')
            return
        }

        const requestId = cameraRequestIdRef.current + 1
        cameraRequestIdRef.current = requestId

        try {
            cameraStreamRef.current?.getTracks().forEach(track => track.stop())
            cameraStreamRef.current = null
            setCameraStream(null)
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
            if (!mountedRef.current || cameraRequestIdRef.current !== requestId) {
                stream.getTracks().forEach(track => track.stop())
                return
            }
            cameraStreamRef.current = stream
            setCameraStream(stream)
            setCameraStatus('Camera background on. Aim it at the projection surface.')
            setMessage('Camera background enabled. Drag zones and reference points over the real wall.')
        } catch (error) {
            if (!mountedRef.current || cameraRequestIdRef.current !== requestId) return
            setCameraStatus(error?.name === 'NotAllowedError'
                ? 'Camera access denied. Allow webcam access and try again.'
                : `Camera failed: ${error?.message || 'unknown error'}`)
        }
    }

    const handleStopCamera = () => {
        cameraRequestIdRef.current += 1
        cameraStreamRef.current?.getTracks().forEach(track => track.stop())
        cameraStreamRef.current = null
        setCameraStream(null)
        setCameraStatus('Camera background off.')
    }

    const handleSavePreset = async () => {
        if (!presetName.trim()) return
        await window.mapping?.savePreset?.({ name: presetName.trim(), surfaces })
        setMessage(`Saved mapping preset: ${presetName.trim()}.`)
    }

    const handlePointerDownSurface = (event, surface) => {
        const startPoint = eventToPoint(event)
        if (!startPoint) return
        event.preventDefault()
        setSelectedSurfaceId(surface.id)
        setDragging({ type: 'surface', surfaceId: surface.id, startPoint, originalCorners: surface.corners })
    }

    const handlePointerDownCorner = (event, surface, cornerIndex) => {
        const startPoint = eventToPoint(event)
        if (!startPoint) return
        event.preventDefault()
        event.stopPropagation()
        setSelectedSurfaceId(surface.id)
        setDragging({ type: 'corner', surfaceId: surface.id, cornerIndex })
    }

    const handlePointerDownReference = (event, referenceId) => {
        event.preventDefault()
        event.stopPropagation()
        setDragging({ type: 'reference', referenceId })
    }

    const handlePointerMove = (event) => {
        if (!dragging) return
        const point = eventToPoint(event)
        if (!point) return

        if (dragging.type === 'corner') {
            const surface = surfaces.find(item => item.id === dragging.surfaceId)
            if (!surface) return
            const corners = surface.corners.map((corner, index) => (
                index === dragging.cornerIndex ? point : corner
            ))
            updateSurfaceGeometry(surface.id, corners, 'Zone corner moved. Projector layout updated live.')
            return
        }

        if (dragging.type === 'surface') {
            const dx = point.x - dragging.startPoint.x
            const dy = point.y - dragging.startPoint.y
            const corners = dragging.originalCorners.map(corner => clampPoint({ x: corner.x + dx, y: corner.y + dy }))
            updateSurfaceGeometry(dragging.surfaceId, corners, 'Zone moved. Projector layout updated live.')
            return
        }

        if (dragging.type === 'reference') {
            setReferencePoints(points => points.map(reference => (
                reference.id === dragging.referenceId ? { ...reference, ...point } : reference
            )))
            setMessage('Reference point moved. Use it to line up camera view and projected test pattern.')
        }
    }

    const handlePointerUp = () => {
        setDragging(null)
    }

    return (
        <div className="page projector-studio-page">
            <div className="studio-hero glass-card">
                <div>
                    <div className="studio-eyebrow">Projector Studio Beta</div>
                    <h2>Visual editor for mapped zones</h2>
                    <p>Build the projector like a scene: draw up to five zones, assign music layers, rotate them, and align the layout over a live camera background.</p>
                </div>
                <div className="studio-live-stack">
                    <div className={`studio-live-pill ${projectorStatus.connected ? 'online' : ''}`}>
                        {projectorStatus.connected ? `LIVE · Display ${projectorStatus.displayId ?? 'active'}` : 'Projector closed'}
                    </div>
                    <div className="studio-live-pill">{surfaces.length}/{MAX_STUDIO_ZONES} zones</div>
                    <div className="studio-live-pill">{activeZones}/{surfaces.length} emitting</div>
                    <div className="studio-live-pill">Bass {Math.round(bass * 100)}%</div>
                </div>
            </div>

            <div className="studio-grid">
                <aside className="studio-panel glass-card">
                    <div className="studio-panel-header">
                        <Layers size={18} />
                        <h3>Zones</h3>
                    </div>
                    <div className="studio-zone-list">
                        {surfaces.map((surface, index) => {
                            const visualId = surface.visualId || DEFAULT_VISUAL_ID
                            const isSelected = surface.id === selectedSurface.id
                            return (
                                <button
                                    key={surface.id}
                                    className={`studio-zone-row ${isSelected ? 'active' : ''}`}
                                    onClick={() => setSelectedSurfaceId(surface.id)}
                                >
                                    <span className="studio-zone-index">{index + 1}</span>
                                    <span>
                                        <strong>{surface.name}</strong>
                                        <small>{getVisualLabel(visualId)}</small>
                                    </span>
                                    <span className="studio-zone-dot" style={{ background: getLayerColor(visualId) }} />
                                </button>
                            )
                        })}
                    </div>
                    <div className="studio-actions-row">
                        <button className="action-button active studio-action" onClick={handleAddSurface} disabled={surfaces.length >= MAX_STUDIO_ZONES}>
                            <Plus size={15} /> Add zone
                        </button>
                        <button className="action-button stop studio-action" onClick={handleRemoveSurface} disabled={surfaces.length <= 1}>
                            <Trash2 size={15} /> Remove
                        </button>
                    </div>

                    <div className="studio-camera-card">
                        <div className="studio-panel-header compact">
                            <Camera size={17} />
                            <h3>Camera alignment</h3>
                        </div>
                        <p>{cameraStatus}</p>
                        <div className="studio-actions-row">
                            <button className="action-button active studio-action" onClick={handleStartCamera}>
                                <Camera size={15} /> Camera
                            </button>
                            <button className="action-button stop studio-action" onClick={handleStopCamera} disabled={!cameraActive}>
                                <EyeOff size={15} /> Off
                            </button>
                        </div>
                        <div className="studio-actions-row">
                            <button className="action-button active studio-action" onClick={handleProjectTestSignal}>
                                <Crosshair size={15} /> Test signal
                            </button>
                            <button className="action-button studio-action" onClick={handleClearTestSignal}>
                                Clear
                            </button>
                        </div>
                    </div>
                </aside>

                <main className="studio-preview-card glass-card">
                    <div className="studio-preview-header">
                        <div>
                            <h3>What the projector will see</h3>
                            <p>{studioSummary}</p>
                        </div>
                        <button className="action-button active" onClick={handleOpenProjector}>
                            <MonitorUp size={16} /> Open projector
                        </button>
                    </div>

                    <div className={`studio-preview-stage ${cameraActive ? 'camera-on' : ''}`}>
                        <video ref={videoRef} className="studio-camera-feed" autoPlay muted playsInline />
                        <svg
                            ref={svgRef}
                            viewBox="0 0 100 100"
                            preserveAspectRatio="none"
                            className="studio-preview-svg"
                            onPointerMove={handlePointerMove}
                            onPointerUp={handlePointerUp}
                            onPointerLeave={handlePointerUp}
                        >
                            <defs>
                                <linearGradient id="studio-grid-glow" x1="0" y1="0" x2="1" y2="1">
                                    <stop offset="0" stopColor="#ff2d75" stopOpacity="0.16" />
                                    <stop offset="0.55" stopColor="#8b5cf6" stopOpacity="0.1" />
                                    <stop offset="1" stopColor="#00f5ff" stopOpacity="0.14" />
                                </linearGradient>
                            </defs>
                            <rect x="0" y="0" width="100" height="100" fill={cameraActive ? 'rgba(0,0,0,0.2)' : 'url(#studio-grid-glow)'} />
                            {[25, 50, 75].map(pos => (
                                <React.Fragment key={pos}>
                                    <line x1={pos} y1="0" x2={pos} y2="100" stroke="rgba(255,255,255,0.1)" strokeWidth="0.15" />
                                    <line x1="0" y1={pos} x2="100" y2={pos} stroke="rgba(255,255,255,0.1)" strokeWidth="0.15" />
                                </React.Fragment>
                            ))}

                            {surfaces.map((surface) => {
                                const visualId = surface.visualId || DEFAULT_VISUAL_ID
                                const isSelected = surface.id === selectedSurface.id
                                const color = getLayerColor(visualId)
                                return (
                                    <polygon
                                        key={surface.id}
                                        points={pointsForSurface(surface)}
                                        fill={visualId === 'blackNeutral' ? 'rgba(0,0,0,0.62)' : `${color}33`}
                                        stroke={isSelected ? '#fff' : color}
                                        strokeWidth={isSelected ? 0.85 : 0.32}
                                        vectorEffect="non-scaling-stroke"
                                        onPointerDown={(event) => handlePointerDownSurface(event, surface)}
                                        style={{ cursor: isSelected ? 'move' : 'pointer' }}
                                    />
                                )
                            })}

                            {selectedSurface.corners.map((corner, index) => (
                                <g key={`${selectedSurface.id}-${index}`}>
                                    <circle
                                        cx={corner.x * 100}
                                        cy={corner.y * 100}
                                        r="1.55"
                                        fill="#00ff88"
                                        stroke="#001b12"
                                        strokeWidth="0.45"
                                        vectorEffect="non-scaling-stroke"
                                        onPointerDown={(event) => handlePointerDownCorner(event, selectedSurface, index)}
                                        style={{ cursor: 'grab' }}
                                    />
                                    <text x={corner.x * 100 + 1.7} y={corner.y * 100 - 1.2} fill="#fff" fontSize="2.7" fontWeight="800">
                                        {index + 1}
                                    </text>
                                </g>
                            ))}

                            {cameraActive && referencePoints.map(point => (
                                <g key={point.id} onPointerDown={(event) => handlePointerDownReference(event, point.id)} style={{ cursor: 'grab' }}>
                                    <line x1={point.x * 100 - 2.6} y1={point.y * 100} x2={point.x * 100 + 2.6} y2={point.y * 100} stroke="#ff9f0a" strokeWidth="0.55" vectorEffect="non-scaling-stroke" />
                                    <line x1={point.x * 100} y1={point.y * 100 - 2.6} x2={point.x * 100} y2={point.y * 100 + 2.6} stroke="#ff9f0a" strokeWidth="0.55" vectorEffect="non-scaling-stroke" />
                                    <circle cx={point.x * 100} cy={point.y * 100} r="1.8" fill="rgba(255,159,10,0.22)" stroke="#ff9f0a" strokeWidth="0.35" vectorEffect="non-scaling-stroke" />
                                    <text x={point.x * 100 + 2.1} y={point.y * 100 - 2.1} fill="#ffcf7a" fontSize="3" fontWeight="900">{point.label}</text>
                                </g>
                            ))}
                        </svg>

                        <div className="studio-preview-overlay">
                            {selectedVisualId === 'nowPlayingCard' && (
                                <div className="studio-nowplaying-preview" style={{ transform: `rotate(${formatDegrees(selectedSurface.rotation)}deg)` }}>
                                    <div className="studio-artwork-placeholder">♪</div>
                                    <strong>{nowPlaying.title || 'No active track'}</strong>
                                    <span>{nowPlaying.artist || 'Start music to fill this card'}</span>
                                </div>
                            )}

                            {selectedVisualId === 'musicEqualizer' && (
                                <div className="studio-eq-preview">
                                    {new Array(16).fill(0).map((_, index) => (
                                        <span key={index} style={{ height: `${12 + clamp01(spectral[index]) * 88}%` }} />
                                    ))}
                                </div>
                            )}

                            {selectedVisualId === 'bassPulse' && (
                                <div className="studio-bass-preview" style={{ '--bass': bass }}>
                                    <span />
                                    <span />
                                    <span />
                                </div>
                            )}

                            {!MUSIC_LAYER_IDS.includes(selectedVisualId) && selectedVisualId !== 'blackNeutral' && (
                                <div className="studio-visual-preview" style={{ '--layer-color': selectedLayerColor }}>
                                    <Waves size={46} />
                                    <strong>{getVisualLabel(selectedVisualId)}</strong>
                                    <span>Live visual source</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="studio-status-strip">
                        <span>{message}</span>
                        <span>Drag corners to shape zones. Drag inside a zone to move it.</span>
                        <span>Volume {Math.round(volume * 100)}%</span>
                    </div>
                </main>

                <aside className="studio-panel glass-card">
                    <div className="studio-panel-header">
                        <Sparkles size={18} />
                        <h3>Inspector</h3>
                    </div>

                    <label className="studio-field-label">Selected zone</label>
                    <input className="system-select studio-input" value={selectedSurface.name || ''} onChange={(event) => handleRename(event.target.value)} />

                    <div className="studio-layer-groups">
                        {CONTENT_GROUPS.map(group => (
                            <section key={group.title}>
                                <h4>{group.title}</h4>
                                <div className="studio-layer-list">
                                    {group.items.map(item => {
                                        const Icon = item.icon || Sparkles
                                        const isActive = selectedVisualId === item.id
                                        return (
                                            <button key={item.id} className={`studio-layer-button ${isActive ? 'active' : ''}`} onClick={() => handleLayerSelect(item.id)}>
                                                <Icon size={16} />
                                                <span>
                                                    <strong>{item.label}</strong>
                                                    <small>{item.description}</small>
                                                </span>
                                            </button>
                                        )
                                    })}
                                </div>
                            </section>
                        ))}
                    </div>

                    <div className="studio-control-block">
                        <label><RotateCw size={15} /> Rotation ({formatDegrees(selectedSurface.rotation)}°)</label>
                        <input type="range" min={0} max={359} step={1} value={formatDegrees(selectedSurface.rotation)} onChange={(event) => handleRotationChange(event.target.value)} />
                        <div className="studio-quick-buttons">
                            {[0, 90, 180, 270].map(degrees => (
                                <button key={degrees} className={`bgr-toggle ${formatDegrees(selectedSurface.rotation) === degrees ? 'active' : ''}`} onClick={() => handleRotationChange(degrees)}>
                                    {degrees}°
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="studio-control-block">
                        <label>Edge feather ({Number(selectedSurface.feather || 0).toFixed(2)})</label>
                        <input type="range" min={0} max={0.45} step={0.01} value={selectedSurface.feather || 0} onChange={(event) => handleFeatherChange(event.target.value)} />
                    </div>

                    <div className="studio-save-row">
                        <input className="system-select studio-input" value={presetName} onChange={(event) => setPresetName(event.target.value)} placeholder="Preset name" />
                        <button className="action-button active" onClick={handleSavePreset}><Save size={15} /> Save</button>
                    </div>
                </aside>
            </div>
        </div>
    )
}

export default ProjectorStudioPage
