import React, { useRef, useCallback, useEffect } from 'react'

const VerticalFader = React.memo(({ channel, value, onChange, config }) => {
    const sliderRef = useRef(null)
    const isDragging = useRef(false)

    const updateValue = useCallback((e) => {
        if (!sliderRef.current) return
        const rect = sliderRef.current.getBoundingClientRect()
        const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top))
        const percent = 1 - (y / rect.height)
        onChange(channel.id, Math.round(percent * 255))
    }, [channel.id, onChange])

    const handleWheel = useCallback((e) => {
        e.preventDefault()
        e.stopPropagation()
        const delta = e.deltaY > 0 ? -5 : 5
        const newValue = Math.max(0, Math.min(255, value + delta))
        onChange(channel.id, newValue)
    }, [channel.id, value, onChange])

    const handleMouseDown = useCallback((e) => {
        isDragging.current = true;
        updateValue(e)
    }, [updateValue])

    useEffect(() => {
        const move = (e) => { if (isDragging.current) { e.preventDefault(); updateValue(e) } }
        const up = () => { isDragging.current = false }
        window.addEventListener('mousemove', move)
        window.addEventListener('mouseup', up)
        return () => {
            window.removeEventListener('mousemove', move)
            window.removeEventListener('mouseup', up)
        }
    }, [updateValue])

    const funcName = channel.id === 'func' && config?.funcRanges
        ? config.funcRanges.find(r => value >= r.min && value <= (r.max || 255))?.name
        : null

    const percent = (value / 255) * 100

    return (
        <div className="fader-strip aesthetic" onWheel={handleWheel}>
            <div className="fader-track-container rounded" ref={sliderRef} onMouseDown={handleMouseDown}>
                <div className="fader-track-bg" />
                <div
                    className="fader-fill rounded"
                    style={{
                        height: `${percent}%`,
                        background: channel.color,
                        boxShadow: `0 0 20px ${channel.color}44`
                    }}
                />
                <div className="fader-thumb" style={{ bottom: `${percent}%` }} />
            </div>
            <div className="fader-info">
                <span className="fader-value">{value}</span>
                <span className="fader-label" style={{ color: channel.color }}>{channel.label}</span>
                <span className="fader-mode">{funcName || ''}</span>

                <button
                    className={`fader-reset-btn ${value === 255 ? 'active-max' : ''}`}
                    onClick={(e) => { e.stopPropagation(); onChange(channel.id, 255); }}
                    title="Maximizar (255)"
                    style={{ marginBottom: '4px' }}
                >
                    MAX
                </button>
                <button
                    className={`fader-reset-btn ${value === 0 ? 'at-zero' : ''}`}
                    onClick={(e) => { e.stopPropagation(); onChange(channel.id, 0); }}
                    title="Volver a 0"
                >
                    0
                </button>
            </div>
        </div>
    )
})

export default VerticalFader
