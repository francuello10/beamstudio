import React, { forwardRef, useEffect, useRef } from 'react'
import { useAudioStore } from '../store/audioStore'
import { useNowPlayingStore } from '../metadata/nowPlayingStore'
import { mergeRefs } from './refUtils'

const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0))
const lerp = (a, b, t) => a + (b - a) * t
const safeText = (value, fallback) => String(value || fallback)

const formatSeconds = (value) => {
    if (!Number.isFinite(value)) return '0:00'
    const total = Math.max(0, Math.floor(value))
    const minutes = Math.floor(total / 60)
    const seconds = String(total % 60).padStart(2, '0')
    return `${minutes}:${seconds}`
}

const fitText = (ctx, text, maxWidth) => {
    if (ctx.measureText(text).width <= maxWidth) return text
    let next = text
    while (next.length > 3 && ctx.measureText(`${next}…`).width > maxWidth) {
        next = next.slice(0, -1)
    }
    return `${next}…`
}

const THEMES = {
    xpBars: {
        bg: ['#00163f', '#0055c8', '#35d6ff'],
        a: '#19d7ff',
        b: '#70ff7a',
        c: '#fff06a'
    },
    classicScope: {
        bg: ['#020608', '#061612', '#132c1f'],
        a: '#39ff14',
        b: '#b6ff6a',
        c: '#ffffff'
    },
    spaceTunnel: {
        bg: ['#020014', '#12005f', '#ff2d75'],
        a: '#8b5cf6',
        b: '#00f5ff',
        c: '#ffffff'
    },
    aquarium: {
        bg: ['#001b2e', '#006d77', '#00f5ff'],
        a: '#00f5ff',
        b: '#7cffcb',
        c: '#ffcf7a'
    },
    daVinci: {
        bg: ['#1f1304', '#704214', '#d9a441'],
        a: '#d9a441',
        b: '#ffefb0',
        c: '#72e0ff'
    },
    goo: {
        bg: ['#160019', '#53006b', '#ff2d75'],
        a: '#ff2d75',
        b: '#8b5cf6',
        c: '#00f5ff'
    }
}

