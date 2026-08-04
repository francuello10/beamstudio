import React, { forwardRef, useEffect, useRef } from 'react'
import { useAudioStore } from '../store/audioStore'
import { mergeRefs } from './refUtils'

const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0))
const lerp = (a, b, t) => a + (b - a) * t

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

const sampleSpectrum = (spectral, index, count) => {
    if (!spectral.length) return 0

    const position = (index / Math.max(1, count - 1)) * (spectral.length - 1)
    const left = Math.floor(position)
    const right = Math.min(spectral.length - 1, left + 1)
    return lerp(clamp01(spectral[left]), clamp01(spectral[right]), position - left)
}

const isLiveAudioFrame = (audioFrame, now) => (
    Number.isFinite(audioFrame?.timestamp) &&
    now - audioFrame.timestamp < 3000 &&
    !audioFrame?.status?.silence &&
    clamp01(audioFrame?.levels?.volume) > 0.01
)

/**
 * MusicEqualizerVisual — audio-frequency bars as a projector visual source.
 * Uses the existing AudioFrame relay. No audio capture, no DMX ownership.
 */
const INTENSITY_GAIN = { smooth: 0.62, standard: 1, exaggerated: 1.7 }

const MusicEqualizerVisual = forwardRef(({ active = true, model = 'bars', intensity = 'standard' }, forwardedRef) => {
    const canvasRef = useRef(null)

    useEffect(() => {
        let frameId = 0
        let peakHolds = new Array(40).fill(0)
        let smoothedBars = new Array(40).fill(0)

        const render = (now = 0) => {
            const canvas = canvasRef.current
            if (!canvas) {
                frameId = requestAnimationFrame(render)
                return
            }

            const ctx = canvas.getContext('2d')
            const width = canvas.width
            const height = canvas.height
            const { audioFrame } = useAudioStore.getState()
            const hasLiveAudio = isLiveAudioFrame(audioFrame, now)
            const spectral = hasLiveAudio && Array.isArray(audioFrame?.spectral)
                ? audioFrame.spectral
                : []
            const gain = INTENSITY_GAIN[intensity] || INTENSITY_GAIN.standard
            const bass = clamp01(audioFrame?.levels?.bass * gain)
            const mid = clamp01(audioFrame?.levels?.mid * gain)
            const high = clamp01(audioFrame?.levels?.high * gain)
            const volume = clamp01(audioFrame?.levels?.volume * gain)
            const stereoWidth = clamp01(audioFrame?.levels?.stereoWidth)
            const energy = hasLiveAudio ? Math.max(volume, bass * 0.75, mid * 0.55) : 0

            ctx.clearRect(0, 0, width, height)
            ctx.fillStyle = '#02020a'
            ctx.fillRect(0, 0, width, height)

            const bg = ctx.createRadialGradient(width * 0.5, height * 0.5, 0, width * 0.5, height * 0.5, width * 0.75)
            bg.addColorStop(0, `rgba(255, 45, 117, ${0.08 + bass * 0.18})`)
            bg.addColorStop(0.48, `rgba(96, 50, 255, ${0.06 + mid * 0.12})`)
            bg.addColorStop(1, '#02020a')
            ctx.fillStyle = bg
            ctx.fillRect(0, 0, width, height)

            if (!hasLiveAudio) {
                ctx.fillStyle = 'rgba(255,255,255,0.68)'
                ctx.font = '800 34px Inter, sans-serif'
                ctx.textAlign = 'center'
                ctx.fillText('WAITING FOR LIVE AUDIO', width / 2, height * 0.48)
                ctx.fillStyle = 'rgba(255,255,255,0.38)'
                ctx.font = '500 18px Inter, sans-serif'
                ctx.fillText('Start music/audio capture to drive this visual', width / 2, height * 0.55)
                if (active) frameId = requestAnimationFrame(render)
                return
            }

            ctx.globalCompositeOperation = 'lighter'
            const horizonY = height * (0.55 + Math.sin(now * 0.0007) * 0.025)
            for (let row = 0; row < 7; row += 1) {
                const y = horizonY + row * height * 0.055
                ctx.strokeStyle = `rgba(0, 245, 255, ${0.035 + row * 0.008})`
                ctx.lineWidth = 1
                ctx.beginPath()
                ctx.moveTo(width * 0.08, y)
                ctx.lineTo(width * 0.92, y)
                ctx.stroke()
            }

            const count = model === 'classic' ? 24 : 40
            const gap = width * 0.006
            const marginX = width * 0.045
            const usableWidth = width - marginX * 2
            const barWidth = (usableWidth - gap * (count - 1)) / count
            const centerY = height * 0.58
            const maxBarHeight = height * (0.26 + energy * 0.24)
            const gradient = ctx.createLinearGradient(0, centerY + maxBarHeight, width, centerY - maxBarHeight)
            gradient.addColorStop(0, '#ff2d75')
            gradient.addColorStop(0.38, '#8b5cf6')
            gradient.addColorStop(0.72, '#00f5ff')
            gradient.addColorStop(1, '#ffffff')

            if (model === 'radial') {
                const cx = width / 2
                const cy = height / 2
                ctx.shadowColor = bass > 0.38 ? '#ff2d75' : '#00f5ff'
                ctx.shadowBlur = 12 + bass * 52
                for (let i = 0; i < 96; i += 1) {
                    const angle = (i / 96) * Math.PI * 2
                    const band = Math.pow(clamp01(sampleSpectrum(spectral, i, 96) * gain), 0.7)
                    const inner = Math.min(width, height) * (0.16 + bass * 0.08)
                    const outer = inner + band * Math.min(width, height) * 0.34
                    ctx.strokeStyle = i % 3 === 0 ? '#ff2d75' : i % 3 === 1 ? '#8b5cf6' : '#00f5ff'
                    ctx.lineWidth = 3 + high * 4
                    ctx.beginPath()
                    ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner)
                    ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer)
                    ctx.stroke()
                }
                ctx.globalCompositeOperation = 'source-over'
                if (active) frameId = requestAnimationFrame(render)
                return
            }

            ctx.shadowColor = bass > 0.38 ? '#ff2d75' : '#00f5ff'
            ctx.shadowBlur = 16 + bass * 58
            for (let i = 0; i < count; i += 1) {
                const mirroredIndex = i < count / 2 ? i : count - 1 - i
                const raw = clamp01(sampleSpectrum(spectral, mirroredIndex, count / 2) * gain)
                const shaped = Math.pow(raw, 0.68)
                smoothedBars[i] += (shaped - smoothedBars[i]) * (shaped > smoothedBars[i] ? 0.38 : 0.16)
                peakHolds[i] = Math.max(smoothedBars[i], peakHolds[i] * 0.94)

                const barHeight = Math.max(height * 0.035, smoothedBars[i] * maxBarHeight)
                const x = marginX + i * (barWidth + gap)
                const wobble = Math.sin(now * 0.004 + i * 0.55) * height * 0.012 * (0.3 + high)
                const y = centerY - barHeight + wobble

                ctx.fillStyle = gradient
                if (model !== 'wave') drawRoundedRect(ctx, x, y, barWidth, barHeight * 2, barWidth * 0.48)

                ctx.fillStyle = 'rgba(255,255,255,0.82)'
                const holdY = centerY - peakHolds[i] * maxBarHeight - 8
                if (model !== 'wave') drawRoundedRect(ctx, x, holdY, barWidth, 4, 2)
            }

            ctx.shadowBlur = 0
            ctx.strokeStyle = `rgba(255,255,255,${0.1 + energy * 0.28})`
            ctx.lineWidth = 2 + energy * 3
            ctx.beginPath()
            for (let i = 0; i <= 96; i += 1) {
                const x = (i / 96) * width
                const band = clamp01(sampleSpectrum(spectral, i, 96) * gain)
                const wave = Math.sin(i * 0.32 + now * 0.006) * height * 0.045 * (0.2 + high)
                const y = height * 0.28 + wave - band * height * 0.12
                if (i === 0) ctx.moveTo(x, y)
                else ctx.lineTo(x, y)
            }
            ctx.stroke()

            const orbX = width * (0.5 + (stereoWidth - 0.5) * 0.22 + Math.sin(now * 0.001) * 0.03)
            const orb = ctx.createRadialGradient(orbX, height * 0.42, 0, orbX, height * 0.42, width * (0.12 + bass * 0.22))
            orb.addColorStop(0, `rgba(255,255,255,${0.16 + energy * 0.18})`)
            orb.addColorStop(0.38, `rgba(255,45,117,${0.08 + bass * 0.26})`)
            orb.addColorStop(1, 'rgba(0,245,255,0)')
            ctx.fillStyle = orb
            ctx.beginPath()
            ctx.arc(orbX, height * 0.42, width * (0.12 + bass * 0.22), 0, Math.PI * 2)
            ctx.fill()
            ctx.globalCompositeOperation = 'source-over'

            if (active) frameId = requestAnimationFrame(render)
        }

        render()
        return () => cancelAnimationFrame(frameId)
    }, [active, model, intensity])

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
