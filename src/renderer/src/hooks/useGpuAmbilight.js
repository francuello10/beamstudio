import { useEffect, useRef, useState } from 'react'
import { hslToRgb, lerpColor, rgbToHsl } from '../utils/palettes'
import { useAudioStore } from '../store/audioStore'

/**
 * useGpuAmbilight v6.2 — Ultra-smooth GPU Screen Sync ("Deco Edition")
 *
 * CTO Improvements over v5:
 * ─────────────────────────────────────────
 * 1. LERP factor 0.12 (was 0.25) — ~330ms silk transitions, no flicker
 * 2. Spatial boost applies sqrt curve — softer audio modulation
 * 3. Base brightness floor — never goes fully dark, always ambient
 * 4. Saturation boost option for richer deco colors
 * 5. BACKGROUND SUPPORT: Hybrid rAF / setTimeout loop
 * 6. Smoothing factor is configurable at runtime (see `smoothingFactor` /
 *    `setSmoothingFactor` below) instead of a hardcoded constant.
 * 7. Per-zone "most vivid pixel" sampling (see below) replaces the old
 *    whole-frame 3x1 downscale, which averaged a full third of the screen
 *    into a muted, gray-washed color. Saturation is then boosted further via
 *    `saturationBoost` / `setSaturationBoost`, same runtime-configurable
 *    pattern as `smoothingFactor`.
 */

// Per-zone sample grid size (NxN). Big enough to avoid single-pixel noise,
// small enough to stay cheap in a 60fps loop. The offscreen canvas is sized
// to fit all 3 zones side by side: ZONE_SAMPLE_SIZE * 3 wide.
const ZONE_SAMPLE_SIZE = 8

/**
 * Scans a zone's NxN sample block (a horizontal slice of the shared offscreen
 * canvas's raw pixel data, starting at column `zoneStartX`) and returns the
 * most saturated ("vivid") pixel in it — chroma = max(r,g,b) - min(r,g,b).
 * Near-black pixels (max channel < 20) are excluded so they can't win by
 * chroma=0 unless the whole zone is genuinely black. This is what lets one
 * bright accent color pop through instead of being diluted by a browser
 * bilinear average of muted UI chrome / dark backgrounds.
 */
const pickVividPixel = (data, canvasWidth, zoneStartX, size) => {
    let bestChroma = -1
    let best = { r: 0, g: 0, b: 0 }

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const idx = (y * canvasWidth + (zoneStartX + x)) * 4
            const r = data[idx]
            const g = data[idx + 1]
            const b = data[idx + 2]
            const maxc = Math.max(r, g, b)
            if (maxc < 20) continue // near-black — don't let true black "win" by default

            const chroma = maxc - Math.min(r, g, b)
            if (chroma > bestChroma) {
                bestChroma = chroma
                best = { r, g, b }
            }
        }
    }

    return best
}

// Boosts a color's HSL saturation by `boostFactor` (clamped to 100%) while
// leaving hue and lightness untouched, so mid-saturation source pixels still
// pop without pushing toward pure white/black.
const boostSaturation = (color, boostFactor) => {
    const { h, s, l } = rgbToHsl(color.r, color.g, color.b)
    return hslToRgb(h, Math.min(100, s * boostFactor), l)
}

/**
 * Pure pixel extraction — samples each screen third (L/C/R) separately at an
 * NxN grid via the 9-arg drawImage crop form (instead of one whole-frame 3x1
 * downscale), picks the most saturated pixel per zone, then applies a
 * saturation boost. No audio logic lives here; that concern is handled by
 * `applyAudioModulation`.
 */
const extractZoneColors = (video, ctx, isMono, sampleSize, saturationBoost) => {
    const canvasWidth = sampleSize * 3
    const videoWidth = video.videoWidth
    const videoHeight = video.videoHeight
    const zoneSourceWidth = videoWidth / 3

    for (let zone = 0; zone < 3; zone++) {
        ctx.drawImage(
            video,
            zone * zoneSourceWidth, 0, zoneSourceWidth, videoHeight, // source rect (crop this third)
            zone * sampleSize, 0, sampleSize, sampleSize // dest rect (this zone's slot)
        )
    }

    const data = ctx.getImageData(0, 0, canvasWidth, sampleSize).data

    if (isMono) {
        const centerVivid = pickVividPixel(data, canvasWidth, sampleSize, sampleSize)
        const monoColor = boostSaturation(centerVivid, saturationBoost)
        return [monoColor, monoColor, monoColor]
    }

    return [0, 1, 2].map(zone => {
        const vivid = pickVividPixel(data, canvasWidth, zone * sampleSize, sampleSize)
        return boostSaturation(vivid, saturationBoost)
    })
}

