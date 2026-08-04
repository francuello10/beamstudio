import React, { forwardRef, useEffect, useRef } from 'react'
import { useAudioStore } from '../store/audioStore'
import { mergeRefs } from './refUtils'

const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0))
const lerp = (a, b, t) => a + (b - a) * t

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


const drawXpPlayerFrame = (ctx, width, height, theme, title, live, progressPhase) => {
    const x = width * 0.055
    const y = height * 0.055
    const w = width * 0.89
    const h = height * 0.87
    const titleH = h * 0.115
    const controlsH = h * 0.19
    const viewportY = y + titleH + h * 0.025
    const viewportH = h - titleH - controlsH - h * 0.055

    ctx.save()
    ctx.globalCompositeOperation = 'source-over'

    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)'
    ctx.fillRect(0, 0, width, height)

    ctx.shadowColor = theme.a
    ctx.shadowBlur = 34
    const shell = ctx.createLinearGradient(x, y, x, y + h)
    shell.addColorStop(0, '#f4f8ff')
    shell.addColorStop(0.08, '#1f72d8')
    shell.addColorStop(0.18, '#0b3f98')
    shell.addColorStop(0.72, '#d7e3f5')
    shell.addColorStop(1, '#6f89ac')
    ctx.fillStyle = shell
    roundedRectPath(ctx, x, y, w, h, 28)
    ctx.rect(x + 28, viewportY, w - 56, viewportH)
    ctx.fill('evenodd')
    ctx.shadowBlur = 0

    const titleBar = ctx.createLinearGradient(x, y, x, y + titleH)
    titleBar.addColorStop(0, '#59a8ff')
    titleBar.addColorStop(0.42, '#1769d1')
    titleBar.addColorStop(1, '#0845a8')
    ctx.fillStyle = titleBar
    drawRoundedRect(ctx, x + 8, y + 8, w - 16, titleH, 20)

    ctx.fillStyle = '#ffffff'
    ctx.font = '900 22px Inter, sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText('Windows Media Player', x + 30, y + titleH * 0.58)

    ;['–', '□', '×'].forEach((glyph, index) => {
        const bx = x + w - 112 + index * 33
        const by = y + 24
        ctx.fillStyle = index === 2 ? '#e94b35' : '#e8f2ff'
        drawRoundedRect(ctx, bx, by, 25, 22, 6)
        ctx.fillStyle = index === 2 ? '#fff' : '#104a9e'
        ctx.font = '900 15px Inter, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(glyph, bx + 12.5, by + 12)
    })

    ctx.fillStyle = 'rgba(7, 17, 31, 0.18)'
    drawRoundedRect(ctx, x + 28, viewportY, w - 56, viewportH, 18)
    ctx.strokeStyle = 'rgba(255,255,255,0.72)'
    ctx.lineWidth = 3
    ctx.strokeRect(x + 36, viewportY + 8, w - 72, viewportH - 16)

    const controlsY = y + h - controlsH - 18
    const controls = ctx.createLinearGradient(x, controlsY, x, y + h)
    controls.addColorStop(0, '#f8fbff')
    controls.addColorStop(0.5, '#c8d7eb')
    controls.addColorStop(1, '#6f89ac')
    ctx.fillStyle = controls
    drawRoundedRect(ctx, x + 22, controlsY, w - 44, controlsH, 22)

    ctx.fillStyle = '#1d3557'
    ctx.font = '800 18px Inter, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(title, x + 44, controlsY + 34)

    const barX = x + 44
    const barY = controlsY + controlsH - 46
    const barW = w - 230
    ctx.fillStyle = '#8da8c9'
    drawRoundedRect(ctx, barX, barY, barW, 12, 6)
    ctx.fillStyle = live ? theme.a : '#5d718b'
    drawRoundedRect(ctx, barX, barY, barW * progressPhase, 12, 6)

    const buttonY = controlsY + controlsH * 0.48
    ;['⏮', live ? '▶' : 'Ⅱ', '⏭'].forEach((glyph, index) => {
        const cx = x + w - 160 + index * 43
        const r = index === 1 ? 18 : 14
        const g = ctx.createRadialGradient(cx, buttonY, 2, cx, buttonY, r)
        g.addColorStop(0, '#ffffff')
        g.addColorStop(1, index === 1 ? theme.a : '#6d89ad')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(cx, buttonY, r, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#0b2d66'
        ctx.font = `900 ${index === 1 ? 17 : 13}px Inter, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(glyph, cx, buttonY + 1)
    })

    ctx.fillStyle = live ? 'rgba(27, 215, 120, 0.92)' : 'rgba(255, 206, 84, 0.9)'
    ctx.font = '900 14px Inter, sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(live ? 'PLAYING' : 'AMBIENT', x + w - 44, controlsY + 34)

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

    useEffect(() => {
        let frameId = 0
        let smoothed = new Array(48).fill(0)
        let phase = 0
        const theme = THEMES[variant] || THEMES.xpBars

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
            const title = `WMP9 ${variant.replace(/([A-Z])/g, ' $1').toUpperCase()}`
            if (playerFrame) {
                drawXpPlayerFrame(ctx, width, height, theme, title, live, (phase * 0.18) % 1)
            } else {
                drawSkinChrome(ctx, width, height, theme, title)
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
