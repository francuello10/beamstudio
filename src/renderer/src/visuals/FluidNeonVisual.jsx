import React, { useEffect } from 'react'
import { useFluidSimulation } from '../hooks/useFluidSimulation'

/**
 * FluidNeonVisual — projector visual wrapper around the existing Fluid Neon
 * engine (BS-005). Mounts the WebGL canvas and starts/stops
 * `useFluidSimulation` for the lifetime of this component; unchanged from
 * the inline mounting logic that used to live directly in ProjectorApp.jsx.
 *
 * @ai-constraints Does not modify useFluidSimulation.js — only mounts/unmounts it.
 */
const FluidNeonVisual = () => {
    // Reuse the existing Fluid Neon engine exactly as-is (do not touch its internals).
    // It manages its own rAF loop and reads useAudioStore.getState() internally.
    const { canvasRef, start, stop } = useFluidSimulation()

    useEffect(() => {
        start()
        return () => stop()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return (
        <canvas
            ref={canvasRef}
            width={1024}
            height={576}
            style={{ width: '100%', height: '100%', display: 'block' }}
        />
    )
}

export default FluidNeonVisual
