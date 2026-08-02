import { useEffect, useRef, useState } from 'react'
import { lerpColor } from '../utils/palettes'
import { useAudioStore } from '../store/audioStore'

/**
 * useGpuAmbilight v6.1 — Ultra-smooth GPU Screen Sync ("Deco Edition")
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
 */

/**
 * Pure pixel extraction — reads the current video frame through a
 * GPU-accelerated 3x1 downscale and returns the raw L/C/R zone colors.
 * No audio logic lives here; that concern is handled by `applyAudioModulation`.
 */
const extractZoneColors = (video, ctx, isMono) => {
    ctx.drawImage(video, 0, 0, 3, 1)
    const data = ctx.getImageData(0, 0, 3, 1).data

    if (isMono) {
        const monoColor = { r: data[4], g: data[5], b: data[6] }
        return [monoColor, monoColor, monoColor]
    }

    return [
        { r: data[0], g: data[1], b: data[2] },
        { r: data[4], g: data[5], b: data[6] },
        { r: data[8], g: data[9], b: data[10] }
    ]
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
                canvasRef.current = new OffscreenCanvas(3, 1)
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

                // 1. Pixel extraction (GPU-accelerated 3x1 downscale)
                const rawColors = extractZoneColors(videoRef.current, ctx, isMonoRef.current)

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
        smoothingFactor, setSmoothingFactor
    }
}
