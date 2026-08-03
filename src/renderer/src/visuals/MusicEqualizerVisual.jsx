import React, { forwardRef, useEffect, useRef } from 'react'
import { useAudioStore } from '../store/audioStore'
import { mergeRefs } from './refUtils'

const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0))

const drawRoundedRect = (ctx, x, y, width, height, radius) => {
    const r = Math.min(radius, width / 2, height / 2)
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + width - r, y)
    ctx.quadraticCurveTo(x + width, y, x + width, y + r)
    ctx.lineTo(x + width, y + height - r)
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
    ctx.lineTo(x + r, y + height)
    ctx.quadraticCurveTo(x, y + height, x, y + height - r)
    ctx.lineTo(x, y + r)
    ctx.quadraticCurveTo(x, y, x + r, y)
    ctx.closePath()
    ctx.fill()
}

/**
 * MusicEqualizerVisual — audio-frequency bars as a projector visual source.
 * Uses the existing AudioFrame relay. No audio capture, no DMX ownership.
 */
const MusicEqualizerVisual = forwardRef(({ active = true }, forwardedRef) => {
    const canvasRef = useRef(null)

    useEffect(() => {
        let frameId = 0
        let peakHolds = new Array(16).fill(0)

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
            const spectral = Array.isArray(audioFrame?.spectral) ? audioFrame.spectral : []
            const bass = clamp01(audioFrame?.levels?.bass)
            const volume = clamp01(audioFrame?.levels?.volume)
            const stereoWidth = clamp01(audioFrame?.levels?.stereoWidth)
            const silence = audioFrame?.status?.silence
            const ambient = silence ? 0.08 : Math.max(0.12, volume)

            ctx.clearRect(0, 0, width, height)
            ctx.fillStyle = '#000'
            ctx.fillRect(0, 0, width, height)

            const glow = 18 + bass * 44
            const gradient = ctx.createLinearGradient(0, height, width, 0)
            gradient.addColorStop(0, '#ff1f72')
            gradient.addColorStop(0.5, '#8b5cf6')
            gradient.addColorStop(1, '#00f5ff')

            ctx.globalCompositeOperation = 'lighter'
            ctx.shadowColor = bass > 0.35 ? '#ff2d75' : '#00f5ff'
            ctx.shadowBlur = glow

            const count = 16
            const gap = width * 0.012
            const marginX = width * 0.06
            const usableWidth = width - marginX * 2
            const barWidth = (usableWidth - gap * (count - 1)) / count
            const floorY = height * 0.82
            const maxBarHeight = height * 0.62

            for (let i = 0; i < count; i += 1) {
                const raw = clamp01(spectral[i] ?? 0)
                const shaped = Math.pow(Math.max(raw, ambient * 0.18), 0.72)
                peakHolds[i] = Math.max(shaped, peakHolds[i] * 0.92)
                const barHeight = Math.max(height * 0.035, shaped * maxBarHeight)
                const x = marginX + i * (barWidth + gap)
                const y = floorY - barHeight

                ctx.fillStyle = gradient
                drawRoundedRect(ctx, x, y, barWidth, barHeight, barWidth * 0.45)

                ctx.fillStyle = 'rgba(255,255,255,0.75)'
                const holdY = floorY - peakHolds[i] * maxBarHeight - 6
                drawRoundedRect(ctx, x, holdY, barWidth, 4, 2)
            }

            ctx.shadowBlur = 0
            ctx.globalCompositeOperation = 'source-over'
            ctx.fillStyle = `rgba(255, 45, 117, ${0.08 + bass * 0.24})`
            ctx.beginPath()
            ctx.arc(width * (0.5 + (stereoWidth - 0.5) * 0.16), height * 0.5, width * (0.12 + bass * 0.25), 0, Math.PI * 2)
            ctx.fill()

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

MusicEqualizerVisual.displayName = 'MusicEqualizerVisual'

export default MusicEqualizerVisual
