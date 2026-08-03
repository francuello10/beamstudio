import React, { useEffect, useRef, useState } from 'react'
import { useAudioStore } from '../store/audioStore'
import FluidNeonVisual from '../visuals/FluidNeonVisual'
import ParticleFieldVisual from '../visuals/ParticleFieldVisual'
import TunnelGridVisual from '../visuals/TunnelGridVisual'
import KaleidoscopeVisual from '../visuals/KaleidoscopeVisual'
import CeilingDomeVisual from '../visuals/CeilingDomeVisual'
import PoseSkeletonVisual from '../visuals/PoseSkeletonVisual'
import { DEFAULT_VISUAL_ID } from '../visuals/visualRegistry'
import MappingCompositor, { DEFAULT_SURFACE } from '../mapping/MappingCompositor'
import { useNowPlaying } from '../hooks/useNowPlaying'
import { useNowPlayingStore } from '../metadata/nowPlayingStore'
import NowPlayingOverlay from './NowPlayingOverlay'

// BS-005: maps a visual id from visualRegistry to its component. All 4
// planned visuals (Fluid Neon, Particle Field, Tunnel Grid, Kaleidoscope)
// plus Ceiling Dome are now present here; a future visual would still just
// be another entry plus a registry entry in visualRegistry.js.
const VISUAL_COMPONENTS = {
    fluidNeon: FluidNeonVisual,
    particleField: ParticleFieldVisual,
    tunnelGrid: TunnelGridVisual,
    kaleidoscope: KaleidoscopeVisual,
    ceilingDome: CeilingDomeVisual,
    poseSkeleton: PoseSkeletonVisual
}

/**
 * ProjectorApp — fullscreen renderer mounted on `?role=projector`.
 *
 * No sidebar/header chrome, no operator controls. The operator drives this
 * window remotely from ProjectorPage in the main window via IPC
 * (blackout / test pattern / visual / open / close).
 *
 * @ai-constraints No renderiza controles de operador. Es salida pura.
 */
