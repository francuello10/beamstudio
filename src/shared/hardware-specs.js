/**
 * BeamStudio Hardware Specifications
 * 
 * Centralized immutable constants for the DMX protocol and FTDI hardware limits.
 * These values are calibrated to prevent jitter and maintain stability of the 
 * StickTec / FTDI D2XX communication pipeline.
 */

export const HARDWARE_CONSTRAINTS = {
    DMX_MIN: 0,
    DMX_MAX: 255,
    DMX_UNIVERSE_CAPACITY: 33, // 32 channels + 1 start code
};

export const CORE_TIMING = {
    THROTTLE_BUFFER_MS: 25,    // 40Hz transmission cycle for stability
    CORE_REFRESH_RATE: 44,      // Standard DMX refresh rate
};

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
    Math.max(HARDWARE_CONSTRAINTS.DMX_MIN, Math.min(HARDWARE_CONSTRAINTS.DMX_MAX, value));
