import React, { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Activity, CircleDot, Layers, MonitorUp, Music, Plus, Radio, RotateCw, Save, Sparkles, Trash2, Waves } from 'lucide-react'
import { DEFAULT_SURFACE, createInsetSurface } from '../mapping/MappingCompositor'
import { DEFAULT_VISUAL_ID, VISUALS } from '../visuals/visualRegistry'
import { useAudioStore } from '../store/audioStore'
import { useNowPlaying } from '../hooks/useNowPlaying'
import { useNowPlayingStore } from '../metadata/nowPlayingStore'

const MUSIC_LAYER_IDS = ['nowPlayingCard', 'musicEqualizer', 'bassPulse']

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
    const audioFrame = useAudioStore(state => state.audioFrame)
    const nowPlaying = useNowPlayingStore(state => state.nowPlaying)
    const [surfaces, setSurfaces] = useState([DEFAULT_SURFACE])
    const [selectedSurfaceId, setSelectedSurfaceId] = useState(DEFAULT_SURFACE.id)
    const [projectorStatus, setProjectorStatus] = useState({ connected: false, displayId: null })
    const [presetName, setPresetName] = useState('Studio Beta')
    const [message, setMessage] = useState('Select a zone, choose a layer, see what will be projected.')

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

            const state = await window.projector?.getState?.()
            if (!cancelled && state) {
                setProjectorStatus({ connected: Boolean(state.connected), displayId: state.displayId || null })
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

    const selectedSurface = surfaces.find(surface => surface.id === selectedSurfaceId) || surfaces[0] || DEFAULT_SURFACE
    const selectedVisualId = selectedSurface.visualId || DEFAULT_VISUAL_ID
    const selectedLayerColor = getLayerColor(selectedVisualId)
    const spectral = Array.isArray(audioFrame?.spectral) ? audioFrame.spectral : []
    const bass = clamp01(audioFrame?.levels?.bass)
    const volume = clamp01(audioFrame?.levels?.volume)
    const activeZones = surfaces.filter(surface => (surface.visualId || DEFAULT_VISUAL_ID) !== 'blackNeutral').length

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
        const nextSurface = createInsetSurface(selectedSurface?.corners)
        const next = [...surfaces, { ...nextSurface, visualId: 'blackNeutral' }]
        setSelectedSurfaceId(nextSurface.id)
        pushSurfaces(next, 'Added a new neutral zone. Choose its layer next.')
    }

    const handleRemoveSurface = () => {
        if (surfaces.length <= 1) return
        const next = surfaces.filter(surface => surface.id !== selectedSurface.id)
        setSelectedSurfaceId(next[0].id)
        pushSurfaces(next, 'Removed zone from Studio layout.')
    }

    const handleOpenProjector = async () => {
        const result = await window.projector?.open?.()
        if (result?.ok) {
            setProjectorStatus({ connected: true, displayId: result.displayId })
            setMessage('Projector opened. Studio layout is live.')
            window.mapping?.setSurfaces?.(surfaces)
        }
    }

    const handleSavePreset = async () => {
        if (!presetName.trim()) return
        await window.mapping?.savePreset?.({ name: presetName.trim(), surfaces })
        setMessage(`Saved mapping preset: ${presetName.trim()}.`)
    }

    return (
        <div className="page projector-studio-page">
            <div className="studio-hero glass-card">
                <div>
                    <div className="studio-eyebrow">Projector Studio Beta</div>
                    <h2>Visual editor for mapped zones</h2>
                    <p>Build the projector like a scene: choose a zone, assign a layer, rotate it, and see a clear preview before it hits the wall.</p>
                </div>
                <div className="studio-live-stack">
                    <div className={`studio-live-pill ${projectorStatus.connected ? 'online' : ''}`}>
                        {projectorStatus.connected ? `LIVE · Display ${projectorStatus.displayId ?? 'active'}` : 'Projector closed'}
                    </div>
                    <div className="studio-live-pill">{activeZones}/{surfaces.length} zones emitting</div>
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
                        <button className="action-button active studio-action" onClick={handleAddSurface}>
                            <Plus size={15} /> Add zone
                        </button>
                        <button className="action-button stop studio-action" onClick={handleRemoveSurface} disabled={surfaces.length <= 1}>
                            <Trash2 size={15} /> Remove
                        </button>
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

                    <div className="studio-preview-stage">
                        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="studio-preview-svg">
                            <defs>
                                <linearGradient id="studio-grid-glow" x1="0" y1="0" x2="1" y2="1">
                                    <stop offset="0" stopColor="#ff2d75" stopOpacity="0.16" />
                                    <stop offset="0.55" stopColor="#8b5cf6" stopOpacity="0.1" />
                                    <stop offset="1" stopColor="#00f5ff" stopOpacity="0.14" />
                                </linearGradient>
                            </defs>
                            <rect x="0" y="0" width="100" height="100" fill="url(#studio-grid-glow)" />
                            {[25, 50, 75].map(pos => (
                                <React.Fragment key={pos}>
                                    <line x1={pos} y1="0" x2={pos} y2="100" stroke="rgba(255,255,255,0.08)" strokeWidth="0.15" />
                                    <line x1="0" y1={pos} x2="100" y2={pos} stroke="rgba(255,255,255,0.08)" strokeWidth="0.15" />
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
                                        fill={visualId === 'blackNeutral' ? 'rgba(0,0,0,0.86)' : `${color}33`}
                                        stroke={isSelected ? '#fff' : color}
                                        strokeWidth={isSelected ? 0.85 : 0.32}
                                        vectorEffect="non-scaling-stroke"
                                        onClick={() => setSelectedSurfaceId(surface.id)}
                                        style={{ cursor: 'pointer' }}
                                    />
                                )
                            })}
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
                                        <span
                                            key={index}
                                            style={{ height: `${12 + clamp01(spectral[index]) * 88}%` }}
                                        />
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
                        <span>Volume {Math.round(volume * 100)}%</span>
                    </div>
                </main>

                <aside className="studio-panel glass-card">
                    <div className="studio-panel-header">
                        <Sparkles size={18} />
                        <h3>Inspector</h3>
                    </div>

                    <label className="studio-field-label">Selected zone</label>
                    <input
                        className="system-select studio-input"
                        value={selectedSurface.name || ''}
                        onChange={(event) => handleRename(event.target.value)}
                    />

                    <div className="studio-layer-groups">
                        {CONTENT_GROUPS.map(group => (
                            <section key={group.title}>
                                <h4>{group.title}</h4>
                                <div className="studio-layer-list">
                                    {group.items.map(item => {
                                        const Icon = item.icon || Sparkles
                                        const isActive = selectedVisualId === item.id
                                        return (
                                            <button
                                                key={item.id}
                                                className={`studio-layer-button ${isActive ? 'active' : ''}`}
                                                onClick={() => handleLayerSelect(item.id)}
                                            >
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
                        <label>
                            <RotateCw size={15} /> Rotation ({formatDegrees(selectedSurface.rotation)}°)
                        </label>
                        <input
                            type="range"
                            min={0}
                            max={359}
                            step={1}
                            value={formatDegrees(selectedSurface.rotation)}
                            onChange={(event) => handleRotationChange(event.target.value)}
                        />
                        <div className="studio-quick-buttons">
                            {[0, 90, 180, 270].map(degrees => (
                                <button
                                    key={degrees}
                                    className={`bgr-toggle ${formatDegrees(selectedSurface.rotation) === degrees ? 'active' : ''}`}
                                    onClick={() => handleRotationChange(degrees)}
                                >
                                    {degrees}°
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="studio-control-block">
                        <label>Edge feather ({Number(selectedSurface.feather || 0).toFixed(2)})</label>
                        <input
                            type="range"
                            min={0}
                            max={0.45}
                            step={0.01}
                            value={selectedSurface.feather || 0}
                            onChange={(event) => handleFeatherChange(event.target.value)}
                        />
                    </div>

                    <div className="studio-save-row">
                        <input
                            className="system-select studio-input"
                            value={presetName}
                            onChange={(event) => setPresetName(event.target.value)}
                            placeholder="Preset name"
                        />
                        <button className="action-button active" onClick={handleSavePreset}>
                            <Save size={15} /> Save
                        </button>
                    </div>
                </aside>
            </div>
        </div>
    )
}

export default ProjectorStudioPage
