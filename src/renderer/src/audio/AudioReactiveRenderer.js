import { multiplyBrightness, lerpColor, GENRE_PROFILES } from '../utils/palettes'

export const buildBassPulseColors = (audioFrame) => {
    const bassBrightness = Math.pow(audioFrame.levels.bass, 0.8)
    const ambientFloor = 0.05
    const centerIntensity = Math.max(ambientFloor, bassBrightness)
    const leftIntensity = Math.max(ambientFloor, Math.pow(audioFrame.stereo.midHighLeft, 0.9))
    const rightIntensity = Math.max(ambientFloor, Math.pow(audioFrame.stereo.midHighRight, 0.9))

    return {
        bassBrightness,
        colors: [
            {
                r: Math.round(150 * leftIntensity),
                g: Math.round(120 * leftIntensity),
                b: Math.round(255 * leftIntensity)
            },
            {
                r: Math.round(255 * centerIntensity),
                g: Math.round(180 * centerIntensity),
                b: Math.round(100 * centerIntensity)
            },
            {
                r: Math.round(150 * rightIntensity),
                g: Math.round(120 * rightIntensity),
                b: Math.round(255 * rightIntensity)
            }
        ]
    }
}

export const buildGenreColors = (audioFrame) => {
    const genre = audioFrame.genre || 'UNKNOWN'
    const bass = audioFrame.levels.bass
    const left = audioFrame.stereo.midHighLeft
    const right = audioFrame.stereo.midHighRight
    const lowMidLeft = audioFrame.stereo.lowMidLeft
    const lowMidRight = audioFrame.stereo.lowMidRight
    const lowMidAvg = (lowMidLeft + lowMidRight) / 2

    if (genre === 'ELECTRO') {
        const bassGlow = bass * 0.85
        return [
            { r: Math.round(left * 180 + 20), g: Math.round(left * 50 + 10), b: Math.round(left * 200 + 30) },
            { r: Math.round(200 * bassGlow + 40), g: Math.round(80 * bassGlow + 15), b: Math.round(120 * bassGlow + 30) },
            { r: Math.round(right * 180 + 20), g: Math.round(right * 50 + 10), b: Math.round(right * 200 + 30) }
        ]
    }

    if (genre === 'ROCK') {
        return [
            { r: Math.round(left * 180 + 15), g: Math.round(left * 100 + 10), b: Math.round(left * 20) },
            { r: Math.round(220 * bass + 20), g: Math.round(130 * bass + 15), b: Math.round(20 * bass + 5) },
            { r: Math.round(right * 180 + 15), g: Math.round(right * 100 + 10), b: Math.round(right * 20) }
        ]
    }

    if (genre === 'LATIN') {
        const warmFactor = lowMidAvg * GENRE_PROFILES.LATIN.midWeight
        return [
            { r: Math.round(lowMidLeft * 180 + 15), g: Math.round(lowMidLeft * 100 + 10), b: Math.round(lowMidLeft * 30) },
            { r: Math.round(warmFactor * 220 + 25), g: Math.round(warmFactor * 120 + 15), b: Math.round(bass * 40 + 10) },
            { r: Math.round(lowMidRight * 180 + 15), g: Math.round(lowMidRight * 100 + 10), b: Math.round(lowMidRight * 30) }
        ]
    }

    if (genre === 'CINEMA') {
        const cinemaBase = bass * 0.8
        return [
            { r: Math.round(left * 120 + 15), g: Math.round(left * 50 + 10), b: Math.round(left * 200 + 25) },
            { r: Math.round(cinemaBase * 160 + 20), g: Math.round(cinemaBase * 60 + 10), b: Math.round(cinemaBase * 200 + 30) },
            { r: Math.round(right * 120 + 15), g: Math.round(right * 50 + 10), b: Math.round(right * 200 + 25) }
        ]
    }

    return [
        { r: Math.round(left * 20 + 5), g: Math.round(left * 120 + 15), b: Math.round(left * 170 + 25) },
        { r: Math.round(bass * 30 + 5), g: Math.round(bass * 100 + 20), b: Math.round(bass * 160 + 30) },
        { r: Math.round(right * 20 + 5), g: Math.round(right * 120 + 15), b: Math.round(right * 170 + 25) }
    ]
}

export const applyModifierAndSmoothing = ({
    currentColors,
    targetColors,
    inputColors,
    modifierMode,
    audioFrame,
    audioSensitivity
}) => {
    let nextTargetColors = targetColors

    if (modifierMode && inputColors && inputColors.length >= 3) {
        nextTargetColors = inputColors.map((color, index) => {
            const factor = index === 1
                ? (0.2 + audioFrame.levels.bass * 1.5 * audioSensitivity)
                : (0.3 + (index === 0 ? audioFrame.stereo.midHighLeft : audioFrame.stereo.midHighRight) * 0.8 * audioSensitivity)
            return multiplyBrightness(color, factor)
        })
    }

    const lerpSpeed = modifierMode ? 0.6 : 0.20
    return nextTargetColors.map((targetColor, index) =>
        lerpColor(currentColors[index], targetColor, lerpSpeed)
    )
}
