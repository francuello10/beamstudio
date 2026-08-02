import React, { useEffect, useRef, useState } from 'react'
import { useAudioStore } from '../store/audioStore'
import FluidNeonVisual from '../visuals/FluidNeonVisual'
import ParticleFieldVisual from '../visuals/ParticleFieldVisual'
import TunnelGridVisual from '../visuals/TunnelGridVisual'
import KaleidoscopeVisual from '../visuals/KaleidoscopeVisual'
import CeilingDomeVisual from '../visuals/CeilingDomeVisual'
import { DEFAULT_VISUAL_ID } from '../visuals/visualRegistry'
import MappingCompositor from '../mapping/MappingCompositor'
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
    ceilingDome: CeilingDomeVisual
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
    const [activeVisual, setActiveVisual] = useState(DEFAULT_VISUAL_ID)
    // BS-006: quad-warp mapping edit mode, driven remotely from ProjectorPage
    // the same way blackout/testPattern/activeVisual already are.
    const [mappingEditMode, setMappingEditMode] = useState(false)
    // BS-007 phase 2: Now Playing overlay toggle, driven remotely from
    // ProjectorPage the same way blackout/testPattern/mappingEditMode are.
    const [nowPlayingOverlay, setNowPlayingOverlay] = useState(false)

    // BS-007 phase 2: get-system-media is a stateless, on-demand main-process
    // query any window can invoke directly - so this window runs its OWN
    // useNowPlaying() poll independently instead of relaying AudioFrame-style
    // data over IPC. Unmodified hook, same as SystemPage.jsx's usage.
    useNowPlaying()
    const nowPlaying = useNowPlayingStore((state) => state.nowPlaying)
    // Ref to whichever visual component is currently mounted below — its
    // <canvas> DOM node gets forwarded here via React.forwardRef
    // (FluidNeonVisual.jsx / ParticleFieldVisual.jsx) so MappingCompositor
    // can read it as a texture source without ever importing a specific
    // visual's hook or internals.
    const activeVisualCanvasRef = useRef(null)

    useEffect(() => {
        const unsubBlackout = window.projector?.onBlackout(setBlackout)
        const unsubTestPattern = window.projector?.onTestPattern(setTestPattern)
        const unsubVisual = window.projector?.onVisualChanged(setActiveVisual)
        const unsubMappingEditMode = window.mapping?.onEditModeChanged(setMappingEditMode)
        const unsubNowPlayingOverlay = window.projector?.onNowPlayingOverlayChanged(setNowPlayingOverlay)

        // Bugfix: setBlackout/setTestPattern/setVisual/setNowPlayingOverlay/
        // setEditMode are one-way relays with no state of their own - a
        // freshly-opened (or reopened after being closed) window only ever
        // saw pushes that happened after it started listening above, so it
        // silently reverted to these useState defaults regardless of what
        // was actually live. Pull current state once on mount instead.
        window.projector?.getState?.().then((state) => {
            if (!state) return
            setBlackout(state.blackout)
            setTestPattern(state.testPattern)
            if (state.activeVisual) setActiveVisual(state.activeVisual)
            setNowPlayingOverlay(state.nowPlayingOverlay)
        })
        window.mapping?.getEditMode?.().then((value) => {
            if (value !== undefined) setMappingEditMode(value)
        })

        return () => {
            unsubBlackout?.()
            unsubTestPattern?.()
            unsubVisual?.()
            unsubMappingEditMode?.()
            unsubNowPlayingOverlay?.()
        }
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

    // Keep the active visual mounted for the whole life of this window and
    // just overlay blackout/test-pattern on top instead of unmounting it, so
    // e.g. the Fluid Neon WebGL context is never recreated. All 4 planned
    // visuals plus Ceiling Dome are wired in now; a future visual would
    // still just be another VISUAL_COMPONENTS entry — no new branch here.
    const ActiveVisualComponent = VISUAL_COMPONENTS[activeVisual]

    return (
        <div className="projector-root" style={{ position: 'relative', width: '100vw', height: '100vh', background: '#000', overflow: 'hidden' }}>
            {/* BS-006: the active visual still renders every frame (so its
                own rAF loop / WebGL context is never disturbed) but is kept
                out of the final paint — MappingCompositor reads its live
                pixels as a texture instead of it being shown directly.
                visibility:hidden (NOT display:none) keeps it reliably
                rendering as a WebGL2 texture source across Chromium
                versions. */}
            <div style={{ position: 'absolute', visibility: 'hidden', width: '100vw', height: '100vh' }}>
                {ActiveVisualComponent ? <ActiveVisualComponent ref={activeVisualCanvasRef} /> : null}
            </div>

            <MappingCompositor visualCanvasRef={activeVisualCanvasRef} editMode={mappingEditMode} />

            {testPattern && !blackout && <TestPatternOverlay />}

            {nowPlayingOverlay && !blackout && <NowPlayingOverlay nowPlaying={nowPlaying} />}

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
