import { create } from 'zustand'
import { createEmptyNowPlaying } from './NowPlaying'

/**
 * useNowPlayingStore - Now Playing metadata state (BS-007)
 *
 * Holds the latest NowPlaying contract snapshot, written by useNowPlaying's
 * independent poller. Deliberately separate from useAudioStore/AudioFrame:
 * this is UX/automation metadata, never a DSP input. See NowPlaying.js for
 * the scope-adjustment rationale (why this does not touch useSystemAudio.js).
 *
 * @ai-constraints No leer/escribir audioStore ni AudioFrame desde este store.
 */
export const useNowPlayingStore = create((set) => ({
    nowPlaying: createEmptyNowPlaying(),
    setNowPlaying: (nowPlaying) => set({ nowPlaying })
}))
