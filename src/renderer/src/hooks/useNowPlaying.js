import { useEffect } from 'react'
import { useNowPlayingStore } from '../metadata/nowPlayingStore'
import { createNowPlaying, createEmptyNowPlaying } from '../metadata/NowPlaying'

// Metadata, not real-time audio - a slow, independent poll is enough and
// keeps this decoupled from useSystemAudio.js's own (faster) internal media
// status check.
const NOW_PLAYING_POLL_INTERVAL_MS = 1500

/**
 * useNowPlaying - independent Now Playing metadata poller (BS-007)
 *
 * Polls window.dmx.getSystemMedia() on its own interval, normalizes the raw
 * result through the NowPlaying contract, and writes it to nowPlayingStore.
 * This is intentionally a SEPARATE poller from whatever useSystemAudio.js
 * already does internally for audio-reactive pause detection - some
 * redundant `playerctl` shelling-out between the two is an accepted, cheap
 * tradeoff for keeping this concern fully decoupled (see NowPlaying.js).
 *
 * Graceful degradation: a null result or a rejected promise settles the
 * store to a clean 'no-player' frame instead of leaving stale data on
 * screen, and never breaks the polling loop.
 */
export const useNowPlaying = () => {
    const setNowPlaying = useNowPlayingStore((state) => state.setNowPlaying)

    useEffect(() => {
        let cancelled = false
        let timerId = null

        const poll = async () => {
            if (cancelled) return

            try {
                if (!window.dmx?.getSystemMedia) {
                    setNowPlaying(createEmptyNowPlaying())
                    return
                }

                const media = await window.dmx.getSystemMedia()
                if (cancelled) return

                if (!media) {
                    setNowPlaying(createEmptyNowPlaying())
                    return
                }

                const hasProgress = Number.isFinite(media.positionSec) && Number.isFinite(media.durationSec)

                setNowPlaying(
                    createNowPlaying({
                        title: media.title,
                        artist: media.artist,
                        album: media.album,
                        artwork: media.artUrl,
                        playbackStatus: media.playbackStatus,
                        progress: hasProgress
                            ? { positionSec: media.positionSec, durationSec: media.durationSec }
                            : null,
                        provider: 'mpris',
                        timestamp: Date.now()
                    })
                )
            } catch {
                if (!cancelled) setNowPlaying(createEmptyNowPlaying())
            } finally {
                if (!cancelled) timerId = setTimeout(poll, NOW_PLAYING_POLL_INTERVAL_MS)
            }
        }

        poll()

        return () => {
            cancelled = true
            if (timerId) clearTimeout(timerId)
        }
    }, [setNowPlaying])
}
