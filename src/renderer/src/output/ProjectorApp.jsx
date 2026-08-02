import React, { useEffect, useState } from 'react'
import { useFluidSimulation } from '../hooks/useFluidSimulation'

/**
 * ProjectorApp — fullscreen renderer mounted on `?role=projector`.
 *
 * No sidebar/header chrome, no operator controls. The operator drives this
 * window remotely from ProjectorPage in the main window via IPC
 * (blackout / test pattern / open / close).
 *
 * @ai-constraints No renderiza controles de operador. Es salida pura.
 */
const ProjectorApp = () => {
    const [blackout, setBlackout] = useState(false)
    const [testPattern, setTestPattern] = useState(false)

    // Reuse the existing Fluid Neon engine exactly as-is (do not touch its internals).
    // It manages its own rAF loop and reads useAudioStore.getState() internally.
    const { canvasRef, start, stop } = useFluidSimulation()

    useEffect(() => {
        const unsubBlackout = window.projector?.onBlackout(setBlackout)
        const unsubTestPattern = window.projector?.onTestPattern(setTestPattern)

        return () => {
            unsubBlackout?.()
            unsubTestPattern?.()
        }
    }, [])

    // Keep the WebGL canvas mounted for the whole life of this window and just
    // start the fluid engine once. We overlay blackout/test-pattern on top
    // instead of unmounting the canvas, so the GL context is never recreated.
    useEffect(() => {
        start()
        return () => stop()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return (
        <div className="projector-root" style={{ position: 'relative', width: '100vw', height: '100vh', background: '#000', overflow: 'hidden' }}>
            <canvas
                ref={canvasRef}
                width={1024}
                height={576}
                style={{ width: '100%', height: '100%', display: 'block' }}
            />

            {testPattern && !blackout && <TestPatternOverlay />}

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
