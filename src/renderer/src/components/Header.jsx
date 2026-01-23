import React, { useState, useEffect } from 'react'
import { PowerOff, Check, AlertCircle, Minus, X, Square } from 'lucide-react'
import { useConfigStore } from '../store/configStore'

const Header = React.memo(({ onReset, onMeet, onFlash }) => {
    const pendingRequests = useConfigStore(state => state.pendingRequests)
    const [flashActive, setFlashActive] = useState(false)
    const [offTimer, setOffTimer] = useState(null)

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
