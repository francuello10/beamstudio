import React, { forwardRef, useEffect, useRef } from 'react'
import { useAudioStore } from '../store/audioStore'
import { mergeRefs } from './refUtils'

const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0))

const INTENSITY_GAIN = { smooth: 0.58, standard: 1, exaggerated: 1.75 }

const isFreshAudioFrame = (audioFrame, now) => (
    Number.isFinite(audioFrame?.timestamp) &&
    now - audioFrame.timestamp < 3000
)

const isLiveAudioFrame = (audioFrame, now) => (
    isFreshAudioFrame(audioFrame, now) &&
    !audioFrame?.status?.silence &&
    clamp01(audioFrame?.levels?.volume) > 0.01
)

const isPausedAudioFrame = (audioFrame, now) => (
    isFreshAudioFrame(audioFrame, now) &&
    (audioFrame?.status?.playbackPaused || String(audioFrame?.status?.playbackStatus || '').toLowerCase() === 'paused')
)

const drawStatusBadge = (ctx, label, width, frozen = false) => {
    const badgeWidth = frozen ? 148 : 132
    const x = width - badgeWidth - 28
    const y = 24
    ctx.save()
    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = frozen ? 'rgba(255, 159, 10, 0.18)' : 'rgba(255, 45, 117, 0.14)'
    roundedRectPath(ctx, x, y, badgeWidth, 38, 19)
    ctx.fill()
    ctx.fillStyle = frozen ? '#ffcf7a' : '#ff9fc0'
    ctx.font = '800 17px Inter, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, x + badgeWidth / 2, y + 19)
    ctx.restore()
}

const roundedRectPath = (ctx, x, y, width, height, radius) => {
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
}

/**
 * BassPulseVisual — kick/bass layer for mapped zones.
 * Uses the existing AudioFrame relay. It is a visual source only.
 */
