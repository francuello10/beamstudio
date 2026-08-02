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
