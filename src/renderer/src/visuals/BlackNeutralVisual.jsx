import React, { forwardRef, useEffect, useRef } from 'react'
import { mergeRefs } from './refUtils'

/**
 * BlackNeutralVisual — explicit per-surface blackout/neutral source.
 *
 * Projection mapping surfaces sample visuals as canvases. A real black canvas
 * lets Projector Studio make a zone emit no light without relying on hidden
 * modes or invalid visual ids.
 */
const BlackNeutralVisual = forwardRef((props, forwardedRef) => {
    const canvasRef = useRef(null)

    useEffect(() => {
        const canvas = canvasRef.current
        const ctx = canvas?.getContext('2d')
        if (!ctx || !canvas) return
        ctx.fillStyle = '#000'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
    }, [])

    return (
        <canvas
            ref={mergeRefs(canvasRef, forwardedRef)}
            width={1024}
            height={576}
            style={{ width: '100%', height: '100%', display: 'block', background: '#000' }}
        />
    )
})

BlackNeutralVisual.displayName = 'BlackNeutralVisual'

export default BlackNeutralVisual