const BassPulseVisual = forwardRef(({ active = true, intensity = 'standard' }, forwardedRef) => {
    const canvasRef = useRef(null)

    useEffect(() => {
        let frameId = 0
        let envelope = 0
        let shockwave = 0
        let lastKick = 0
        let lastLiveSnapshot = null

        const render = (now = 0) => {
            const canvas = canvasRef.current
            if (!canvas) {
                frameId = requestAnimationFrame(render)
                return
            }

            const ctx = canvas.getContext('2d')
            const width = canvas.width
            const height = canvas.height
            const { audioFrame: currentAudioFrame } = useAudioStore.getState()
            const gain = INTENSITY_GAIN[intensity] || INTENSITY_GAIN.standard
            const currentIsLive = isLiveAudioFrame(currentAudioFrame, now)

            const isFrozenPaused = !currentIsLive && isPausedAudioFrame(currentAudioFrame, now) && lastLiveSnapshot
            const audioFrame = isFrozenPaused ? lastLiveSnapshot.audioFrame : currentAudioFrame
            const renderTime = isFrozenPaused ? lastLiveSnapshot.renderTime : now
            const hasAudioToDraw = currentIsLive || isFrozenPaused
            const bass = hasAudioToDraw ? clamp01((audioFrame?.levels?.centerBassHit ?? audioFrame?.levels?.bass) * gain) : 0
            const bassFloor = hasAudioToDraw ? clamp01(audioFrame?.levels?.bass * gain) : 0
            const mid = hasAudioToDraw ? clamp01(audioFrame?.levels?.mid * gain) : 0
            const high = hasAudioToDraw ? clamp01(audioFrame?.levels?.high * gain) : 0
            const transient = hasAudioToDraw ? clamp01(audioFrame?.telemetry?.transientDensity * gain) : 0
            const target = Math.max(bass, bassFloor * 0.85, mid * 0.3)

            if (isFrozenPaused) {
                envelope = lastLiveSnapshot.envelope
                shockwave = lastLiveSnapshot.shockwave
                lastKick = lastLiveSnapshot.lastKick
            } else {
                envelope += (target - envelope) * (target > envelope ? 0.48 : 0.075)
                if (currentIsLive && target > 0.52 && now - lastKick > 140) {
                    shockwave = 1
                    lastKick = now
                }
                shockwave *= 0.935
            }

            ctx.clearRect(0, 0, width, height)
            ctx.fillStyle = '#020008'
            ctx.fillRect(0, 0, width, height)

            const cx = width * (0.5 + Math.sin(renderTime * 0.00055) * 0.025)
            const cy = height * (0.5 + Math.cos(renderTime * 0.00048) * 0.025)
            const baseRadius = Math.min(width, height) * (0.12 + envelope * 0.22)

            const background = ctx.createRadialGradient(cx, cy, 0, cx, cy, width * 0.72)
            background.addColorStop(0, `rgba(255, 45, 117, ${0.16 + envelope * 0.24})`)
            background.addColorStop(0.38, `rgba(139, 92, 246, ${0.08 + mid * 0.16})`)
            background.addColorStop(0.76, `rgba(0, 245, 255, ${0.04 + high * 0.14})`)
            background.addColorStop(1, '#020008')
            ctx.fillStyle = background
            ctx.fillRect(0, 0, width, height)

            if (!hasAudioToDraw) {
                ctx.fillStyle = 'rgba(255,255,255,0.68)'
                ctx.font = '800 34px Inter, sans-serif'
                ctx.textAlign = 'center'
                ctx.fillText('WAITING FOR LIVE BASS', width / 2, height * 0.48)
                ctx.fillStyle = 'rgba(255,255,255,0.38)'
                ctx.font = '500 18px Inter, sans-serif'
                ctx.fillText('No fake pulse: this moves only from AudioFrame bass', width / 2, height * 0.55)
                if (active) frameId = requestAnimationFrame(render)
                return
            }

            ctx.globalCompositeOperation = 'lighter'

            for (let i = 0; i < 9; i += 1) {
                const phase = (i / 9 + renderTime * 0.00018) % 1
                const radius = Math.min(width, height) * (0.08 + phase * 0.78 + envelope * 0.08)
                const alpha = Math.max(0, (1 - phase) * (0.09 + envelope * 0.2))
                ctx.strokeStyle = `rgba(${i % 2 ? '0,245,255' : '255,45,117'},${alpha})`
                ctx.lineWidth = 2 + envelope * 7 + (1 - phase) * 3
                ctx.beginPath()
                ctx.arc(cx, cy, radius, 0, Math.PI * 2)
                ctx.stroke()
            }

            if (shockwave > 0.025) {
                ctx.strokeStyle = `rgba(255,255,255,${shockwave * 0.65})`
                ctx.lineWidth = 3 + shockwave * 12
                ctx.beginPath()
                ctx.arc(cx, cy, Math.min(width, height) * (0.18 + (1 - shockwave) * 0.62), 0, Math.PI * 2)
                ctx.stroke()
            }

            const core = ctx.createRadialGradient(cx, cy, baseRadius * 0.08, cx, cy, baseRadius)
            core.addColorStop(0, `rgba(255,255,255,${0.32 + envelope * 0.34})`)
            core.addColorStop(0.22, `rgba(255,45,117,${0.36 + envelope * 0.4})`)
            core.addColorStop(0.62, `rgba(139,92,246,${0.22 + mid * 0.28})`)
            core.addColorStop(1, 'rgba(0,245,255,0)')
            ctx.fillStyle = core
            ctx.beginPath()
            ctx.arc(cx, cy, baseRadius, 0, Math.PI * 2)
            ctx.fill()

            const points = 28
            ctx.strokeStyle = `rgba(255,255,255,${0.12 + envelope * 0.42})`
            ctx.lineWidth = 2 + envelope * 5
            ctx.beginPath()
            for (let i = 0; i <= points; i += 1) {
                const angle = (i / points) * Math.PI * 2
                const spike = 0.72 + Math.sin(angle * 6 + renderTime * 0.008) * 0.14 + Math.sin(angle * 11 - renderTime * 0.005) * 0.08
                const radius = baseRadius * (1.05 + spike * envelope * 0.72 + transient * 0.18)
                const x = cx + Math.cos(angle) * radius
                const y = cy + Math.sin(angle) * radius
                if (i === 0) ctx.moveTo(x, y)
                else ctx.lineTo(x, y)
            }
            ctx.closePath()
            ctx.stroke()

            for (let i = 0; i < 36; i += 1) {
                const angle = i * 2.39996 + renderTime * (0.00035 + envelope * 0.00042)
                const orbit = Math.min(width, height) * (0.18 + ((i % 9) / 9) * 0.46 + envelope * 0.08)
                const sparkle = 0.5 + Math.sin(renderTime * 0.006 + i * 1.7) * 0.5
                const size = 2 + sparkle * 3 + envelope * 5
                const x = cx + Math.cos(angle) * orbit
                const y = cy + Math.sin(angle * 1.18) * orbit * 0.58
                ctx.fillStyle = `rgba(${i % 3 === 0 ? '255,45,117' : i % 3 === 1 ? '0,245,255' : '255,255,255'},${0.16 + sparkle * 0.22 + envelope * 0.22})`
                ctx.beginPath()
                ctx.arc(x, y, size, 0, Math.PI * 2)
                ctx.fill()
            }

            ctx.globalCompositeOperation = 'source-over'
            if (currentIsLive) lastLiveSnapshot = { audioFrame, renderTime, envelope, shockwave, lastKick }
            drawStatusBadge(ctx, isFrozenPaused ? 'PAUSED · FROZEN' : 'PLAYING', width, isFrozenPaused)

            if (active) frameId = requestAnimationFrame(render)
        }

        render()
        return () => cancelAnimationFrame(frameId)
    }, [active, intensity])

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
