import React, { forwardRef, useEffect } from 'react'
import { useParticleField } from '../hooks/useParticleField'
import { mergeRefs } from './refUtils'

/**
 * ParticleFieldVisual — projector visual wrapper around the Particle Field
 * engine (BS-005, 2nd of 4 visuals). Mounts the WebGL canvas and starts/stops
 * `useParticleField` for the lifetime of this component, mirroring
 * FluidNeonVisual.jsx's structure.
 *
 * Unlike Fluid Neon, this hook is designed to support clean unmount/remount
 * (stop() fully releases its GL resources), since ProjectorApp actually
 * unmounts the previous visual component when the operator switches visuals.
 *
 * BS-006: forwards its canvas DOM node via ref (mirrors FluidNeonVisual.jsx)
 * so MappingCompositor.jsx can read it as a texture source without this
 * component touching useParticleField.js's own internal canvasRef handling.
 *
 * @ai-constraints Pure canvas/WebGL visual driven only by AudioFrame — no
 * DMX/fixture output, no useDmxStore/window.dmx/window.ambilight usage.
 */
const ParticleFieldVisual = forwardRef((props, forwardedRef) => {
    const { canvasRef, start, stop } = useParticleField()

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

ParticleFieldVisual.displayName = 'ParticleFieldVisual'

export default ParticleFieldVisual
