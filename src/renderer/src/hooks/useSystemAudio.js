import { useEffect, useRef, useState, useCallback } from 'react'
import { createAudioFrame } from '../audio/AudioFrame'
import {
    applyModifierAndSmoothing,
    buildBassPulseColors,
    buildGenreColors
} from '../audio/AudioReactiveRenderer'
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
import { useAudioStore } from '../store/audioStore'

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
    const [modifierMode, setModifierMode] = useState(true)
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
                requestedDeviceId,
                discoveredMonitorAfterPermission
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
                    : 'Preferred monitor input is unavailable. BeamStudio did not fall back to the microphone.')
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

            if (!selectedDeviceId && discoveredMonitorAfterPermission) {
                setSourceError(null)
            } else if (!selectedDeviceId && !activeSourceRef.current.isMonitor) {
                setSourceError('No system monitor/loopback input was detected. BeamStudio is listening to the default input, which may be the computer microphone.')
            }

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
                    stereo: {
                        lowMidLeft: lowMidL,
                        lowMidRight: lowMidR,
                        midHighLeft: midHighL,
                        midHighRight: midHighR
                    },
                    spatial,
                    spectral,
                    telemetry: frameTelemetry,
                    status: { silence, clipping },
                    genre: autoGenre ? detectedGenre : manualGenre
                })

                // ═══════════════════════════════════════════════
                // BASS PULSE MODE — Pure bass-driven ON/OFF lights
                // ═══════════════════════════════════════════════
                if (bassPulseModeRef.current) {
                    const pulseRender = buildBassPulseColors(audioFrame)
                    smoothedOutput.current = applyModifierAndSmoothing({
                        currentColors: smoothedOutput.current,
                        targetColors: pulseRender.colors,
                        inputColors: inputColorsRef.current,
                        modifierMode: true,
                        audioFrame,
                        audioSensitivity
                    })

                    useAudioStore.getState().updateAudioAnalysis(spatial, spectral, audioFrame)

                    setAudioTelemetryDSP(energies)
                    if (onAudioUpdate) onAudioUpdate(energies)

                    sendDmxBatch(smoothedOutput.current)
                    setEnergyFactor(pulseRender.bassBrightness)

                    setVisualizerData({
                        left: [...peakHoldL.current],
                        right: [...peakHoldR.current],
                        bass: peakHoldBass.current
                    })
                    return
                }

                // 3. ATOMIC UPDATE
                useAudioStore.getState().updateAudioAnalysis(spatial, spectral, audioFrame)

                // Legacy Internal State (keep for now to not break old consumers immediately if any)
                setAudioTelemetryDSP(energies)
                if (onAudioUpdate) onAudioUpdate(energies)

                const globalEnergy = (bassEnergy + (midHighL + midHighR) / 2) / 2
                const boostFactor = 0.2 + (globalEnergy * 0.9 * audioSensitivity)
                setEnergyFactor(boostFactor)
                smoothedOutput.current = applyModifierAndSmoothing({
                    currentColors: smoothedOutput.current,
                    targetColors: buildGenreColors(audioFrame),
                    inputColors: inputColorsRef.current,
                    modifierMode: modifierModeRef.current,
                    audioFrame,
                    audioSensitivity
                })

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
            if (err?.name === 'NotAllowedError') {
                setSourceError('Audio capture permission was denied. Allow microphone / monitor access and try again.')
                return
            }

            if (err?.name === 'SystemAudioSourceNotFoundError') {
                setSourceError('No system monitor/loopback input was detected. BeamStudio will not use the computer microphone in Auto mode. Select a monitor/loopback device or expose one from PipeWire/PulseAudio.')
                return
            }

            if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') {
                setSourceError('No audio input is available. BeamStudio needs the monitor/loopback source for what people actually hear.')
                return
            }

            setSourceError('Audio detection failed to start. BeamStudio only auto-captures monitor/loopback system audio, not the computer microphone.')
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
