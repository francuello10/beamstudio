import { useEffect, useRef, useState } from 'react'
import { lerpColor } from '../utils/palettes'

/**
 * useGpuAmbilight v5.0 - Ultra-smooth GPU Screen Sync
 * 
 * Features:
 * - GPU downscaling via OffscreenCanvas (3x1)
 * - LERP color smoothing (anti-flicker)
 * - Spatial Boost integration (audio-reactive brightness)
 */
export const useGpuAmbilight = (sendDmxBatch, audioEnergies = null) => {
    const [capturing, setCapturing] = useState(false)
    const [isMono, setIsMono] = useState(false)
    const [boostEnabled, setBoostEnabled] = useState(false)
    const [boostFactor, setBoostFactor] = useState(0.8) // 0.5-1.5 range
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

    // Ref for mode to avoid closure staleness in requestAnimationFrame
    const isMonoRef = useRef(false)
    const boostEnabledRef = useRef(false)
    const boostFactorRef = useRef(0.8)
    const audioEnergiesRef = useRef(null)

    useEffect(() => { isMonoRef.current = isMono }, [isMono])
    useEffect(() => { boostEnabledRef.current = boostEnabled }, [boostEnabled])
    useEffect(() => { boostFactorRef.current = boostFactor }, [boostFactor])
    useEffect(() => { audioEnergiesRef.current = audioEnergies }, [audioEnergies])

    const videoRef = useRef(null)
    const canvasRef = useRef(null)
    const requestRef = useRef(null)

    const stop = () => {
        if (videoRef.current?.srcObject) {
            videoRef.current.srcObject.getTracks().forEach(t => t.stop())
            videoRef.current.srcObject = null
        }
        if (requestRef.current) cancelAnimationFrame(requestRef.current)
        setCapturing(false)
        setColors([{ r: 0, g: 0, b: 0 }, { r: 0, g: 0, b: 0 }, { r: 0, g: 0, b: 0 }])
        smoothedColors.current = [{ r: 0, g: 0, b: 0 }, { r: 0, g: 0, b: 0 }, { r: 0, g: 0, b: 0 }]
        window.ambilight?.stop()
    }

    const start = async (sourceId) => {
        if (!sourceId) {
            console.error('[Ambilight GPU] No sourceId provided')
            return
        }

        try {
            // In Electron, we use getUserMedia for specific sourceIds from desktopCapturer
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
            window.ambilight?.start(sourceId)

            const ctx = canvasRef.current.getContext('2d', {
                alpha: false,
                desynchronized: true,
                willReadFrequently: true
            })

            const process = () => {
                if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) return

                // GPU-ACCELERATED DOWNSCALE
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
                if (boostEnabledRef.current && audioEnergiesRef.current) {
                    const energies = audioEnergiesRef.current
                    const bf = boostFactorRef.current

                    rawColors = rawColors.map((c, i) => {
                        const energy = i === 0 ? energies.left : (i === 1 ? energies.center : energies.right)
                        const multiplier = 1 + (energy * bf)
                        return {
                            r: Math.min(255, Math.round(c.r * multiplier)),
                            g: Math.min(255, Math.round(c.g * multiplier)),
                            b: Math.min(255, Math.round(c.b * multiplier))
                        }
                    })
                }

                // === LERP SMOOTHING (Anti-flicker) ===
                const lerpFactor = 0.25 // Colors chase target at 25% per frame
                smoothedColors.current = smoothedColors.current.map((current, i) =>
                    lerpColor(current, rawColors[i], lerpFactor)
                )

                const finalColors = smoothedColors.current

                setColors(finalColors)
                sendDmxBatch(finalColors)
                requestRef.current = requestAnimationFrame(process)
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
