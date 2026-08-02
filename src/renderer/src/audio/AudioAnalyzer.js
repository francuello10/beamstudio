export const extractBands = (data, count = 16) => {
    const bands = []
    const step = Math.floor(data.length / count)

    for (let i = 0; i < count; i++) {
        let sum = 0
        for (let j = 0; j < step; j++) sum += data[i * step + j]
        bands.push(sum / step / 255)
    }

    return bands
}

const clamp01 = (value) => Math.max(0, Math.min(1, value))

const averageFrequencyBand = (data, sampleRate, fftSize, minHz, maxHz) => {
    if (!data?.length || !sampleRate || !fftSize) return 0

    const hzPerBin = sampleRate / fftSize
    const startBin = Math.max(1, Math.floor(minHz / hzPerBin))
    const endBin = Math.min(data.length - 1, Math.ceil(maxHz / hzPerBin))
    if (endBin < startBin) return 0

    let sum = 0
    let count = 0
    for (let bin = startBin; bin <= endBin; bin++) {
        sum += data[bin]
        count++
    }

    return count ? sum / count / 255 : 0
}

export const computeBassProfile = (dataBass, {
    sampleRate = 48000,
    fftSize = 2048,
    previousRaw = 0,
    adaptiveFloor = 0,
    boostLevel = 1
} = {}) => {
    if (!dataBass?.length) {
        return { energy: 0, raw: 0, floor: 0, sub: 0, kick: 0, lowMid: 0, transient: 0 }
    }

    // True bass detector for lighting:
    // - SUB: 35-90 Hz
    // - KICK: 90-160 Hz
    // - LOW-MID penalty: 160-350 Hz so guitars/vocals/rock body do not fake club bass.
    const sub = averageFrequencyBand(dataBass, sampleRate, fftSize, 35, 90)
    const kick = averageFrequencyBand(dataBass, sampleRate, fftSize, 90, 160)
    const lowMid = averageFrequencyBand(dataBass, sampleRate, fftSize, 160, 350)

    const coreBass = Math.max(sub * 1.25, kick * 1.08, sub * 0.78 + kick * 0.58)
    const lowMidPenalty = Math.min(0.5, lowMid * 0.55)
    const raw = clamp01(coreBass - lowMidPenalty)

    const floor = adaptiveFloor <= 0.0001 && previousRaw <= 0.0001
        ? raw
        : raw > adaptiveFloor
            ? adaptiveFloor * 0.96 + raw * 0.04
            : adaptiveFloor * 0.88 + raw * 0.12

    const sensitivity = Math.max(0.5, Math.min(4, boostLevel || 1))
    const gate = Math.max(0.012, floor * (1.16 - sensitivity * 0.045) + (0.045 - sensitivity * 0.008))
    const aboveFloor = Math.max(0, raw - gate)
    const rise = Math.max(0, raw - previousRaw)
    const transient = clamp01(rise * 7.5)
    const sustained = clamp01(aboveFloor * 2.4)
    const shaped = sustained * 0.65 + transient * 0.95
    const curve = Math.max(0.45, 0.82 - sensitivity * 0.06)
    const energy = clamp01(Math.pow(shaped, curve))

    return { energy, raw, floor, sub, kick, lowMid, transient }
}

export const computeBassEnergy = (dataBass, options) => computeBassProfile(dataBass, options).energy

export const computeVocalMelodyProfile = (data, {
    sampleRate = 48000,
    fftSize = 2048,
    previousRaw = 0,
    adaptiveFloor = 0,
    boostLevel = 1
} = {}) => {
    if (!data?.length) {
        return { energy: 0, raw: 0, floor: 0, body: 0, vowel: 0, presence: 0, air: 0, transient: 0 }
    }

    // Lightweight vocal/lead-melody envelope for live lighting.
    // This is not AI stem separation; it follows the vocal/melodic midrange
    // contour in a mixed track and keeps Slot 2 reserved for true bass.
    const lowNoise = averageFrequencyBand(data, sampleRate, fftSize, 35, 180)
    const body = averageFrequencyBand(data, sampleRate, fftSize, 180, 420)
    const vowel = averageFrequencyBand(data, sampleRate, fftSize, 420, 1100)
    const presence = averageFrequencyBand(data, sampleRate, fftSize, 1100, 3200)
    const air = averageFrequencyBand(data, sampleRate, fftSize, 3200, 6200)

    const leadCore = Math.max(
        vowel * 1.14 + presence * 0.58,
        body * 0.78 + presence * 0.74
    )
    const noisePenalty = Math.min(0.55, lowNoise * 0.38 + air * 0.22)
    const raw = clamp01(leadCore - noisePenalty)

    const floor = adaptiveFloor <= 0.0001 && previousRaw <= 0.0001
        ? raw
        : raw > adaptiveFloor
            ? adaptiveFloor * 0.94 + raw * 0.06
            : adaptiveFloor * 0.82 + raw * 0.18

    const sensitivity = Math.max(0.5, Math.min(4, boostLevel || 1))
    const gate = Math.max(0.018, floor * (1.12 - sensitivity * 0.035) + (0.04 - sensitivity * 0.006))
    const aboveFloor = Math.max(0, raw - gate)
    const rise = Math.max(0, raw - previousRaw)
    const transient = clamp01(rise * 6.4)
    const sustained = clamp01(aboveFloor * 2.15)
    const shaped = sustained * 0.58 + transient * 0.88
    const curve = Math.max(0.42, 0.84 - sensitivity * 0.055)
    const energy = clamp01(Math.pow(shaped, curve))

    return { energy, raw, floor, body, vowel, presence, air, transient }
}

