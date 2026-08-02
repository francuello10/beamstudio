import React, { createContext, useContext } from 'react'
import { useSystemAudio } from '../hooks/useSystemAudio'

/**
 * AudioEngineProvider / useAudioEngine — the one shared audio-reactive engine.
 *
 * WHY THIS EXISTS
 * ───────────────
 * useSystemAudio used to be instantiated separately inside five different page
 * components (AudioPage, ConsoleMixerPage, DynamicScenesPageV2, FluidSimPage,
 * AmbilightPage). App.jsx renders exactly one page at a time (renderPage() +
 * <AnimatePresence mode='wait'> keyed on activePage), so navigating away
 * UNMOUNTED whichever page happened to own the engine, and the hook's
 * `useEffect(() => () => stop(), [stop])` tore the whole thing down: MediaStream
 * tracks stopped, AudioContext closed, analyse timer cleared, window.audio.stop()
 * fired. Real-world symptom: start audio-reactive lighting on the Audio page, go
 * to the Projector page to line up a projector, and every audio-reactive DMX
 * fixture goes dead.
 *
 * The engine is infrastructure, not page-local UI state. It is mounted once here,
 * above the page switch, so it keeps analysing while the user moves around the
 * app, and every feature (fixtures, ambilight, fluid sim, projector visuals)
 * plugs into the SAME running engine instead of bolting on its own instance.
 *
 * Consequences of being shared, worth knowing before you touch this:
 *  - Only App.jsx mounts this provider. App.jsx never renders in the projector
 *    window (main.jsx swaps in ProjectorApp for `?role=projector`), and the
 *    preload strips audio.start/stop for that window, so the projector consumes
 *    AudioFrames over IPC and must never call useAudioEngine().
 *  - Pages must NOT call stop() in unmount cleanup. stop() is reserved for
 *    deliberate user actions (a Stop button, an explicit toggle-off).
 *  - Pages that only want telemetry (they already own DMX output through their
 *    own feature) start the engine with start({ claimsOutput: false }).
 */
const AudioEngineContext = createContext(null)

export const AudioEngineProvider = ({ children }) => {
    const engine = useSystemAudio()

    return (
        <AudioEngineContext.Provider value={engine}>
            {children}
        </AudioEngineContext.Provider>
    )
}

export const useAudioEngine = () => {
    const engine = useContext(AudioEngineContext)

    if (!engine) {
        throw new Error(
            'useAudioEngine() must be used inside <AudioEngineProvider>. ' +
            'The shared audio engine is mounted in App.jsx; the projector window ' +
            '(ProjectorApp) has no engine and must read AudioFrames from useAudioStore instead.'
        )
    }

    return engine
}
