import React, { forwardRef, useEffect, useRef } from 'react'
import { useNowPlayingStore } from '../metadata/nowPlayingStore'
import { mergeRefs } from './refUtils'

const safeText = (value, fallback) => String(value || fallback)

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

const fitText = (ctx, text, maxWidth) => {
    if (ctx.measureText(text).width <= maxWidth) return text
    let next = text
    while (next.length > 3 && ctx.measureText(`${next}…`).width > maxWidth) {
        next = next.slice(0, -1)
    }
    return `${next}…`
}

/**
 * NowPlayingCardVisual — Now Playing as a mappable visual source.
 * This is separate from the legacy full-screen DOM overlay so Projector Studio
 * can assign track metadata to one zone while other zones keep different layers.
 */
const NowPlayingCardVisual = forwardRef(({ active = true }, forwardedRef) => {
    const canvasRef = useRef(null)

    useEffect(() => {
        let frameId = 0
        let pulse = 0

        const render = () => {
            const canvas = canvasRef.current
            if (!canvas) {
                frameId = requestAnimationFrame(render)
                return
            }

            const ctx = canvas.getContext('2d')
            const width = canvas.width
            const height = canvas.height
            const { nowPlaying } = useNowPlayingStore.getState()
            const isEmpty = !nowPlaying || nowPlaying.state === 'no-player'
            pulse = (pulse + 0.012) % 1

            ctx.clearRect(0, 0, width, height)
            ctx.fillStyle = '#000'
            ctx.fillRect(0, 0, width, height)

            const bg = ctx.createLinearGradient(0, 0, width, height)
            bg.addColorStop(0, '#150817')
            bg.addColorStop(0.45, '#06121f')
            bg.addColorStop(1, '#021b1f')
            ctx.fillStyle = bg
            ctx.fillRect(0, 0, width, height)

            const cardWidth = width * 0.54
            const cardHeight = height * 0.74
            const x = (width - cardWidth) / 2
            const y = (height - cardHeight) / 2

            ctx.shadowColor = 'rgba(255, 45, 117, 0.35)'
            ctx.shadowBlur = 42
            ctx.fillStyle = 'rgba(12, 12, 18, 0.82)'
            drawRoundedRect(ctx, x, y, cardWidth, cardHeight, 28)
            ctx.shadowBlur = 0

            const artSize = cardHeight * 0.48
            const artX = x + (cardWidth - artSize) / 2
            const artY = y + 42
            const artGradient = ctx.createLinearGradient(artX, artY, artX + artSize, artY + artSize)
            artGradient.addColorStop(0, '#123f36')
            artGradient.addColorStop(0.52, '#1d2a46')
            artGradient.addColorStop(1, '#e91e63')
            ctx.fillStyle = artGradient
            drawRoundedRect(ctx, artX, artY, artSize, artSize, 22)

            ctx.fillStyle = 'rgba(255,255,255,0.9)'
            ctx.font = '800 70px Inter, sans-serif'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText('♪', artX + artSize / 2, artY + artSize / 2)

            ctx.textBaseline = 'alphabetic'
            ctx.fillStyle = '#ffffff'
            ctx.font = '800 40px Inter, sans-serif'
            ctx.fillText(fitText(ctx, safeText(nowPlaying?.title, isEmpty ? 'No active player' : 'Untitled'), cardWidth * 0.82), width / 2, y + cardHeight * 0.69)

            ctx.fillStyle = 'rgba(255,255,255,0.68)'
            ctx.font = '500 24px Inter, sans-serif'
            ctx.fillText(fitText(ctx, safeText(nowPlaying?.artist, isEmpty ? 'Start music to fill this zone' : 'Unknown artist'), cardWidth * 0.78), width / 2, y + cardHeight * 0.76)

            const progress = nowPlaying?.progress
            const pct = progress?.durationSec ? Math.max(0, Math.min(1, progress.positionSec / progress.durationSec)) : pulse
            const barX = x + cardWidth * 0.16
            const barY = y + cardHeight * 0.86
            const barW = cardWidth * 0.68
            ctx.fillStyle = 'rgba(255,255,255,0.14)'
            drawRoundedRect(ctx, barX, barY, barW, 7, 4)
            ctx.fillStyle = '#ff2d75'
            drawRoundedRect(ctx, barX, barY, barW * pct, 7, 4)

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

NowPlayingCardVisual.displayName = 'NowPlayingCardVisual'

export default NowPlayingCardVisual
