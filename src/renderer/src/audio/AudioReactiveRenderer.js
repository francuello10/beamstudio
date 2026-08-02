import { multiplyBrightness, lerpColor, GENRE_PROFILES } from '../utils/palettes'

const clamp01 = (value) => Math.max(0, Math.min(1, value))

const buildCenterBassKickColor = (color, rawBass, boostLevel) => {
    // Keep Slot 2 in the selected/base hue. White accents clip too easily on DMX
    // fixtures and look like a stuck center light instead of an audio kick.
    const threshold = Math.max(0.02, 0.16 - boostLevel * 0.035)
    const normalized = clamp01((rawBass - threshold) / (0.86 - threshold))
    const curve = Math.max(0.48, 0.9 - boostLevel * 0.14)
    const kick = Math.pow(normalized, curve)
    const floor = clamp01(0.24 - boostLevel * 0.075)
    const ceiling = Math.min(1, 0.72 + boostLevel * 0.12)
    const intensity = floor + kick * (ceiling - floor)
    return multiplyBrightness(color, intensity)
}

export const buildBassPulseColors = (audioFrame) => {
    const bassBrightness = Math.pow(audioFrame.levels.bass, 0.8)
    const ambientFloor = 0.05
    const centerIntensity = Math.max(ambientFloor, bassBrightness)
    const bassSideBleed = bassBrightness * 0.28
    const leftIntensity = Math.max(ambientFloor, Math.min(1, Math.pow(audioFrame.stereo.midHighLeft, 0.9) + bassSideBleed))
    const rightIntensity = Math.max(ambientFloor, Math.min(1, Math.pow(audioFrame.stereo.midHighRight, 0.9) + bassSideBleed))

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
        const boostLevel = Math.max(0.5, Math.min(2.5, audioSensitivity || 1))
        nextTargetColors = inputColors.map((color, index) => {
            const rawBass = clamp01(audioFrame.levels.bass)
            const bass = Math.pow(rawBass, 0.62)
            if (index === 1) {
                return buildCenterBassKickColor(color, rawBass, boostLevel)
            }

            const sideEnergy = index === 0 ? audioFrame.stereo.midHighLeft : audioFrame.stereo.midHighRight
            const sideWithBassBleed = Math.min(1, Math.pow(sideEnergy, 0.72) + bass * 0.22)
            const factor = 0.32 + sideWithBassBleed * 1.15 * boostLevel
            return multiplyBrightness(color, factor)
        })
    }

    const lerpSpeed = modifierMode
        ? Math.min(0.9, 0.58 + Math.max(0.5, Math.min(2.5, audioSensitivity || 1)) * 0.12)
        : 0.24
    return nextTargetColors.map((targetColor, index) =>
        lerpColor(currentColors[index], targetColor, lerpSpeed)
    )
}
