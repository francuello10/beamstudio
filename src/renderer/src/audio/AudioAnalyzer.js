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

export const computeBassEnergy = (dataBass) => {
    let bassEnergy = 0
    for (let i = 0; i < 3; i++) bassEnergy += dataBass[i]
    return bassEnergy / 3 / 255
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

export const buildSpatialResponse = ({ midHighL, bassSmooth, midHighR }) => ({
    left: Math.min(1.0, midHighL * 1.2),
    center: Math.min(1.0, bassSmooth * 1.0),
    right: Math.min(1.0, midHighR * 1.2)
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
