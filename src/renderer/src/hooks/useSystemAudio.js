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
    computeBassProfile,
    computeLowMid,
    computeMidHigh,
    computeStereoWidth,
    computeVocalMelodyProfile,
    detectStableGenre,
    extractBands
} from '../audio/AudioAnalyzer'
import {
    listAudioInputs,
    readStoredAudioInputId,
    createSystemAudioSourceError,
    resolveActiveAudioSource,
    requestAudioInputStream,
    writeStoredAudioInputId
} from '../audio/AudioSourceManager'
import { useAudioStore } from '../store/audioStore'

const MEDIA_STATUS_CHECK_INTERVAL_MS = 900
const PLAYBACK_PAUSED_STATUSES = new Set(['paused', 'stopped'])

/**
 * useSystemAudio v6.1 — Expert Deco Tuning for Thonet & Vander Ratsel 2.1
 *
 * Signal Chain (8 precision tuning points):
 * ─────────────────────────────────────────
 * 1. L/R analyser smoothing: 0.65 (organic mids/highs)
 * 2. Bass analyser smoothing: 0.18 (fast enough to punch)
 * 3. Peak decay: 0.96 (~300ms luxurious fade)
 * 4. Bass output: fast bass pulse for center slot, peak hold only for meters
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
    const bassPulse = useRef(0)
    const vocalPulse = useRef(0)
    const bassFloor = useRef(0)
    const previousBassRaw = useRef(0)
    const vocalFloor = useRef(0)
    const previousVocalRaw = useRef(0)
    const broadbandFloor = useRef(0)
    const previousBroadband = useRef(0)
    const lastMusicalActivityAt = useRef(0)
    const audioStartedAt = useRef(0)
    const mediaPlaybackRef = useRef({
        checkedAt: 0,
        status: 'unknown',
        paused: false
    })
    const mediaStatusRequestRef = useRef(null)

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

    const refreshPlaybackStatus = useCallback((now) => {
        if (!window.dmx?.getSystemMedia) return
        if (mediaStatusRequestRef.current) return
        if (now - mediaPlaybackRef.current.checkedAt < MEDIA_STATUS_CHECK_INTERVAL_MS) return

        mediaPlaybackRef.current.checkedAt = now
        mediaStatusRequestRef.current = window.dmx.getSystemMedia()
            .then((media) => {
                const status = String(media?.playbackStatus || '').toLowerCase()
                mediaPlaybackRef.current = {
                    checkedAt: now,
                    status: status || 'unknown',
                    paused: PLAYBACK_PAUSED_STATUSES.has(status)
                }
            })
            .catch(() => {
                mediaPlaybackRef.current = {
                    checkedAt: now,
                    status: 'unknown',
                    paused: false
                }
            })
            .finally(() => {
                mediaStatusRequestRef.current = null
            })
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
        peakHoldBass.current = 0
        bassPulse.current = 0
        vocalPulse.current = 0
        bassFloor.current = 0
        previousBassRaw.current = 0
        vocalFloor.current = 0
        previousVocalRaw.current = 0
        broadbandFloor.current = 0
        previousBroadband.current = 0
        lastMusicalActivityAt.current = 0
        audioStartedAt.current = 0
        mediaPlaybackRef.current = {
            checkedAt: 0,
            status: 'unknown',
            paused: false
        }
        mediaStatusRequestRef.current = null
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
            let systemSelectedDeviceId = selectedDeviceId

            if (systemSelectedDeviceId && !inputs.some(input => input.deviceId === systemSelectedDeviceId && (input.isMonitor || input.isGenericSystem))) {
                systemSelectedDeviceId = ''
                setSelectedDeviceIdState('')
                writeStoredAudioInputId('')
            }

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
                selectedDeviceId: systemSelectedDeviceId,
                inputs,
                constraints: baseAudioConstraints
            }).catch(async (err) => {
                throw err
            })

            if (fallbackToDefault && requestedDeviceId) {
                setSourceError('System monitor input became unavailable. BeamStudio did not fall back to the microphone.')
            }

            streamRef.current = stream
            const refreshedInputs = await refreshInputs().catch(() => [])
            activeSourceRef.current = resolveActiveAudioSource({
                stream,
                refreshedInputs,
                requestedDeviceId,
                selectedDeviceId: systemSelectedDeviceId,
                preferredInput,
                fallbackToDefault
            })
            if (!activeSourceRef.current.isMonitor && !activeSourceRef.current.isGenericSystem) {
                stream.getTracks().forEach(track => track.stop())
                throw createSystemAudioSourceError('Active input is not a speaker monitor/loopback source. BeamStudio ignored it instead of using a microphone.')
            }

            setActiveSource(activeSourceRef.current)

            if (!systemSelectedDeviceId && discoveredMonitorAfterPermission) {
                setSourceError(null)
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
            analyserL.current.smoothingTimeConstant = 0.28 // [T1] Party mode: visible side jumps
            splitter.connect(analyserL.current, 0)

            // RIGHT Analyser
            analyserR.current = audioCtx.current.createAnalyser()
            analyserR.current.fftSize = 512
            analyserR.current.smoothingTimeConstant = 0.28 // [T1] Match L channel party response
            splitter.connect(analyserR.current, 1)

            // BASS Analyser (Mono Mix L+R)
            const merger = audioCtx.current.createChannelMerger(2)
            splitter.connect(merger, 0, 0)
            splitter.connect(merger, 1, 1)
            analyserBass.current = audioCtx.current.createAnalyser()
            analyserBass.current.fftSize = 2048
            analyserBass.current.smoothingTimeConstant = 0.06 // [T2] True sub/kick detector with fast lighting response
            merger.connect(analyserBass.current)

            setActive(true)
            audioStartedAt.current = performance.now()
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
                const boostLevel = Math.max(0.5, Math.min(4, audioSensitivity || 1))
                const bassProfile = computeBassProfile(dataBass, {
                    sampleRate: audioCtx.current?.sampleRate || 48000,
                    fftSize: analyserBass.current?.fftSize || 2048,
                    previousRaw: previousBassRaw.current,
                    adaptiveFloor: bassFloor.current,
                    boostLevel
                })
                bassFloor.current = bassProfile.floor
                previousBassRaw.current = bassProfile.raw
                const vocalProfile = computeVocalMelodyProfile(dataBass, {
                    sampleRate: audioCtx.current?.sampleRate || 48000,
                    fftSize: analyserBass.current?.fftSize || 2048,
                    previousRaw: previousVocalRaw.current,
                    adaptiveFloor: vocalFloor.current,
                    boostLevel
                })
                vocalFloor.current = vocalProfile.floor
                previousVocalRaw.current = vocalProfile.raw
                const bassEnergy = bassProfile.energy
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

                // Output bass must be rhythmic, not a slow VU hold. Peak hold is useful
                // for meters, but it flattens the physical center light into “always on”.
                const bassDecay = Math.max(0.48, 0.78 - boostLevel * 0.075)
                bassPulse.current = Math.max(bassEnergy, bassPulse.current * bassDecay)
                const bassOutput = bassPulse.current
                const stereoWidth = computeStereoWidth(bandsL, bandsR)
                const { lowMidL, lowMidR, lowMidAvg } = computeLowMid(bandsL, bandsR)

                // === GENRE DETECTION (Every 2.5s) ===
                const now = performance.now()
                refreshPlaybackStatus(now)
                const playbackPaused = mediaPlaybackRef.current.paused
                const playbackStatus = mediaPlaybackRef.current.status

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
                const vocalCenterBias = Math.max(0, Math.min(1, 1 - Math.abs(midHighL - midHighR) / (midHighL + midHighR + 0.04)))
                const vocalRhythm = Math.max(vocalProfile.transient, vocalProfile.energy * 0.58)
                const vocalEnergy = Math.min(1, vocalRhythm * (0.58 + vocalCenterBias * 0.22))
                const vocalDecay = Math.max(0.34, 0.64 - boostLevel * 0.055)
                vocalPulse.current = Math.max(vocalEnergy, vocalPulse.current * vocalDecay)
                const vocalOutput = vocalPulse.current

                const spatial = buildSpatialResponse({ midHighL, bassSmooth: bassOutput, midHighR, vocalPulse: vocalOutput })
                const spectral = buildSpectralResponse(bandsL, bandsR)

                const energies = spatial

                const highEnergy = spectral.slice(10).reduce((sum, value) => sum + value, 0) / 6
                const midEnergy = spectral.slice(4, 10).reduce((sum, value) => sum + value, 0) / 6
                const volume = Math.min(1.0, (bassOutput + vocalOutput + midHighL + midHighR) / 4)
                const broadband = Math.max(midEnergy, highEnergy, midHighL, midHighR)
                const broadbandRise = Math.max(0, broadband - previousBroadband.current)
                previousBroadband.current = broadband
                broadbandFloor.current = broadbandFloor.current <= 0.0001
                    ? broadband
                    : broadband > broadbandFloor.current
                        ? broadbandFloor.current * 0.96 + broadband * 0.04
                        : broadbandFloor.current * 0.88 + broadband * 0.12
                const broadbandAboveFloor = Math.max(0, broadband - (broadbandFloor.current + 0.045))
                const transientActivity = Math.max(
                    bassProfile.transient,
                    vocalProfile.transient,
                    broadbandRise * 6.5
                )
                const sustainedActivity = Math.max(
                    bassProfile.energy,
                    vocalProfile.energy,
                    broadbandAboveFloor * 1.6
                )
                const calibrating = audioStartedAt.current === 0 || now - audioStartedAt.current < 900
                if (!calibrating && (transientActivity > 0.1 || sustainedActivity > 0.18)) {
                    lastMusicalActivityAt.current = now
                }
                const silence = playbackPaused || calibrating || lastMusicalActivityAt.current === 0 || now - lastMusicalActivityAt.current > 700
                const clipping = Math.max(...spectral, bassOutput, midHighL, midHighR) >= 0.98
                const frameTelemetry = buildFrameTelemetry({
                    bassEnergy,
                    bandsL,
                    bandsR,
                    peakHoldL: peakHoldL.current,
                    peakHoldR: peakHoldR.current,
                    midEnergy,
                    vocalEnergy: silence ? 0 : vocalOutput,
                    stereoWidth
                })
                const frameSpatial = silence ? { left: 0, center: 0, right: 0 } : spatial
                const frameSpectral = silence ? new Array(16).fill(0) : spectral
                const frameLevels = silence
                    ? {
                        bass: 0,
                        vocal: 0,
                        melodyPulse: 0,
                        mid: 0,
                        high: 0,
                        volume: 0,
                        stereoWidth: 0
                    }
                    : {
                        bass: bassOutput,
                        vocal: vocalOutput,
                        melodyPulse: vocalOutput,
                        mid: midEnergy,
                        high: highEnergy,
                        volume,
                        stereoWidth
                    }
                const frameStereo = silence
                    ? {
                        lowMidLeft: 0,
                        lowMidRight: 0,
                        midHighLeft: 0,
                        midHighRight: 0
                    }
                    : {
                        lowMidLeft: lowMidL,
                        lowMidRight: lowMidR,
                        midHighLeft: midHighL,
                        midHighRight: midHighR
                    }

                const audioFrame = createAudioFrame({
                    timestamp: Date.now(),
                    source: activeSourceRef.current,
                    levels: frameLevels,
                    stereo: frameStereo,
                    spatial: frameSpatial,
                    spectral: frameSpectral,
                    telemetry: frameTelemetry,
                    status: { silence, clipping, playbackPaused, playbackStatus },
                    genre: autoGenre ? detectedGenre : manualGenre
                })

                if (silence) {
                    peakHoldL.current = new Array(16).fill(0)
                    peakHoldR.current = new Array(16).fill(0)
                    peakHoldBass.current = 0
                    bassPulse.current = 0
                    vocalPulse.current = 0
                    useAudioStore.getState().updateAudioAnalysis(
                        frameSpatial,
                        frameSpectral,
                        audioFrame
                    )
                    setAudioTelemetryDSP({ left: 0, center: 0, right: 0 })
                    if (onAudioUpdate) onAudioUpdate({ left: 0, center: 0, right: 0 })
                    setVisualizerData({
                        left: new Array(16).fill(0),
                        right: new Array(16).fill(0),
                        bass: 0
                    })
                    return
                }

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

                const globalEnergy = (bassEnergy + vocalOutput * 0.75 + (midHighL + midHighR) / 2) / 2.75
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
                setSourceError('Audio capture permission was denied. Allow speaker monitor/loopback access and try again.')
                return
            }

            if (err?.name === 'SystemAudioSourceNotFoundError') {
                setSourceError('No speaker monitor/loopback input was detected. BeamStudio ignored microphones and did not change your operating system.')
                return
            }

            if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') {
                setSourceError('No audio input is available. BeamStudio needs the monitor/loopback source for what people actually hear.')
                return
            }

            setSourceError('Audio detection failed to start. BeamStudio only captures speaker monitor/loopback audio, never the computer microphone.')
        }
    }, [refreshInputs, refreshPlaybackStatus, selectedDeviceId, sendDmxBatch, stop, autoGenre, detectedGenre, manualGenre, onAudioUpdate, audioSensitivity])

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
