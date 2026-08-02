import { useEffect, useRef, useState, useCallback } from 'react'
import { multiplyBrightness, lerpColor, GENRE_PROFILES } from '../utils/palettes'
import { createAudioFrame } from '../audio/AudioFrame'
import {
    applyPeakHold,
    buildFrameTelemetry,
    buildSpatialResponse,
    buildSpectralResponse,
    computeBassEnergy,
    computeLowMid,
    computeMidHigh,
    computeStereoWidth,
    detectStableGenre,
    extractBands
} from '../audio/AudioAnalyzer'
import {
    listAudioInputs,
    readStoredAudioInputId,
    resolveActiveAudioSource,
    requestAudioInputStream,
    writeStoredAudioInputId
} from '../audio/AudioSourceManager'

/**
 * useSystemAudio v6.1 — Expert Deco Tuning for Thonet & Vander Ratsel 2.1
 *
 * Signal Chain (8 precision tuning points):
 * ─────────────────────────────────────────
 * 1. L/R analyser smoothing: 0.65 (organic mids/highs)
 * 2. Bass analyser smoothing: 0.45 (breathes, doesn't punch)
 * 3. Peak decay: 0.96 (~300ms luxurious fade)
 * 4. Bass curve: pow(1.5) (sweet spot: present but never hectic)
 * 5. Modifier center: 0.45-1.55x (floor 45%, never dark)
 * 6. Modifier sides: 0.5-1.4x (subtle shimmer)
 * 7. LERP modifier: 0.28 (~250ms diffused transitions)
 * 8. LERP standalone: 0.20 (smooth genre output)
 * 9. BACKGROUND SUPPORT: Recursive setTimeout (Anti-Throttle)
 */
