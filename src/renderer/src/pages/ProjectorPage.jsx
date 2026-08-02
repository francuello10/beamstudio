import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Projector, Power, EyeOff, Crosshair, RefreshCw, Check, AlertCircle, Move, Layers, Plus, Trash2, Save, FolderOpen, Music, RotateCw } from 'lucide-react'
import { VISUALS } from '../visuals/visualRegistry'
import { DEFAULT_SURFACE, createInsetSurface } from '../mapping/MappingCompositor'

// BS-005: visual library — Fluid Neon exists today, the remaining 3 (Particle
// Field, Tunnel/Grid, Kaleidoscope/Waves) are follow-up work. VISUALS is
// shared with ProjectorApp.jsx via visualRegistry.js so adding one is just
// another entry there, not a locally-duplicated literal.

/**
 * ProjectorPage — operator control surface for the fullscreen projector
 * output window (`?role=projector`). Lists displays, opens/closes the
 * projector window, and drives blackout / test pattern / active visual
 * remotely via IPC.
 *
 * This page never renders inside the projector window itself.
 */
const ProjectorPage = () => {
    const [displays, setDisplays] = useState([])
    const [selectedDisplayId, setSelectedDisplayId] = useState(null)
    const [status, setStatus] = useState({ connected: false, displayId: null })
    const [blackout, setBlackout] = useState(false)
    const [testPattern, setTestPattern] = useState(false)
    // BS-007 phase 2: Now Playing overlay toggle for the projector output.
    const [nowPlayingOverlay, setNowPlayingOverlay] = useState(false)
    const [activeVisual, setActiveVisual] = useState(VISUALS[0].id)
    const [refreshing, setRefreshing] = useState(false)
    // BS-006: projection mapping edit mode — shows/hides the quad-warp
    // corner handles on the projector output.
    const [mappingEditMode, setMappingEditMode] = useState(false)
    // BS-006 phase 2: mirrors MappingCompositor.jsx's live surfaces array
    // (the projector window is the source of truth while dragging happens
    // there) purely for this page's own list/save/load UI. Initialized to
    // the same single default surface so the list isn't empty before the
    // projector window has ever opened and broadcast anything.
    const [surfaces, setSurfaces] = useState([DEFAULT_SURFACE])
    // Selection here is LOCAL to this page (which surface Add/Remove/Rename
    // target) and intentionally independent of MappingCompositor's own
    // selectedSurfaceId (which surface shows drag handles on the projector
    // output) — the task doesn't call for a dedicated selection-sync IPC
    // channel, only the surfaces array itself, so keeping these two
    // "selected" concepts separate avoids inventing one.
    const [selectedSurfaceId, setSelectedSurfaceId] = useState(DEFAULT_SURFACE.id)
    const [presetName, setPresetName] = useState('')
    const [presets, setPresets] = useState([])

    const refreshDisplays = async () => {
        setRefreshing(true)
        try {
            const list = await window.projector?.listDisplays()
            if (list) {
                setDisplays(list)
                setSelectedDisplayId((current) => {
                    if (current && list.some(d => d.id === current)) return current
                    const nonPrimary = list.find(d => !d.isPrimary)
                    return (nonPrimary || list[0])?.id ?? null
                })
            }
        } catch (e) {
            // Listing displays failing is non-fatal; the operator can retry.
        }
        setRefreshing(false)
    }

    useEffect(() => {
        refreshDisplays()

        const unsubDisplaysChanged = window.projector?.onDisplaysChanged((updated) => {
            setDisplays(updated)
        })
        const unsubStatusChanged = window.projector?.onStatusChanged((payload) => {
            setStatus(payload)
        })

        return () => {
            unsubDisplaysChanged?.()
            unsubStatusChanged?.()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const handleOpen = async () => {
        const result = await window.projector?.open(selectedDisplayId)
        if (result?.ok) setStatus({ connected: true, displayId: result.displayId })
    }

    const handleClose = async () => {
        await window.projector?.close()
        setStatus({ connected: false, displayId: null })
    }

    const handleBlackoutToggle = () => {
        const next = !blackout
        setBlackout(next)
        window.projector?.setBlackout(next)
    }

    const handleTestPatternToggle = () => {
        const next = !testPattern
        setTestPattern(next)
        window.projector?.setTestPattern(next)
    }

    const handleNowPlayingOverlayToggle = () => {
        const next = !nowPlayingOverlay
        setNowPlayingOverlay(next)
        window.projector?.setNowPlayingOverlay(next)
    }

    const handleVisualSelect = (visualId) => {
        setActiveVisual(visualId)
        window.projector?.setVisual(visualId)
    }

    const handleMappingEditModeToggle = () => {
        const next = !mappingEditMode
        setMappingEditMode(next)
        window.mapping?.setEditMode(next)
    }

    // BS-006 phase 2: pick up whatever MappingCompositor.jsx (projector
    // window) currently has live — including drag/mask edits made there —
    // so this page's surface list stays in sync. This page never
    // auto-broadcasts on its own `surfaces` state changes; it only calls
    // window.mapping.setSurfaces(...) explicitly inside the handlers below,
    // so there's no feedback-loop risk here (unlike MappingCompositor.jsx,
    // which reacts to every surfaces-state change including this remote one).
    useEffect(() => {
        const unsubSurfacesChanged = window.mapping?.onSurfacesChanged((updated) => {
            if (!Array.isArray(updated) || updated.length === 0) return
            setSurfaces(updated)
            setSelectedSurfaceId((current) => (updated.some(s => s.id === current) ? current : updated[0].id))
        })
        return () => unsubSurfacesChanged?.()
    }, [])

    // BS-006 phase 2 fix: pull the main process's last-known surfaces array
    // on mount, symmetrical to MappingCompositor.jsx's own getSurfaces()
    // pull. Without this, this page stays stuck showing [DEFAULT_SURFACE] if
    // the main window reloads/reopens while the projector window already
    // has a richer multi-surface/masked layout live — that window has no
    // reason to re-broadcast on its own since nothing about ITS surfaces
    // changed, so onSurfacesChanged above would never fire here otherwise.
    useEffect(() => {
        let cancelled = false
        ;(async () => {
            const cached = await window.mapping?.getSurfaces()
            if (cancelled || !Array.isArray(cached) || cached.length === 0) return
            setSurfaces(cached)
            setSelectedSurfaceId((current) => (cached.some(s => s.id === current) ? current : cached[0].id))
        })()
        return () => { cancelled = true }
    }, [])

    const refreshPresets = async () => {
        try {
            const list = await window.mapping?.listPresets()
            if (list) setPresets(list)
        } catch (e) {
            // Listing presets failing is non-fatal.
        }
    }

    useEffect(() => {
        refreshPresets()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const pushSurfaces = (next) => {
        setSurfaces(next)
        window.mapping?.setSurfaces(next)
    }

    const handleAddSurface = () => {
        const lastSurface = surfaces[surfaces.length - 1]
        const newSurface = createInsetSurface(lastSurface?.corners)
        pushSurfaces([...surfaces, newSurface])
        setSelectedSurfaceId(newSurface.id)
    }

    const handleRemoveSurface = () => {
        if (surfaces.length <= 1) return
        const next = surfaces.filter(s => s.id !== selectedSurfaceId)
        pushSurfaces(next)
        setSelectedSurfaceId(next[next.length - 1].id)
    }

    const handleRenameSelected = (name) => {
        pushSurfaces(surfaces.map(s => (s.id === selectedSurfaceId ? { ...s, name } : s)))
    }

    // BS-006 phase 3: per-surface content rotation. Stored on the surface
    // object as radians (consumed directly by MappingCompositor.jsx's
    // uRotation uniform); this page converts to/from degrees only for
    // display, same split as the feather value elsewhere in this feature.
    const handleRotationChange = (degrees) => {
        const rotation = (Number(degrees) * Math.PI) / 180
        pushSurfaces(surfaces.map(s => (s.id === selectedSurfaceId ? { ...s, rotation } : s)))
    }

    const handleSavePreset = async () => {
        if (!presetName.trim()) return
        await window.mapping?.savePreset({ name: presetName.trim(), surfaces })
        await refreshPresets()
    }

    const handleLoadPreset = async (name) => {
        const loaded = await window.mapping?.loadPreset(name)
        if (Array.isArray(loaded) && loaded.length > 0) {
            pushSurfaces(loaded)
            setSelectedSurfaceId(loaded[0].id)
        }
    }

    const handleDeletePreset = async (name) => {
        await window.mapping?.deletePreset(name)
        await refreshPresets()
    }

    const selectedSurface = surfaces.find(s => s.id === selectedSurfaceId) || surfaces[0]
    const rotationDegrees = Math.round((((selectedSurface?.rotation || 0) * 180) / Math.PI) % 360)

    const connectedDisplay = displays.find(d => d.id === status.displayId)

    return (
        <div className="page projector-page">
            <div className="system-grid">
                <div className="glass-card" style={{ gridColumn: '1 / -1' }}>
                    <div className="card-header-icon">
                        <Projector size={20} className="accent-text" />
                        <h3>Projector Output</h3>
                        <span style={{
                            marginLeft: 'auto',
                            fontSize: '11px',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            color: status.connected ? 'var(--accent)' : 'var(--text-secondary)'
                        }}>
                            {status.connected ? <Check size={14} /> : <AlertCircle size={14} />}
                            {status.connected
                                ? `Proyector conectado en Display ${connectedDisplay?.id ?? status.displayId}`
                                : 'Sin proyector conectado'}
                        </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <select
                                className="system-select"
                                value={selectedDisplayId ?? ''}
                                onChange={(e) => setSelectedDisplayId(Number(e.target.value))}
                                disabled={status.connected}
                                style={{ flex: 1, margin: 0, height: '42px' }}
                            >
                                {displays.map(d => (
                                    <option key={d.id} value={d.id}>
                                        Display {d.id} — {d.size.width}x{d.size.height}{d.isPrimary ? ' (primary)' : ''}
                                    </option>
                                ))}
                            </select>

                            <button
                                onClick={refreshDisplays}
                                disabled={refreshing}
                                title="Refresh displays"
                                style={{
                                    width: '42px',
                                    height: '42px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: 'rgba(255,255,255,0.05)',
                                    borderRadius: '8px',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    color: 'var(--text-secondary)',
                                    cursor: refreshing ? 'not-allowed' : 'pointer',
                                    flexShrink: 0
                                }}
                            >
                                <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
                            </button>

                            <motion.button
                                className={`action-button ${status.connected ? 'stop' : 'active'}`}
                                onClick={status.connected ? handleClose : handleOpen}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                disabled={!status.connected && selectedDisplayId == null}
                                style={{ margin: 0, height: '42px', display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}
                            >
                                <Power size={16} />
                                {status.connected ? 'Cerrar proyector' : 'Abrir proyector'}
                            </motion.button>
                        </div>

                        <div style={{ display: 'flex', gap: '12px' }}>
                            <div
                                className={`bgr-toggle ${blackout ? 'active' : ''}`}
                                onClick={handleBlackoutToggle}
                                title="Blackout"
                                style={{ height: '48px', padding: '0 16px', flex: 1, justifyContent: 'center' }}
                            >
                                <EyeOff size={16} />
                                <span>BLACKOUT</span>
                            </div>

                            <div
                                className={`bgr-toggle ${testPattern ? 'active' : ''}`}
                                onClick={handleTestPatternToggle}
                                title="Test pattern"
                                style={{ height: '48px', padding: '0 16px', flex: 1, justifyContent: 'center' }}
                            >
                                <Crosshair size={16} />
                                <span>TEST PATTERN</span>
                            </div>

                            <div
                                className={`bgr-toggle ${nowPlayingOverlay ? 'active' : ''}`}
                                onClick={handleNowPlayingOverlayToggle}
                                title="Now Playing overlay"
                                style={{ height: '48px', padding: '0 16px', flex: 1, justifyContent: 'center' }}
                            >
                                <Music size={16} />
                                <span>NOW PLAYING</span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '12px' }}>
                            {VISUALS.map((visual) => (
                                <div
                                    key={visual.id}
                                    className={`bgr-toggle ${activeVisual === visual.id ? 'active' : ''}`}
                                    onClick={() => handleVisualSelect(visual.id)}
                                    title={visual.label}
                                    style={{ height: '48px', padding: '0 16px', flex: 1, justifyContent: 'center' }}
                                >
                                    <span>{visual.label.toUpperCase()}</span>
                                </div>
                            ))}
                        </div>

                        <div style={{ display: 'flex', gap: '12px' }}>
                            <div
                                className={`bgr-toggle ${mappingEditMode ? 'active' : ''}`}
                                onClick={handleMappingEditModeToggle}
                                title="Edit Mapping"
                                style={{ height: '48px', padding: '0 16px', flex: 1, justifyContent: 'center' }}
                            >
                                <Move size={16} />
                                <span>EDIT MAPPING</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="glass-card" style={{ gridColumn: '1 / -1' }}>
                    <div className="card-header-icon">
                        <Layers size={20} className="accent-text" />
                        <h3>Projection Mapping — Surfaces</h3>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {surfaces.map((surface) => (
                                <div
                                    key={surface.id}
                                    onClick={() => setSelectedSurfaceId(surface.id)}
                                    className={`bgr-toggle ${surface.id === selectedSurfaceId ? 'active' : ''}`}
                                    style={{ height: '40px', padding: '0 16px', justifyContent: 'flex-start', cursor: 'pointer' }}
                                >
                                    <span>{surface.name}</span>
                                    {surface.mask && <span style={{ marginLeft: 'auto', fontSize: '10px', opacity: 0.7 }}>masked</span>}
                                </div>
                            ))}
                        </div>

                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <input
                                type="text"
                                className="system-select"
                                value={selectedSurface?.name || ''}
                                onChange={(e) => handleRenameSelected(e.target.value)}
                                placeholder="Surface name"
                                style={{ flex: 1, margin: 0, height: '42px' }}
                            />
                            <button
                                onClick={handleAddSurface}
                                title="Add Surface"
                                className="action-button active"
                                style={{ margin: 0, height: '42px', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
                            >
                                <Plus size={16} />
                                Add Surface
                            </button>
                            <button
                                onClick={handleRemoveSurface}
                                disabled={surfaces.length <= 1}
                                title="Remove Surface"
                                className="action-button stop"
                                style={{ margin: 0, height: '42px', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', opacity: surfaces.length <= 1 ? 0.4 : 1, cursor: surfaces.length <= 1 ? 'not-allowed' : 'pointer' }}
                            >
                                <Trash2 size={16} />
                                Remove Surface
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                                <RotateCw size={16} />
                                Rotation ({rotationDegrees}°)
                            </label>
                            <input
                                type="range"
                                min={0}
                                max={360}
                                step={1}
                                value={rotationDegrees}
                                onChange={(e) => handleRotationChange(e.target.value)}
                            />
                            <div style={{ display: 'flex', gap: '8px' }}>
                                {[0, 90, 180, 270].map((deg) => (
                                    <button
                                        key={deg}
                                        onClick={() => handleRotationChange(deg)}
                                        className={`bgr-toggle ${rotationDegrees === deg ? 'active' : ''}`}
                                        style={{ flex: 1, height: '32px', padding: 0, justifyContent: 'center', fontSize: '11px' }}
                                    >
                                        <span>{deg}°</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <input
                                type="text"
                                className="system-select"
                                value={presetName}
                                onChange={(e) => setPresetName(e.target.value)}
                                placeholder="Preset name"
                                style={{ flex: 1, margin: 0, height: '42px' }}
                            />
                            <button
                                onClick={handleSavePreset}
                                disabled={!presetName.trim()}
                                title="Save Preset"
                                className="action-button active"
                                style={{ margin: 0, height: '42px', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
                            >
                                <Save size={16} />
                                Save Preset
                            </button>
                        </div>

                        {presets.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {presets.map((name) => (
                                    <div key={name} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <span style={{ flex: 1, fontSize: '13px' }}>{name}</span>
                                        <button
                                            onClick={() => handleLoadPreset(name)}
                                            title="Load"
                                            style={{ ...presetButtonStyle }}
                                        >
                                            <FolderOpen size={14} />
                                        </button>
                                        <button
                                            onClick={() => handleDeletePreset(name)}
                                            title="Delete"
                                            style={{ ...presetButtonStyle }}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

const presetButtonStyle = {
    width: '36px',
    height: '36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.1)',
    color: 'var(--text-secondary)',
    cursor: 'pointer'
}

export default ProjectorPage
