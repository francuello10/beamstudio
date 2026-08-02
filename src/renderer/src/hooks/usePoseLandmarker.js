/**
 * usePoseLandmarker.js — MediaPipe PoseLandmarker hook (BeamStudio transplant package)
 *
 * Mirrors the hook pattern already used across BeamStudio's visuals
 * (see src/renderer/src/hooks/useFluidSimulation.js in the host app):
 *   - owns its own refs for anything read every frame (no React re-render cost)
 *   - exposes a DOM element ref for the caller to mount (there: <canvas>,
 *     here: <video> — the frame *source* this hook owns and feeds into the
 *     detector)
 *   - runs its own requestAnimationFrame loop, independent of React's
 *     render cycle
 *   - start()/stop()/running mirror useFluidSimulation's lifecycle shape
 *
 * Unlike useFluidSimulation (which owns a WebGL2 canvas and draws every
 * frame), this hook does NOT draw anything — it only owns the camera feed
 * and produces landmark results. Drawing is PoseSkeletonVisual.jsx's job,
 * exactly the same separation FluidNeonVisual.jsx keeps from
 * useFluidSimulation.js (hook = engine, visual component = mount point).
 *
 * Per-frame results are exposed via `latestResultRef` (a plain ref), NOT
 * React state — pushing 30-60 PoseLandmarkerResult objects/sec through
 * setState would force a re-render every frame for no benefit, since the
 * only consumer that needs them (PoseSkeletonVisual's own draw loop) reads
 * the ref directly. An optional `onResults` callback is also provided for
 * callers that *do* want to react to updates (e.g. driving DMX/audio state)
 * without polling.
 *
 * @ai-constraints Model files are loaded from a local path (`modelBasePath`),
 * never from Google's model-hosting CDN. The MediaPipe WASM runtime is
 * vendored under renderer public assets, so pose tracking works offline and
 * stays inside the app's CSP.
 */
import { useRef, useCallback, useState, useEffect } from 'react'

// MediaPipe's Vision Tasks WASM runtime is copied from the exact
// @mediapipe/tasks-vision package version installed in package.json so the
// WASM build matches the JS bindings and works under BeamStudio's offline/CSP
// constraints.
const DEFAULT_WASM_BASE_PATH = `${import.meta.env?.BASE_URL || '/'}vendor/mediapipe/tasks-vision/wasm`
const DEFAULT_MODEL_BASE_PATH = `${import.meta.env?.BASE_URL || '/'}models/pose-tracking`

// Model variant -> filename living under `modelBasePath`. Both files are
// copied into this package's own models/ dir so it is self-contained; see
// README.md for where they land inside the host app.
const MODEL_FILENAMES = {
    lite: 'pose_landmarker_lite.task',
    heavy: 'pose_landmarker_heavy.task'
}

/**
 * @param {Object} [options]
 * @param {'lite'|'heavy'} [options.modelVariant='lite'] — lite is faster/smaller
 *   (5.8MB), heavy is more accurate/slower (31MB). Parameterized so the host
 *   app can pick per-machine performance budget.
 * @param {string} [options.modelBasePath] — directory
 *   the .task files are served from. MUST be overridden to match wherever the
 *   host app serves static assets from (see README.md — electron-vite's
 *   `src/renderer/public/` convention in BeamStudio's case).
 * @param {string} [options.wasmBasePath] — override for the MediaPipe WASM
 *   fileset location; defaults to the jsDelivr CDN pinned to this package's
 *   installed version.
 * @param {number} [options.numPoses=1] — max simultaneous poses to track.
 * @param {'CPU'|'GPU'} [options.delegate='GPU'] — inference backend.
 * @param {(result: import('@mediapipe/tasks-vision').PoseLandmarkerResult) => void} [options.onResults]
 *   optional callback fired every processed frame, in addition to
 *   `latestResultRef`.
 */
