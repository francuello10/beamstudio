import React from 'react'
import { Music } from 'lucide-react'

// BS-007 phase 2: local mm:ss formatter, same style as SystemPage.jsx's -
// no new dependency, no shared import (kept local so this file stays a
// self-contained presentational component like TestPatternOverlay).
const formatSeconds = (totalSeconds) => {
    if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '0:00'
    const mins = Math.floor(totalSeconds / 60)
    const secs = Math.floor(totalSeconds % 60)
    return `${mins}:${String(secs).padStart(2, '0')}`
}

/**
 * NowPlayingOverlay — projector-output "now playing" card (BS-007 phase 2).
 *
 * Presentational only, plain HTML/CSS/React (same spirit as
 * ProjectorApp.jsx's TestPatternOverlay) - no WebGL/canvas. `nowPlaying` is
 * the NowPlaying contract snapshot (see
 * src/renderer/src/metadata/NowPlaying.js); this component never fetches or
 * polls data itself - ProjectorApp.jsx owns the useNowPlaying() call and
 * passes the store snapshot down as a prop.
 *
 * Rendered on top of whatever visual is currently active, mirroring
 * TestPatternOverlay's `testPattern && !blackout` precedence
 * (`nowPlayingOverlay && !blackout` in ProjectorApp.jsx) - blackout always
 * wins over this overlay.
 *
 * No composer/songwriter field: confirmed unavailable via MPRIS on this
 * machine against a real live Spotify session (see NowPlaying.js) - never
 * fabricated here.
 */
const NowPlayingOverlay = ({ nowPlaying }) => {
    const isEmpty = !nowPlaying || nowPlaying.state === 'no-player'

    return (
        <div
            style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(0, 0, 0, 0.55)'
            }}
        >
            {isEmpty ? (
                <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '28px', fontWeight: 600 }}>
                    Sin reproductor activo
                </div>
            ) : (
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '28px',
                        padding: '48px 64px',
                        borderRadius: '28px',
                        background: 'rgba(20, 20, 24, 0.55)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        backdropFilter: 'blur(24px)',
                        maxWidth: '640px'
                    }}
                >
                    {nowPlaying.artwork ? (
                        <img
                            src={nowPlaying.artwork}
                            alt=""
                            style={{
                                width: '340px',
                                height: '340px',
                                borderRadius: '20px',
                                objectFit: 'cover',
                                boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
                            }}
                        />
                    ) : (
                        <div
                            style={{
                                width: '340px',
                                height: '340px',
                                borderRadius: '20px',
                                background: 'rgba(255,255,255,0.06)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            <Music size={96} color="rgba(255,255,255,0.25)" />
                        </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', textAlign: 'center' }}>
                        <div style={{ fontSize: '32px', fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>
                            {nowPlaying.title || 'Sin título'}
                        </div>
                        <div style={{ fontSize: '18px', color: 'rgba(255,255,255,0.7)' }}>
                            {nowPlaying.artist || 'Artista desconocido'}
                        </div>
                        {nowPlaying.album && (
                            <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)' }}>
                                {nowPlaying.album}
                            </div>
                        )}
                    </div>

                    {nowPlaying.progress && (
                        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{
                                width: '100%',
                                height: '6px',
                                borderRadius: '3px',
                                background: 'rgba(255,255,255,0.15)',
                                overflow: 'hidden'
                            }}>
                                <div style={{
                                    width: `${Math.min(100, (nowPlaying.progress.positionSec / nowPlaying.progress.durationSec) * 100)}%`,
                                    height: '100%',
                                    background: '#ff3366',
                                    borderRadius: '3px'
                                }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>
                                <span>{formatSeconds(nowPlaying.progress.positionSec)}</span>
                                <span>{formatSeconds(nowPlaying.progress.durationSec)}</span>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

export default NowPlayingOverlay
