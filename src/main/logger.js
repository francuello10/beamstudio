/**
 * Conditional Logger for BeamStudio
 * Only logs in development mode (when NODE_ENV !== 'production')
 * In production, logs are suppressed to improve performance and reduce noise
 */

const isDevelopment = process.env.NODE_ENV !== 'production' || process.env.ELECTRON_IS_DEV === '1'

const logger = {
    log: (...args) => {
        if (isDevelopment) {
            console.log(...args)
        }
    },
    warn: (...args) => {
        if (isDevelopment) {
            console.warn(...args)
        }
    },
    error: (...args) => {
        // Always log errors, even in production, as they're critical
        console.error(...args)
    },
    info: (...args) => {
        if (isDevelopment) {
            console.info(...args)
        }
    },
    debug: (...args) => {
        if (isDevelopment) {
            console.debug(...args)
        }
    }
}

export default logger
