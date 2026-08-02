import React, { forwardRef, useEffect } from 'react'
import { useKaleidoscope } from '../hooks/useKaleidoscope'
import { mergeRefs } from './refUtils'

/**
 * KaleidoscopeVisual — projector visual wrapper around the Kaleidoscope
 * engine (BS-005, 4th and FINAL of 4 visuals). Mounts the WebGL canvas and
 * starts/stops `useKaleidoscope` for the lifetime of this component,
 * mirroring TunnelGridVisual.jsx's structure exactly.
 *
 * Like Particle Field and Tunnel/Grid (and unlike Fluid Neon), this hook
 * supports clean unmount/remount (stop() fully releases its GL resources),
 * since ProjectorApp actually unmounts the previous visual component when
 * the operator switches visuals.
 *
 * Forwards its canvas DOM node via ref (mirrors TunnelGridVisual.jsx) so
 * MappingCompositor.jsx can read it as a texture source without this
 * component touching useKaleidoscope.js's own internal canvasRef handling.
 *
 * @ai-constraints Pure canvas/WebGL visual driven only by AudioFrame — no
 * DMX/fixture output, no useDmxStore/window.dmx/window.ambilight usage.
 */
const KaleidoscopeVisual = forwardRef((props, forwardedRef) => {
    const { canvasRef, start, stop } = useKaleidoscope()

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

KaleidoscopeVisual.displayName = 'KaleidoscopeVisual'

export default KaleidoscopeVisual
