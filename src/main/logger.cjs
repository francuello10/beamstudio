/**
 * Conditional Logger for BeamStudio (CommonJS version for Workers)
 * Only logs in development mode
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
        // Always log errors, even in production
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

module.exports = logger