const ProjectorApp = () => {
    const [blackout, setBlackout] = useState(false)
    const [testPattern, setTestPattern] = useState(false)
    // BS-006: quad-warp mapping edit mode, driven remotely from ProjectorPage
    // the same way blackout/testPattern already are.
    const [mappingEditMode, setMappingEditMode] = useState(false)
    const [poseCameraDeviceId, setPoseCameraDeviceId] = useState(null)
    // BS-008: this window's own read-only mirror of the surfaces array — the
    // same mapping:getSurfaces/onSurfacesChanged pull-and-subscribe pattern
    // ProjectorPage.jsx already uses for its own surfaces mirror. Needed here
    // (not just inside MappingCompositor, which owns the two-way sync) so
    // this component can compute which distinct visuals to mount BEFORE
    // MappingCompositor ever reads a canvas ref — this component never
    // pushes surfaces back out, so there's no feedback-loop risk, exactly
    // like ProjectorPage.jsx's own mirror.
    const [surfaces, setSurfaces] = useState([DEFAULT_SURFACE])
    // BS-007 phase 2: Now Playing overlay toggle, driven remotely from
    // ProjectorPage the same way blackout/testPattern/mappingEditMode are.
    const [nowPlayingOverlay, setNowPlayingOverlay] = useState(false)
    const [nowPlayingRotationDeg, setNowPlayingRotationDeg] = useState(0)

    // BS-007 phase 2: get-system-media is a stateless, on-demand main-process
    // query any window can invoke directly - so this window runs its OWN
    // useNowPlaying() poll independently instead of relaying AudioFrame-style
    // data over IPC. Unmodified hook, same as SystemPage.jsx's usage.
    useNowPlaying()
    const nowPlaying = useNowPlayingStore((state) => state.nowPlaying)
    useEffect(() => {
        const unsubBlackout = window.projector?.onBlackout(setBlackout)
        const unsubTestPattern = window.projector?.onTestPattern(setTestPattern)
        const unsubMappingEditMode = window.mapping?.onEditModeChanged(setMappingEditMode)
        const unsubNowPlayingOverlay = window.projector?.onNowPlayingOverlayChanged(setNowPlayingOverlay)
        const unsubNowPlayingRotation = window.projector?.onNowPlayingRotationChanged(setNowPlayingRotationDeg)
        const unsubPoseCameraDeviceId = window.projector?.onPoseCameraDeviceIdChanged(setPoseCameraDeviceId)
        // Ecosystem Color-Sync: unlike the toggles above, this one has no
        // local React state of its own here - it's written straight into
        // this window's own local useAudioStore (the store instance the
        // visual hooks actually read from), same reasoning as the AudioFrame
        // relay below.
        const unsubVisualColorSync = window.projector?.onVisualColorSyncChanged((value) => {
            useAudioStore.getState().setVisualColorSyncEnabled(value)
        })

        // Bugfix: setBlackout/setTestPattern/setNowPlayingOverlay/setEditMode
        // are one-way relays with no state of their own - a freshly-opened
        // (or reopened after being closed) window only ever saw pushes that
        // happened after it started listening above, so it silently
        // reverted to these useState defaults regardless of what was
        // actually live. Pull current state once on mount instead.
        window.projector?.getState?.().then((state) => {
            if (!state) return
            setBlackout(state.blackout)
            setTestPattern(state.testPattern)
            setNowPlayingOverlay(state.nowPlayingOverlay)
            setNowPlayingRotationDeg(Number.isFinite(state.nowPlayingRotationDeg) ? state.nowPlayingRotationDeg : 0)
            setPoseCameraDeviceId(state.poseCameraDeviceId || null)
            if (state.visualColorSyncEnabled !== undefined) {
                useAudioStore.getState().setVisualColorSyncEnabled(state.visualColorSyncEnabled)
            }
        })
        window.mapping?.getEditMode?.().then((value) => {
            if (value !== undefined) setMappingEditMode(value)
        })

        return () => {
            unsubBlackout?.()
            unsubTestPattern?.()
            unsubMappingEditMode?.()
            unsubNowPlayingOverlay?.()
            unsubNowPlayingRotation?.()
            unsubPoseCameraDeviceId?.()
            unsubVisualColorSync?.()
        }
    }, [])

    // BS-008: read-only surfaces mirror (see the `surfaces` state comment
    // above) — same pull-on-mount + subscribe shape as every other
    // mapping:getSurfaces/onSurfacesChanged consumer in this codebase
    // (MappingCompositor.jsx, ProjectorPage.jsx).
    useEffect(() => {
        const unsubSurfacesChanged = window.mapping?.onSurfacesChanged((updated) => {
            if (!Array.isArray(updated) || updated.length === 0) return
            setSurfaces(updated)
        })
        return () => unsubSurfacesChanged?.()
    }, [])

    useEffect(() => {
        let cancelled = false
        ;(async () => {
            const cached = await window.mapping?.getSurfaces()
            if (cancelled || !Array.isArray(cached) || cached.length === 0) return
            setSurfaces(cached)
        })()
        return () => { cancelled = true }
    }, [])

    // BS-005: this window is a separate renderer process from the main
    // window, so it never runs useSystemAudio itself — it only consumes the
    // AudioFrame relayed over IPC by App.jsx (window.audio.broadcastFrame)
    // and writes it into its own local useAudioStore via the store's
    // existing setAudioData action.
    useEffect(() => {
        const unsubscribe = window.audio?.onFrameBroadcast?.((frame) => {
            useAudioStore.getState().setAudioData({ audioFrame: frame })
        })
        return () => unsubscribe?.()
    }, [])

    // BS-008: distinct visualIds actually referenced by at least one CURRENT
    // surface (dedup — N surfaces pointing at the same visual only need ONE
    // live instance). Falls back to DEFAULT_VISUAL_ID if surfaces somehow
    // resolves empty (shouldn't happen — MappingCompositor/ProjectorPage
    // both always keep at least one surface — but this keeps the projector
    // showing SOMETHING rather than a blank mount list).
    const distinctVisualIds = new Set()
    surfaces.forEach((surface) => {
        const id = surface.visualId || DEFAULT_VISUAL_ID
        if (VISUAL_COMPONENTS[id]) distinctVisualIds.add(id)
    })
    if (distinctVisualIds.size === 0) distinctVisualIds.add(DEFAULT_VISUAL_ID)

    // "Ever mounted this session" set — grows only, never shrinks. Some
    // visuals (Fluid Neon today, per useFluidSimulation.js's own comments)
    // don't support clean unmount/remount, so once a visualId has been
    // mounted here because some surface referenced it, it stays mounted for
    // the rest of this window's life even if every surface later stops
    // using it — this avoids remount churn generically, not as a
    // FluidNeon-specific special case. Mutated directly during render
    // (mirrors MappingCompositor.jsx's own `surfacesRef.current = surfaces`
    // idiom) — Set.add is idempotent, so this is safe under React's
    // double-invocation in StrictMode/dev.
    const everMountedVisualIdsRef = useRef(new Set())
    distinctVisualIds.forEach((id) => everMountedVisualIdsRef.current.add(id))

    // One stable canvas ref per ever-mounted visualId, created lazily and
    // never replaced once created — keyed extension of this component's
    // previous single activeVisualCanvasRef, so MappingCompositor.jsx can
    // still read each canvas via a plain ref without React re-renders.
    const canvasRefsByVisualIdRef = useRef(new Map())
    const getCanvasRef = (visualId) => {
        let ref = canvasRefsByVisualIdRef.current.get(visualId)
        if (!ref) {
            ref = { current: null }
            canvasRefsByVisualIdRef.current.set(visualId, ref)
        }
        return ref
    }

    return (
        <div className="projector-root" style={{ position: 'relative', width: '100vw', height: '100vh', background: '#000', overflow: 'hidden' }}>
            {/* BS-006/BS-008: source visuals must stay PAINTED, not
                visibility:hidden/display:none. MappingCompositor samples
                these canvases with texImage2D; Electron/Chromium may stop
                or lose WebGL contexts for hidden canvases, which makes Live
                Visual output black while DOM overlays still work. Keep them
                alive behind the compositor instead. Deliberate ceiling: one
                mounted source per visual id from visualRegistry.js. */}
            <div style={{ position: 'absolute', inset: 0, width: '100vw', height: '100vh', overflow: 'hidden', pointerEvents: 'none' }}>
                {Array.from(everMountedVisualIdsRef.current).map((visualId) => {
                    const VisualComponent = VISUAL_COMPONENTS[visualId]
                    if (!VisualComponent) return null
                    return (
                        <div key={visualId} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                            <VisualComponent
                                ref={getCanvasRef(visualId)}
                                active={distinctVisualIds.has(visualId)}
                                cameraDeviceId={poseCameraDeviceId || undefined}
                            />
                        </div>
                    )
                })}
            </div>

            <MappingCompositor visualCanvasRefs={canvasRefsByVisualIdRef.current} editMode={mappingEditMode} />

            {testPattern && !blackout && <TestPatternOverlay />}

            {nowPlayingOverlay && !blackout && (
                <NowPlayingOverlay nowPlaying={nowPlaying} rotationDeg={nowPlayingRotationDeg} />
            )}

            {blackout && (
                <div style={{ position: 'absolute', inset: 0, background: '#000' }} />
            )}
        </div>
    )
}