export function usePoseLandmarker(options = {}) {
    const {
        modelVariant = 'lite',
        modelBasePath = DEFAULT_MODEL_BASE_PATH,
        wasmBasePath = DEFAULT_WASM_BASE_PATH,
        numPoses = 1,
        delegate = 'GPU',
        onResults
    } = options

    // The frame source this hook owns — mirrors canvasRef in
    // useFluidSimulation, just a <video> instead of a <canvas> since that's
    // the input MediaPipe's detectForVideo needs.
    const videoRef = useRef(null)
    const streamRef = useRef(null)
    const landmarkerRef = useRef(null)
    const mountedRef = useRef(true)
    const runningRef = useRef(false)
    const startingRef = useRef(false)
    const startTokenRef = useRef(0)
    const rafRef = useRef(null)
    const lastVideoTimeRef = useRef(-1)

    // Latest per-frame result — read directly by draw loops (e.g.
    // PoseSkeletonVisual), never routed through setState (see file header).
    const latestResultRef = useRef(null)

    const [running, setRunning] = useState(false)
    const [modelReady, setModelReady] = useState(false)
    const [error, setError] = useState(null)

    const releaseStream = useCallback((stream) => {
        stream?.getTracks().forEach((track) => track.stop())
    }, [])

    // ── Load the model (idempotent — safe to call once on start()) ──
    const loadModel = useCallback(async (startToken) => {
        if (landmarkerRef.current) return landmarkerRef.current

        // Deferred import keeps this hook's cost at zero until start() is
        // actually called (e.g. a visual that never mounts never pays for
        // the WASM fetch).
        const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision')

        if (!mountedRef.current || startTokenRef.current !== startToken) return null

        const vision = await FilesetResolver.forVisionTasks(wasmBasePath)

        if (!mountedRef.current || startTokenRef.current !== startToken) return null

        const filename = MODEL_FILENAMES[modelVariant] || MODEL_FILENAMES.lite
        const modelAssetPath = `${modelBasePath.replace(/\/$/, '')}/${filename}`

        const landmarker = await PoseLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath,
                delegate
            },
            runningMode: 'VIDEO',
            numPoses
        })

        if (!mountedRef.current || startTokenRef.current !== startToken || landmarkerRef.current) {
            landmarker.close()
            return landmarkerRef.current
        }

        landmarkerRef.current = landmarker
        setModelReady(true)
        return landmarker
    }, [modelVariant, modelBasePath, wasmBasePath, numPoses, delegate])

    // ── Per-frame detect loop ──
    const detectLoop = useCallback(() => {
        if (!runningRef.current) return

        const video = videoRef.current
        const landmarker = landmarkerRef.current

        if (video && landmarker && video.readyState >= 2 && video.currentTime !== lastVideoTimeRef.current) {
            lastVideoTimeRef.current = video.currentTime
            const timestampMs = performance.now()
            const result = landmarker.detectForVideo(video, timestampMs)
            latestResultRef.current = result
            onResults?.(result)
        }

        rafRef.current = requestAnimationFrame(detectLoop)
    }, [onResults])

    // ── Start: acquire camera + load model + kick off the loop ──
    const start = useCallback(async () => {
        if (runningRef.current || startingRef.current) return
        const startToken = startTokenRef.current + 1
        startTokenRef.current = startToken
        startingRef.current = true
        setError(null)

        try {
            if (!streamRef.current) {
                const acquiredStream = await navigator.mediaDevices.getUserMedia({
                    video: { width: 1280, height: 720 },
                    audio: false
                })

                if (!mountedRef.current || startTokenRef.current !== startToken) {
                    releaseStream(acquiredStream)
                    return
                }

                streamRef.current = acquiredStream
            }

            const video = videoRef.current
            const stream = streamRef.current
            if (video) {
                video.srcObject = stream
                await video.play()
            }

            if (!mountedRef.current || startTokenRef.current !== startToken) {
                if (video?.srcObject === stream) video.srcObject = null
                if (streamRef.current === stream) streamRef.current = null
                releaseStream(stream)
                return
            }

            const landmarker = await loadModel(startToken)

            if (!landmarker || !mountedRef.current || startTokenRef.current !== startToken) {
                if (video?.srcObject === stream) video.srcObject = null
                if (streamRef.current === stream) streamRef.current = null
                releaseStream(stream)
                return
            }

            runningRef.current = true
            setRunning(true)
            detectLoop()
        } catch (err) {
            if (startTokenRef.current === startToken) {
                setError(err)
                console.error('[usePoseLandmarker] start() failed:', err)
            }
        } finally {
            if (startTokenRef.current === startToken) startingRef.current = false
        }
    }, [loadModel, detectLoop, releaseStream])

    // ── Stop: halt the loop, release the camera, keep the model warm ──
    const stop = useCallback(() => {
        startTokenRef.current += 1
        startingRef.current = false
        runningRef.current = false
        setRunning(false)
        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current)
            rafRef.current = null
        }
        if (streamRef.current) {
            releaseStream(streamRef.current)
            streamRef.current = null
        }
        const video = videoRef.current
        if (video) video.srcObject = null
    }, [releaseStream])

    // Cleanup on unmount — also tears down the detector itself (unlike
    // stop(), which keeps it warm for a quick restart).
    useEffect(() => {
        return () => {
            mountedRef.current = false
            startTokenRef.current += 1
            startingRef.current = false
            runningRef.current = false
            if (rafRef.current) cancelAnimationFrame(rafRef.current)
            if (streamRef.current) {
                releaseStream(streamRef.current)
                streamRef.current = null
            }
            landmarkerRef.current?.close()
            landmarkerRef.current = null
        }
    }, [releaseStream])

    return {
        videoRef,
        start,
        stop,
        running,
        modelReady,
        error,
        latestResultRef
    }
}
