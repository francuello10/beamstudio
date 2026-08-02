import { multiplyBrightness, lerpColor, GENRE_PROFILES } from '../utils/palettes'

const clamp01 = (value) => Math.max(0, Math.min(1, value))

const normalizeAudioPowerColor = (color, fallback = { r: 255, g: 64, b: 180 }) => {
    const source = color || fallback
    const maxChannel = Math.max(source.r || 0, source.g || 0, source.b || 0)
    if (maxChannel <= 0) return fallback

    const gain = 255 / maxChannel
    return {
        r: Math.min(255, Math.round((source.r || 0) * gain)),
        g: Math.min(255, Math.round((source.g || 0) * gain)),
        b: Math.min(255, Math.round((source.b || 0) * gain))
    }
}

const quantizeKick = (energy, boostLevel, {
    threshold = 0.14,
    thresholdBoost = 0.035,
    curve = 0.78,
    curveBoost = 0.12,
    minSteps = 3,
    baseSteps = 8,
    stepBoost = 1.35
} = {}) => {
    // Boost should make accepted hits larger/brutal, not turn every low-mid
    // wiggle into a trigger. Keep a real floor even at x4.
    const boostBias = Math.max(0, boostLevel - 1)
    const trigger = Math.max(threshold * 0.72, threshold - boostBias * thresholdBoost * 0.42)
    const normalized = clamp01((energy - trigger) / (0.88 - trigger))
    const shapedKick = Math.pow(normalized, Math.max(0.25, curve - boostLevel * curveBoost))
    const stepCount = Math.max(minSteps, Math.round(baseSteps - boostLevel * stepBoost))
    return shapedKick <= 0 ? 0 : Math.min(1, Math.ceil(shapedKick * stepCount) / stepCount)
}

const withAudioDim = (color, kick, boostLevel, {
    floor = 0.16,
    floorBoost = 0.04,
    dimFloor = 44,
    dimFloorBoost = 12,
    fallbackColor
} = {}) => {
    const intensityFloor = clamp01(floor - boostLevel * floorBoost)
    const intensity = intensityFloor + kick * (1 - intensityFloor)
    const dimBase = Math.max(0, Math.round(dimFloor - boostLevel * dimFloorBoost))
    const dim = Math.round(dimBase + kick * (255 - dimBase))

    const powerColor = normalizeAudioPowerColor(color, fallbackColor)

    return {
        ...multiplyBrightness(powerColor, intensity),
        dim
    }
}

const buildCenterBassKickColor = (color, rawBass, boostLevel) => {
    // Keep Slot 2 in the selected/base hue. For this hardware the physical 4D
    // effect comes from brutal DIM jumps, not subtle RGB-only modulation.
    const kick = quantizeKick(rawBass, boostLevel, {
        threshold: 0.18,
        thresholdBoost: 0.03,
        curve: 0.56,
        curveBoost: 0.08,
        minSteps: 2,
        baseSteps: 4,
        stepBoost: 0.5
    })
    return withAudioDim(color, kick, boostLevel, {
        floor: 0.02,
        floorBoost: 0.004,
        dimFloor: 8,
        dimFloorBoost: 2,
        fallbackColor: { r: 255, g: 48, b: 96 }
    })
}

const buildSidePartyKickColor = (color, energy, bass, boostLevel) => {
    const kick = quantizeKick(Math.min(1, energy + bass * 0.36), boostLevel, {
        threshold: 0.18,
        thresholdBoost: 0.03,
        curve: 0.82,
        curveBoost: 0.1,
        minSteps: 3,
        baseSteps: 8,
        stepBoost: 1.15
    })
    return withAudioDim(color, kick, boostLevel, {
        floor: 0.1,
        floorBoost: 0.02,
        dimFloor: 36,
        dimFloorBoost: 7,
        fallbackColor: energy >= 0.5 ? { r: 64, g: 220, b: 255 } : { r: 120, g: 64, b: 255 }
    })
}

const lerpAudioColor = (current, target, factor) => {
    const color = lerpColor(current, target, factor)
    if (target?.dim !== undefined || current?.dim !== undefined) {
        const currentDim = current?.dim ?? target?.dim ?? 255
        const targetDim = target?.dim ?? currentDim
        color.dim = Math.round(currentDim + (targetDim - currentDim) * factor)
    }
    return color
}

