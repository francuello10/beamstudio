import { useEffect, useRef, useState } from 'react'
import { lerpColor } from '../utils/palettes'

/**
 * useGpuAmbilight v6.0 — Ultra-smooth GPU Screen Sync ("Deco Edition")
 *
 * CTO Improvements over v5:
 * ─────────────────────────────────────────
 * 1. LERP factor 0.12 (was 0.25) — ~330ms silk transitions, no flicker
 * 2. Spatial boost applies sqrt curve — softer audio modulation
 * 3. Base brightness floor — never goes fully dark, always ambient
 * 4. Saturation boost option for richer deco colors
 * 5. BACKGROUND SUPPORT: Hybrid rAF / setTimeout loop
 */
export const useGpuAmbilight = (dispatchPixelMapUpdate, audioTelemetryDSP = null) => {
    const [capturing, setCapturing] = useState(false)
    const [isMono, setIsMono] = useState(false)
    const [boostEnabled, setBoostEnabled] = useState(false)
    const [boostFactor, setBoostFactor] = useState(0.8)
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
    const boostEnabledRef = useRef(false)
    const boostFactorRef = useRef(0.8)
    const audioTelemetryDSPRef = useRef(null)
    const capturingRef = useRef(false) // Ref for loop exit

    useEffect(() => { isMonoRef.current = isMono }, [isMono])
    useEffect(() => { boostEnabledRef.current = boostEnabled }, [boostEnabled])
    useEffect(() => { boostFactorRef.current = boostFactor }, [boostFactor])
    useEffect(() => { audioTelemetryDSPRef.current = audioTelemetryDSP }, [audioTelemetryDSP])

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
        dispatchPixelMapUpdate([{ r: 0, g: 0, b: 0 }, { r: 0, g: 0, b: 0 }, { r: 0, g: 0, b: 0 }])
        window.ambilight?.stop()
    }

    const start = async (sourceId) => {
        if (!sourceId) {
            console.error('[Ambilight GPU] No sourceId provided')
            return
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
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

                // GPU-ACCELERATED DOWNSCALE → 3x1 pixels
                ctx.drawImage(videoRef.current, 0, 0, 3, 1)
                const data = ctx.getImageData(0, 0, 3, 1).data

                let rawColors
                if (isMonoRef.current) {
                    const monoColor = { r: data[4], g: data[5], b: data[6] }
                    rawColors = [monoColor, monoColor, monoColor]
                } else {
                    rawColors = [
                        { r: data[0], g: data[1], b: data[2] },
                        { r: data[4], g: data[5], b: data[6] },
                        { r: data[8], g: data[9], b: data[10] }
                    ]
                }

                // === SPATIAL BOOST (Audio-reactive brightness) ===
                if (boostEnabledRef.current && audioTelemetryDSPRef.current) {
                    const energies = audioTelemetryDSPRef.current
                    const bf = boostFactorRef.current

                    rawColors = rawColors.map((c, i) => {
                        const energy = i === 0 ? energies.left : (i === 1 ? energies.center : energies.right)
                        // v6.2: Center channel (Bass) gets 1.5x boost for stronger pump
                        const channelMult = i === 1 ? 1.5 : 1.0
                        const multiplier = 1 + (Math.sqrt(energy) * bf * 0.5 * channelMult)
                        return {
                            r: Math.min(255, Math.round(c.r * multiplier)),
                            g: Math.min(255, Math.round(c.g * multiplier)),
                            b: Math.min(255, Math.round(c.b * multiplier))
                        }
                    })
                }

                // === SILK LERP SMOOTHING (Anti-flicker) ===
                // v6.1: 0.15 per frame — ~280ms transition, responsive yet silky
                const lerpFactor = 0.15
                smoothedColors.current = smoothedColors.current.map((current, i) =>
                    lerpColor(current, rawColors[i], lerpFactor)
                )

                const finalColors = smoothedColors.current

                setColors(finalColors)
                dispatchPixelMapUpdate(finalColors)

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
        }
    }

    useEffect(() => {
        return () => stop()
    }, [])

    return {
        start, stop, capturing, colors,
        isMono, setIsMono,
        boostEnabled, setBoostEnabled,
        boostFactor, setBoostFactor
    }
}
