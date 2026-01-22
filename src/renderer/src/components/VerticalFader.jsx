import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './VerticalFader.css';

/**
 * VerticalFader v3.0 - Pro-Grade Hybrid-Precision Fader
 * Features: Non-passive scroll isolation, keyboard navigation, 
 *           Double-click reset, Modifier-aware tooltips, Limit-hit feedback.
 */
const VerticalFader = React.memo(({
    value,
    onChange,
    label,
    color,
    id,
    defaultValue = 0
}) => {
    const [isHovered, setIsHovered] = useState(false);
    const [showTooltip, setShowTooltip] = useState(false);
    const [modifier, setModifier] = useState(null); // 'shift' | 'alt' | null
    const [isAtLimit, setIsAtLimit] = useState(null); // 'min' | 'max' | null

    const containerRef = useRef(null);
    const sliderRef = useRef(null);
    const isDragging = useRef(false);
    const tooltipTimer = useRef(null);

    // 1. ADVANCED SCROLL ISOLATION (Non-Passive)
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const handleNativeWheel = (e) => {
            // Mandatory isolation
            e.preventDefault();
            e.stopPropagation();

            let step = 5;
            if (e.shiftKey) step = 1;
            if (e.altKey) step = 25;

            const delta = e.deltaY > 0 ? -step : step;
            const rawValue = value + delta;

            // STRICT CLAMPING
            let newValue = Math.max(0, Math.min(255, rawValue));

            // Limit Hit Feedback
            if (rawValue > 255) setIsAtLimit('max');
            else if (rawValue < 0) setIsAtLimit('min');
            else setIsAtLimit(null);

            onChange(id, newValue);
            setShowTooltip(true);

            if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
            tooltipTimer.current = setTimeout(() => {
                setShowTooltip(false);
                setIsAtLimit(null);
            }, 800);
        };

        // Attach non-passive listener to allow preventDefault
        el.addEventListener('wheel', handleNativeWheel, { passive: false });
        return () => el.removeEventListener('wheel', handleNativeWheel);
    }, [id, value, onChange]);

    // 2. KEYBOARD NAVIGATION & MODIFIER DETECTION
    useEffect(() => {
        const handleGlobalKeyDown = (e) => {
            if (e.shiftKey) setModifier('shift');
            else if (e.altKey) setModifier('alt');
        };
        const handleGlobalKeyUp = () => setModifier(null);

        window.addEventListener('keydown', handleGlobalKeyDown);
        window.addEventListener('keyup', handleGlobalKeyUp);
        return () => {
            window.removeEventListener('keydown', handleGlobalKeyDown);
            window.removeEventListener('keyup', handleGlobalKeyUp);
        };
    }, []);

    const handleKeyDown = (e) => {
        let step = 5;
        if (e.shiftKey) step = 1;
        if (e.altKey) step = 25;

        if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
            e.preventDefault();
            onChange(id, Math.min(255, value + step));
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
            e.preventDefault();
            onChange(id, Math.max(0, value - step));
        } else if (e.key === 'Home') {
            onChange(id, 255);
        } else if (e.key === 'End') {
            onChange(id, 0);
        }
    };

    // 3. MOUSE & RESET LOGIC
    const updateFromMouse = useCallback((e) => {
        if (!sliderRef.current) return;
        const rect = sliderRef.current.getBoundingClientRect();
        const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
        const percent = 1 - (y / rect.height);
        onChange(id, Math.round(percent * 255));
    }, [id, onChange]);

    const handleMouseDown = useCallback((e) => {
        isDragging.current = true;
        updateFromMouse(e);
        setShowTooltip(true);
    }, [updateFromMouse]);

    const handleDoubleClick = () => {
        onChange(id, defaultValue);
        // Visual pop on reset
        setIsAtLimit('min');
        setTimeout(() => setIsAtLimit(null), 300);
    };

    useEffect(() => {
        const handleMouseMove = (e) => { if (isDragging.current) updateFromMouse(e); };
        const handleMouseUp = () => { isDragging.current = false; setShowTooltip(false); };

        if (isDragging.current) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [updateFromMouse]);

    const percent = (value / 255) * 100;

    return (
        <div
            ref={containerRef}
            tabIndex={0}
            className={`vertical-fader-container ${isHovered ? 'hover-active' : ''} ${modifier ? `mod-${modifier}` : ''}`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => { setIsHovered(false); setShowTooltip(false); }}
            onKeyDown={handleKeyDown}
            onDoubleClick={handleDoubleClick}
        >
            <div className="fader-label-container">
                <span className="fader-value-display">{value}</span>
                <span className="fader-label-text" style={{ color: color }}>{label}</span>
            </div>

            <div
                className="fader-track-area"
                ref={sliderRef}
                onMouseDown={handleMouseDown}
            >
                <div className="fader-track-base">
                    <div className="fader-ticks">
                        {[0, 25, 50, 75, 100].map(t => (
                            <div key={t} className="tick" style={{ bottom: `${t}%` }} />
                        ))}
                    </div>

                    <motion.div
                        className="fader-fill-neon"
                        initial={false}
                        animate={{
                            height: `${percent}%`,
                            boxShadow: isAtLimit ? `0 0 30px ${color}` : `0 0 15px ${color}66`
                        }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        style={{ background: `linear-gradient(to top, ${color}cc, ${color})` }}
                    />

                    <motion.div
                        className="fader-handle-pro"
                        initial={false}
                        animate={{
                            bottom: `${percent}%`,
                            scale: isAtLimit ? 1.2 : 1,
                            x: "-50%"
                        }}
                        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    >
                        <div className="handle-line-glow" style={{ backgroundColor: color }} />
                    </motion.div>
                </div>

                <AnimatePresence>
                    {(showTooltip || isHovered) && (
                        <motion.div
                            className={`fader-tooltip ${modifier ? `tooltip-${modifier}` : ''}`}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{
                                opacity: 1,
                                x: 10,
                                scale: isAtLimit ? [1, 1.3, 1] : 1
                            }}
                            exit={{ opacity: 0, x: 20 }}
                            style={{ bottom: `${percent}%` }}
                        >
                            {modifier === 'shift' && <span className="mod-tag">FINE</span>}
                            {modifier === 'alt' && <span className="mod-tag">FAST</span>}
                            {value}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <div className="fader-quick-actions">
                <button onClick={() => onChange(id, 255)} className="quick-btn">MAX</button>
                <button onClick={() => onChange(id, 0)} className="quick-btn">ZERO</button>
            </div>
        </div>
    );
});

export default VerticalFader;