export const buildBassPulseColors = (audioFrame) => {
    const centerBassHit = clamp01(audioFrame.levels.centerBassHit ?? audioFrame.levels.bass ?? 0)
    const bassBrightness = Math.pow(centerBassHit, 0.72)
    const sideBass = Math.pow(clamp01(audioFrame.levels.bass || 0), 0.8)
    const vocalPulse = Math.pow(clamp01(audioFrame.levels.vocal || audioFrame.levels.melodyPulse || 0), 0.7)
    const ambientFloor = 0.05
    const centerIntensity = Math.max(ambientFloor, bassBrightness)
    const bassSideBleed = sideBass * 0.34
    const leftIntensity = Math.max(ambientFloor, Math.min(1, Math.pow(audioFrame.stereo.midHighLeft, 0.9) + vocalPulse * 0.34 + bassSideBleed))
    const rightIntensity = Math.max(ambientFloor, Math.min(1, Math.pow(audioFrame.stereo.midHighRight, 0.9) + vocalPulse * 0.34 + bassSideBleed))

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
    const centerBass = clamp01(audioFrame.levels.centerBassHit ?? bass ?? 0)
    const left = audioFrame.stereo.midHighLeft
    const right = audioFrame.stereo.midHighRight
    const vocalPulse = clamp01(audioFrame.levels.vocal || audioFrame.levels.melodyPulse || 0)
    const leftMelody = clamp01(left + vocalPulse * 0.3)
    const rightMelody = clamp01(right + vocalPulse * 0.3)
    const lowMidLeft = audioFrame.stereo.lowMidLeft
    const lowMidRight = audioFrame.stereo.lowMidRight
    const lowMidMelodyLeft = clamp01(lowMidLeft + vocalPulse * 0.25)
    const lowMidMelodyRight = clamp01(lowMidRight + vocalPulse * 0.25)

    if (genre === 'ELECTRO') {
        const bassGlow = centerBass * 0.85
        return [
            { r: Math.round(leftMelody * 180 + 20), g: Math.round(leftMelody * 50 + 10), b: Math.round(leftMelody * 200 + 30) },
            { r: Math.round(200 * bassGlow + 40), g: Math.round(80 * bassGlow + 15), b: Math.round(120 * bassGlow + 30) },
            { r: Math.round(rightMelody * 180 + 20), g: Math.round(rightMelody * 50 + 10), b: Math.round(rightMelody * 200 + 30) }
        ]
    }

    if (genre === 'ROCK') {
        return [
            { r: Math.round(leftMelody * 180 + 15), g: Math.round(leftMelody * 100 + 10), b: Math.round(leftMelody * 20) },
            { r: Math.round(220 * centerBass + 20), g: Math.round(130 * centerBass + 15), b: Math.round(20 * centerBass + 5) },
            { r: Math.round(rightMelody * 180 + 15), g: Math.round(rightMelody * 100 + 10), b: Math.round(rightMelody * 20) }
        ]
    }

    if (genre === 'LATIN') {
        const centerWarm = clamp01(centerBass * GENRE_PROFILES.LATIN.bassWeight)
        return [
            { r: Math.round(lowMidMelodyLeft * 180 + 15), g: Math.round(lowMidMelodyLeft * 100 + 10), b: Math.round(lowMidMelodyLeft * 30) },
            { r: Math.round(centerWarm * 220 + 25), g: Math.round(centerWarm * 120 + 15), b: Math.round(centerWarm * 40 + 10) },
            { r: Math.round(lowMidMelodyRight * 180 + 15), g: Math.round(lowMidMelodyRight * 100 + 10), b: Math.round(lowMidMelodyRight * 30) }
        ]
    }

    if (genre === 'CINEMA') {
        const cinemaBase = centerBass * 0.8
        return [
            { r: Math.round(leftMelody * 120 + 15), g: Math.round(leftMelody * 50 + 10), b: Math.round(leftMelody * 200 + 25) },
            { r: Math.round(cinemaBase * 160 + 20), g: Math.round(cinemaBase * 60 + 10), b: Math.round(cinemaBase * 200 + 30) },
            { r: Math.round(rightMelody * 120 + 15), g: Math.round(rightMelody * 50 + 10), b: Math.round(rightMelody * 200 + 25) }
        ]
    }

    return [
        { r: Math.round(leftMelody * 20 + 5), g: Math.round(leftMelody * 120 + 15), b: Math.round(leftMelody * 170 + 25) },
        { r: Math.round(centerBass * 30 + 5), g: Math.round(centerBass * 100 + 20), b: Math.round(centerBass * 160 + 30) },
        { r: Math.round(rightMelody * 20 + 5), g: Math.round(rightMelody * 120 + 15), b: Math.round(rightMelody * 170 + 25) }
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

    const sourceColors = inputColors && inputColors.length >= 3 ? inputColors : targetColors

    if (modifierMode && sourceColors && sourceColors.length >= 3) {
        const boostLevel = Math.max(0.5, Math.min(4, audioSensitivity || 1))
        nextTargetColors = sourceColors.map((color, index) => {
            const rawBass = clamp01(audioFrame.levels.bass)
            const centerBassHit = clamp01(audioFrame.levels.centerBassHit ?? rawBass)
            const bass = Math.pow(rawBass, 0.62)
            const vocalPulse = Math.pow(clamp01(audioFrame.levels.vocal || audioFrame.levels.melodyPulse || 0), 0.62)
            if (index === 1) {
                return buildCenterBassKickColor(color, centerBassHit, boostLevel)
            }

            const sideEnergy = index === 0 ? audioFrame.stereo.midHighLeft : audioFrame.stereo.midHighRight
            const sideWithBassBleed = Math.min(1, Math.pow(sideEnergy, 0.72) + vocalPulse * 0.34 + bass * 0.36)
            return buildSidePartyKickColor(color, sideWithBassBleed, bass, boostLevel)
        })
    }

    const lerpSpeed = modifierMode
        ? Math.min(0.95, 0.58 + Math.max(0.5, Math.min(4, audioSensitivity || 1)) * 0.1)
        : 0.24
    return nextTargetColors.map((targetColor, index) => {
        const slotLerpSpeed = modifierMode ? (index === 1 ? 1 : Math.max(0.9, lerpSpeed)) : lerpSpeed
        return lerpAudioColor(currentColors[index], targetColor, slotLerpSpeed)
    })
}
