import { useEffect, useRef, useState, useCallback } from 'react'
import { multiplyBrightness, GENRE_PROFILES } from '../utils/palettes'

/**
 * useSystemAudio v5.0 - True Stereo 2.1 DSP Engine + Spatial Export
 * 
 * Features:
 * - 3 Separate AnalyserNodes (L, R, Bass)
 * - Virtual 2.1 Crossover (Bass → Center, Mids/Highs → Sides)
 * - Smart Vibe Engine (Auto Genre Detection) with LATIN/CINEMA
 * - Pro Visuals Data Export
 * - Modifier Mode (accepts inputColors and modulates brightness)
 * - NEW: audioTelemetryDSP export for Ambilight Boost
 */
export const useSystemAudio = (sendDmxBatch, inputColors = null, onAudioUpdate = null) => {
    // === STATE ===
    const [active, setActive] = useState(false)
    const [autoGenre, setAutoGenre] = useState(true)
    const [manualGenre, setManualGenre] = useState('ELECTRO') // Manual override
    const [detectedGenre, setDetectedGenre] = useState('UNKNOWN')
    const [telemetry, setTelemetry] = useState({
        lowEndDynamics: 0,
        transientDensity: 0,
        midRms: 0,
        stereoWidth: 0
    })
    const [visualizerData, setVisualizerData] = useState({
        left: new Array(16).fill(0),
        right: new Array(16).fill(0),
        bass: 0
    })
    const [modifierMode, setModifierMode] = useState(false)
    const [energyFactor, setEnergyFactor] = useState(1)

    // NEW V5.0: Audio telemetry DSP for Ambilight boost
    const [audioTelemetryDSP, setAudioTelemetryDSP] = useState({
        left: 0,
        center: 0,
        right: 0
    })

    // === REFS FOR CLOSURE SAFETY ===
    const inputColorsRef = useRef(inputColors)
    const modifierModeRef = useRef(modifierMode)

    useEffect(() => { inputColorsRef.current = inputColors }, [inputColors])
    useEffect(() => { modifierModeRef.current = modifierMode }, [modifierMode])

    // === REFS ===
    const audioCtx = useRef(null)
    const analyserL = useRef(null)
    const analyserR = useRef(null)
    const analyserBass = useRef(null)
    const streamRef = useRef(null)
    const requestRef = useRef(null)

    // Peak hold for visual decay
    const peakHoldL = useRef(new Array(16).fill(0))
    const peakHoldR = useRef(new Array(16).fill(0))
    const peakHoldBass = useRef(0)

    // Genre detection history
    const genreHistory = useRef([])
    const lastGenreCheck = useRef(0)

    // === CLEANUP ===
    const stop = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop())
            streamRef.current = null
        }
        if (audioCtx.current) {
            audioCtx.current.close().catch(() => { })
            audioCtx.current = null
        }
        if (requestRef.current) clearInterval(requestRef.current)

        setActive(false)
        setDetectedGenre('UNKNOWN')
        setVisualizerData({ left: new Array(16).fill(0), right: new Array(16).fill(0), bass: 0 })
        setAudioTelemetryDSP({ left: 0, center: 0, right: 0 })
        window.audio?.stop()
    }, [])

    // === MAIN ENGINE ===
    const start = useCallback(async () => {
        try {
            // 1. Capture Audio Stream (Standard Input)
            // Fix: Decoupled from Ambilight/Screen Capture to prevent Screen Picker popup.
            // User can route System Audio via OS settings (e.g. PulseAudio Monitor, Virtual Cable).
            console.log('[Audio DSP] Requesting Audio Input...')

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    autoGainControl: false,
                    noiseSuppression: false,
                    latency: 0
                },
                video: false
            })

            streamRef.current = stream

            // 3. Build Web Audio Graph (True Stereo)
            const AudioContextClass = window.AudioContext || window.webkitAudioContext
            audioCtx.current = new AudioContextClass()

            const source = audioCtx.current.createMediaStreamSource(stream)

            // Channel Splitter (Stereo → L/R)
            const splitter = audioCtx.current.createChannelSplitter(2)
            source.connect(splitter)

            // LEFT Analyser (Channel 0)
            analyserL.current = audioCtx.current.createAnalyser()
            analyserL.current.fftSize = 512
            analyserL.current.smoothingTimeConstant = 0.4
            splitter.connect(analyserL.current, 0)

            // RIGHT Analyser (Channel 1)
            analyserR.current = audioCtx.current.createAnalyser()
            analyserR.current.fftSize = 512
            analyserR.current.smoothingTimeConstant = 0.4
            splitter.connect(analyserR.current, 1)

            // BASS Analyser (Mono Mix L+R for Subwoofer)
            const merger = audioCtx.current.createChannelMerger(2)
            splitter.connect(merger, 0, 0)
            splitter.connect(merger, 1, 1)
            analyserBass.current = audioCtx.current.createAnalyser()
            analyserBass.current.fftSize = 256
            analyserBass.current.smoothingTimeConstant = 0.2 // SNAPPY for kicks
            merger.connect(analyserBass.current)

            setActive(true)
            window.audio?.start()

            // 4. Analysis Loop
            const dataL = new Uint8Array(analyserL.current.frequencyBinCount)
            const dataR = new Uint8Array(analyserR.current.frequencyBinCount)
            const dataBass = new Uint8Array(analyserBass.current.frequencyBinCount)

            const analyze = () => {
                if (!analyserL.current) return

                analyserL.current.getByteFrequencyData(dataL)
                analyserR.current.getByteFrequencyData(dataR)
                analyserBass.current.getByteFrequencyData(dataBass)

                // === FREQUENCY EXTRACTION ===
                const extractBands = (data, count = 16) => {
                    const bands = []
                    const step = Math.floor(data.length / count)
                    for (let i = 0; i < count; i++) {
                        let sum = 0
                        for (let j = 0; j < step; j++) sum += data[i * step + j]
                        bands.push(sum / step / 255)
                    }
                    return bands
                }

                const bandsL = extractBands(dataL)
                const bandsR = extractBands(dataR)

                // Bass (20-150Hz) = First 3 bins of bass analyser
                let bassEnergy = 0
                for (let i = 0; i < 3; i++) bassEnergy += dataBass[i]
                bassEnergy = bassEnergy / 3 / 255

                // === PEAK HOLD & DECAY (Visual Physics) ===
                const decayRate = 0.92
                for (let i = 0; i < 16; i++) {
                    peakHoldL.current[i] = Math.max(bandsL[i], peakHoldL.current[i] * decayRate)
                    peakHoldR.current[i] = Math.max(bandsR[i], peakHoldR.current[i] * decayRate)
                }
                peakHoldBass.current = Math.max(bassEnergy, peakHoldBass.current * decayRate)

                // === STEREO WIDTH CALCULATION ===
                let diffSum = 0
                for (let i = 0; i < 16; i++) diffSum += Math.abs(bandsL[i] - bandsR[i])
                const stereoWidth = diffSum / 16

                // === LOW-MIDS FOR LATIN (200-800Hz ~ bands 2-6) ===
                const lowMidL = bandsL.slice(2, 7).reduce((a, b) => a + b, 0) / 5
                const lowMidR = bandsR.slice(2, 7).reduce((a, b) => a + b, 0) / 5
                const lowMidAvg = (lowMidL + lowMidR) / 2

                // === GENRE DETECTION (Every 2.5s) with LATIN/CINEMA ===
                const now = performance.now()
                if (now - lastGenreCheck.current > 2500) {
                    lastGenreCheck.current = now

                    // Metrics
                    const bassRMS = Math.sqrt(bassEnergy)
                    const midL = bandsL.slice(4, 10).reduce((a, b) => a + b, 0) / 6
                    const midR = bandsR.slice(4, 10).reduce((a, b) => a + b, 0) / 6
                    const midRms = (midL + midR) / 2

                    // Transient detection (compare peak to average)
                    const peakMax = Math.max(...peakHoldL.current, ...peakHoldR.current)
                    const avgEnergy = (bandsL.reduce((a, b) => a + b, 0) + bandsR.reduce((a, b) => a + b, 0)) / 32
                    const transientRatio = avgEnergy > 0.01 ? peakMax / avgEnergy : 0

                    // Dynamic range for CINEMA detection
                    const dynamicRange = peakMax - avgEnergy

                    // Classify with new genres
                    let genre = 'CHILL'
                    if (bassRMS > 0.5 && transientRatio > 1.8) genre = 'ELECTRO'
                    else if (midRms > 0.4 && transientRatio > 1.2) genre = 'ROCK'
                    else if (lowMidAvg > 0.35 && transientRatio > 1.0 && transientRatio < 1.5) genre = 'LATIN'
                    else if (dynamicRange > 0.6 && transientRatio > 2.0) genre = 'CINEMA'

                    genreHistory.current.push(genre)
                    if (genreHistory.current.length > 5) genreHistory.current.shift()

                    // Mode of last 5
                    const counts = { ELECTRO: 0, ROCK: 0, CHILL: 0, LATIN: 0, CINEMA: 0 }
                    genreHistory.current.forEach(g => counts[g]++)
                    const stable = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]

                    setDetectedGenre(stable)
                    setTelemetry({
                        lowEndDynamics: Math.round(bassRMS * 100),
                        transientDensity: Math.round(transientRatio * 50),
                        midRms: Math.round(midRms * 100),
                        stereoWidth: Math.round(stereoWidth * 100)
                    })
                }

                // === DMX OUTPUT (2.1 Virtual Crossover) ===
                // Mids/Highs for sides (bands 4-15)
                const midHighL = bandsL.slice(4).reduce((a, b) => a + b, 0) / 12
                const midHighR = bandsR.slice(4).reduce((a, b) => a + b, 0) / 12

                // EXPONENTIAL BASS for more punch
                const bassExp = Math.pow(bassEnergy, 2.5)
                const kickFlash = bassEnergy > 0.8 // Kick detected!

                // === UPDATE SPATIAL ENERGIES FOR AMBILIGHT ===
                const energies = {
                    left: midHighL,
                    center: bassEnergy,
                    right: midHighR
                }
                setAudioTelemetryDSP(energies)
                if (onAudioUpdate) onAudioUpdate(energies)

                // Color mapping based on genre (auto or manual)
                let colorL, colorC, colorR
                const currentGenre = autoGenre ? detectedGenre : manualGenre
                const profile = GENRE_PROFILES[currentGenre] || GENRE_PROFILES.CHILL

                if (currentGenre === 'ELECTRO') {
                    // Hard strobe: White flash on bass peaks
                    if (kickFlash) {
                        colorC = { r: 255, g: 255, b: 255 } // KICK FLASH
                    } else {
                        colorC = { r: Math.round(bassExp * 255), g: 0, b: Math.round(bassExp * 100) }
                    }
                    colorL = { r: Math.round(midHighL * 255), g: 0, b: Math.round(midHighL * 150) }
                    colorR = { r: Math.round(midHighR * 255), g: 0, b: Math.round(midHighR * 150) }
                } else if (currentGenre === 'ROCK') {
                    // Organic warm tones with kick boost
                    const baseR = Math.round(bassExp * 255)
                    const baseG = Math.round(bassExp * 100)
                    if (kickFlash) {
                        colorC = { r: Math.min(255, baseR + 100), g: Math.min(255, baseG + 100), b: 50 }
                    } else {
                        colorC = { r: baseR, g: baseG, b: 0 }
                    }
                    colorL = { r: Math.round(midHighL * 200), g: Math.round(midHighL * 100), b: 0 }
                    colorR = { r: Math.round(midHighR * 200), g: Math.round(midHighR * 100), b: 0 }
                } else if (currentGenre === 'LATIN') {
                    // Warm mid-focused (low-mids drive the color)
                    const warmFactor = lowMidAvg * profile.midWeight
                    colorC = { r: Math.round(warmFactor * 255), g: Math.round(warmFactor * 150), b: Math.round(bassExp * 50) }
                    colorL = { r: Math.round(lowMidL * 200), g: Math.round(lowMidL * 120), b: 0 }
                    colorR = { r: Math.round(lowMidR * 200), g: Math.round(lowMidR * 120), b: 0 }
                } else if (currentGenre === 'CINEMA') {
                    // Extreme dynamics - punchy bass, dramatic
                    const cinemaBase = bassExp * profile.bassWeight
                    if (kickFlash) {
                        colorC = { r: 255, g: 200, b: 100 } // Explosion flash
                    } else {
                        colorC = { r: Math.round(cinemaBase * 200), g: Math.round(cinemaBase * 100), b: Math.round(cinemaBase * 255) }
                    }
                    colorL = { r: Math.round(midHighL * 150), g: Math.round(midHighL * 80), b: Math.round(midHighL * 255) }
                    colorR = { r: Math.round(midHighR * 150), g: Math.round(midHighR * 80), b: Math.round(midHighR * 255) }
                } else {
                    // CHILL: Cool tones, smooth but still reactive
                    colorC = { r: 0, g: Math.round(bassExp * 80), b: Math.round(bassExp * 200) }
                    colorL = { r: 0, g: Math.round(midHighL * 100), b: Math.round(midHighL * 200) }
                    colorR = { r: 0, g: Math.round(midHighR * 100), b: Math.round(midHighR * 200) }
                }

                // === MODIFIER MODE: Apply audio energy to external colors ===
                const globalEnergy = (bassEnergy + (midHighL + midHighR) / 2) / 2
                const boostFactor = 0.3 + globalEnergy * 1.2 // Range: 0.3 to 1.5 (overdrive on peaks)
                setEnergyFactor(boostFactor)

                let finalColors = [colorL, colorC, colorR]

                // If modifierMode is ON and we have inputColors, modulate those instead
                if (modifierModeRef.current && inputColorsRef.current && inputColorsRef.current.length >= 3) {
                    finalColors = inputColorsRef.current.map((c, i) => {
                        // Apply bass boost to center, mid/high boost to sides
                        const factor = i === 1 ? (0.4 + bassExp * 3.0) : (0.4 + (i === 0 ? midHighL : midHighR) * 1.5)
                        return multiplyBrightness(c, factor)
                    })
                }

                sendDmxBatch(finalColors)

                // === UPDATE VISUALIZER DATA ===
                setVisualizerData({
                    left: [...peakHoldL.current],
                    right: [...peakHoldR.current],
                    bass: peakHoldBass.current
                })

            }
            // Use setInterval instead of rAF - keeps running when minimized
            requestRef.current = setInterval(analyze, 16) // ~60fps

            stream.getAudioTracks()[0].onended = stop
        } catch (err) {
            console.error('[Audio DSP] Failed:', err)
            stop()
        }
    }, [sendDmxBatch, stop, detectedGenre])

    // Cleanup on unmount
    useEffect(() => () => stop(), [stop])

    return {
        // Controls
        start, stop, active,
        // Genre
        detectedGenre, autoGenre, setAutoGenre, manualGenre, setManualGenre,
        // Modifier Mode
        modifierMode, setModifierMode, energyFactor,
        // NEW V5.0: Spatial energies for Ambilight
        audioTelemetryDSP,
        // Telemetry
        telemetry,
        // Visualizer
        visualizerData
    }
}
