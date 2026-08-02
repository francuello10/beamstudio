import React, { useState, useEffect } from 'react'
import { PowerOff, Check, AlertCircle, Minus, Plus, Volume2, X, Square } from 'lucide-react'
import { useConfigStore } from '../store/configStore'
import { useAudioEngine } from '../audio/AudioEngineContext'
import { useAudioStore } from '../store/audioStore'

const Header = React.memo(({ onReset, onMeet, onFlash }) => {
    const pendingRequests = useConfigStore(state => state.pendingRequests)
    const [flashActive, setFlashActive] = useState(false)
    const [offTimer, setOffTimer] = useState(null)

    // === Shared Audio Engine widget ===
    // `active` is the ONLY source of truth for on/off - the engine is mounted
    // once in AudioEngineProvider (App.jsx) and survives page navigation, so a
    // page-local useState here would drift from reality the moment some OTHER
    // page started/stopped it. See AudioEngineContext.jsx's own header comment
    // for the DMX-layer version of this same bug class.
    const { active: audioEngineActive, start: startAudioEngine, stop: stopAudioEngine } = useAudioEngine()
    const audioBoostLevel = useAudioStore(state => state.audioBoostLevel)
    const setAudioBoostLevel = useAudioStore(state => state.setAudioBoostLevel)
    const setAudioActive = useAudioStore(state => state.setAudioActive)
    const [isStartingAudio, setIsStartingAudio] = useState(false)

    // Mirrors the real engine state into useAudioStore.audioActive regardless
    // of which page (if any) is mounted - DmxScheduler.js reads that flag to
    // avoid fighting the audio engine's own RGB writes, and it used to only
    // get updated by whichever page's own toggle happened to be open.
    useEffect(() => {
        setAudioActive(audioEngineActive)
    }, [audioEngineActive, setAudioActive])

    const handleAudioEngineToggle = async () => {
        if (audioEngineActive) {
            stopAudioEngine()
            return
        }
        if (isStartingAudio) return
        setIsStartingAudio(true)
        try {
            // Bare start(): claimsOutput defaults to true. This widget is the
            // user explicitly asking for audio-reactive DMX output, same as
            // AudioPage's own Start button - not an analysis-only caller.
            await startAudioEngine()
        } finally {
            setIsStartingAudio(false)
        }
    }

    const adjustAudioBoost = (delta) => {
        setAudioBoostLevel(Math.round((audioBoostLevel + delta) * 10) / 10)
    }

    const handleFlash = () => {
        onFlash()
        setFlashActive(true)
        setTimeout(() => setFlashActive(false), 200)
    }

    const startOffTimer = () => {
        let count = 0
        const btn = document.getElementById('off-btn')
        const interval = setInterval(() => {
            count++
            if (btn) btn.style.background = `rgba(255, 0, 0, ${0.1 + count * 0.15})`
            if (count >= 5) {
                clearInterval(interval)
                onReset()
                if (btn) btn.style.background = ''
                setOffTimer(null)
            }
        }, 200)
        setOffTimer(interval)
    }

    const cancelOffTimer = () => {
        if (offTimer) {
            clearInterval(offTimer)
            setOffTimer(null)
            const btn = document.getElementById('off-btn')
            if (btn) btn.style.background = ''
        }
    }

    const windowOps = window.windowOps

    return (
        <header className="header">
            <div className="header-actions">
                <button
                    id="off-btn"
                    className="off-button"
                    onMouseDown={startOffTimer}
                    onMouseUp={cancelOffTimer}
                    onMouseLeave={cancelOffTimer}
                    title="Mantener presionado para Reset Total"
                >
                    <PowerOff size={16} /> RESET
                </button>
                <button className="meet-button" onClick={onMeet}>
                    <Check size={16} /> REUNIÓN
                </button>
                <button
                    className={`meet-button flash ${flashActive ? 'active' : ''}`}
                    onClick={handleFlash}
                    style={{
                        background: flashActive ? 'var(--accent)' : undefined,
                        borderColor: flashActive ? 'var(--accent)' : undefined,
                        color: flashActive ? 'white' : undefined,
                        boxShadow: flashActive ? '0 0 20px var(--accent)' : undefined
                    }}
                >
                    <AlertCircle size={16} /> FLASH
                </button>

                <div className="audio-engine-widget">
                    <button
                        className={`meet-button audio-engine-toggle ${audioEngineActive ? 'active' : ''}`}
                        onClick={handleAudioEngineToggle}
                        disabled={isStartingAudio}
                        title={audioEngineActive ? 'Stop shared audio-reactive engine' : 'Start shared audio-reactive engine'}
                    >
                        <span className={`audio-engine-dot ${audioEngineActive ? 'on' : 'off'}`} />
                        <Volume2 size={16} />
                        AUDIO {audioEngineActive ? 'ON' : isStartingAudio ? '...' : 'OFF'}
                    </button>
                    <div className="audio-engine-boost" title="Audio boost level">
                        <button
                            type="button"
                            onClick={() => adjustAudioBoost(-0.5)}
                            disabled={audioBoostLevel <= 0.5}
                            aria-label="Decrease audio boost"
                        >
                            <Minus size={10} />
                        </button>
                        <span>x{audioBoostLevel.toFixed(1)}</span>
                        <button
                            type="button"
                            onClick={() => adjustAudioBoost(0.5)}
                            disabled={audioBoostLevel >= 4}
                            aria-label="Increase audio boost"
                        >
                            <Plus size={10} />
                        </button>
                    </div>
                </div>
            </div>

            <div style={{ flex: 1 }} />

            <div className="sync-witness-container">
                <div className={`sync-witness ${pendingRequests > 0 ? 'syncing' : 'idle'}`} />
                <span className="sync-text">{pendingRequests > 0 ? 'SYNCING DMX' : 'STABLE'}</span>
            </div>

            <div className="window-controls" style={{ display: 'flex', gap: '0', height: '100%', WebkitAppRegion: 'no-drag' }}>
                <button
                    className="win-btn minimize"
                    onClick={() => windowOps?.minimize()}
                    style={{
                        width: '46px',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'transparent',
                        border: 'none',
                        color: '#ffffff',
                        cursor: 'pointer',
                        transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.1)'}
                    onMouseLeave={(e) => e.target.style.background = 'transparent'}
                >
                    <Minus size={14} />
                </button>
                <button
                    className="win-btn maximize"
                    onClick={() => windowOps?.toggleMaximize()}
                    style={{
                        width: '46px',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'transparent',
                        border: 'none',
                        color: '#ffffff',
                        cursor: 'pointer',
                        transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.1)'}
                    onMouseLeave={(e) => e.target.style.background = 'transparent'}
                >
                    <Square size={12} />
                </button>
                <button
                    className="win-btn close"
                    onClick={() => windowOps?.close()}
                    style={{
                        width: '46px',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'transparent',
                        border: 'none',
                        color: '#ffffff',
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                        borderTopRightRadius: '8px' // If rounded corner needed
                    }}
                    onMouseEnter={(e) => e.target.style.background = '#e81123'}
                    onMouseLeave={(e) => e.target.style.background = 'transparent'}
                >
                    <X size={14} />
                </button>
            </div>
        </header>
    )
})

export default Header
