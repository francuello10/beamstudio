import React, { forwardRef, useEffect } from 'react'
import { useCeilingDome } from '../hooks/useCeilingDome'
import { mergeRefs } from './refUtils'

/**
 * CeilingDomeVisual — projector visual wrapper around the Ceiling Dome
 * (Aurora/Nebula) engine (BS-005, 5th visual, ceiling-mounted-projector
 * specific). Mounts the WebGL canvas and starts/stops `useCeilingDome` for
 * the lifetime of this component, mirroring TunnelGridVisual.jsx's/
 * ParticleFieldVisual.jsx's structure exactly.
 *
 * Like Tunnel Grid/Particle Field (and unlike Fluid Neon), this hook
 * supports clean unmount/remount (stop() fully releases its GL resources),
 * since ProjectorApp actually unmounts the previous visual component when
 * the operator switches visuals.
 *
 * Forwards its canvas DOM node via ref (mirrors ParticleFieldVisual.jsx) so
 * MappingCompositor.jsx can read it as a texture source without this
 * component touching useCeilingDome.js's own internal canvasRef handling.
 *
 * @ai-constraints Pure canvas/WebGL visual driven only by AudioFrame — no
 * DMX/fixture output, no useDmxStore/window.dmx/window.ambilight usage.
 */
const CeilingDomeVisual = forwardRef((props, forwardedRef) => {
    const { canvasRef, start, stop } = useCeilingDome()

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

CeilingDomeVisual.displayName = 'CeilingDomeVisual'

export default CeilingDomeVisual
