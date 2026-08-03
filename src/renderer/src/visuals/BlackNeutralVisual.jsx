import React, { forwardRef } from 'react'

/**
 * BlackNeutralVisual — explicit per-surface blackout/neutral source.
 *
 * Projection mapping surfaces sample visuals as canvases. A real black canvas
 * lets Projector Studio make a zone emit no light without relying on hidden
 * modes or invalid visual ids.
 */
const BlackNeutralVisual = forwardRef((props, forwardedRef) => (
    <canvas
        ref={forwardedRef}
        width={1024}
        height={576}
        style={{ width: '100%', height: '100%', display: 'block', background: '#000' }}
    />
))

BlackNeutralVisual.displayName = 'BlackNeutralVisual'

export default BlackNeutralVisual