/**
 * Applies spatial (STEREO) / spectral (EQ) audio-driven boost multipliers on
 * top of raw extracted colors. Returns the raw colors untouched when audio
 * mode is OFF — this is the only place Ambilight's audio modulation logic
 * lives, kept separate from pixel extraction above. Reads the current
 * AudioFrame directly from useAudioStore rather than taking it as a
 * parameter, since it's called from inside a rAF loop at high frequency.
 */
const applyAudioModulation = (rawColors, audioMode, boostFactor) => {
    if (audioMode === 'OFF') return rawColors

    const audioFrame = useAudioStore.getState().audioFrame
    const spatialData = audioFrame.spatial
    const spectralData = audioFrame.spectral
    const bf = boostFactor

    let multipliers = [1.0, 1.0, 1.0]

    if (audioMode === 'STEREO') {
        // Mapping: L -> L, Center -> Bass, R -> R
        multipliers[0] = 1.0 + (spatialData.left * bf * 0.8)
        multipliers[1] = 1.0 + (spatialData.center * bf * 1.5) // Bass Kick
        multipliers[2] = 1.0 + (spatialData.right * bf * 0.8)
    } else if (audioMode === 'EQ') {
        // Mapping: 16 bands -> 3 zones
        // Left: Low Mids (Bands 2-6)
        const lowMids = spectralData.slice(2, 6).reduce((a, b) => a + b, 0) / 4
        // Center: Bass (Bands 0-1) + Vocals (Bands 7-10)
        const bassVocals = (spectralData[0] + spectralData[1] + spectralData.slice(7, 10).reduce((a, b) => a + b, 0) / 3) / 2
        // Right: Highs (Bands 11-15)
        const highs = spectralData.slice(11).reduce((a, b) => a + b, 0) / 5

        multipliers[0] = 1.0 + (lowMids * bf)
        multipliers[1] = 1.0 + (bassVocals * bf)
        multipliers[2] = 1.0 + (highs * bf)
    }

    return rawColors.map((c, i) => {
        const m = multipliers[i]
        return {
            r: Math.min(255, Math.round(c.r * m)),
            g: Math.min(255, Math.round(c.g * m)),
            b: Math.min(255, Math.round(c.b * m))
        }
    })
}

