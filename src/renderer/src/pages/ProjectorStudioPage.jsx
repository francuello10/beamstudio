import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Activity, Camera, CircleDot, Crosshair, EyeOff, Layers, MonitorUp, Music, Plus, Radio, RotateCw, Save, Sparkles, Trash2 } from 'lucide-react'
import { DEFAULT_SURFACE, createInsetSurface } from '../mapping/MappingCompositor'
import { DEFAULT_VISUAL_ID, VISUALS } from '../visuals/visualRegistry'
import { VISUAL_COMPONENTS as STUDIO_PREVIEW_VISUAL_COMPONENTS } from '../visuals/visualComponentRegistry'
import { useAudioStore } from '../store/audioStore'
import { useNowPlaying } from '../hooks/useNowPlaying'

const MAX_STUDIO_ZONES = 12
const NOW_PLAYING_LAYER_IDS = ['nowPlayingCard', 'nowPlayingCover', 'nowPlayingTitle', 'nowPlayingArtist', 'nowPlayingAlbum', 'nowPlayingProgress', 'nowPlayingTime']
const EQUALIZER_LAYER_IDS = ['musicEqualizer', 'musicEqualizerSmooth', 'musicEqualizerExaggerated', 'musicEqualizerWave', 'musicEqualizerRadial']
const BASS_LAYER_IDS = ['bassPulse', 'bassPulseSmooth', 'bassPulseExaggerated']
const MUSIC_LAYER_IDS = [...NOW_PLAYING_LAYER_IDS, ...EQUALIZER_LAYER_IDS, ...BASS_LAYER_IDS]
const MUSIC_SPLIT_PRESET = [
    {
        name: 'Now Playing',
        visualId: 'nowPlayingCard',
        corners: [{ x: 0, y: 0 }, { x: 0.34, y: 0 }, { x: 0.34, y: 1 }, { x: 0, y: 1 }]
    },
    {
        name: 'Frequency EQ',
        visualId: 'musicEqualizer',
        corners: [{ x: 0.34, y: 0 }, { x: 0.68, y: 0 }, { x: 0.68, y: 1 }, { x: 0.34, y: 1 }]
    },
    {
        name: 'Bass Pulse',
        visualId: 'bassPulse',
        corners: [{ x: 0.68, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0.68, y: 1 }]
    }
]
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
        title: 'Now Playing parts',
        items: [
            { id: 'nowPlayingCard', label: 'Full Card', description: 'Cover, title, artist, and progress together.', icon: Music },
            { id: 'nowPlayingCover', label: 'Album Cover', description: 'Only the album artwork.', icon: Music },
            { id: 'nowPlayingTitle', label: 'Track Title', description: 'Only the song name.', icon: Music },
            { id: 'nowPlayingArtist', label: 'Artist Name', description: 'Only the artist.', icon: Music },
            { id: 'nowPlayingAlbum', label: 'Album Name', description: 'Only the album.', icon: Music },
            { id: 'nowPlayingProgress', label: 'Progress Bar', description: 'Only real song progress when available.', icon: Music },
            { id: 'nowPlayingTime', label: 'Song Time', description: 'Elapsed and total time.', icon: Music }
        ]
    },
    {
        title: 'Equalizer models',
        items: [
            { id: 'musicEqualizer', label: 'EQ Standard', description: 'Real spectral bars.', icon: Activity },
            { id: 'musicEqualizerSmooth', label: 'EQ Smooth', description: 'Softer real spectral response.', icon: Activity },
            { id: 'musicEqualizerExaggerated', label: 'EQ Exaggerated', description: 'Amplified real spectral response.', icon: Activity },
            { id: 'musicEqualizerWave', label: 'EQ Wave', description: 'Waveform model from real spectrum.', icon: Activity },
            { id: 'musicEqualizerRadial', label: 'EQ Radial', description: 'Radial spectrum model.', icon: Activity }
        ]
    },
    {
        title: 'Bass pulse models',
        items: [
            { id: 'bassPulse', label: 'Bass Standard', description: 'Real kick/bass rings.', icon: Radio },
            { id: 'bassPulseSmooth', label: 'Bass Smooth', description: 'Softer real bass pulse.', icon: Radio },
            { id: 'bassPulseExaggerated', label: 'Bass Exaggerated', description: 'Amplified real bass pulse.', icon: Radio }
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
const cornersMatch = (a = [], b = []) => a.length === b.length && a.every((point, index) => (
    Math.abs(point.x - b[index].x) < 0.001 && Math.abs(point.y - b[index].y) < 0.001
))

const getVisualLabel = (visualId) => VISUALS.find(visual => visual.id === visualId)?.label || visualId || 'Unknown'
const pointsForSurface = (surface) => surface.corners.map(point => `${point.x * 100},${point.y * 100}`).join(' ')
const clipPathForSurface = (surface) => `polygon(${surface.corners.map(point => `${point.x * 100}% ${point.y * 100}%`).join(', ')})`

const getSurfaceBounds = (surface) => {
    const xs = surface.corners.map(point => point.x * 100)
    const ys = surface.corners.map(point => point.y * 100)
    const left = Math.min(...xs)
    const top = Math.min(...ys)
    const width = Math.max(...xs) - left
    const height = Math.max(...ys) - top
    return { left, top, width: Math.max(width, 8), height: Math.max(height, 8) }
}

const getLayerColor = (visualId) => {
    if (visualId === 'blackNeutral') return '#050505'
    if (NOW_PLAYING_LAYER_IDS.includes(visualId)) return '#ff2d75'
    if (EQUALIZER_LAYER_IDS.includes(visualId)) return '#00f5ff'
    if (BASS_LAYER_IDS.includes(visualId)) return '#ff8a00'
    if (visualId === 'poseSkeleton') return '#00ff88'
    return '#8b5cf6'
}

const createStudioSurface = ({ id, name, corners, visualId }) => ({
    ...DEFAULT_SURFACE,
    id,
    name,
    corners,
    mask: null,
    feather: 0,
    rotation: 0,
    visualId
})

const ProjectorStudioPage = () => {
    useNowPlaying()
    const svgRef = useRef(null)
    const videoRef = useRef(null)
    const cameraStreamRef = useRef(null)
    const cameraRequestIdRef = useRef(0)
    const mountedRef = useRef(true)
    const audioFrame = useAudioStore(state => state.audioFrame)
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

    const handleApplyMusicSplit = () => {
        const now = Date.now()
        const isPristineDefault = surfaces.length === 1 && surfaces[0].id === DEFAULT_SURFACE.id && cornersMatch(surfaces[0].corners, DEFAULT_SURFACE.corners)
        const baseSurfaces = isPristineDefault ? [] : surfaces
        const next = baseSurfaces.map((surface, index) => {
            const preset = MUSIC_SPLIT_PRESET[index]
            return preset ? { ...surface, name: preset.name, visualId: preset.visualId } : surface
        })

        for (let index = next.length; index < MUSIC_SPLIT_PRESET.length; index += 1) {
            const preset = MUSIC_SPLIT_PRESET[index]
            next.push(createStudioSurface({
                id: `studio-music-${now}-${preset.visualId}`,
                name: preset.name,
                visualId: preset.visualId,
                corners: preset.corners
            }))
        }

        setSelectedSurfaceId(next[0].id)
        pushSurfaces(next, isPristineDefault
            ? 'Created a three-zone music layout: Now Playing, EQ, and Bass.'
            : 'Music split applied without deleting existing zone geometry.')
    }

    const handleOpenProjector = async () => {
        window.projector?.setBlackout?.(false)
        window.projector?.setTestPattern?.(false)
        window.projector?.setNowPlayingOverlay?.(false)

        if (projectorStatus.connected) {
            window.mapping?.setSurfaces?.(surfaces)
            setMessage('Projector is already live. Studio preview synced to output.')
            return
        }

        const result = await window.projector?.open?.()
        if (result?.ok) {
            setProjectorStatus({ connected: true, displayId: result.displayId })
            window.projector?.setBlackout?.(false)
            window.projector?.setTestPattern?.(false)
            window.projector?.setNowPlayingOverlay?.(false)
            window.mapping?.setSurfaces?.(surfaces)
            setMessage('Projector opened and synced. The output matches this preview.')
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

    const renderSurfacePreview = (surface, index) => {
        const visualId = surface.visualId || DEFAULT_VISUAL_ID
        const color = getLayerColor(visualId)
        const bounds = getSurfaceBounds(surface)
        const rotation = formatDegrees(surface.rotation)
        const label = `${index + 1} · ${getVisualLabel(visualId)}`
        const layerStyle = {
            position: 'absolute',
            inset: 0,
            clipPath: clipPathForSurface(surface),
            WebkitClipPath: clipPathForSurface(surface),
            background: visualId === 'blackNeutral'
                ? '#000'
                : `radial-gradient(circle at 50% 50%, ${color}66, #050508 58%, #000 100%)`,
            pointerEvents: 'none',
            overflow: 'hidden'
        }
        const contentStyle = {
            position: 'absolute',
            left: `${bounds.left}%`,
            top: `${bounds.top}%`,
            width: `${bounds.width}%`,
            height: `${bounds.height}%`,
            transform: `rotate(${rotation}deg)`,
            transformOrigin: '50% 50%'
        }

        if (visualId === 'blackNeutral') {
            return (
                <div key={surface.id} style={layerStyle}>
                    <div style={{ position: 'absolute', left: `${bounds.left + 2}%`, top: `${bounds.top + 2}%`, color: '#777', fontSize: '12px', fontWeight: 800 }}>
                        {index + 1} · BLACK
                    </div>
                </div>
            )
        }

        const PreviewVisual = STUDIO_PREVIEW_VISUAL_COMPONENTS[visualId]

        return (
            <div key={surface.id} style={layerStyle}>
                <div style={contentStyle}>
                    {PreviewVisual ? (
                        <PreviewVisual active />
                    ) : (
                        <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: '#fff', textAlign: 'center', padding: '10%' }}>
                            <div>
                                <Sparkles size={38} color={color} />
                                <strong style={{ display: 'block', marginTop: 10, fontSize: 'clamp(12px, 1.6vw, 18px)' }}>{getVisualLabel(visualId)}</strong>
                                <span style={{ color: 'rgba(255,255,255,0.62)', fontSize: 11 }}>Preview unavailable</span>
                            </div>
                        </div>
                    )}
                </div>
                <div style={{ position: 'absolute', left: `${bounds.left + 1.2}%`, top: `${bounds.top + 1.2}%`, padding: '5px 8px', borderRadius: 999, background: 'rgba(0,0,0,0.62)', color: '#fff', border: `1px solid ${color}`, fontSize: 11, fontWeight: 900, letterSpacing: '0.03em' }}>
                    {label}
                </div>
            </div>
        )
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
                    <button className="action-button studio-action" onClick={handleApplyMusicSplit} style={{ width: '100%', marginTop: 12 }}>
                        <Music size={15} /> Apply music layers
                    </button>

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
                            <MonitorUp size={16} /> Open / Sync
                        </button>
                    </div>

                    <div className={`studio-preview-stage ${cameraActive ? 'camera-on' : ''}`}>
                        <video ref={videoRef} className="studio-camera-feed" autoPlay muted playsInline />
                        <div style={{ position: 'absolute', inset: 0, background: cameraActive ? 'transparent' : '#000', opacity: cameraActive ? 0.82 : 1 }}>
                            {surfaces.map(renderSurfacePreview)}
                        </div>
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
                            <rect x="0" y="0" width="100" height="100" fill={cameraActive ? 'rgba(0,0,0,0.08)' : 'url(#studio-grid-glow)'} />
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
