import { useEffect, useRef, useState } from 'react'

/**
 * useGpuAmbilight - Ultra-low CPU Screen Sync
 * Uses GPU downscaling via OffscreenCanvas (3x1)
 */
export const useGpuAmbilight = (sendDmxBatch) => {
    const [capturing, setCapturing] = useState(false)
    const [isMono, setIsMono] = useState(false)
    const [colors, setColors] = useState([
        { r: 0, g: 0, b: 0 },
        { r: 0, g: 0, b: 0 },
        { r: 0, g: 0, b: 0 }
    ])

    // Ref for mode to avoid closure staleness in requestAnimationFrame
    const isMonoRef = useRef(false)
    useEffect(() => { isMonoRef.current = isMono }, [isMono])

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

                let newColors;
                if (isMonoRef.current) {
                    const monoColor = { r: data[4], g: data[5], b: data[6] }
                    newColors = [monoColor, monoColor, monoColor]
                } else {
                    newColors = [
                        { r: data[0], g: data[1], b: data[2] },
                        { r: data[4], g: data[5], b: data[6] },
                        { r: data[8], g: data[9], b: data[10] }
                    ]
                }

                setColors(newColors)
                sendDmxBatch(newColors)
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

    return { start, stop, capturing, colors, isMono, setIsMono }
}
