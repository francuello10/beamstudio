import React, { useRef } from 'react'

function hslToRgb(h, s, l) {
    s /= 100; l /= 100
    const k = n => (n + h / 30) % 12
    const a = s * Math.min(l, 1 - l)
    const f = n => l - a * Math.max(Math.min(k(n) - 3, 9 - k(n), 1), -1)
    return { r: Math.round(255 * f(0)), g: Math.round(255 * f(8)), b: Math.round(255 * f(4)) }
}

function ColorWheel({ onChange, size = 180 }) {
    const wheelRef = useRef(null)

    const handleInteraction = (e) => {
        if (!wheelRef.current) return
        const rect = wheelRef.current.getBoundingClientRect()
        const clientX = e.touches ? e.touches[0].clientX : e.clientX
        const clientY = e.touches ? e.touches[0].clientY : e.clientY

        const x = clientX - (rect.left + rect.width / 2)
        const y = clientY - (rect.top + rect.height / 2)

        let angle = Math.atan2(y, x) * (180 / Math.PI) + 90
        if (angle < 0) angle += 360

        const rgb = hslToRgb(angle, 100, 50)
        onChange(rgb)
    }

    return (
        <div
            ref={wheelRef}
            className="color-wheel-container"
            style={{
                width: size, height: size,
                borderRadius: '50%',
                background: 'conic-gradient(from 0deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
                margin: '10px auto',
                position: 'relative',
                cursor: 'crosshair',
                touchAction: 'none',
                boxShadow: '0 0 20px rgba(0,0,0,0.5), inset 0 0 20px rgba(0,0,0,0.2)'
            }}
            onMouseDown={(e) => {
                handleInteraction(e);
                const move = (ev) => handleInteraction(ev);
                const up = () => {
                    window.removeEventListener('mousemove', move);
                    window.removeEventListener('mouseup', up);
                };
                window.addEventListener('mousemove', move);
                window.addEventListener('mouseup', up);
            }}
            onTouchStart={(e) => { handleInteraction(e); }}
            onTouchMove={(e) => { handleInteraction(e); }}
        >
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '20px', height: '20px', background: '#333', borderRadius: '50%', pointerEvents: 'none' }} />
        </div>
    )
}

export default ColorWheel