const sampleSpectrum = (spectral, index, count) => {
    if (!spectral.length) return 0
    const position = (index / Math.max(1, count - 1)) * (spectral.length - 1)
    const left = Math.floor(position)
    const right = Math.min(spectral.length - 1, left + 1)
    return lerp(clamp01(spectral[left]), clamp01(spectral[right]), position - left)
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

const drawArtworkThumb = (ctx, image, x, y, size, theme) => {
    const artGradient = ctx.createLinearGradient(x, y, x + size, y + size)
    artGradient.addColorStop(0, theme.bg[1])
    artGradient.addColorStop(0.52, '#123f8f')
    artGradient.addColorStop(1, theme.a)
    ctx.fillStyle = artGradient
    drawRoundedRect(ctx, x, y, size, size, 10)

    if (image) {
        ctx.save()
        roundedRectPath(ctx, x, y, size, size, 10)
        ctx.clip()
        drawImageCover(ctx, image, x, y, size, size)
        ctx.restore()
        return
    }

    ctx.fillStyle = 'rgba(255,255,255,0.92)'
    ctx.font = `900 ${Math.max(28, size * 0.42)}px Inter, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('♪', x + size / 2, y + size / 2)
}

const drawXpPlayerFrame = (ctx, width, height, theme, title, live, progressPhase, track, artworkImage) => {
    const x = width * 0.012
    const y = height * 0.016
    const w = width * 0.976
    const h = height * 0.952
    const titleH = 29
    const menuH = 25
    const modeH = 36
    const bottomH = 90
    const statusH = 20
    const leftW = w * 0.14
    const rightW = w * 0.23
    const bodyX = x + 8
    const bodyY = y + titleH + menuH + modeH
    const bodyW = w - 16
    const bodyH = h - titleH - menuH - modeH - bottomH - statusH - 8
    const visualX = bodyX + leftW + 10
    const visualY = bodyY + 8
    const visualW = bodyW - leftW - rightW - 20
    const visualH = bodyH - 14
    const rightX = visualX + visualW + 8
    const bottomY = y + h - bottomH - statusH
    const progress = clamp01(progressPhase)

    ctx.save()
    ctx.globalCompositeOperation = 'source-over'

    ctx.fillStyle = '#0046d5'
    ctx.fillRect(0, 0, width, height)

    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)'
    ctx.shadowBlur = 14
    ctx.shadowOffsetY = 4
    ctx.fillStyle = '#ece9d8'
    ctx.fillRect(x, y, w, h)
    ctx.shadowBlur = 0
    ctx.shadowOffsetY = 0

    ctx.strokeStyle = '#003caa'
    ctx.lineWidth = 4
    ctx.strokeRect(x + 2, y + 2, w - 4, h - 4)
    ctx.strokeStyle = '#6db6ff'
    ctx.lineWidth = 1
    ctx.strokeRect(x + 5, y + 5, w - 10, h - 10)

    const titleBar = ctx.createLinearGradient(x, y + 5, x, y + titleH)
    titleBar.addColorStop(0, '#4bb5ff')
    titleBar.addColorStop(0.46, '#1270ea')
    titleBar.addColorStop(1, '#0053d6')
    ctx.fillStyle = titleBar
    ctx.fillRect(x + 6, y + 6, w - 12, titleH - 4)

    const logoX = x + 20
    const logoY = y + 20
    const logo = ctx.createRadialGradient(logoX, logoY, 2, logoX, logoY, 9)
    logo.addColorStop(0, '#ffffff')
    logo.addColorStop(0.45, '#42d6ff')
    logo.addColorStop(1, '#0060c8')
    ctx.fillStyle = logo
    ctx.beginPath()
    ctx.arc(logoX, logoY, 9, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#ff9f00'
    ctx.beginPath()
    ctx.moveTo(logoX - 3, logoY - 5)
    ctx.lineTo(logoX + 5, logoY)
    ctx.lineTo(logoX - 3, logoY + 5)
    ctx.closePath()
    ctx.fill()

    ctx.fillStyle = '#ffffff'
    ctx.font = '900 17px Tahoma, Verdana, sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(fitText(ctx, `Windows Media Player - ${track.title}`, w * 0.58), x + 36, y + titleH * 0.78)

    ;['—', '□', '×'].forEach((glyph, index) => {
        const bx = x + w - 108 + index * 32
        const by = y + 10
        const button = ctx.createLinearGradient(bx, by, bx, by + 22)
        button.addColorStop(0, index === 2 ? '#ffb18c' : '#e7f5ff')
        button.addColorStop(1, index === 2 ? '#d73720' : '#2f84f4')
        ctx.fillStyle = button
        drawRoundedRect(ctx, bx, by, 25, 22, 4)
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 1
        ctx.strokeRect(bx + 1, by + 1, 23, 20)
        ctx.fillStyle = '#ffffff'
        ctx.font = '900 14px Tahoma, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(glyph, bx + 12.5, by + 11)
    })

    const menuY = y + titleH + 5
    ctx.fillStyle = '#f7f4e8'
    ctx.fillRect(x + 6, menuY, w - 12, menuH)
    ctx.strokeStyle = '#c6c2ad'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x + 7, menuY + menuH)
    ctx.lineTo(x + w - 7, menuY + menuH)
    ctx.stroke()

    ctx.fillStyle = '#111111'
    ctx.font = '13px Tahoma, Verdana, sans-serif'
    let menuX = x + 18
    ;['File', 'View', 'Play', 'Tools', 'Help'].forEach((label) => {
        ctx.fillText(label, menuX, menuY + 16)
        menuX += ctx.measureText(label).width + 24
    })

    const tabsY = menuY + menuH
    const tabs = ctx.createLinearGradient(x, tabsY, x, tabsY + modeH)
    tabs.addColorStop(0, '#f9fcff')
    tabs.addColorStop(0.42, '#c5dcf8')
    tabs.addColorStop(1, '#6d8bc3')
    ctx.fillStyle = tabs
    ctx.fillRect(x + 6, tabsY, w - 12, modeH)
    ctx.strokeStyle = '#5b75a7'
    ctx.strokeRect(x + 6, tabsY, w - 12, modeH)

    const tabLabels = ['Now Playing', 'Library', 'Rip', 'Burn', 'Sync', 'Guide']
    let tabX = x + leftW + 8
    tabLabels.forEach((label, index) => {
        const tabW = index === 0 ? 112 : 78
        const active = index === 0
        const tabGradient = ctx.createLinearGradient(tabX, tabsY + 4, tabX, tabsY + modeH - 3)
        tabGradient.addColorStop(0, active ? '#ffffff' : '#e8f2ff')
        tabGradient.addColorStop(1, active ? '#4f92e6' : '#87a7d5')
        ctx.fillStyle = tabGradient
        drawRoundedRect(ctx, tabX, tabsY + 5, tabW, modeH - 8, 8)
        ctx.fillStyle = active ? '#ffffff' : '#14315e'
        ctx.font = '800 14px Tahoma, Verdana, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(label, tabX + tabW / 2, tabsY + 25)
        tabX += tabW + 6
    })

    ctx.fillStyle = '#1c3471'
    ctx.fillRect(bodyX, bodyY, bodyW, bodyH)

    const side = ctx.createLinearGradient(bodyX, bodyY, bodyX + leftW, bodyY + bodyH)
    side.addColorStop(0, '#eaf5ff')
    side.addColorStop(0.52, '#bfd4f0')
    side.addColorStop(1, '#7389c5')
    ctx.fillStyle = side
    drawRoundedRect(ctx, bodyX + 4, bodyY + 6, leftW - 8, bodyH - 10, 10)

    const navItems = ['Now\nPlaying', 'Media\nGuide', 'Copy from\nCD', 'Media\nLibrary', 'Radio\nTuner', 'Copy to CD\nor Device']
    navItems.forEach((label, index) => {
        const itemY = bodyY + 18 + index * 49
        if (index === 0) {
            ctx.fillStyle = 'rgba(255,255,255,0.55)'
            ctx.fillRect(bodyX + 8, itemY - 9, leftW - 20, 42)
            ctx.fillStyle = '#0f2c63'
            ctx.beginPath()
            ctx.moveTo(bodyX + leftW - 18, itemY + 12)
            ctx.lineTo(bodyX + leftW - 10, itemY + 17)
            ctx.lineTo(bodyX + leftW - 18, itemY + 22)
            ctx.fill()
        }
        ctx.fillStyle = '#061942'
        ctx.font = '900 13px Tahoma, Verdana, sans-serif'
        ctx.textAlign = 'left'
        label.split('\n').forEach((line, lineIndex) => ctx.fillText(line, bodyX + 17, itemY + lineIndex * 14))
    })
    ctx.fillStyle = '#f1f4ff'
    ctx.font = '900 20px Tahoma, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('⌄', bodyX + leftW * 0.5, bodyY + bodyH - 18)

    ctx.fillStyle = '#02040c'
    ctx.fillRect(visualX - 4, visualY - 4, visualW + 8, visualH + 8)
    ctx.strokeStyle = '#0b0b0b'
    ctx.lineWidth = 5
    ctx.strokeRect(visualX - 4, visualY - 4, visualW + 8, visualH + 8)
    ctx.strokeStyle = 'rgba(255,255,255,0.34)'
    ctx.lineWidth = 1
    ctx.strokeRect(visualX, visualY, visualW, visualH)

    const rightPanel = ctx.createLinearGradient(rightX, visualY - 4, rightX, visualY + visualH + 4)
    rightPanel.addColorStop(0, '#6177bf')
    rightPanel.addColorStop(0.38, '#3f5488')
    rightPanel.addColorStop(1, '#1b3f72')
    ctx.fillStyle = rightPanel
    ctx.fillRect(rightX, visualY - 4, rightW - 8, visualH + 8)

    const selectY = visualY - 38
    const select = ctx.createLinearGradient(rightX, selectY, rightX, selectY + 27)
    select.addColorStop(0, '#f6fbff')
    select.addColorStop(1, '#b8cceb')
    ctx.fillStyle = select
    drawRoundedRect(ctx, rightX, selectY, rightW - 8, 27, 5)
    ctx.strokeStyle = '#5d76ad'
    ctx.strokeRect(rightX + 1, selectY + 1, rightW - 10, 25)
    ctx.fillStyle = '#001f59'
    ctx.font = '800 13px Tahoma, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('▸  Now Playing', rightX + 12, selectY + 18)
    ctx.textAlign = 'right'
    ctx.fillText('⌄', rightX + rightW - 20, selectY + 18)

    drawArtworkThumb(ctx, artworkImage, rightX + rightW * 0.23, visualY + 28, rightW * 0.48, theme)
    ctx.fillStyle = '#ffffff'
    ctx.font = '900 14px Tahoma, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(fitText(ctx, track.title, rightW * 0.74), rightX + rightW * 0.47, visualY + rightW * 0.55 + 52)
    ctx.fillStyle = '#d8e7ff'
    ctx.font = '700 12px Tahoma, sans-serif'
    ctx.fillText(fitText(ctx, track.artist, rightW * 0.7), rightX + rightW * 0.47, visualY + rightW * 0.55 + 70)

    const listY = visualY + rightW * 0.55 + 94
    ctx.fillStyle = 'rgba(0,0,0,0.22)'
    ctx.fillRect(rightX + 10, listY - 16, rightW - 28, visualY + visualH - listY + 12)
    ctx.font = '11px Tahoma, sans-serif'
    ctx.textAlign = 'left'
    const rows = [track.title, 'Legacy visual layer', title.replace('WMP9 ', ''), track.album, track.statusLabel]
    rows.forEach((row, index) => {
        const rowY = listY + index * 19
        ctx.fillStyle = index === 0 ? '#ffffff' : '#c6d8ff'
        ctx.fillText(`${index + 1}`, rightX + 16, rowY)
        ctx.fillText(fitText(ctx, row, rightW - 74), rightX + 38, rowY)
        ctx.textAlign = 'right'
        ctx.fillText(index === 0 ? track.timeText.split(' / ')[1] : '--:--', rightX + rightW - 20, rowY)
        ctx.textAlign = 'left'
    })

    const statusY = bottomY - statusH
    ctx.fillStyle = '#11182c'
    ctx.fillRect(visualX - 4, statusY, visualW + rightW + 4, statusH)
    ctx.fillStyle = '#d7e4ff'
    ctx.font = '11px Tahoma, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(`${track.statusLabel.toLowerCase()} • ${track.timeText}`, visualX + 10, statusY + 14)

    const bottom = ctx.createLinearGradient(x + 6, bottomY, x + 6, bottomY + bottomH)
    bottom.addColorStop(0, '#ffffff')
    bottom.addColorStop(0.18, '#c8daf5')
    bottom.addColorStop(0.58, '#edf6ff')
    bottom.addColorStop(1, '#7c96cc')
    ctx.fillStyle = bottom
    ctx.fillRect(x + 6, bottomY, w - 12, bottomH)
    ctx.strokeStyle = '#6a82b7'
    ctx.strokeRect(x + 6, bottomY, w - 12, bottomH)

    const progressX = x + 62
    const progressY = bottomY + 13
    const progressW = w - 124
    const progressTrack = ctx.createLinearGradient(progressX, progressY, progressX, progressY + 10)
    progressTrack.addColorStop(0, '#d1d8e8')
    progressTrack.addColorStop(1, '#ffffff')
    ctx.fillStyle = progressTrack
    drawRoundedRect(ctx, progressX, progressY, progressW, 10, 5)
    ctx.fillStyle = track.hasProgress ? '#62d21f' : '#a8b7d8'
    drawRoundedRect(ctx, progressX, progressY, progressW * progress, 10, 5)
    ctx.strokeStyle = '#8ea4cf'
    ctx.strokeRect(progressX, progressY, progressW, 10)
    ctx.fillStyle = '#f6fbff'
    drawRoundedRect(ctx, progressX + progressW * progress - 4, progressY - 3, 8, 16, 4)

    const mainButtonX = x + 78
    const mainButtonY = bottomY + 42
    const mainButton = ctx.createRadialGradient(mainButtonX + 21, mainButtonY + 21, 3, mainButtonX + 21, mainButtonY + 21, 23)
    mainButton.addColorStop(0, '#ffffff')
    mainButton.addColorStop(0.55, '#96d4ff')
    mainButton.addColorStop(1, '#3674c9')
    ctx.fillStyle = mainButton
    ctx.beginPath()
    ctx.arc(mainButtonX + 21, mainButtonY + 21, 22, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#5e7caf'
    ctx.stroke()
    ctx.fillStyle = '#ffffff'
    ctx.font = '900 25px Tahoma, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(track.isPaused ? '▶' : 'Ⅱ', mainButtonX + 22, mainButtonY + 22)

    const smallButtons = ['■', '⏮', '⏭', '◄']
    smallButtons.forEach((glyph, index) => {
        const cx = mainButtonX + 72 + index * 38
        const cy = mainButtonY + 21
        const g = ctx.createLinearGradient(cx - 13, cy - 13, cx + 13, cy + 13)
        g.addColorStop(0, '#ffffff')
        g.addColorStop(1, '#8cb3df')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(cx, cy, 13, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = '#6d8fc0'
        ctx.stroke()
        ctx.fillStyle = '#315a8e'
        ctx.font = '900 12px Tahoma, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(glyph, cx, cy + 1)
    })

    const infoX = mainButtonX + 245
    ctx.fillStyle = '#24436f'
    ctx.font = '900 13px Tahoma, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(fitText(ctx, track.title, w * 0.32), infoX, bottomY + 62)
    ctx.fillStyle = '#3f5e88'
    ctx.font = '700 12px Tahoma, sans-serif'
    ctx.fillText(fitText(ctx, `${track.artist}  •  ${track.timeText}`, w * 0.38), infoX, bottomY + 78)

    const volumeX = x + w - 170
    ctx.strokeStyle = '#77a0c9'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(volumeX, bottomY + 61)
    ctx.lineTo(volumeX + 74, bottomY + 61)
    ctx.stroke()
    ctx.fillStyle = '#55d11b'
    drawRoundedRect(ctx, volumeX + 42, bottomY + 54, 8, 15, 4)
    ctx.fillStyle = '#245f9a'
    ctx.font = '900 15px Tahoma, sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(track.timeText.split(' / ')[0], x + w - 22, bottomY + 63)

    ctx.restore()
}

const drawSkinChrome = (ctx, width, height, theme, title) => {
    ctx.save()
    ctx.globalCompositeOperation = 'source-over'
    ctx.shadowColor = theme.a
    ctx.shadowBlur = 18
    ctx.fillStyle = 'rgba(255,255,255,0.08)'
    drawRoundedRect(ctx, width * 0.05, height * 0.055, width * 0.9, height * 0.105, 20)
    ctx.shadowBlur = 0

    ctx.fillStyle = 'rgba(0,0,0,0.46)'
    drawRoundedRect(ctx, width * 0.065, height * 0.075, width * 0.19, height * 0.065, 12)
    ;['◀', '▶', '●'].forEach((glyph, index) => {
        ctx.fillStyle = index === 1 ? theme.b : 'rgba(255,255,255,0.7)'
        ctx.font = '800 22px Inter, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(glyph, width * (0.095 + index * 0.058), height * 0.108)
    })

    ctx.fillStyle = 'rgba(255,255,255,0.84)'
    ctx.font = '800 18px Inter, sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(title, width * 0.925, height * 0.114)
    ctx.restore()
}

const Wmp9SkinPackVisual = forwardRef(({ active = true, variant = 'xpBars', playerFrame = false }, forwardedRef) => {
    const canvasRef = useRef(null)
    const artworkRef = useRef({ src: null, image: null, loaded: false, failed: false })

    useEffect(() => {
        let frameId = 0
        let smoothed = new Array(48).fill(0)
        let phase = 0
        const theme = THEMES[variant] || THEMES.xpBars

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
            const visualTitle = `WMP9 ${variant.replace(/([A-Z])/g, ' $1').toUpperCase()}`
            const { nowPlaying } = useNowPlayingStore.getState()
            const noPlayer = !nowPlaying || nowPlaying.state === 'no-player'
            const progress = nowPlaying?.progress
            const progressPct = progress?.durationSec ? Math.max(0, Math.min(1, progress.positionSec / progress.durationSec)) : null
            const track = {
                title: safeText(nowPlaying?.title, noPlayer ? visualTitle : 'Untitled track'),
                artist: safeText(nowPlaying?.artist, noPlayer ? 'Start music to fill this XP player' : 'Unknown artist'),
                album: safeText(nowPlaying?.album, noPlayer ? 'Waiting for system media' : 'Unknown album'),
                hasProgress: progressPct !== null,
                timeText: progress ? `${formatSeconds(progress.positionSec)} / ${formatSeconds(progress.durationSec)}` : '0:00 / 0:00',
                isPaused: String(nowPlaying?.playbackStatus || '').toLowerCase() === 'paused',
                statusLabel: noPlayer ? 'NO PLAYER' : String(nowPlaying?.playbackStatus || '').toLowerCase() === 'paused' ? 'PAUSED' : 'PLAYING'
            }
            const artworkImage = getLoadedArtwork(nowPlaying?.artwork)
            const spectral = Array.isArray(audioFrame?.spectral) ? audioFrame.spectral : []
            const bass = clamp01(audioFrame?.levels?.bass)
            const mid = clamp01(audioFrame?.levels?.mid)
            const high = clamp01(audioFrame?.levels?.high)
            const volume = clamp01(audioFrame?.levels?.volume)
            const live = Number.isFinite(audioFrame?.timestamp) && now - audioFrame.timestamp < 3000 && !audioFrame?.status?.silence && volume > 0.01
            const energy = live ? Math.max(volume, bass * 0.82, mid * 0.55) : 0.18
            phase += live ? 0.008 + energy * 0.035 : 0.006

            const bg = ctx.createRadialGradient(width * 0.5, height * 0.52, 0, width * 0.5, height * 0.52, width * 0.78)
            bg.addColorStop(0, theme.bg[2])
            bg.addColorStop(0.38, theme.bg[1])
            bg.addColorStop(1, theme.bg[0])
            ctx.fillStyle = bg
            ctx.fillRect(0, 0, width, height)

            ctx.globalCompositeOperation = 'lighter'
            if (variant === 'spaceTunnel') {
                const cx = width / 2
                const cy = height * 0.56
                for (let i = 0; i < 38; i += 1) {
                    const t = (i / 38 + phase * 0.16) % 1
                    const radius = Math.pow(t, 1.8) * width * (0.72 + bass * 0.16)
                    ctx.strokeStyle = `rgba(${i % 2 ? '0,245,255' : '255,45,117'},${(1 - t) * (0.12 + energy * 0.3)})`
                    ctx.lineWidth = 1 + (1 - t) * 8
                    ctx.beginPath()
                    ctx.ellipse(cx, cy, radius, radius * 0.34, phase + t * 4, 0, Math.PI * 2)
                    ctx.stroke()
                }
            } else if (variant === 'goo') {
                for (let i = 0; i < 18; i += 1) {
                    const band = sampleSpectrum(spectral, i, 18)
                    const x = width * (0.1 + ((i * 0.137 + phase * 0.05) % 0.8))
                    const y = height * (0.24 + 0.56 * (0.5 + Math.sin(phase * 1.8 + i) * 0.5))
                    const r = width * (0.045 + Math.pow(Math.max(band, energy * 0.3), 0.7) * 0.095)
                    const blob = ctx.createRadialGradient(x, y, 0, x, y, r)
                    blob.addColorStop(0, `rgba(255,255,255,${0.13 + high * 0.18})`)
                    blob.addColorStop(0.45, `${theme.a}aa`)
                    blob.addColorStop(1, `${theme.b}00`)
                    ctx.fillStyle = blob
                    ctx.beginPath()
                    ctx.arc(x, y, r, 0, Math.PI * 2)
                    ctx.fill()
                }
            } else if (variant === 'aquarium') {
                for (let i = 0; i < 30; i += 1) {
                    const band = sampleSpectrum(spectral, i, 30)
                    const x = width * ((i * 0.073 + phase * (0.025 + band * 0.02)) % 1)
                    const y = height * (0.25 + (i % 7) * 0.085 + Math.sin(phase * 2 + i) * 0.018)
                    ctx.fillStyle = i % 4 === 0 ? theme.c : theme.a
                    ctx.globalAlpha = 0.28 + band * 0.48
                    ctx.beginPath()
                    ctx.ellipse(x, y, width * (0.012 + band * 0.025), height * 0.015, Math.sin(phase + i), 0, Math.PI * 2)
                    ctx.fill()
                }
                ctx.globalAlpha = 1
            } else if (variant === 'daVinci') {
                const cx = width / 2
                const cy = height * 0.56
                for (let i = 0; i < 9; i += 1) {
                    const r = Math.min(width, height) * (0.08 + i * 0.045 + energy * 0.08)
                    ctx.strokeStyle = i % 2 ? `${theme.a}99` : `${theme.b}88`
                    ctx.lineWidth = 1.5 + bass * 5
                    ctx.beginPath()
                    ctx.ellipse(cx, cy, r * (1.3 + Math.sin(phase + i) * 0.18), r, phase * (i % 2 ? 1 : -1) + i, 0, Math.PI * 2)
                    ctx.stroke()
                }
            } else {
                const count = variant === 'classicScope' ? 32 : 48
                const marginX = width * 0.075
                const baseY = height * 0.82
                const gap = width * 0.006
                const barW = (width - marginX * 2 - gap * (count - 1)) / count
                for (let i = 0; i < count; i += 1) {
                    const raw = live ? sampleSpectrum(spectral, i, count) : 0.08 + Math.sin(phase + i) * 0.03
                    const shaped = Math.pow(clamp01(raw), 0.65)
                    smoothed[i] += (shaped - smoothed[i]) * (shaped > smoothed[i] ? 0.35 : 0.12)
                    const barH = Math.max(height * 0.035, smoothed[i] * height * (0.52 + energy * 0.18))
                    const x = marginX + i * (barW + gap)
                    const y = baseY - barH
                    const g = ctx.createLinearGradient(x, baseY, x, y)
                    g.addColorStop(0, theme.a)
                    g.addColorStop(0.62, theme.b)
                    g.addColorStop(1, theme.c)
                    ctx.shadowColor = theme.a
                    ctx.shadowBlur = 8 + bass * 42
                    ctx.fillStyle = g
                    drawRoundedRect(ctx, x, y, barW, barH, barW * 0.45)
                }

                if (variant === 'classicScope') {
                    ctx.shadowBlur = 18
                    ctx.strokeStyle = theme.a
                    ctx.lineWidth = 3
                    ctx.beginPath()
                    for (let i = 0; i <= 120; i += 1) {
                        const x = (i / 120) * width
                        const band = live ? sampleSpectrum(spectral, i, 120) : 0.08
                        const y = height * 0.38 + Math.sin(i * 0.35 + phase * 5) * height * (0.025 + band * 0.11)
                        if (i === 0) ctx.moveTo(x, y)
                        else ctx.lineTo(x, y)
                    }
                    ctx.stroke()
                }
            }

            ctx.globalCompositeOperation = 'source-over'
            ctx.globalAlpha = 1
            if (playerFrame) {
                drawXpPlayerFrame(ctx, width, height, theme, visualTitle, live, track.hasProgress ? progressPct : (phase * 0.18) % 1, track, artworkImage)
            } else {
                drawSkinChrome(ctx, width, height, theme, visualTitle)
            }

            if (active) frameId = requestAnimationFrame(render)
        }

        render()
        return () => cancelAnimationFrame(frameId)
    }, [active, variant, playerFrame])

    return (
        <canvas
            ref={mergeRefs(canvasRef, forwardedRef)}
            width={1024}
            height={576}
            style={{ width: '100%', height: '100%', display: 'block' }}
        />
    )
})

Wmp9SkinPackVisual.displayName = 'Wmp9SkinPackVisual'

export default Wmp9SkinPackVisual
