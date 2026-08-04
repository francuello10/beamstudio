import React, { forwardRef, useEffect, useRef } from 'react'
import { useNowPlayingStore } from '../metadata/nowPlayingStore'
import { mergeRefs } from './refUtils'

const safeText = (value, fallback) => String(value || fallback)

const formatSeconds = (value) => {
    if (!Number.isFinite(value)) return '0:00'
    const total = Math.max(0, Math.floor(value))
    const minutes = Math.floor(total / 60)
    const seconds = String(total % 60).padStart(2, '0')
    return `${minutes}:${seconds}`
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

const drawRoundedRect = (ctx, x, y, width, height, radius) => {
    roundedRectPath(ctx, x, y, width, height, radius)
    ctx.fill()
}

const drawImageCover = (ctx, image, x, y, width, height) => {
    const imageRatio = image.naturalWidth / image.naturalHeight
    const targetRatio = width / height
    const sourceWidth = imageRatio > targetRatio ? image.naturalHeight * targetRatio : image.naturalWidth
    const sourceHeight = imageRatio > targetRatio ? image.naturalHeight : image.naturalWidth / targetRatio
    const sourceX = (image.naturalWidth - sourceWidth) / 2
    const sourceY = (image.naturalHeight - sourceHeight) / 2

    ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height)
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
const NowPlayingCardVisual = forwardRef(({ active = true, part = 'card' }, forwardedRef) => {
    const canvasRef = useRef(null)
    const artworkRef = useRef({ src: null, image: null, loaded: false, failed: false })

    useEffect(() => {
        let frameId = 0

        const getLoadedArtwork = (src) => {
            const artwork = artworkRef.current

            if (!src) {
                if (artwork.src) artworkRef.current = { src: null, image: null, loaded: false, failed: false }
                return null
            }

            if (artwork.src === src) return artwork.loaded && !artwork.failed ? artwork.image : null

            const image = new Image()
            const nextArtwork = { src, image, loaded: false, failed: false }
            artworkRef.current = nextArtwork

            // Remote covers must opt into CORS before being drawn into this
            // canvas, because MappingCompositor later uploads the canvas as a
            // WebGL texture. Local file:// MPRIS covers should be left alone.
            if (/^https?:\/\//i.test(src)) image.crossOrigin = 'anonymous'

            image.onload = () => {
                if (artworkRef.current.src === src) artworkRef.current = { ...nextArtwork, loaded: true }
            }
            image.onerror = () => {
                if (artworkRef.current.src === src) artworkRef.current = { src, image: null, loaded: false, failed: true }
            }
            image.src = src

            return null
        }

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

            ctx.clearRect(0, 0, width, height)
            ctx.fillStyle = '#000'
            ctx.fillRect(0, 0, width, height)

            const bg = ctx.createLinearGradient(0, 0, width, height)
            bg.addColorStop(0, '#150817')
            bg.addColorStop(0.45, '#06121f')
            bg.addColorStop(1, '#021b1f')
            ctx.fillStyle = bg
            ctx.fillRect(0, 0, width, height)

            const artworkImage = getLoadedArtwork(nowPlaying?.artwork)
            const progress = nowPlaying?.progress
            const progressPct = progress?.durationSec ? Math.max(0, Math.min(1, progress.positionSec / progress.durationSec)) : 0
            const title = safeText(nowPlaying?.title, isEmpty ? 'No active player' : 'Untitled')
            const artist = safeText(nowPlaying?.artist, isEmpty ? 'Start music to fill this zone' : 'Unknown artist')
            const album = safeText(nowPlaying?.album, isEmpty ? 'Waiting for track' : 'Unknown album')
            const timeText = progress ? `${formatSeconds(progress.positionSec)} / ${formatSeconds(progress.durationSec)}` : '0:00 / 0:00'

            const drawArtwork = (x, y, size, radius = 22) => {
                const artGradient = ctx.createLinearGradient(x, y, x + size, y + size)
                artGradient.addColorStop(0, '#123f36')
                artGradient.addColorStop(0.52, '#1d2a46')
                artGradient.addColorStop(1, '#e91e63')
                ctx.fillStyle = artGradient
                drawRoundedRect(ctx, x, y, size, size, radius)

                if (artworkImage) {
                    ctx.save()
                    roundedRectPath(ctx, x, y, size, size, radius)
                    ctx.clip()
                    drawImageCover(ctx, artworkImage, x, y, size, size)
                    ctx.restore()
                    return
                }

                ctx.fillStyle = 'rgba(255,255,255,0.9)'
                ctx.font = `${Math.max(70, size * 0.28)}px Inter, sans-serif`
                ctx.textAlign = 'center'
                ctx.textBaseline = 'middle'
                ctx.fillText('♪', x + size / 2, y + size / 2)
            }

            const drawTextOnly = (text, subtext, fontSize = 86) => {
                ctx.textAlign = 'center'
                ctx.textBaseline = 'middle'
                ctx.fillStyle = '#ffffff'
                ctx.font = `900 ${fontSize}px Inter, sans-serif`
                ctx.fillText(fitText(ctx, text, width * 0.86), width / 2, height * 0.48)
                if (subtext) {
                    ctx.fillStyle = 'rgba(255,255,255,0.58)'
                    ctx.font = '600 30px Inter, sans-serif'
                    ctx.fillText(fitText(ctx, subtext, width * 0.76), width / 2, height * 0.65)
                }
            }

            if (part === 'cover') {
                const size = Math.min(width, height) * 0.78
                drawArtwork((width - size) / 2, (height - size) / 2, size, 34)
            } else if (part === 'title') {
                drawTextOnly(title, artist, 92)
            } else if (part === 'artist') {
                drawTextOnly(artist, 'ARTIST', 86)
            } else if (part === 'album') {
                drawTextOnly(album, 'ALBUM', 78)
            } else if (part === 'progress') {
                const barX = width * 0.12
                const barY = height * 0.46
                const barW = width * 0.76
                ctx.fillStyle = 'rgba(255,255,255,0.16)'
                drawRoundedRect(ctx, barX, barY, barW, 34, 17)
                ctx.fillStyle = progress ? '#ff2d75' : 'rgba(255,45,117,0.22)'
                drawRoundedRect(ctx, barX, barY, barW * progressPct, 34, 17)
                ctx.fillStyle = '#ffffff'
                ctx.font = '800 38px Inter, sans-serif'
                ctx.textAlign = 'center'
                ctx.fillText(progress ? `${Math.round(progressPct * 100)}%` : 'NO PROGRESS DATA', width / 2, height * 0.64)
            } else if (part === 'time') {
                drawTextOnly(timeText, progress ? title : 'NO PROGRESS DATA', 86)
            } else {
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
                drawArtwork(artX, artY, artSize, 22)

                ctx.textBaseline = 'alphabetic'
                ctx.textAlign = 'center'
                ctx.fillStyle = '#ffffff'
                ctx.font = '800 40px Inter, sans-serif'
                ctx.fillText(fitText(ctx, title, cardWidth * 0.82), width / 2, y + cardHeight * 0.69)

                ctx.fillStyle = 'rgba(255,255,255,0.68)'
                ctx.font = '500 24px Inter, sans-serif'
                ctx.fillText(fitText(ctx, artist, cardWidth * 0.78), width / 2, y + cardHeight * 0.76)

                const barX = x + cardWidth * 0.16
                const barY = y + cardHeight * 0.86
                const barW = cardWidth * 0.68
                ctx.fillStyle = 'rgba(255,255,255,0.14)'
                drawRoundedRect(ctx, barX, barY, barW, 7, 4)
                ctx.fillStyle = '#ff2d75'
                drawRoundedRect(ctx, barX, barY, barW * progressPct, 7, 4)
            }

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
