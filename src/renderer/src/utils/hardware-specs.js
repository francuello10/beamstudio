/**
 * BeamStudio Hardware Specifications
 * 
 * Centralized immutable constants for the DMX protocol and FTDI hardware limits.
 * These values are calibrated to prevent jitter and maintain stability of the 
 * StickTec / FTDI D2XX communication pipeline.
 * 
 * @ai-constraints These values are hardware-driven. Do NOT modify them for 
 * "performance optimization" without physical hardware validation.
 */

export const DMX_LIMITS = {
    MIN: 0,
    MAX: 255
};

/**
 * The physical transmit length of the buffer.
 * Current driver is limited to 32+1 channels (32 DMX + 1 Start Code).
 */
export const UNIVERSE_CAPACITY = 33;

/**
 * Standard DMX refresh rate.
 * 44Hz is the theoretical maximum for a full 512 universe, 
 * but here it provides the standard timing for our 32-channel rig.
 */
export const CORE_REFRESH_RATE = 44;

/**
 * Hardware Timing Constants (ms)
 * Calibrated for FTDI D2XX chip stability.
 */
export const SERIAL_PROTOCOL = {
    BREAK: 2.0, // Mark Break
    MAB: 0.2,   // Mark After Break
};

/**
 * Utility to clamp values within DMX limits.
 * @param {number} value - The input value to clamp.
 * @returns {number} - Clamped value [0-255].
 */
export const clampDmxValue = (value) =>
    Math.max(DMX_LIMITS.MIN, Math.min(DMX_LIMITS.MAX, value));
