// fallbackArtwork.js — BS-007: best-effort cover art lookup for when MPRIS
// doesn't provide `mpris:artUrl` (true for most non-Spotify players — VLC,
// most browsers' Media Session exposure, many other MPRIS clients don't
// publish artwork at all).
//
// Uses Apple's public iTunes Search API: no API key, no OAuth, no account —
// a plain unauthenticated GET, so this doesn't fall under BS-007's "OAuth
// completo antes de revisar políticas" exclusion (that's about real
// Spotify/Tidal integration, not a generic public metadata search). Best
// effort only: a title+artist text search can mismatch or return nothing,
// so this must never be treated as authoritative or block the rest of the
// Now Playing display.

const ITUNES_SEARCH_ENDPOINT = 'https://itunes.apple.com/search'
const FETCH_TIMEOUT_MS = 4000

// iTunes artwork URLs end in a fixed "100x100bb.jpg" size segment; bumping it
// to a larger size is the standard, documented trick (still the same image,
// just a higher-res render from Apple's CDN).
const upsizeArtworkUrl = (url) => (typeof url === 'string' ? url.replace(/100x100bb(\.\w+)$/, '600x600bb$1') : url)

/**
 * Looks up a plausible cover art URL for a title+artist via the iTunes
 * Search API. Returns null on no match, timeout, or any error — never
 * throws, never blocks the caller.
 */
export const fetchFallbackArtwork = async (artist, title) => {
    const query = [artist, title].filter(Boolean).join(' ').trim()
    if (!query) return null

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    try {
        const url = `${ITUNES_SEARCH_ENDPOINT}?term=${encodeURIComponent(query)}&media=music&entity=song&limit=1`
        const response = await fetch(url, { signal: controller.signal })
        if (!response.ok) return null

        const data = await response.json()
        const artworkUrl100 = data?.results?.[0]?.artworkUrl100
        return typeof artworkUrl100 === 'string' && artworkUrl100 ? upsizeArtworkUrl(artworkUrl100) : null
    } catch {
        return null
    } finally {
        clearTimeout(timeoutId)
    }
}