export const useSystemAudio = (sendDmxBatch, inputColors = null, onAudioUpdate = null, audioSensitivity = 1.0) => {
    // === STATE ===
    const [active, setActive] = useState(false)
    const [reconnecting, setReconnecting] = useState(false)
    const [availableInputs, setAvailableInputs] = useState([])
    const [selectedDeviceId, setSelectedDeviceIdState] = useState(() => readStoredAudioInputId())
    const [sourceError, setSourceError] = useState(null)
    const [activeSource, setActiveSource] = useState({ deviceId: '', label: '', fallbackToDefault: false })
    const [autoGenre, setAutoGenre] = useState(true)
    const [manualGenre, setManualGenre] = useState('ELECTRO')
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
    const [bassPulseMode, setBassPulseMode] = useState(false)
    const [energyFactor, setEnergyFactor] = useState(1)

    // Audio telemetry DSP for Ambilight boost
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

    const bassPulseModeRef = useRef(bassPulseMode)
    useEffect(() => { bassPulseModeRef.current = bassPulseMode }, [bassPulseMode])
    const activeRef = useRef(active)
    useEffect(() => { activeRef.current = active }, [active])

    // === REFS ===
    const audioCtx = useRef(null)
    const analyserL = useRef(null)
    const analyserR = useRef(null)
    const analyserBass = useRef(null)
    const streamRef = useRef(null)
    const timerRef = useRef(null) // Using setTimeout for robust background timing

    // Peak hold with slower decay (0.95 → ~250ms visible tail)
    const peakHoldL = useRef(new Array(16).fill(0))
    const peakHoldR = useRef(new Array(16).fill(0))
    const peakHoldBass = useRef(0)

    // Genre detection history
    const genreHistory = useRef([])
    const lastGenreCheck = useRef(0)

    // LERP smoothing buffer for output colors (silk transitions)
    const smoothedOutput = useRef([
        { r: 0, g: 0, b: 0 },
        { r: 0, g: 0, b: 0 },
        { r: 0, g: 0, b: 0 }
    ])
    const activeSourceRef = useRef({ deviceId: '', label: '', fallbackToDefault: false })

    const refreshInputs = useCallback(async () => {
        const inputs = await listAudioInputs()
        setAvailableInputs(inputs)
        return inputs
    }, [])

    const setSelectedDeviceId = useCallback((deviceId) => {
        setSelectedDeviceIdState(deviceId)
        setSourceError(null)
        writeStoredAudioInputId(deviceId)
    }, [])

    useEffect(() => {
        refreshInputs().catch(() => { })

        if (!navigator.mediaDevices?.addEventListener) return undefined

        const handleDeviceChange = () => refreshInputs().catch(() => { })
        navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange)
        return () => navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange)
    }, [refreshInputs])

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
        if (timerRef.current) {
            clearTimeout(timerRef.current)
            timerRef.current = null
        }

        setActive(false)
        setReconnecting(false)
        setDetectedGenre('UNKNOWN')
        setVisualizerData({ left: new Array(16).fill(0), right: new Array(16).fill(0), bass: 0 })
        setAudioTelemetryDSP({ left: 0, center: 0, right: 0 })
        smoothedOutput.current = [
            { r: 0, g: 0, b: 0 },
            { r: 0, g: 0, b: 0 },
            { r: 0, g: 0, b: 0 }
        ]
        activeSourceRef.current = { deviceId: '', label: '', fallbackToDefault: false }
        setActiveSource({ deviceId: '', label: '', fallbackToDefault: false })
        window.audio?.stop()
    }, [])

    // === MAIN ENGINE ===
    const start = useCallback(async () => {
        try {
            stop()
            setSourceError(null)
            const inputs = await refreshInputs().catch(() => [])

            const baseAudioConstraints = {
                echoCancellation: false,
                autoGainControl: false,
                noiseSuppression: false,
                latency: 0
            }

            const {
                stream,
                fallbackToDefault,
                preferredInput,
                requestedDeviceId
            } = await requestAudioInputStream({
                selectedDeviceId,
                inputs,
                constraints: baseAudioConstraints
            }).catch(async (err) => {
                throw err
            })

            if (fallbackToDefault && requestedDeviceId) {
                setSourceError(selectedDeviceId
                    ? 'Selected audio input is unavailable. BeamStudio fell back to the default input.'
                    : 'Preferred monitor input is unavailable. BeamStudio fell back to the default input.')
            }

            streamRef.current = stream
            const refreshedInputs = await refreshInputs().catch(() => [])
            activeSourceRef.current = resolveActiveAudioSource({
                stream,
                refreshedInputs,
                requestedDeviceId,
                selectedDeviceId,
                preferredInput,
                fallbackToDefault
            })
            setActiveSource(activeSourceRef.current)

            const AudioContextClass = window.AudioContext || window.webkitAudioContext
            audioCtx.current = new AudioContextClass()

            const source = audioCtx.current.createMediaStreamSource(stream)

            // Channel Splitter (Stereo → L/R)
            const splitter = audioCtx.current.createChannelSplitter(2)
            source.connect(splitter)

            // LEFT Analyser — organic smoothing for deco mids/highs
            analyserL.current = audioCtx.current.createAnalyser()
            analyserL.current.fftSize = 512
            analyserL.current.smoothingTimeConstant = 0.65 // [T1] Deco: organic, less nervous
            splitter.connect(analyserL.current, 0)

            // RIGHT Analyser
            analyserR.current = audioCtx.current.createAnalyser()
            analyserR.current.fftSize = 512
            analyserR.current.smoothingTimeConstant = 0.65 // [T1] Match L channel
            splitter.connect(analyserR.current, 1)

            // BASS Analyser (Mono Mix L+R)
            const merger = audioCtx.current.createChannelMerger(2)
            splitter.connect(merger, 0, 0)
            splitter.connect(merger, 1, 1)
            analyserBass.current = audioCtx.current.createAnalyser()
            analyserBass.current.fftSize = 256
            analyserBass.current.smoothingTimeConstant = 0.45 // [T2] Deco: bass breathes, doesn't punch
            merger.connect(analyserBass.current)

            setActive(true)
            window.audio?.start()

            const dataL = new Uint8Array(analyserL.current.frequencyBinCount)
            const dataR = new Uint8Array(analyserR.current.frequencyBinCount)
            const dataBass = new Uint8Array(analyserBass.current.frequencyBinCount)

            const analyze = () => {
                if (!analyserL.current) return

                analyserL.current.getByteFrequencyData(dataL)
                analyserR.current.getByteFrequencyData(dataR)
                analyserBass.current.getByteFrequencyData(dataBass)

                const bandsL = extractBands(dataL)
                const bandsR = extractBands(dataR)
                const bassEnergy = computeBassEnergy(dataBass)
                const peakState = applyPeakHold({
                    bandsL,
                    bandsR,
                    bassEnergy,
                    peakHoldL: peakHoldL.current,
                    peakHoldR: peakHoldR.current,
                    peakHoldBass: peakHoldBass.current,
                    decayRate: 0.96
                })
                peakHoldBass.current = peakState.peakHoldBass
                const bassSmooth = peakState.bassSmooth
                const stereoWidth = computeStereoWidth(bandsL, bandsR)
                const { lowMidL, lowMidR, lowMidAvg } = computeLowMid(bandsL, bandsR)

                // === GENRE DETECTION (Every 2.5s) ===
                const now = performance.now()
                if (now - lastGenreCheck.current > 2500) {
                    lastGenreCheck.current = now
                    const genreState = detectStableGenre({
                        bassEnergy,
                        bandsL,
                        bandsR,
                        lowMidAvg,
                        peakHoldL: peakHoldL.current,
                        peakHoldR: peakHoldR.current,
                        genreHistory: genreHistory.current,
                        stereoWidth
                    })

                    genreHistory.current = genreState.nextHistory
                    setDetectedGenre(genreState.stableGenre)
                    setTelemetry(genreState.telemetry)
                }

                // Sides: Mid/High energy (bands 4-15) — needed by BOTH Bass Pulse and Genre mode
                const { midHighL, midHighR } = computeMidHigh(bandsL, bandsR)

                // ═══════════════════════════════════════════════
                // BASS PULSE MODE — Pure bass-driven ON/OFF lights
                // ═══════════════════════════════════════════════
                if (bassPulseModeRef.current) {
                    const bassBrightness = Math.pow(bassEnergy, 0.8)
                    const ambientFloor = 0.05
                    const centerIntensity = Math.max(ambientFloor, bassBrightness)
                    const centerColor = {
                        r: Math.round(255 * centerIntensity),
                        g: Math.round(180 * centerIntensity),
                        b: Math.round(100 * centerIntensity)
                    }

                    const leftIntensity = Math.max(ambientFloor, Math.pow(midHighL, 0.9))
                    const rightIntensity = Math.max(ambientFloor, Math.pow(midHighR, 0.9))
                    const leftColor = {
                        r: Math.round(150 * leftIntensity),
                        g: Math.round(120 * leftIntensity),
                        b: Math.round(255 * leftIntensity)
                    }
                    const rightColor = {
                        r: Math.round(150 * rightIntensity),
                        g: Math.round(120 * rightIntensity),
                        b: Math.round(255 * rightIntensity)
                    }

                    const PULSE_LERP = 0.4
                    smoothedOutput.current = smoothedOutput.current.map((current, i) =>
                        lerpColor(current, [leftColor, centerColor, rightColor][i], PULSE_LERP)
                    )

                    const energies = { left: midHighL, center: Math.pow(bassEnergy, 1.5), right: midHighR }
                    setAudioTelemetryDSP(energies)
                    if (onAudioUpdate) onAudioUpdate(energies)

                    sendDmxBatch(smoothedOutput.current)
                    setEnergyFactor(bassBrightness)

                    setVisualizerData({
                        left: [...peakHoldL.current],
                        right: [...peakHoldR.current],
                        bass: peakHoldBass.current
                    })
                    return // Loop handled by process wrapper
                }

                // ═══════════════════════════════════════════════
                // v7.0 CENTRALIZED AUDIO INTELLIGENCE
                // ═══════════════════════════════════════════════

                // 1. SPATIAL ANALYSIS (Bass=Center, Mids=Stereo)
                const spatial = buildSpatialResponse({ midHighL, bassSmooth, midHighR })
                const spectral = buildSpectralResponse(bandsL, bandsR)

                const energies = spatial

                const highEnergy = spectral.slice(10).reduce((sum, value) => sum + value, 0) / 6
                const midEnergy = spectral.slice(4, 10).reduce((sum, value) => sum + value, 0) / 6
                const volume = Math.min(1.0, (bassSmooth + midHighL + midHighR) / 3)
                const silence = volume < 0.025
                const clipping = Math.max(...spectral, bassSmooth, midHighL, midHighR) >= 0.98
                const frameTelemetry = buildFrameTelemetry({
                    bassEnergy,
                    bandsL,
                    bandsR,
                    peakHoldL: peakHoldL.current,
                    peakHoldR: peakHoldR.current,
                    midEnergy,
                    stereoWidth
                })

                const audioFrame = createAudioFrame({
                    timestamp: Date.now(),
                    source: activeSourceRef.current,
                    levels: {
                        bass: bassSmooth,
                        mid: midEnergy,
                        high: highEnergy,
                        volume,
                        stereoWidth
                    },
                    spatial,
                    spectral,
                    telemetry: frameTelemetry,
                    status: { silence, clipping },
                    genre: autoGenre ? detectedGenre : manualGenre
                })

                // 3. ATOMIC UPDATE
                useAudioStore.getState().updateAudioAnalysis(spatial, spectral, audioFrame)

                // Legacy Internal State (keep for now to not break old consumers immediately if any)
                setAudioTelemetryDSP(energies)
                if (onAudioUpdate) onAudioUpdate(energies)

                // ═══════════════════════════════════════════════
                // v6.1 "DECO MODE" — Refined Color Engine
                // ═══════════════════════════════════════════════

                let colorL, colorC, colorR
                const currentGenre = autoGenre ? detectedGenre : manualGenre

                if (currentGenre === 'ELECTRO') {
                    const bassGlow = bassSmooth * 0.85
                    colorC = {
                        r: Math.round(200 * bassGlow + 40),
                        g: Math.round(80 * bassGlow + 15),
                        b: Math.round(120 * bassGlow + 30)
                    }
                    colorL = {
                        r: Math.round(midHighL * 180 + 20),
                        g: Math.round(midHighL * 50 + 10),
                        b: Math.round(midHighL * 200 + 30)
                    }
                    colorR = {
                        r: Math.round(midHighR * 180 + 20),
                        g: Math.round(midHighR * 50 + 10),
                        b: Math.round(midHighR * 200 + 30)
                    }
                } else if (currentGenre === 'ROCK') {
                    colorC = {
                        r: Math.round(220 * bassSmooth + 20),
                        g: Math.round(130 * bassSmooth + 15),
                        b: Math.round(20 * bassSmooth + 5)
                    }
                    colorL = {
                        r: Math.round(midHighL * 180 + 15),
                        g: Math.round(midHighL * 100 + 10),
                        b: Math.round(midHighL * 20)
                    }
                    colorR = {
                        r: Math.round(midHighR * 180 + 15),
                        g: Math.round(midHighR * 100 + 10),
                        b: Math.round(midHighR * 20)
                    }
                } else if (currentGenre === 'LATIN') {
                    const profile = GENRE_PROFILES.LATIN
                    const warmFactor = lowMidAvg * profile.midWeight
                    colorC = {
                        r: Math.round(warmFactor * 220 + 25),
                        g: Math.round(warmFactor * 120 + 15),
                        b: Math.round(bassSmooth * 40 + 10)
                    }
                    colorL = {
                        r: Math.round(lowMidL * 180 + 15),
                        g: Math.round(lowMidL * 100 + 10),
                        b: Math.round(lowMidL * 30)
                    }
                    colorR = {
                        r: Math.round(lowMidR * 180 + 15),
                        g: Math.round(lowMidR * 100 + 10),
                        b: Math.round(lowMidR * 30)
                    }
                } else if (currentGenre === 'CINEMA') {
                    const cinemaBase = bassSmooth * 0.8
                    colorC = {
                        r: Math.round(cinemaBase * 160 + 20),
                        g: Math.round(cinemaBase * 60 + 10),
                        b: Math.round(cinemaBase * 200 + 30)
                    }
                    colorL = {
                        r: Math.round(midHighL * 120 + 15),
                        g: Math.round(midHighL * 50 + 10),
                        b: Math.round(midHighL * 200 + 25)
                    }
                    colorR = {
                        r: Math.round(midHighR * 120 + 15),
                        g: Math.round(midHighR * 50 + 10),
                        b: Math.round(midHighR * 200 + 25)
                    }
                } else {
                    colorC = {
                        r: Math.round(bassSmooth * 30 + 5),
                        g: Math.round(bassSmooth * 100 + 20),
                        b: Math.round(bassSmooth * 160 + 30)
                    }
                    colorL = {
                        r: Math.round(midHighL * 20 + 5),
                        g: Math.round(midHighL * 120 + 15),
                        b: Math.round(midHighL * 170 + 25)
                    }
                    colorR = {
                        r: Math.round(midHighR * 20 + 5),
                        g: Math.round(midHighR * 120 + 15),
                        b: Math.round(midHighR * 170 + 25)
                    }
                }

                const globalEnergy = (bassEnergy + (midHighL + midHighR) / 2) / 2
                const boostFactor = 0.2 + (globalEnergy * 0.9 * audioSensitivity)
                setEnergyFactor(boostFactor)

                let targetColors = [colorL, colorC, colorR]

                if (modifierModeRef.current && inputColorsRef.current && inputColorsRef.current.length >= 3) {
                    targetColors = inputColorsRef.current.map((c, i) => {
                        const factor = i === 1
                            ? (0.2 + bassSmooth * 1.5 * audioSensitivity)
                            : (0.3 + (i === 0 ? midHighL : midHighR) * 0.8 * audioSensitivity)
                        return multiplyBrightness(c, factor)
                    })
                }

                const LERP_SPEED = modifierModeRef.current ? 0.6 : 0.20
                smoothedOutput.current = smoothedOutput.current.map((current, i) =>
                    lerpColor(current, targetColors[i], LERP_SPEED)
                )

                sendDmxBatch(smoothedOutput.current)

                setVisualizerData({
                    left: [...peakHoldL.current],
                    right: [...peakHoldR.current],
                    bass: peakHoldBass.current
                })
            }

            // Loop Wrapper with Background Support
            const loop = () => {
                if (!streamRef.current) return
                analyze()
                // Hybrid: 16ms (60fps) usually, 33ms (30fps) if hidden to satisfy Electron throttling constraints
                const delay = document.hidden ? 33 : 16
                timerRef.current = setTimeout(loop, delay)
            }
            loop()

            const track = stream.getAudioTracks()[0]
            if (track) {
                track.onended = async () => {
                    if (!activeRef.current) return
                    setSourceError('Active audio input ended. BeamStudio is trying to reconnect.')
                    setReconnecting(true)
                    try {
                        await start()
                    } catch {
                        stop()
                    } finally {
                        setReconnecting(false)
                    }
                }
            }
        } catch (err) {
            console.error('[Audio DSP] Failed:', err)
            stop()
        }
    }, [refreshInputs, selectedDeviceId, sendDmxBatch, stop, autoGenre, detectedGenre, manualGenre, onAudioUpdate, audioSensitivity])

    // Cleanup on unmount
    useEffect(() => () => stop(), [stop])

    useEffect(() => {
        if (!navigator.mediaDevices?.addEventListener) return undefined

        const handleDeviceChange = async () => {
            const inputs = await refreshInputs().catch(() => [])
            if (!activeRef.current) return

            const currentDeviceId = activeSourceRef.current.deviceId
            if (currentDeviceId && !inputs.some(input => input.deviceId === currentDeviceId)) {
                setSourceError('Active audio input disconnected. BeamStudio is reconnecting with the best available source.')
                setReconnecting(true)
                try {
                    await start()
                } catch {
                    stop()
                } finally {
                    setReconnecting(false)
                }
            }
        }

        navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange)
        return () => navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange)
    }, [refreshInputs, start, stop])

    return {
        start, stop, active,
        reconnecting,
        activeSource,
        detectedGenre, autoGenre, setAutoGenre, manualGenre, setManualGenre,
        modifierMode, setModifierMode, bassPulseMode, setBassPulseMode,
        energyFactor,
        audioTelemetryDSP,
        availableInputs,
        selectedDeviceId,
        setSelectedDeviceId,
        refreshInputs,
        sourceError,
        telemetry,
        visualizerData
    }
}