export const applyPeakHold = ({
    bandsL,
    bandsR,
    bassEnergy,
    peakHoldL,
    peakHoldR,
    peakHoldBass,
    decayRate = 0.96
}) => {
    for (let i = 0; i < 16; i++) {
        peakHoldL[i] = Math.max(bandsL[i], peakHoldL[i] * decayRate)
        peakHoldR[i] = Math.max(bandsR[i], peakHoldR[i] * decayRate)
    }

    const nextPeakBass = Math.max(bassEnergy, peakHoldBass * decayRate)

    return {
        peakHoldL,
        peakHoldR,
        peakHoldBass: nextPeakBass,
        bassSmooth: nextPeakBass
    }
}

export const computeStereoWidth = (bandsL, bandsR) => {
    let diffSum = 0
    for (let i = 0; i < 16; i++) diffSum += Math.abs(bandsL[i] - bandsR[i])
    return diffSum / 16
}

export const computeLowMid = (bandsL, bandsR) => {
    const lowMidL = bandsL.slice(2, 7).reduce((a, b) => a + b, 0) / 5
    const lowMidR = bandsR.slice(2, 7).reduce((a, b) => a + b, 0) / 5
    return {
        lowMidL,
        lowMidR,
        lowMidAvg: (lowMidL + lowMidR) / 2
    }
}

export const computeMidHigh = (bandsL, bandsR) => ({
    midHighL: bandsL.slice(4).reduce((a, b) => a + b, 0) / 12,
    midHighR: bandsR.slice(4).reduce((a, b) => a + b, 0) / 12
})

export const buildSpatialResponse = ({ midHighL, bassSmooth, midHighR, vocalPulse = 0 }) => ({
    left: Math.min(1.0, midHighL * 1.12 + vocalPulse * 0.34),
    center: Math.min(1.0, bassSmooth * 1.0),
    right: Math.min(1.0, midHighR * 1.12 + vocalPulse * 0.34)
})

export const buildSpectralResponse = (bandsL, bandsR) => {
    const spectral = new Array(16)
    for (let i = 0; i < 16; i++) {
        const val = (bandsL[i] + bandsR[i]) / 2
        spectral[i] = Math.min(1.0, val * 1.5)
    }
    return spectral
}

export const buildFrameTelemetry = ({
    bassEnergy,
    bandsL,
    bandsR,
    peakHoldL,
    peakHoldR,
    midEnergy,
    vocalEnergy = 0,
    stereoWidth
}) => {
    const avgEnergy = (bandsL.reduce((a, b) => a + b, 0) + bandsR.reduce((a, b) => a + b, 0)) / 32
    const transientRatio = avgEnergy > 0.01
        ? Math.max(...peakHoldL, ...peakHoldR) / avgEnergy
        : 0

    return {
        lowEndDynamics: Math.round(Math.sqrt(bassEnergy) * 100),
        transientDensity: Math.round(transientRatio * 50),
        midRms: Math.round(midEnergy * 100),
        vocalDynamics: Math.round(Math.sqrt(vocalEnergy) * 100),
        stereoWidth: Math.round(stereoWidth * 100)
    }
}

export const detectStableGenre = ({
    bassEnergy,
    bandsL,
    bandsR,
    lowMidAvg,
    peakHoldL,
    peakHoldR,
    genreHistory,
    stereoWidth
}) => {
    const bassRMS = Math.sqrt(bassEnergy)
    const midL = bandsL.slice(4, 10).reduce((a, b) => a + b, 0) / 6
    const midR = bandsR.slice(4, 10).reduce((a, b) => a + b, 0) / 6
    const midRms = (midL + midR) / 2
    const peakMax = Math.max(...peakHoldL, ...peakHoldR)
    const avgEnergy = (bandsL.reduce((a, b) => a + b, 0) + bandsR.reduce((a, b) => a + b, 0)) / 32
    const transientRatio = avgEnergy > 0.01 ? peakMax / avgEnergy : 0
    const dynamicRange = peakMax - avgEnergy

    let genre = 'CHILL'
    if (bassRMS > 0.5 && transientRatio > 1.8) genre = 'ELECTRO'
    else if (midRms > 0.4 && transientRatio > 1.2) genre = 'ROCK'
    else if (lowMidAvg > 0.35 && transientRatio > 1.0 && transientRatio < 1.5) genre = 'LATIN'
    else if (dynamicRange > 0.6 && transientRatio > 2.0) genre = 'CINEMA'

    const nextHistory = [...genreHistory, genre].slice(-5)
    const counts = { ELECTRO: 0, ROCK: 0, CHILL: 0, LATIN: 0, CINEMA: 0 }
    nextHistory.forEach((value) => { counts[value]++ })
    const stableGenre = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]

    return {
        stableGenre,
        nextHistory,
        telemetry: {
            lowEndDynamics: Math.round(bassRMS * 100),
            transientDensity: Math.round(transientRatio * 50),
            midRms: Math.round(midRms * 100),
            stereoWidth: Math.round(stereoWidth * 100)
        }
    }
}
