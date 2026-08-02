/**
 * genreColorTheme.js — Ecosystem Color-Sync: a DELIBERATE, hand-authored
 * genre -> hue-range mapping for the projector's automatic-hue visuals
 * (Particle Field, Tunnel Grid, Kaleidoscope).
 *
 * This table is NOT derived automatically from
 * `AudioReactiveRenderer.js`'s `buildGenreColors` — it is a small,
 * loosely-coupled, hand-picked HSV hue range per genre chosen to roughly
 * match that genre's DMX color family (same recognizable color identity,
 * not a byte-identical RGB->HSV conversion). This module is intentionally
 * kept pure and standalone, with ZERO imports from AudioReactiveRenderer.js
 * or useSystemAudio.js, so this feature can never accidentally couple
 * casual UI/visual work to this project's DMX-timing-sensitive files (see
 * this repo's CLAUDE.md: "Do not rewrite working DMX timing paths without a
 * concrete bug and a validation plan").
 *
 * Hue values are 0-1 HSV hue units, matching the existing hue-band
 * convention already used by useParticleField.js / useTunnelGrid.js /
 * useKaleidoscope.js's own hardcoded HUE_LOW/HUE_HIGH constants (0.82
 * magenta/violet down to 0.52 cyan).
 */

// Each entry roughly matches buildGenreColors' RGB formulas for that genre
// (src/renderer/src/audio/AudioReactiveRenderer.js), re-expressed as a hue
// range by eye rather than computed:
//   - ELECTRO's RGB terms lean magenta/violet (high R+B, low G)             -> ~0.80-0.93
//   - ROCK's RGB terms lean orange-amber (high R+G, low B, warm/yellow-ish) -> ~0.06-0.10
//   - LATIN's RGB terms are the same warm family as Rock's, pushed redder
//     for its own distinct genre identity                                  -> ~0.00-0.05
//   - CINEMA's RGB terms lean indigo-violet (high B, low G)                -> ~0.71-0.79
//   - default/UNKNOWN leans cyan-teal (high B, low R) — deliberately close
//     to the cyan end already used as HUE_HIGH by all 3 visual hooks       -> ~0.50-0.58
export const GENRE_THEMES = {
    ELECTRO: { hueLow: 0.80, hueHigh: 0.93 },
    ROCK: { hueLow: 0.06, hueHigh: 0.10 },
    LATIN: { hueLow: 0.00, hueHigh: 0.05 },
    CINEMA: { hueLow: 0.71, hueHigh: 0.79 },
    UNKNOWN: { hueLow: 0.50, hueHigh: 0.58 }
}

/**
 * Pure lookup — falls back to the UNKNOWN/default entry for any genre
 * string this table doesn't recognize (including undefined/null), mirroring
 * buildGenreColors' own `audioFrame.genre || 'UNKNOWN'` fallback.
 */
export function getThemeForGenre(genre) {
    return GENRE_THEMES[genre] || GENRE_THEMES.UNKNOWN
}
