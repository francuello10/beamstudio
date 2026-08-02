/**
 * PoseSkeletonVisual.jsx — forwardRef visual wrapper around usePoseLandmarker
 * (BeamStudio transplant package).
 *
 * Mirrors FluidNeonVisual.jsx's contract exactly:
 *   - forwardRef so MappingCompositor.jsx (host app) can grab the <canvas>
 *     DOM node as a WebGL2 texture source, without this component or its
 *     hook knowing MappingCompositor exists.
 *   - the hook (usePoseLandmarker) owns the actual engine/loop; this
 *     component just mounts it and starts/stops it for its own lifetime,
 *     same division of labor as FluidNeonVisual <-> useFluidSimulation.
 *
 * Rendering choice: plain 2D canvas, not WebGL2. A pose skeleton is ~33
 * dots + ~35 lines per frame — trivial for Canvas2D, and MappingCompositor
 * only needs *a* <canvas> DOM node to `texImage2D` from; it does not care
 * whether that canvas's own context is '2d' or 'webgl2'. Reusing glUtils.js
 * plumbing here would add shader/program/buffer bookkeeping for no visual
 * or performance benefit, so this stays 2D per the task's own guidance to
 * pick whichever is simpler while still fitting the forwardRef-canvas
 * contract.
 *
 * @ai-constraints Does not modify usePoseLandmarker.js — only mounts/unmounts it.
 */
import React, { forwardRef, useEffect, useRef } from 'react'
import { usePoseLandmarker } from '../hooks/usePoseLandmarker'
import { mergeRefs } from './refUtils'

// Standard 33-landmark BlazePose topology (MediaPipe's own POSE_CONNECTIONS,
// Apache-2.0). Each pair is an edge to draw between two landmark indices.
const POSE_CONNECTIONS = [
    [0, 1], [1, 2], [2, 3], [3, 7], [0, 4], [4, 5], [5, 6], [6, 8],
    [9, 10],
    [11, 12], [11, 13], [13, 15], [15, 17], [15, 19], [15, 21], [17, 19],
    [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], [18, 20],
    [11, 23], [12, 24], [23, 24],
    [23, 25], [24, 26], [25, 27], [26, 28],
    [27, 29], [27, 31], [28, 30], [28, 32], [29, 31], [30, 32]
]

const DOT_COLOR = '#00e5ff'
const LINE_COLOR = 'rgba(0, 229, 255, 0.85)'

/**
 * @param {Object} props
 * @param {'lite'|'heavy'} [props.modelVariant='lite']
 * @param {string} [props.modelBasePath] — forwarded to usePoseLandmarker;
 *   see that hook's JSDoc for the default and why it must be overridden per
 *   host app.
 */
const PoseSkeletonVisual = forwardRef(({ active = true, modelVariant = 'lite', modelBasePath } = {}, forwardedRef) => {
    const canvasRef = useRef(null)
    const rafRef = useRef(null)

    const { videoRef, start, stop, latestResultRef, error } = usePoseLandmarker({
        modelVariant,
        ...(modelBasePath ? { modelBasePath } : {})
    })

    // Own draw loop — independent from the detect loop inside
    // usePoseLandmarker, same as FluidNeonVisual not reaching into
    // useFluidSimulation's internals beyond the exposed API.
    useEffect(() => {
        let cancelled = false

        const drawLoop = () => {
            if (cancelled) return

            const canvas = canvasRef.current
            const ctx = canvas?.getContext('2d')
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height)

                const result = latestResultRef.current
                const landmarksList = result?.landmarks || []

                for (const landmarks of landmarksList) {
                    ctx.strokeStyle = LINE_COLOR
                    ctx.lineWidth = 3
                    for (const [a, b] of POSE_CONNECTIONS) {
                        const pa = landmarks[a]
                        const pb = landmarks[b]
                        if (!pa || !pb) continue
                        ctx.beginPath()
                        ctx.moveTo(pa.x * canvas.width, pa.y * canvas.height)
                        ctx.lineTo(pb.x * canvas.width, pb.y * canvas.height)
                        ctx.stroke()
                    }

                    ctx.fillStyle = DOT_COLOR
                    for (const point of landmarks) {
                        ctx.beginPath()
                        ctx.arc(point.x * canvas.width, point.y * canvas.height, 5, 0, Math.PI * 2)
                        ctx.fill()
                    }
                }
            }

            rafRef.current = requestAnimationFrame(drawLoop)
        }

        drawLoop()
        return () => {
            cancelled = true
            if (rafRef.current) cancelAnimationFrame(rafRef.current)
        }
    }, [latestResultRef])

    useEffect(() => {
        if (!active) {
            stop()
            return undefined
        }
        start()
        return () => stop()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active])

    if (error) {
        console.error('[PoseSkeletonVisual] pose landmarker error:', error)
    }

    return (
        <>
            {/* Hidden camera feed — the frame source usePoseLandmarker reads
                from every detect-loop iteration. Not rendered directly;
                only the skeleton canvas below is exposed to the compositor. */}
            <video ref={videoRef} muted playsInline style={{ display: 'none' }} />
            <canvas
                ref={mergeRefs(canvasRef, forwardedRef)}
                width={1280}
                height={720}
                style={{ width: '100%', height: '100%', display: 'block' }}
            />
        </>
    )
})

PoseSkeletonVisual.displayName = 'PoseSkeletonVisual'

export default PoseSkeletonVisual
