import { useEffect, useRef } from 'react'
import { useNowPlayingStore } from '../metadata/nowPlayingStore'
import { createNowPlaying, createEmptyNowPlaying } from '../metadata/NowPlaying'
import { fetchFallbackArtwork } from '../metadata/fallbackArtwork'

// Metadata, not real-time audio - a slow, independent poll is enough and
// keeps this decoupled from useSystemAudio.js's own (faster) internal media
// status check.
const NOW_PLAYING_POLL_INTERVAL_MS = 1500

/**
 * useNowPlaying - independent Now Playing metadata poller (BS-007)
 *
 * Polls window.nowPlaying.getSystemMedia() on its own interval, normalizes
 * the raw result through the NowPlaying contract, and writes it to
 * nowPlayingStore. This is intentionally a SEPARATE poller from whatever
 * useSystemAudio.js already does internally for audio-reactive pause
 * detection - some redundant `playerctl` shelling-out between the two is an
 * accepted, cheap tradeoff for keeping this concern fully decoupled (see
 * NowPlaying.js). Uses the `nowPlaying` preload alias (not `dmx`) on purpose:
 * this hook is also called from the projector window (for its Now Playing
 * overlay), which never gets `window.dmx` at all (see isProjectorWindow in
 * src/preload/index.js) - `nowPlaying` is exposed in both windows since it's
 * a read-only metadata query with no DMX/hardware capability.
 *
 * Graceful degradation: a null result or a rejected promise settles the
 * store to a clean 'no-player' frame instead of leaving stale data on
 * screen, and never breaks the polling loop.
 */
export const useNowPlaying = () => {
    const setNowPlaying = useNowPlayingStore((state) => state.setNowPlaying)
    // Single-slot cache keyed by JSON.stringify([artist, title, album]): most
    // MPRIS players (VLC, browser tabs, etc.) never send mpris:artUrl, so this
    // avoids re-hitting the iTunes Search API every 1.5s poll for the same
    // track — only fires once per track change, and only when MPRIS itself
    // provided no art. JSON.stringify properly escapes any character (a raw
    // "artist|title" string concat had the same unescaped-delimiter collision
    // bug as the main-process metadata parsing: an artist/title containing a
    // literal '|' could collide with a different track); including album also
    // means a live/studio re-release sharing artist+title no longer
    // incorrectly shares a cache slot.
    const fallbackArtworkRef = useRef({ key: null, url: null })

    useEffect(() => {
        let cancelled = false
        let timerId = null

        const poll = async () => {
            if (cancelled) return

            try {
                if (!window.nowPlaying?.getSystemMedia) {
                    setNowPlaying(createEmptyNowPlaying())
                    return
                }

                const media = await window.nowPlaying.getSystemMedia()
                if (cancelled) return

                if (!media) {
                    setNowPlaying(createEmptyNowPlaying())
                    return
                }

                const hasProgress = Number.isFinite(media.positionSec) && Number.isFinite(media.durationSec)
                const trackKey = media.title || media.artist
                    ? JSON.stringify([media.artist || '', media.title || '', media.album || ''])
                    : null

                let artwork = media.artUrl || null
                if (!artwork && trackKey) {
                    if (fallbackArtworkRef.current.key === trackKey) {
                        artwork = fallbackArtworkRef.current.url
                    } else {
                        // Show text immediately without waiting on the network;
                        // the lookup below fills artwork in on a later poll tick.
                        fallbackArtworkRef.current = { key: trackKey, url: null }
                        fetchFallbackArtwork(media.artist, media.title).then((url) => {
                            // Guard against a superseded fetch (track changed again
                            // while this one was in flight) clobbering the cache
                            // slot for whatever track is current now.
                            if (cancelled || fallbackArtworkRef.current.key !== trackKey) return
                            fallbackArtworkRef.current = { key: trackKey, url }
                        })
                    }
                }

                setNowPlaying(
                    createNowPlaying({
                        title: media.title,
                        artist: media.artist,
                        album: media.album,
                        artwork,
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