/**
 * Calibration test pattern — high-contrast white-on-black grid with edge
 * markers and a center crosshair, so the operator can align the projector
 * (bordes + centro).
 */
const TestPatternOverlay = () => (
    <div style={{ position: 'absolute', inset: 0, background: '#000' }}>
        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ display: 'block' }}>
            {/* Outer frame */}
            <rect x="1" y="1" width="98" height="98" fill="none" stroke="#fff" strokeWidth="0.4" />
            {/* Thirds grid */}
            {[33.33, 66.66].map((pos) => (
                <line key={`v-${pos}`} x1={pos} y1="0" x2={pos} y2="100" stroke="#fff" strokeWidth="0.15" opacity="0.6" />
            ))}
            {[33.33, 66.66].map((pos) => (
                <line key={`h-${pos}`} x1="0" y1={pos} x2="100" y2={pos} stroke="#fff" strokeWidth="0.15" opacity="0.6" />
            ))}
            {/* Center crosshair */}
            <line x1="50" y1="42" x2="50" y2="58" stroke="#fff" strokeWidth="0.4" />
            <line x1="42" y1="50" x2="58" y2="50" stroke="#fff" strokeWidth="0.4" />
            <circle cx="50" cy="50" r="6" fill="none" stroke="#fff" strokeWidth="0.3" />
            {/* Corner markers */}
            {[[3, 3], [97, 3], [3, 97], [97, 97]].map(([cx, cy]) => (
                <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.5" fill="#fff" />
            ))}
        </svg>
    </div>
)

export default ProjectorApp
