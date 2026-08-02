import React, { forwardRef, useEffect } from 'react'
import { useFluidSimulation } from '../hooks/useFluidSimulation'
import { mergeRefs } from './refUtils'

/**
 * FluidNeonVisual — projector visual wrapper around the existing Fluid Neon
 * engine (BS-005). Mounts the WebGL canvas and starts/stops
 * `useFluidSimulation` for the lifetime of this component; unchanged from
 * the inline mounting logic that used to live directly in ProjectorApp.jsx.
 *
 * BS-006: forwards its canvas DOM node via ref so MappingCompositor.jsx can
 * grab it as a texture source, without touching useFluidSimulation.js at all
 * — the hook still owns/receives its own internal `canvasRef` exactly as
 * before, this just also mirrors the DOM node onto whatever ref the parent
 * passes in.
 *
 * @ai-constraints Does not modify useFluidSimulation.js — only mounts/unmounts it.
 */
const FluidNeonVisual = forwardRef((props, forwardedRef) => {
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
            ref={mergeRefs(canvasRef, forwardedRef)}
            width={1024}
            height={576}
            style={{ width: '100%', height: '100%', display: 'block' }}
        />
    )
})

FluidNeonVisual.displayName = 'FluidNeonVisual'

export default FluidNeonVisual