export const useGpuAmbilight = (dispatchPixelMapUpdate) => {
    const [capturing, setCapturing] = useState(false)
    const [isMono, setIsMono] = useState(false)

    // Configurable smoothing (LERP) factor — default (0.15) preserves prior
    // behavior; UI can adjust it via setSmoothingFactor without code changes.
    const [smoothingFactor, setSmoothingFactor] = useState(0.15)
    const smoothingFactorRef = useRef(0.15)
    useEffect(() => { smoothingFactorRef.current = smoothingFactor }, [smoothingFactor])

    // Configurable saturation-boost factor applied to the most-vivid pixel
    // picked per zone (see `extractZoneColors` / `boostSaturation` above).
    // Default 1.5 gives a noticeably punchier, "videogame-like" look without
    // clipping mid-saturation colors to pure white. Same runtime-configurable
    // pattern as `smoothingFactor` so a page can expose a slider later.
    const [saturationBoost, setSaturationBoost] = useState(1.5)
    const saturationBoostRef = useRef(1.5)
    useEffect(() => { saturationBoostRef.current = saturationBoost }, [saturationBoost])

    // Removed local boost state in favor of store state
    const [colors, setColors] = useState([
        { r: 0, g: 0, b: 0 },
        { r: 0, g: 0, b: 0 },
        { r: 0, g: 0, b: 0 }
    ])

    // Smoothed colors for LERP
    const smoothedColors = useRef([
        { r: 0, g: 0, b: 0 },
        { r: 0, g: 0, b: 0 },
        { r: 0, g: 0, b: 0 }
    ])

    const isMonoRef = useRef(false)
    const boostFactorRef = useRef(1.2) // Increased default boost
    const capturingRef = useRef(false) // Ref for loop exit

    useEffect(() => { isMonoRef.current = isMono }, [isMono])

    const videoRef = useRef(null)
    const canvasRef = useRef(null)
    const requestRef = useRef(null)
    const timerRef = useRef(null)

    const stop = () => {
        capturingRef.current = false
        if (videoRef.current?.srcObject) {
            videoRef.current.srcObject.getTracks().forEach(t => t.stop())
            videoRef.current.srcObject = null
        }
        if (requestRef.current) cancelAnimationFrame(requestRef.current)
        if (timerRef.current) clearTimeout(timerRef.current)

        setCapturing(false)
        setColors([{ r: 0, g: 0, b: 0 }, { r: 0, g: 0, b: 0 }, { r: 0, g: 0, b: 0 }])
        smoothedColors.current = [{ r: 0, g: 0, b: 0 }, { r: 0, g: 0, b: 0 }, { r: 0, g: 0, b: 0 }]
        // Ambilight owns DMX output while active (see ambilight:start in main/index.js
        // calling setOutputOwner('ambilight')) — tag every dispatch with the matching
        // 'ambilight' source so isAsyncOutputSourceAllowed() doesn't silently drop it.
        dispatchPixelMapUpdate([{ r: 0, g: 0, b: 0 }, { r: 0, g: 0, b: 0 }, { r: 0, g: 0, b: 0 }], 'ambilight')
        window.ambilight?.stop()
    }

    // BS-004: Wayland/PipeWire returns empty-named sources (or none at all)
    // from desktopCapturer.getSources() — see docs/revival/tasks/
    // BS-004_AMBILIGHT_QA.md. On Linux there is no usable sourceId to pre-
    // select, so this hook bypasses the classic Electron desktopCapturer +
    // getUserMedia({ mandatory: { chromeMediaSource: 'desktop', ... } })
    // pattern entirely and calls the standard getDisplayMedia() API instead.
    // With `enable-features=WebRTCPipeWireCapturer` already set in
    // src/main/index.js, this routes through Chromium's native
    // xdg-desktop-portal ScreenCast picker — a real OS dialog — so no
    // sourceId is needed at all. Non-Linux platforms are untouched and keep
    // using the desktopCapturer-enumerated sourceId + getUserMedia flow.
    const start = async (sourceId) => {
        const isLinux = window.platform === 'linux'

        if (!isLinux && !sourceId) {
            console.error('[Ambilight GPU] No sourceId provided')
            return
        }

        try {
            const stream = isLinux
                ? await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
                : await navigator.mediaDevices.getUserMedia({
                    audio: false,
                    video: {
                        mandatory: {
                            chromeMediaSource: 'desktop',
                            chromeMediaSourceId: sourceId,
                            minWidth: 1280,
                            maxWidth: 1920,
                            minHeight: 720,
                            maxHeight: 1080
                        }
                    }
                })

            if (!videoRef.current) {
                videoRef.current = document.createElement('video')
                videoRef.current.muted = true
            }

            videoRef.current.srcObject = stream
            await videoRef.current.play()

            if (!canvasRef.current) {
                canvasRef.current = new OffscreenCanvas(ZONE_SAMPLE_SIZE * 3, ZONE_SAMPLE_SIZE)
            }

            setCapturing(true)
            capturingRef.current = true
            window.ambilight?.start(sourceId)

            const ctx = canvasRef.current.getContext('2d', {
                alpha: false,
                desynchronized: true,
                willReadFrequently: true
            })

            const process = () => {
                if (!capturingRef.current) return
                if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) return

                // 1. Pixel extraction — per-zone most-vivid-pixel sampling
                const rawColors = extractZoneColors(
                    videoRef.current, ctx, isMonoRef.current, ZONE_SAMPLE_SIZE, saturationBoostRef.current
                )

                // 2. Audio-driven modulation (no-op when audio mode is OFF)
                const currentMode = useAudioStore.getState().audioMode
                const modulatedColors = applyAudioModulation(rawColors, currentMode, boostFactorRef.current)

                // 3. Silk LERP smoothing (anti-flicker) — factor is runtime-configurable
                smoothedColors.current = smoothedColors.current.map((current, i) =>
                    lerpColor(current, modulatedColors[i], smoothingFactorRef.current)
                )

                const finalColors = smoothedColors.current

                setColors(finalColors)
                // 'ambilight' must match dmxState.outputOwner set by ambilight:start,
                // otherwise isAsyncOutputSourceAllowed() rejects every frame silently.
                dispatchPixelMapUpdate(finalColors, 'ambilight')

                // Hybrid loop: setTimeout if hidden (keeps DMX running), raf if visible
                if (document.hidden) {
                    timerRef.current = setTimeout(process, 33)
                } else {
                    requestRef.current = requestAnimationFrame(process)
                }
            }
            process()

            stream.getVideoTracks()[0].onended = stop
        } catch (err) {
            console.error('[Ambilight GPU] Init failed:', err)
            stop()
            // Re-throw so callers (AmbilightPage's try/catch) can surface a real
            // error to the UI instead of the promise silently resolving.
            throw err
        }
    }

    useEffect(() => {
        return () => stop()
    }, [])

    return {
        start, stop, capturing, colors,
        isMono, setIsMono,
        smoothingFactor, setSmoothingFactor,
        saturationBoost, setSaturationBoost
    }
}
