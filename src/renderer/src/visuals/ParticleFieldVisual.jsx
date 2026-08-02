import React, { useEffect } from 'react'
import { useParticleField } from '../hooks/useParticleField'

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
 * @ai-constraints Pure canvas/WebGL visual driven only by AudioFrame — no
 * DMX/fixture output, no useDmxStore/window.dmx/window.ambilight usage.
 */
const ParticleFieldVisual = () => {
    const { canvasRef, start, stop } = useParticleField()

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

export default ParticleFieldVisual
