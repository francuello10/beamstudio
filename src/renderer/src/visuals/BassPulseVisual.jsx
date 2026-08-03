import React, { forwardRef, useEffect, useRef } from 'react'
import { useAudioStore } from '../store/audioStore'
import { mergeRefs } from './refUtils'

const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0))

/**
 * BassPulseVisual — simple kick/bass layer for mapped zones.
 * Uses the existing AudioFrame relay. It is a visual source only.
 */
const BassPulseVisual = forwardRef(({ active = true }, forwardedRef) => {
    const canvasRef = useRef(null)

    useEffect(() => {
        let frameId = 0
        let envelope = 0

        const render = () => {
            const canvas = canvasRef.current
            if (!canvas) {
                frameId = requestAnimationFrame(render)
                return
            }

            const ctx = canvas.getContext('2d')
            const width = canvas.width
            const height = canvas.height
            const { audioFrame } = useAudioStore.getState()
            const bass = clamp01(audioFrame?.levels?.centerBassHit ?? audioFrame?.levels?.bass)
            const mid = clamp01(audioFrame?.levels?.mid)
            const high = clamp01(audioFrame?.levels?.high)
            const target = Math.max(bass, mid * 0.25)
            envelope += (target - envelope) * (target > envelope ? 0.42 : 0.08)

            ctx.clearRect(0, 0, width, height)
            ctx.fillStyle = '#000'
            ctx.fillRect(0, 0, width, height)

            const cx = width / 2
            const cy = height / 2
            const rings = 5
            ctx.globalCompositeOperation = 'lighter'
            for (let i = 0; i < rings; i += 1) {
                const t = i / rings
                const radius = width * (0.08 + t * 0.36 + envelope * 0.22)
                const alpha = Math.max(0.03, (1 - t) * (0.18 + envelope * 0.62))
                const gradient = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius)
                gradient.addColorStop(0, `rgba(255, 25, 105, ${alpha})`)
                gradient.addColorStop(0.55, `rgba(140, 92, 246, ${alpha * (0.8 + mid * 0.4)})`)
                gradient.addColorStop(1, `rgba(0, 245, 255, ${alpha * high})`)
                ctx.fillStyle = gradient
                ctx.beginPath()
                ctx.arc(cx, cy, radius, 0, Math.PI * 2)
                ctx.fill()
            }

            ctx.strokeStyle = `rgba(255,255,255,${0.12 + envelope * 0.38})`
            ctx.lineWidth = 2 + envelope * 8
            ctx.beginPath()
            ctx.arc(cx, cy, width * (0.12 + envelope * 0.32), 0, Math.PI * 2)
            ctx.stroke()
            ctx.globalCompositeOperation = 'source-over'

            if (active) frameId = requestAnimationFrame(render)
        }

        render()
        return () => cancelAnimationFrame(frameId)
    }, [active])

    return (
        <canvas
            ref={mergeRefs(canvasRef, forwardedRef)}
            width={1024}
            height={576}
            style={{ width: '100%', height: '100%', display: 'block' }}
        />
    )
})

BassPulseVisual.displayName = 'BassPulseVisual'

export default BassPulseVisual
