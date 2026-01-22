import { hslToRgb } from './palettes'

/**
 * AI Runtime Sandbox
 * Compiles and executes AI-generated JavaScript code for lighting scenes.
 */

const SafeScope = {
    Math,
    Date,
    hslToRgb
}

/**
 * Compiles a raw code string into an executable function.
 * @param {string} codeBody - The function body string (returns [L, C, R])
 * @returns {Function|null} - The compiled function or null on error
 */
export function compileAIResponse(codeBody) {
    try {
        // Create a function that takes params and returns the result
        // We inject 'hslToRgb' into the scope arguments
        return new Function('t', 'bass', 'hslToRgb', codeBody)
    } catch (err) {
        console.error("AI Compilation Error:", err)
        return null
    }
}

/**
 * Executes a compiled AI scene function.
 * @param {Function} sceneFunc - The compiled function
 * @param {number} t - Time in ms
 * @param {number} bass - Bass energy (0.0 - 1.0)
 * @returns {Array} - Array of 3 color objects [{r,g,b}, ...]
 */
export function executeAIScene(sceneFunc, t, bass) {
    try {
        const colors = sceneFunc(t, bass, hslToRgb)

        // Basic validation
        if (!Array.isArray(colors) || colors.length !== 3) {
            // Fallback if AI returns garbage
            return [{ r: 0, g: 0, b: 0 }, { r: 0, g: 0, b: 0 }, { r: 0, g: 0, b: 0 }]
        }
        return colors
    } catch (err) {
        // Runtime error (e.g., bass is undefined in bad code)
        // console.warn("AI Runtime Warning:", err) // Suppress log spam
        return [{ r: 0, g: 0, b: 0 }, { r: 0, g: 0, b: 0 }, { r: 0, g: 0, b: 0 }]
    }
}
