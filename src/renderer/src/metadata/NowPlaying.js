// NowPlaying contract (BS-007)
//
// This is a real, independent data flow for "what's playing" UX/automation
// metadata - decoupled FROM AudioFrame in the sense that it has its own
// poller (useNowPlaying.js) and its own store (nowPlayingStore.js). It does
// NOT feed into, wrap, or read from useSystemAudio.js/AudioFrame.js/
// AudioAnalyzer.js/AudioReactiveRenderer.js in any way, and must not.
//
// Scope-adjustment note: the BS-007 task doc's original "Alcance" implied
// today's code improperly lets Now-Playing metadata influence audio-reactive
// behavior via useSystemAudio.js's `playbackPaused` check. That check is a
// real, deliberate, and recent fix (commits b01e457 "fix(audio): freeze
// output on paused music" and 8a98e23 "fix(audio): honor paused media
// playback") for audio-reactive output staying "alive" after the user pauses
// music, before raw audio-silence detection catches up. That file is under
// active parallel development and is intentionally NOT touched by this
// contract - see docs/revival/tasks/BS-007_NOW_PLAYING_METADATA.md for the
// full rationale. Some redundant `playerctl` shelling-out between this
// poller and useSystemAudio.js's internal one is an accepted, cheap tradeoff
// for that decoupling.
export const createEmptyNowPlaying = () => ({
    title: '',
    artist: '',
    artwork: null,
    state: 'no-player',
    progress: null,
    provider: 'unknown',
    timestamp: Date.now()
})

const NOW_PLAYING_STATES = new Set(['playing', 'paused', 'stopped', 'no-player'])

/**
 * Normalizes a raw MPRIS/GSMTC playback status string ("Playing", "Paused",
 * "Stopped", or empty/unknown) into the NowPlaying `state` union.
 */
export const normalizeNowPlayingState = (rawPlaybackStatus) => {
    const status = String(rawPlaybackStatus || '').trim().toLowerCase()
    if (status === 'playing') return 'playing'
    if (status === 'paused') return 'paused'
    if (status === 'stopped') return 'stopped'
    return 'no-player'
}

/**
 * createNowPlaying - normalizer/factory for the NowPlaying contract.
 *
 * Accepts either an already-normalized `state` (one of NOW_PLAYING_STATES) or
 * a raw `playbackStatus` string (as returned by `get-system-media`) and
 * normalizes it consistently. Mirrors AudioFrame.js's style: sane defaults,
 * clamping, never throws on partial/missing input.
 */
export const createNowPlaying = ({
    title,
    artist,
    artwork,
    state,
    playbackStatus,
    progress,
    provider,
    timestamp
} = {}) => ({
    title: typeof title === 'string' ? title.trim() : '',
    artist: typeof artist === 'string' ? artist.trim() : '',
    // Artwork via MPRIS `mpris:artUrl`: reliably present for some players
    // (e.g. Spotify) but not guaranteed across every MPRIS-compatible player
    // or desktop environment, so this stays null unless a real URL string
    // was actually provided upstream - never a placeholder/guess.
    artwork: typeof artwork === 'string' && artwork.trim() ? artwork.trim() : null,
    state: NOW_PLAYING_STATES.has(state) ? state : normalizeNowPlayingState(playbackStatus),
    progress:
        progress &&
        Number.isFinite(progress.positionSec) &&
        Number.isFinite(progress.durationSec) &&
        progress.durationSec > 0
            ? {
                  positionSec: Math.max(0, progress.positionSec),
                  durationSec: Math.max(0, progress.durationSec)
              }
            : null,
    provider: typeof provider === 'string' && provider ? provider : 'unknown',
    timestamp: Number.isFinite(timestamp) ? timestamp : Date.now()
})
