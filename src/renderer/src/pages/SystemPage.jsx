import React, { useState, useEffect } from 'react'
import { Sparkles, Zap, Radio, Check, AlertCircle, Monitor } from 'lucide-react'
import logoImg from '../assets/logo.png'
import sticktecImg from '../assets/sticktec.png'
import { useDmxStore } from '../store/dmxStore'
import { useConfigStore } from '../store/configStore'

const SystemPage = () => {
    // Stores
    const config = useConfigStore(state => state.config)
    const setConfig = useConfigStore(state => state.setConfig)
    const updatePerformance = useConfigStore(state => state.updatePerformance)
    const dmxFixtures = useDmxStore(state => state.dmxFixtures)
    const setDmxFixtures = useDmxStore(state => state.setDmxFixtures)

    const funcRanges = config?.funcRanges || []
    const perf = config?.performance || { dmxHz: 44, uiHz: 60, ambiFps: 60 }

    // DMX Mode state
    const [dmxMode, setDmxMode] = useState(config?.dmxMode || 'artnet')
    const [selectedPort, setSelectedPort] = useState(config?.nativeDevicePath || '')
    const [selectedDriver, setSelectedDriver] = useState('d2xx')
    const [serialPorts, setSerialPorts] = useState([])
    const [isConnecting, setIsConnecting] = useState(false)
    const [connectionStatus, setConnectionStatus] = useState(null)
    const [actualHz, setActualHz] = useState(0)

    // AI Configuration
    const [geminiKey, setGeminiKey] = useState(localStorage.getItem('RENDERER_VITE_GEMINI_API_KEY') || '')
    const [geminiModel, setGeminiModel] = useState(localStorage.getItem('RENDERER_VITE_GEMINI_MODEL') || 'gemini-2.0-flash-exp')
    const [keySaved, setKeySaved] = useState(false)
    const [testStatus, setTestStatus] = useState(null)

    useEffect(() => {
        const handleTelemetry = (data) => setActualHz(data.actualHz)
        const cleanup = window.dmx?.onTelemetryUpdated(handleTelemetry)
        return () => cleanup && cleanup()
    }, [])

    const handleSaveKey = () => {
        localStorage.setItem('RENDERER_VITE_GEMINI_API_KEY', geminiKey)
        localStorage.setItem('RENDERER_VITE_GEMINI_MODEL', geminiModel)
        setKeySaved(true)
        setTimeout(() => setKeySaved(false), 2000)
    }

    useEffect(() => {
        window.dmx?.listPorts().then(async ports => {
            setSerialPorts(ports || [])
            const recommended = ports?.find(p => p.isRecommended)
            if (recommended) {
                setSelectedPort(recommended.path)
                if (recommended.recommendedDriver) setSelectedDriver(recommended.recommendedDriver)
            }
        })
        window.dmx?.getMode().then(mode => {
            setDmxMode(mode.mode)
            if (mode.devicePath) setSelectedPort(mode.devicePath)
            if (mode.driver) setSelectedDriver(mode.driver)
        })
    }, [])

    const handleRename = (id, newName) => {
        setDmxFixtures(dmxFixtures.map(f => f.id === id ? { ...f, name: newName } : f))
    }

    const handleModeChange = async (newMode) => {
        if (newMode === dmxMode) return;
        const confirmSwitch = window.confirm(`WARNING: Switching DMX mode to ${newMode.toUpperCase()} will momentarily interrupt communication. Proceed?`);
        if (!confirmSwitch) return;

        setIsConnecting(true)
        setConnectionStatus(null)
        try {
            const result = await window.dmx?.setMode(newMode, selectedPort, selectedDriver)
            if (result.success) {
                setDmxMode(result.mode)
                setConnectionStatus({
                    type: 'success',
                    message: newMode === 'usb' || newMode === 'native'
                        ? `Connected (${result.driverType})`
                        : 'Using Art-Net (QLC+)'
                })
            } else {
                setConnectionStatus({ type: 'error', message: result.error || 'Failed to switch mode' })
            }
        } catch (err) {
            setConnectionStatus({ type: 'error', message: err.message })
        }
        setIsConnecting(false)
    }

    return (
        <div className="page system-page">
            <div className="system-grid">
                <div className="glass-card branding-card">
                    <img src={logoImg} alt="BeamStudio" className="branding-logo" />
                    <h1>BeamStudio</h1>
                    <p>DMX Lighting Controller</p>
                    <span className="version">v1.0.0</span>
                </div>

                <div className="glass-card ai-config-card">
                    <div className="card-header-icon">
                        <Sparkles size={20} className="accent-text" />
                        <h3>AI Engine Configuration</h3>
                    </div>
                    <div style={{ display: 'flex', gap: '16px', flexDirection: 'column', marginTop: '16px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)' }}>GEMINI API KEY</label>
                            <input
                                type="password"
                                value={geminiKey}
                                onChange={(e) => setGeminiKey(e.target.value.replace(/[^\x00-\x7F]/g, "").trim())}
                                placeholder="Paste API Key"
                                className="system-input"
                            />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)' }}>MODEL</label>
                            <select value={geminiModel} onChange={(e) => setGeminiModel(e.target.value)} className="system-select">
                                <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                                <option value="gemini-2.0-flash-exp">Gemini 2.0 Flash Exp</option>
                            </select>
                        </div>
                        <button onClick={handleSaveKey} className={`action-button ${keySaved ? 'success' : 'active'}`}>
                            {keySaved ? 'SAVED' : 'SAVE CONFIG'}
                        </button>
                    </div>
                </div>

                <div className="glass-card performance-card">
                    <div className="card-header-icon">
                        <Zap size={20} className="accent-text" />
                        <h3>Hardware Performance</h3>
                    </div>
                    <div className="perf-slider-group" style={{ marginTop: '16px' }}>
                        {['dmxHz', 'uiHz', 'ambiFps'].map(key => (
                            <div key={key} className="perf-control">
                                <div className="label-row">
                                    <span>{key.toUpperCase()}</span>
                                    <span className="value-badge">{perf[key]} Hz/FPS</span>
                                </div>
                                <input
                                    type="range"
                                    min="10"
                                    max={key === 'dmxHz' ? 44 : 60}
                                    value={perf[key]}
                                    onChange={(e) => updatePerformance({ [key]: parseInt(e.target.value) })}
                                />
                            </div>
                        ))}
                    </div>
                </div>

                <div className="glass-card dmx-mode-card">
                    <div className="card-header-icon">
                        <Radio size={20} className="accent-text" />
                        <h3>DMX Connection Mode</h3>
                        {connectionStatus && (
                            <span style={{
                                marginLeft: 'auto',
                                fontSize: '11px',
                                fontWeight: 700,
                                color: connectionStatus.type === 'success' ? 'var(--accent)' : '#ff4444',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}>
                                {connectionStatus.type === 'success' ? <Check size={14} /> : <AlertCircle size={14} />}
                                {connectionStatus.message}
                            </span>
                        )}
                    </div>
                    <div className="dmx-mode-toggle" style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <button
                            className={`mode-btn ${dmxMode === 'artnet' ? 'active' : ''}`}
                            onClick={() => handleModeChange('artnet')}
                            style={{
                                padding: '12px 20px',
                                borderRadius: '8px',
                                border: dmxMode === 'artnet' ? '2px solid var(--accent)' : '1px solid var(--border-color)',
                                background: dmxMode === 'artnet' ? 'rgba(255, 0, 128, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                                color: 'white',
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            🌐 Art-Net
                        </button>
                        <button
                            className={`mode-btn ${dmxMode !== 'artnet' ? 'active' : ''}`}
                            onClick={() => handleModeChange('usb')}
                            style={{
                                padding: '12px 20px',
                                borderRadius: '8px',
                                border: dmxMode !== 'artnet' ? '2px solid var(--accent)' : '1px solid var(--border-color)',
                                background: dmxMode !== 'artnet' ? 'rgba(255, 0, 128, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                                color: 'white',
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            🔌 USB Direct
                        </button>
                    </div>
                    {dmxMode !== 'artnet' && (
                        <div className="native-config" style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <select
                                value={selectedPort}
                                onChange={(e) => setSelectedPort(e.target.value)}
                                className="system-select"
                                style={{ padding: '10px 12px' }}
                            >
                                {serialPorts.map(p => <option key={p.path} value={p.path}>{p.displayName || p.path}</option>)}
                            </select>
                            <button
                                onClick={() => handleModeChange('usb')}
                                className="action-button active"
                                disabled={isConnecting}
                            >
                                {isConnecting ? '⏳ CONNECTING...' : '🔄 RECONNECT'}
                            </button>
                        </div>
                    )}
                    {actualHz > 0 && (
                        <div style={{ marginTop: '12px', fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent)', animation: 'pulse 1s infinite' }} />
                            Transmitting at <strong style={{ color: 'var(--accent)' }}>{actualHz} Hz</strong>
                        </div>
                    )}
                </div>

                <div className="glass-card hardware-card">
                    <h3>Fixtures Config</h3>
                    <div className="fixtures-config-list" style={{ marginTop: '10px' }}>
                        {dmxFixtures.map(f => (
                            <div key={f.id} className="fixture-config-row" style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '8px' }}>
                                <img src={sticktecImg} alt="bar" style={{ width: '30px', opacity: 0.5 }} />
                                <input
                                    type="text"
                                    value={f.name}
                                    onChange={(e) => handleRename(f.id, e.target.value)}
                                    style={{ flex: 1, background: 'transparent', border: '1px solid var(--border-color)', color: 'white', padding: '4px 8px' }}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default SystemPage
