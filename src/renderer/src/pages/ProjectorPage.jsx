import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Projector, Power, EyeOff, Crosshair, RefreshCw, Check, AlertCircle } from 'lucide-react'
import { VISUALS } from '../visuals/visualRegistry'

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
    const [activeVisual, setActiveVisual] = useState(VISUALS[0].id)
    const [refreshing, setRefreshing] = useState(false)

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

    const handleVisualSelect = (visualId) => {
        setActiveVisual(visualId)
        window.projector?.setVisual(visualId)
    }

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
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ProjectorPage
