import { useEffect, useRef, useState } from 'react'

/**
 * useSystemAudio - High-energy Loopback Sync with CTO Themes
 * Captures pure system audio and provides multi-band EQ data.
 */
export const useSystemAudio = (sendDmxBatch) => {
    const [active, setActive] = useState(false)
    const [theme, setTheme] = useState('PULSE') // PULSE, RAVE, FLOW, CHILL
    const [eqData, setEqData] = useState(new Array(16).fill(0))
    const [isMono, setIsMono] = useState(false)

    const themeRef = useRef('PULSE')
    const isMonoRef = useRef(false)

    useEffect(() => { themeRef.current = theme }, [theme])
    useEffect(() => { isMonoRef.current = isMono }, [isMono])

    const audioCtx = useRef(null)
    const analyser = useRef(null)
    const streamRef = useRef(null)
    const requestRef = useRef(null)

    const stop = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop())
            streamRef.current = null
        }
        if (audioCtx.current) {
            audioCtx.current.close().catch(() => { })
            audioCtx.current = null
        }
        if (requestRef.current) cancelAnimationFrame(requestRef.current)
        setActive(false)
        setEqData(new Array(16).fill(0))
        window.audio?.stop()
    }

    const start = async () => {
        try {
            // CTO FIX: To get system audio in Electron we MUST use desktopCapturer source 
            // OR getDisplayMedia with specific audio constraints.
            // On Windows, getDisplayMedia is the modern way.
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: { width: 1, height: 1 },
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            })

            streamRef.current = stream

            const AudioContextClass = window.AudioContext || window.webkitAudioContext
            audioCtx.current = new AudioContextClass()

            const source = audioCtx.current.createMediaStreamSource(stream)
            analyser.current = audioCtx.current.createAnalyser()
            analyser.current.fftSize = 512 // More resolution for 16 bands
            analyser.current.smoothingTimeConstant = 0.5 // Faster response for visualizer
            source.connect(analyser.current)

            const bufferLength = analyser.current.frequencyBinCount
            const dataArray = new Uint8Array(bufferLength)

            setActive(true)
            window.audio?.start()

            const analyze = () => {
                if (!analyser.current) return
                analyser.current.getByteFrequencyData(dataArray)

                // 16-Band Equalizer for UI
                const newEq = []
                const step = Math.floor(bufferLength / 16)
                for (let i = 0; i < 16; i++) {
                    let sum = 0
                    for (let j = 0; j < step; j++) sum += dataArray[i * step + j]
                    newEq.push(sum / step / 255)
                }
                setEqData(newEq)

                // DMX Mapping Logic (The CTO Secret Sauce)
                const bass = newEq.slice(0, 2).reduce((a, b) => a + b, 0) / 2
                const mid = newEq.slice(3, 8).reduce((a, b) => a + b, 0) / 5
                const high = newEq.slice(10, 16).reduce((a, b) => a + b, 0) / 6

                let colors = []
                const currentTheme = themeRef.current

                if (currentTheme === 'PULSE') {
                    // Classic: Red Bass center, Blue Mids sides
                    const left = { r: 0, g: Math.round(mid * 100), b: Math.round(mid * 255) }
                    const center = { r: Math.round(bass * 255), g: Math.round(bass * 50), b: 0 }
                    const right = { r: 0, g: Math.round(mid * 100), b: Math.round(mid * 255) }
                    colors = [left, center, right]
                } else if (currentTheme === 'RAVE') {
                    // Aggressive: Strobing colors based on Highs
                    const color = high > 0.6 ? { r: 255, g: 255, b: 255 } : { r: Math.round(bass * 255), g: 0, b: Math.round(high * 255) }
                    colors = [color, color, color]
                } else if (currentTheme === 'FLOW') {
                    // Smooth: Pastel transitions
                    const r = Math.round(bass * 150 + mid * 100)
                    const g = Math.round(mid * 200)
                    const b = Math.round(high * 150 + bass * 50)
                    const flowColor = { r, g, b }
                    colors = [flowColor, flowColor, flowColor]
                } else if (currentTheme === 'CHILL') {
                    // Deep: Dark blues and purples
                    const chillColor = { r: Math.round(bass * 50), g: 0, b: Math.round(mid * 150) }
                    colors = [chillColor, chillColor, chillColor]
                }

                if (isMonoRef.current) {
                    // In mono, we average the three zones into one
                    const avg = {
                        r: Math.round((colors[0].r + colors[1].r + colors[2].r) / 3),
                        g: Math.round((colors[0].g + colors[1].g + colors[2].g) / 3),
                        b: Math.round((colors[0].b + colors[1].b + colors[2].b) / 3)
                    }
                    colors = [avg, avg, avg]
                }

                sendDmxBatch(colors)
                requestRef.current = requestAnimationFrame(analyze)
            }
            analyze()

            stream.getAudioTracks()[0].onended = stop
        } catch (err) {
            console.error('[Audio System] Final error:', err)
            stop()
        }
    }

    useEffect(() => {
        return () => stop()
    }, [])

    return { start, stop, active, eqData, isMono, setIsMono, theme, setTheme }
}
