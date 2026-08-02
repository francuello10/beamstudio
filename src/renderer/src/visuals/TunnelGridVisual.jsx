import React, { forwardRef, useEffect } from 'react'
import { useTunnelGrid } from '../hooks/useTunnelGrid'
import { mergeRefs } from './refUtils'

/**
 * TunnelGridVisual — projector visual wrapper around the Tunnel/Grid engine
 * (BS-005, 3rd of 4 visuals). Mounts the WebGL canvas and starts/stops
 * `useTunnelGrid` for the lifetime of this component, mirroring
 * ParticleFieldVisual.jsx's structure exactly.
 *
 * Like Particle Field (and unlike Fluid Neon), this hook supports clean
 * unmount/remount (stop() fully releases its GL resources), since
 * ProjectorApp actually unmounts the previous visual component when the
 * operator switches visuals.
 *
 * Forwards its canvas DOM node via ref (mirrors ParticleFieldVisual.jsx) so
 * MappingCompositor.jsx can read it as a texture source without this
 * component touching useTunnelGrid.js's own internal canvasRef handling.
 *
 * @ai-constraints Pure canvas/WebGL visual driven only by AudioFrame — no
 * DMX/fixture output, no useDmxStore/window.dmx/window.ambilight usage.
 */
const TunnelGridVisual = forwardRef((props, forwardedRef) => {
    const { canvasRef, start, stop } = useTunnelGrid()

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

TunnelGridVisual.displayName = 'TunnelGridVisual'

export default TunnelGridVisual
